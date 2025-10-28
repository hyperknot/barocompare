import * as echarts from 'echarts'
import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { CalibrationInfo, IGCFileWithMetadata, TimeRange } from '../types'
import { buildCalibrator, type CalibrationMethod } from '../utils/baro-calibration'
import {
  calculateBaroCalibration,
  createTimeRangeFilter,
  findCommonTimeRange,
} from '../utils/chart-calculations'
import { CalibrationInfoPanel } from './CalibrationInfo'
import { CalibrationSettings } from './CalibrationSettings'
import { FileInfoPanel } from './FileInfo'

interface AltitudeChartProps {
  file1Data: IGCFileWithMetadata | null
  file2Data: IGCFileWithMetadata | null
}

interface SeriesConfig {
  name: string
  color: string
}

interface HoverData {
  timestamp: number
  values: Array<{ name: string; value: number; color: string }>
}

const SERIES_CONFIGS: Record<string, SeriesConfig> = {
  gps1: { name: 'gps1', color: '#3b82f6' },
  gps2: { name: 'gps2', color: '#10b981' },
  baro1: { name: 'baro1', color: '#ef4444' },
  baro2: { name: 'baro2', color: '#f97316' },
}

function createSeries(
  file: IGCFileWithMetadata,
  seriesKey: 'gps1' | 'gps2' | 'baro1' | 'baro2',
  calibrateFn: ((h: number) => number) | null,
  timeRangeFilter: (fix: any) => boolean,
) {
  const config = SERIES_CONFIGS[seriesKey]
  const isGPS = seriesKey.startsWith('gps')

  return {
    name: config.name,
    type: 'line',
    data: file.fixes.filter(timeRangeFilter).flatMap((fix) => {
      const altitude = isGPS ? fix.gpsAltitude : fix.pressureAltitude
      if (altitude === null) return []
      const calibrated = isGPS || !calibrateFn ? altitude : calibrateFn(altitude)
      return [[fix.timestamp, calibrated]]
    }),
    smooth: false,
    symbol: 'none',
    lineStyle: { width: 2, color: config.color },
    itemStyle: { color: config.color },
  }
}

function calculateYRange(
  series: Array<any>,
  xMin: number,
  xMax: number,
): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  series.forEach((s) => {
    if (s.data && Array.isArray(s.data)) {
      s.data.forEach((point: [number, number]) => {
        const [x, y] = point
        if (x >= xMin && x <= xMax) {
          if (y < min) min = y
          if (y > max) max = y
        }
      })
    }
  })

  // Add 5% padding to top and bottom
  const range = max - min
  const padding = range * 0.05

  return {
    min: min === Number.POSITIVE_INFINITY ? 0 : Math.floor(min - padding),
    max: max === Number.NEGATIVE_INFINITY ? 1000 : Math.ceil(max + padding),
  }
}

function createChartOption(
  series: Array<any>,
  timeRange: TimeRange | null,
  yMin?: number,
  yMax?: number,
): echarts.EChartsOption {
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        snap: true, // Helps snap to nearest data point
      },
      // Keep tooltip enabled but hide it by returning empty content
      formatter: () => '',
      // Make it completely invisible
      backgroundColor: 'transparent',
      borderWidth: 0,
      textStyle: {
        color: 'transparent',
      },
    },
    legend: {
      data: series.map((s) => s.name),
      top: 10,
      type: 'scroll',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: 60,
      containLabel: true,
    },
    toolbox: {
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: { zoom: 'Zoom', back: 'Reset Zoom' },
        },
        restore: { title: 'Restore' },
        saveAsImage: { title: 'Save as Image' },
      },
    },
    xAxis: {
      type: 'time',
      min: timeRange?.start,
      max: timeRange?.end,
      axisLabel: {
        formatter: (value: number) => new Date(value).toLocaleTimeString(),
      },
    },
    yAxis: {
      type: 'value',
      name: 'Altitude (m)',
      min: yMin,
      max: yMax,
      axisLabel: { formatter: '{value} m' },
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: true,
      },
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: 30,
        bottom: 60,
      },
    ],
    series,
  }
}

