"""Unit tests for the alarm engine Phase-2 features."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any
from unittest.mock import patch

from src.services.alarm_engine import AlarmEngine
from src.services.alarm_engine import _filter_detections_by_zone
from src.services.alarm_engine import _point_in_polygon

# ── Test fixtures ───────────────────────────────────────────────────────


@dataclass
class FakeAlarm:
    id: int = 1
    stream_id: int = 1
    name: str = "test-alarm"
    is_active: bool = True
    severity: str = "warning"
    trigger_type: str = "class_present"
    trigger_config: dict[str, Any] = None
    zone_id: int | None = None
    min_on_seconds: float = 0.0
    min_off_seconds: float = 0.0
    cooldown_seconds: float = 0.0
    schedule: list | None = None


@dataclass
class FakeEvent:
    timestamp: float
    detections: list[dict[str, Any]]
    frame_width: int = 100
    frame_height: int = 100


def _det(class_name="person", confidence=0.9, bbox=(10, 10, 30, 30), track_id=None):
    return {
        "class_name": class_name,
        "confidence": confidence,
        "bbox": list(bbox),
        "track_id": track_id,
    }


# ── _point_in_polygon ───────────────────────────────────────────────────


def test_point_in_polygon_square():
    # Arrange
    sq = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)]

    # Act & Assert
    assert _point_in_polygon(5, 5, sq) is True
    assert _point_in_polygon(15, 5, sq) is False
    assert _point_in_polygon(-1, 5, sq) is False
    assert _point_in_polygon(5, 15, sq) is False


def test_point_in_polygon_triangle():
    # Arrange
    tri = [(0.0, 0.0), (10.0, 0.0), (5.0, 10.0)]

    # Act & Assert
    assert _point_in_polygon(5, 1, tri) is True
    assert _point_in_polygon(0, 5, tri) is False


# ── zone filtering ──────────────────────────────────────────────────────


def test_zone_filter_keeps_only_inside():
    # Arrange: frame is 100x100. Polygon covers left half (0..0.5 in x).
    poly = [(0.0, 0.0), (0.5, 0.0), (0.5, 1.0), (0.0, 1.0)]
    inside = _det(bbox=(10, 10, 30, 30))  # center (20,20) → inside
    outside = _det(bbox=(70, 10, 90, 30))  # center (80,20) → outside

    # Act
    result = _filter_detections_by_zone([inside, outside], poly, (100, 100))

    # Assert
    assert result == [inside]


def test_zone_filter_no_polygon_returns_all():
    # Arrange
    d = _det()

    # Act & Assert
    assert _filter_detections_by_zone([d], None, (100, 100)) == [d]


# ── Engine integration: zone filtering applied to class_present ─────────


def test_class_present_with_zone_only_inside_counts():
    # Arrange
    alarm = FakeAlarm(
        trigger_type="class_present",
        trigger_config={"class_names": ["person"], "min_confidence": 0.5},
        zone_id=1,
    )
    poly = [(0.0, 0.0), (0.5, 0.0), (0.5, 1.0), (0.0, 1.0)]  # left half
    engine = AlarmEngine(stream_id=1)
    engine.load_rules([alarm], zones_by_id={1: poly})

    # Act: detection only in right half → zone filter excludes it
    ev = FakeEvent(
        timestamp=time.time(),
        detections=[_det(bbox=(70, 10, 90, 30))],
    )
    engine.evaluate(ev, frame=None)

    # Assert: no alarm fires
    assert engine.drain_deltas() == []

    # Act: now a detection in the zone
    ev2 = FakeEvent(
        timestamp=time.time(),
        detections=[_det(bbox=(10, 10, 30, 30))],
    )
    engine.evaluate(ev2, frame=None)

    # Assert: alarm opens
    deltas = engine.drain_deltas()
    assert len(deltas) == 1
    assert deltas[0].event_type == "open"


# ── zone_enter trigger ──────────────────────────────────────────────────


def test_zone_enter_fires_on_new_track_only():
    # Arrange
    alarm = FakeAlarm(
        trigger_type="zone_enter",
        trigger_config={"class_names": ["person"], "min_confidence": 0.5},
        zone_id=1,
    )
    # Whole-frame polygon (so spatial filter is a no-op)
    poly = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    engine = AlarmEngine(stream_id=1)
    engine.load_rules([alarm], zones_by_id={1: poly})
    t0 = time.time()

    # Act: frame 1, track_id=7 enters
    engine.evaluate(
        FakeEvent(timestamp=t0, detections=[_det(track_id=7)]),
        frame=None,
    )

    # Assert: fires open for track 7
    d1 = engine.drain_deltas()
    assert len(d1) == 1
    assert d1[0].event_type == "open"
    assert d1[0].matched_track_ids == [7]

    # Act: frame 2, same track_id=7 still present
    engine.evaluate(
        FakeEvent(timestamp=t0 + 0.1, detections=[_det(track_id=7)]),
        frame=None,
    )

    # Assert: no new "open" (already open, no new entry)
    d2 = engine.drain_deltas()
    assert d2 == []  # no new entries, alarm stays open


def test_zone_enter_new_track_after_first():
    # Arrange
    alarm = FakeAlarm(
        trigger_type="zone_enter",
        trigger_config={"class_names": ["person"], "min_confidence": 0.5},
        zone_id=1,
        min_off_seconds=0.05,
    )
    poly = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    engine = AlarmEngine(stream_id=1)
    engine.load_rules([alarm], zones_by_id={1: poly})
    t0 = time.time()

    # Act: track 7 enters, then leaves, then min_off elapses
    engine.evaluate(FakeEvent(timestamp=t0, detections=[_det(track_id=7)]), frame=None)
    engine.drain_deltas()  # consume open
    # Track 7 leaves → condition false → start min_off clock
    engine.evaluate(FakeEvent(timestamp=t0 + 0.1, detections=[]), frame=None)
    # Tick again past min_off_seconds → alarm closes
    engine.evaluate(FakeEvent(timestamp=t0 + 0.5, detections=[]), frame=None)

    # Assert: alarm closed
    closed = engine.drain_deltas()
    assert any(d.event_type == "close" for d in closed)

    # Act: track 9 enters
    engine.evaluate(FakeEvent(timestamp=t0 + 1.0, detections=[_det(track_id=9)]), frame=None)

    # Assert: fires again for track 9
    opened = engine.drain_deltas()
    assert len(opened) == 1
    assert opened[0].matched_track_ids == [9]


# ── dwell trigger ───────────────────────────────────────────────────────


def test_dwell_fires_only_after_dwell_seconds():
    # Arrange
    alarm = FakeAlarm(
        trigger_type="dwell",
        trigger_config={
            "class_names": ["person"],
            "min_confidence": 0.5,
            "dwell_seconds": 2.0,
        },
        zone_id=1,
    )
    poly = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    engine = AlarmEngine(stream_id=1)
    engine.load_rules([alarm], zones_by_id={1: poly})
    t0 = time.time()

    # Act: first frame, track enters (dwell time = 0 < 2s)
    engine.evaluate(FakeEvent(timestamp=t0, detections=[_det(track_id=42)]), frame=None)

    # Assert: no fire yet
    assert engine.drain_deltas() == []

    # Act: 1 second later, still inside
    engine.evaluate(FakeEvent(timestamp=t0 + 1.0, detections=[_det(track_id=42)]), frame=None)

    # Assert: still not enough dwell time
    assert engine.drain_deltas() == []

    # Act: 2.5s later, over threshold
    engine.evaluate(FakeEvent(timestamp=t0 + 2.5, detections=[_det(track_id=42)]), frame=None)

    # Assert: fires
    deltas = engine.drain_deltas()
    assert len(deltas) == 1
    assert deltas[0].event_type == "open"
    assert deltas[0].matched_track_ids == [42]


def test_dwell_resets_when_track_leaves():
    # Arrange
    alarm = FakeAlarm(
        trigger_type="dwell",
        trigger_config={
            "class_names": ["person"],
            "min_confidence": 0.5,
            "dwell_seconds": 2.0,
        },
        zone_id=1,
    )
    poly = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    engine = AlarmEngine(stream_id=1)
    engine.load_rules([alarm], zones_by_id={1: poly})
    t0 = time.time()

    # Act: track enters, leaves, then re-enters (resetting dwell clock)
    engine.evaluate(FakeEvent(timestamp=t0, detections=[_det(track_id=42)]), frame=None)
    # track leaves
    engine.evaluate(FakeEvent(timestamp=t0 + 1.0, detections=[]), frame=None)
    # comes back → entry-time resets
    engine.evaluate(FakeEvent(timestamp=t0 + 1.1, detections=[_det(track_id=42)]), frame=None)
    engine.drain_deltas()
    # Only 1s after re-entry → still no fire
    engine.evaluate(FakeEvent(timestamp=t0 + 2.0, detections=[_det(track_id=42)]), frame=None)

    # Assert: dwell clock reset, so no fire
    assert engine.drain_deltas() == []


# ── schedule ────────────────────────────────────────────────────────────


def test_schedule_outside_window_forces_condition_false():
    # Arrange: schedule only Monday 8..9. We mock datetime.now() to be Sunday → out.
    alarm = FakeAlarm(
        trigger_type="class_present",
        trigger_config={"class_names": ["person"], "min_confidence": 0.5},
        schedule=[{"weekdays": [0], "start_hour": 8, "end_hour": 9}],
    )
    engine = AlarmEngine(stream_id=1)
    engine.load_rules([alarm], zones_by_id={})

    from datetime import datetime as _dt

    class _SundayNoon(_dt):
        @classmethod
        def now(cls, tz=None):  # type: ignore[override]
            # Sunday=6, hour=12 → outside window
            return _dt(2024, 1, 7, 12, 0, 0)

    # Act
    with patch("src.services.alarm_engine.datetime", _SundayNoon):
        engine.evaluate(
            FakeEvent(timestamp=time.time(), detections=[_det(track_id=1)]),
            frame=None,
        )

    # Assert: outside window → no alarm
    assert engine.drain_deltas() == []


def test_schedule_inside_window_allows_open():
    # Arrange
    alarm = FakeAlarm(
        trigger_type="class_present",
        trigger_config={"class_names": ["person"], "min_confidence": 0.5},
        schedule=[{"weekdays": [0, 1, 2, 3, 4, 5, 6], "start_hour": 0, "end_hour": 24}],
    )
    engine = AlarmEngine(stream_id=1)
    engine.load_rules([alarm], zones_by_id={})

    # Act
    engine.evaluate(
        FakeEvent(timestamp=time.time(), detections=[_det(track_id=1)]),
        frame=None,
    )

    # Assert: inside window → alarm opens
    deltas = engine.drain_deltas()
    assert len(deltas) == 1
    assert deltas[0].event_type == "open"


# ── evaluate_once (stateless test endpoint helper) ──────────────────────


def test_evaluate_once_basic():
    # Arrange
    alarm = FakeAlarm(
        trigger_type="class_present",
        trigger_config={"class_names": ["person"], "min_confidence": 0.5},
    )

    # Act
    res = AlarmEngine.evaluate_once(
        alarm_orm=alarm,
        zone_orm=None,
        detections=[{"class_name": "person", "confidence": 0.9, "bbox": [0, 0, 10, 10], "track_id": 3}],
        frame_shape=(100, 100),
    )

    # Assert
    assert res["condition_met"] is True
    assert res["in_schedule"] is True
    assert res["peak_count"] == 1
