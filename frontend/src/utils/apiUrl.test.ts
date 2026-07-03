import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAlarmWsUrl, buildDetectionsWsUrl, buildSnapshotUrl, getApiBaseUrl } from './apiUrl'

const originalLocation = window.location

function setLocation(props: { protocol?: string; host?: string }) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...originalLocation,
      protocol: props.protocol ?? 'http:',
      host: props.host ?? 'localhost:3000',
    },
  })
}

describe('apiUrl', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    setLocation({})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  describe('getApiBaseUrl', () => {
    it('returns the default base url when VITE_API_URL is unset', () => {
      // Arrange

      // Act & Assert
      expect(getApiBaseUrl()).toBe('/api/v1')
    })

    it('returns a configured absolute url without trailing slashes', () => {
      // Arrange
      vi.stubEnv('VITE_API_URL', 'https://api.example.com/v1///')

      // Act & Assert
      expect(getApiBaseUrl()).toBe('https://api.example.com/v1')
    })
  })

  describe('buildAlarmWsUrl', () => {
    it('derives a ws url from an absolute http base', () => {
      // Arrange
      vi.stubEnv('VITE_API_URL', 'http://api.example.com/v1')

      // Act & Assert
      expect(buildAlarmWsUrl()).toBe('ws://api.example.com/v1/ws/alarms')
    })

    it('derives a wss url from a relative base on an https page', () => {
      // Arrange
      setLocation({ protocol: 'https:', host: 'app.example.com' })

      // Act & Assert
      expect(buildAlarmWsUrl()).toBe('wss://app.example.com/api/v1/ws/alarms')
    })
  })

  describe('buildDetectionsWsUrl', () => {
    it('includes the stream id in the path', () => {
      // Arrange
      setLocation({ protocol: 'http:', host: 'localhost:8080' })

      // Act & Assert
      expect(buildDetectionsWsUrl(42)).toBe('ws://localhost:8080/api/v1/ws/streams/42/detections')
    })
  })

  describe('buildSnapshotUrl', () => {
    it('builds a snapshot url from the base', () => {
      // Arrange

      // Act & Assert
      expect(buildSnapshotUrl(7)).toBe('/api/v1/streams/7/snapshot')
    })
  })
})
