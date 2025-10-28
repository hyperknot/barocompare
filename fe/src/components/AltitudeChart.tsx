import * as echarts from 'echarts'
import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { CalibrationInfo, IGCFileWithMetadata, TimeRange } from '../types'
import type { CalibrationMethod } from '../utils/baro-calibration'
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
      axisPointer: { type: 'cross', snap: true },
      formatter: () => '',
      backgroundColor: 'transparent',
      borderWidth: 0,
      textStyle: { color: 'transparent' },
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

    const start = dataZoom.start ?? 0
    const end = dataZoom.end ?? 100
    const totalRange = timeRange.end - timeRange.start
    const xMin = timeRange.start + (totalRange * start) / 100
    const xMax = timeRange.start + (totalRange * end) / 100

    const yRange = calculateYRange(series, xMin, xMax)

    chartInstance.setOption({ yAxis: { min: yRange.min, max: yRange.max } }, false)
  }

  onMount(() => {
    if (chartRef) {
      const chartInstance = echarts.init(chartRef)
      setChart(chartInstance)

      chartInstance.on('dataZoom', () => {
        updateYAxisForCurrentZoom(chartInstance)
      })

      chartInstance.on('restore', () => {
        const series = currentSeries()
        const timeRange = fullTimeRange()

        if (series.length > 0 && timeRange) {
          const initialYRange = calculateYRange(series, timeRange.start, timeRange.end)
          chartInstance.setOption(
            { yAxis: { min: initialYRange.min, max: initialYRange.max } },
            false,
          )
        }
      })

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
              const config = SERIES_CONFIGS[s.name as keyof typeof SERIES_CONFIGS]
              values.push({
                name: s.name,
                value: closestPoint[1],
                color: config?.color || '#666',
              })
              dataMap[s.name] = closestPoint[1]
            }
          })

          if (dataMap.gps2 !== undefined && dataMap.gps1 !== undefined) {
            values.push({
              name: 'gps2 - gps1',
              value: dataMap.gps2 - dataMap.gps1,
              color: '#6b7280',
            })
          }

          if (dataMap.baro2 !== undefined && dataMap.baro1 !== undefined) {
            values.push({
              name: 'baro2 - baro1',
              value: dataMap.baro2 - dataMap.baro1,
              color: '#6b7280',
            })
          }

          setHoverData({ timestamp, values })
        }
      })

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
      setCurrentSeries([])
      setFullTimeRange(null)
      return
    }

    let calibration: CalibrationInfo | null = null
    let timeRange: TimeRange | null = null

    if (file1 && file2 && file1.fixes.length > 0 && file2.fixes.length > 0) {
      const useAllShared = method === 'linear-alt' || method === 'linear-press'

      calibration = calculateBaroCalibration(file1, file2, {
        method,
        referenceMode: 'avg-gps',
        useAllShared,
        calibrationSeconds: 60,
        robust: true,
      })

      setCalibrationInfo(calibration)
      timeRange = findCommonTimeRange(file1, file2)
    } else {
      setCalibrationInfo(null)
    }

    const timeRangeFilter = createTimeRangeFilter(timeRange)

    const series: Array<any> = []

    if (file1 && file1.fixes.length > 0) {
      series.push(createSeries(file1, 'gps1', null, timeRangeFilter))
      series.push(
        createSeries(file1, 'baro1', calibration?.calibrateBaro1 ?? null, timeRangeFilter),
      )
    }

    if (file2 && file2.fixes.length > 0) {
      series.push(createSeries(file2, 'gps2', null, timeRangeFilter))
      series.push(
        createSeries(file2, 'baro2', calibration?.calibrateBaro2 ?? null, timeRangeFilter),
      )
    }

    setCurrentSeries(series)
    setFullTimeRange(timeRange)

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