export const AltitudeChart: Component<AltitudeChartProps> = (props) => {
  let chartRef: HTMLDivElement | undefined
  const [chart, setChart] = createSignal<echarts.ECharts | null>(null)
  const [calibrationInfo, setCalibrationInfo] = createSignal<CalibrationInfo | null>(null)
  const [calibrateBaro1, setCalibrateBaro1] = createSignal<((h: number) => number) | null>(null)
  const [calibrateBaro2, setCalibrateBaro2] = createSignal<((h: number) => number) | null>(null)
  const [currentSeries, setCurrentSeries] = createSignal<Array<any>>([])
  const [fullTimeRange, setFullTimeRange] = createSignal<TimeRange | null>(null)
  const [selectedMethod, setSelectedMethod] = createSignal<CalibrationMethod>('linear-alt')
  const [hoverData, setHoverData] = createSignal<HoverData | null>(null)

  const updateYAxisForCurrentZoom = (chartInstance: echarts.ECharts) => {
    const option = chartInstance.getOption() as any
    const dataZoom = option.dataZoom?.[0]
    const series = currentSeries()
    const timeRange = fullTimeRange()

    if (!dataZoom || !timeRange || series.length === 0) return

    // Get current zoom range
    const start = dataZoom.start ?? 0
    const end = dataZoom.end ?? 100
    const totalRange = timeRange.end - timeRange.start
    const xMin = timeRange.start + (totalRange * start) / 100
    const xMax = timeRange.start + (totalRange * end) / 100

    // Calculate Y range for visible data
    const yRange = calculateYRange(series, xMin, xMax)

    // Update Y-axis with new range
    chartInstance.setOption(
      {
        yAxis: {
          min: yRange.min,
          max: yRange.max,
        },
      },
      false,
    )
  }

  onMount(() => {
    if (chartRef) {
      const chartInstance = echarts.init(chartRef)
      setChart(chartInstance)

      // Listen to dataZoom events (handles slider, mouse wheel, and rectangle selection)
      chartInstance.on('dataZoom', () => {
        updateYAxisForCurrentZoom(chartInstance)
      })

      // Listen to restore events (when user clicks "Reset Zoom")
      chartInstance.on('restore', () => {
        const series = currentSeries()
        const timeRange = fullTimeRange()

        if (series.length > 0 && timeRange) {
          const initialYRange = calculateYRange(series, timeRange.start, timeRange.end)
          chartInstance.setOption(
            {
              yAxis: {
                min: initialYRange.min,
                max: initialYRange.max,
              },
            },
            false,
          )
        }
      })

      // Capture hover data for fixed display
      chartInstance.on('updateAxisPointer', (event: any) => {
        const axesInfo = event.axesInfo
        const xAxisInfo = axesInfo[0]

        if (xAxisInfo && xAxisInfo.value != null) {
          const timestamp = xAxisInfo.value
          const option = chartInstance.getOption() as any
          const series = option.series || []

          const values: Array<{ name: string; value: number; color: string }> = []
          const dataMap: Record<string, number> = {}

          series.forEach((s: any) => {
            if (!s.data || !Array.isArray(s.data)) return

            // Find the closest point to the hovered timestamp
            let closestPoint: [number, number] | null = null
            let minDiff = Number.POSITIVE_INFINITY

            s.data.forEach((point: [number, number]) => {
              const diff = Math.abs(point[0] - timestamp)
              if (diff < minDiff) {
                minDiff = diff
                closestPoint = point
              }
            })

            if (closestPoint && minDiff < 10000) {
              // Within 10 seconds
              const config = SERIES_CONFIGS[s.name as keyof typeof SERIES_CONFIGS]
              values.push({
                name: s.name,
                value: closestPoint[1],
                color: config?.color || '#666',
              })
              dataMap[s.name] = closestPoint[1]
            }
          })

          // Calculate differences
          if (dataMap.gps2 !== undefined && dataMap.gps1 !== undefined) {
            values.push({
              name: 'gps2 - gps1',
              value: dataMap.gps2 - dataMap.gps1,
              color: '#6b7280', // gray
            })
          }

          if (dataMap.baro2 !== undefined && dataMap.baro1 !== undefined) {
            values.push({
              name: 'baro2 - baro1',
              value: dataMap.baro2 - dataMap.baro1,
              color: '#6b7280', // gray
            })
          }

          setHoverData({ timestamp, values })
        }
      })

      // Clear hover data when mouse leaves
      chartInstance.getZr().on('mouseout', () => {
        setHoverData(null)
      })

      const handleResize = () => chartInstance.resize()
      window.addEventListener('resize', handleResize)

      onCleanup(() => {
        window.removeEventListener('resize', handleResize)
        chartInstance.off('dataZoom')
        chartInstance.off('restore')
        chartInstance.off('updateAxisPointer')
        chartInstance.dispose()
      })
    }
  })

  createEffect(() => {
    const chartInstance = chart()
    if (!chartInstance) return

    const file1 = props.file1Data
    const file2 = props.file2Data
    const method = selectedMethod()

    if (!file1 && !file2) {
      chartInstance.clear()
      setCalibrationInfo(null)
      setCalibrateBaro1(null)
      setCalibrateBaro2(null)
      setCurrentSeries([])
      setFullTimeRange(null)
      return
    }

    let calibration: CalibrationInfo | null = null
    let timeRange: TimeRange | null = null

    // Calculate calibration and time range if both files are present
    if (file1 && file2 && file1.fixes.length > 0 && file2.fixes.length > 0) {
      // Determine if multi-point or single-point
      const useAllShared =
        method === 'linear-alt' || method === 'linear-press' || method === 'quadratic-alt'

      calibration = calculateBaroCalibration(file1, file2, {
        method,
        referenceMode: 'avg-gps',
        useAllShared,
        calibrationSeconds: 60,
        robust: true,
        verticalSpeedLimit: method.startsWith('linear') || method === 'quadratic-alt' ? 10 : null,
      })

      setCalibrationInfo(calibration)
      timeRange = findCommonTimeRange(file1, file2)

      const maps = createDataMapsLocal(file1, file2)
      const sharedSeconds = findSharedSecondsLocal(maps)
      const calibSeconds = useAllShared ? sharedSeconds : sharedSeconds.slice(0, 60)

      const refAlt = new Map<number, number>()
      for (const s of calibSeconds) {
        const g1 = maps.file1GpsMap.get(s)!
        const g2 = maps.file2GpsMap.get(s)!
        refAlt.set(s, (g1 + g2) / 2)
      }

      const buildPairs = (sensor: 1 | 2) => {
        const baroMap = sensor === 1 ? maps.file1BaroMap : maps.file2BaroMap
        const hRaw: Array<number> = []
        const hRef: Array<number> = []
        for (const s of calibSeconds) {
          const h = baroMap.get(s)
          const r = refAlt.get(s)
          if (h !== undefined && r !== undefined && Number.isFinite(h) && Number.isFinite(r)) {
            hRaw.push(h)
            hRef.push(r)
          }
        }
        return { hRaw, hRef }
      }

      const pairs1 = buildPairs(1)
      const pairs2 = buildPairs(2)

      const calibrator1 = buildCalibrator(pairs1.hRaw, pairs1.hRef, {
        method,
        robust: true,
      })
      const calibrator2 = buildCalibrator(pairs2.hRaw, pairs2.hRef, {
        method,
        robust: true,
      })

      setCalibrateBaro1(() => calibrator1.fn)
      setCalibrateBaro2(() => calibrator2.fn)
    } else {
      setCalibrationInfo(null)
      setCalibrateBaro1(null)
      setCalibrateBaro2(null)
    }

    const timeRangeFilter = createTimeRangeFilter(timeRange)

    const series: Array<any> = []

    // Add all series
    if (file1 && file1.fixes.length > 0) {
      series.push(createSeries(file1, 'gps1', null, timeRangeFilter))
      series.push(createSeries(file1, 'baro1', calibrateBaro1(), timeRangeFilter))
    }

    if (file2 && file2.fixes.length > 0) {
      series.push(createSeries(file2, 'gps2', null, timeRangeFilter))
      series.push(createSeries(file2, 'baro2', calibrateBaro2(), timeRangeFilter))
    }

    // Store series and time range for zoom calculations
    setCurrentSeries(series)
    setFullTimeRange(timeRange)

    // Calculate initial Y range for full data
    const initialYRange = timeRange
      ? calculateYRange(series, timeRange.start, timeRange.end)
      : { min: undefined, max: undefined }

    const option = createChartOption(series, timeRange, initialYRange.min, initialYRange.max)
    chartInstance.setOption(option, true)
  })

  return (
    <div class="w-full space-y-4">
      <Show when={props.file1Data && props.file2Data}>
        <CalibrationSettings selectedMethod={selectedMethod()} onMethodChange={setSelectedMethod} />
      </Show>

      <Show when={calibrationInfo()}>
        <CalibrationInfoPanel info={calibrationInfo()!} method={selectedMethod()} />
      </Show>

      <FileInfoPanel file1Data={props.file1Data} file2Data={props.file2Data} />

      <div class="relative">
        <div ref={chartRef} class="w-full" style={{ height: '600px' }} />

        {/* Fixed hover info panel */}
        <Show when={hoverData()}>
          <div class="absolute top-4 right-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[200px]">
            <div class="font-semibold text-sm mb-2 text-gray-700 dark:text-gray-300">
              {new Date(hoverData()!.timestamp).toLocaleTimeString()}
            </div>
            <div class="space-y-1">
              <For each={hoverData()!.values}>
                {(item) => (
                  <div class="flex items-center justify-between text-sm">
                    <div class="flex items-center gap-2">
                      <div class="w-3 h-3 rounded-full" style={{ background: item.color }} />
                      <span class="text-gray-600 dark:text-gray-400">{item.name}:</span>
                    </div>
                    <span class="font-mono font-semibold text-gray-900 dark:text-gray-100">
                      {item.value.toFixed(0)} m
                    </span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}

// Helper functions for local data processing
function createDataMapsLocal(file1: IGCFileWithMetadata, file2: IGCFileWithMetadata) {
  const maps = {
    file1BaroMap: new Map<number, number>(),
    file1GpsMap: new Map<number, number>(),
    file2BaroMap: new Map<number, number>(),
    file2GpsMap: new Map<number, number>(),
  }

  file1.fixes.forEach((fix) => {
    const secondTimestamp = Math.floor(fix.timestamp / 1000)
    if (fix.pressureAltitude !== null) {
      maps.file1BaroMap.set(secondTimestamp, fix.pressureAltitude)
    }
    if (fix.gpsAltitude !== null) {
      maps.file1GpsMap.set(secondTimestamp, fix.gpsAltitude)
    }
  })

  file2.fixes.forEach((fix) => {
    const secondTimestamp = Math.floor(fix.timestamp / 1000)
    if (fix.pressureAltitude !== null) {
      maps.file2BaroMap.set(secondTimestamp, fix.pressureAltitude)
    }
    if (fix.gpsAltitude !== null) {
      maps.file2GpsMap.set(secondTimestamp, fix.gpsAltitude)
    }
  })

  return maps
}

function findSharedSecondsLocal(maps: ReturnType<typeof createDataMapsLocal>): Array<number> {
  const sharedSeconds: Array<number> = []

  for (const [second] of maps.file1BaroMap) {
    if (
      maps.file1GpsMap.has(second) &&
      maps.file2BaroMap.has(second) &&
      maps.file2GpsMap.has(second)
    ) {
      sharedSeconds.push(second)
    }
  }

  return sharedSeconds.sort((a, b) => a - b)
}
