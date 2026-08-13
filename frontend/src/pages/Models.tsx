import React, { useCallback, useMemo } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import { useSearchParams } from 'react-router-dom'

import ActiveWorkersPanel from '../components/models/ActiveWorkersPanel'
import ModelCatalogPanel from '../components/models/ModelCatalogPanel'
import RuntimeDefaultsPanel from '../components/models/RuntimeDefaultsPanel'

type ModelsTabId = 'catalog' | 'runtime' | 'workers'

const TAB_IDS: ModelsTabId[] = ['catalog', 'runtime', 'workers']
const DEFAULT_TAB: ModelsTabId = 'catalog'

const isModelsTabId = (value: string | null): value is ModelsTabId =>
  value !== null && (TAB_IDS as string[]).includes(value)

const Models: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab: ModelsTabId = useMemo(() => {
    const param = searchParams.get('tab')
    return isModelsTabId(param) ? param : DEFAULT_TAB
  }, [searchParams])

  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, value: ModelsTabId) => {
      const next = new URLSearchParams(searchParams)
      if (value === DEFAULT_TAB) {
        next.delete('tab')
      } else {
        next.set('tab', value)
      }
      setSearchParams(next, { replace: false })
    },
    [searchParams, setSearchParams],
  )

  const goToRuntimeTab = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'runtime')
    setSearchParams(next, { replace: false })
  }, [searchParams, setSearchParams])

  return (
    <Box className="fade-in settings-page" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box className="page-header">
        <Box>
          <Typography variant="h4" className="page-header__title">
            Models
          </Typography>
          <Typography variant="body2" color="text.secondary" className="page-header__subtitle">
            Manage your AI model catalog, runtime defaults and active workers.
          </Typography>
        </Box>
      </Box>

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        <Tab value="catalog" label="Catalog" />
        <Tab value="runtime" label="Runtime" />
        <Tab value="workers" label="Workers" />
      </Tabs>

      {/*
        Only mount the active tab's panel so heavy polling (e.g. workers refetch
        every 2s) does not run while the user is on a different tab.
      */}
      {activeTab === 'catalog' && <ModelCatalogPanel onOpenRuntimeTab={goToRuntimeTab} />}
      {activeTab === 'runtime' && <RuntimeDefaultsPanel />}
      {activeTab === 'workers' && <ActiveWorkersPanel />}
    </Box>
  )
}

export default Models
