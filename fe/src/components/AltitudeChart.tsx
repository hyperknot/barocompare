import type { Component } from 'solid-js'
import { createEffect, createSignal, onMount, onCleanup, Show } from 'solid-js'
import * as echarts from 'echarts'
import type { IGCFileWithMetadata, CalibrationInfo, TimeRange } from '../types'
import {
  calculateBaroCalibration,
  findCommonTimeRange,
  createTimeRangeFilter
} from '../utils/chart-calculations'
import { CalibrationInfoPanel } from './CalibrationInfo'
import { FileInfoPanel } from './FileInfo'

interface AltitudeChartProps {
  file1Data: IGCFileWithMetadata | null
  file2Data: IGCFileWithMetadata | null
}

interface SeriesConfig {
  name: string
  color: string
}

const SERIES_CONFIGS: Record<string, SeriesConfig> = {
  gps1: { name: 'gps1', color: '#3b82f6' },
  gps2: { name: 'gps2', color: '#10b981' },
  baro1: { name: 'baro1', color: '#ef4444' },
  baro2: { name: 'baro2', color: '#f97316' }
}

function createSeries(
  file: IGCFileWithMetadata,
  seriesKey: 'gps1' | 'gps2' | 'baro1' | 'baro2',
  baroOffset: number,
  timeRangeFilter: (fix: any) => boolean
) {
  const config = SERIES_CONFIGS[seriesKey]
  const isGPS = seriesKey.startsWith('gps')

  return {
    name: config.name,
    type: 'line',
    data: file.fixes
      .filter(timeRangeFilter)
      .flatMap(fix => {
        const altitude = isGPS ? fix.gpsAltitude : fix.pressureAltitude
        if (altitude === null) return []
        return [[fix.timestamp, altitude + (isGPS ? 0 : baroOffset)]]
      }),
    smooth: false,
    symbol: 'none',
    lineStyle: { width: 2, color: config.color },
    itemStyle: { color: config.color }
  }
}

function calculateYRange(series: any[], xMin: number, xMax: number): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity

  series.forEach(s => {
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
    min: min === Infinity ? 0 : Math.floor(min - padding),
    max: max === -Infinity ? 1000 : Math.ceil(max + padding)
  }
}

function createChartOption(
  series: any[],
  timeRange: TimeRange | null,
  yMin?: number,
  yMax?: number
): echarts.EChartsOption {
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return ''
        const timestamp = params[0].value[0]
        const timeStr = new Date(timestamp).toLocaleTimeString()
        let result = `<strong>${timeStr}</strong><br/>`
        params.forEach((param: any) => {
          result += `${param.marker} ${param.seriesName}: ${param.value[1].toFixed(0)} m<br/>`
        })
        return result
      }
    },
    legend: {
      data: series.map(s => s.name),
      top: 10,
      type: 'scroll'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: 60,
      containLabel: true
    },
    toolbox: {
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: { zoom: 'Zoom', back: 'Reset Zoom' }
        },
        restore: { title: 'Restore' },
        saveAsImage: { title: 'Save as Image' }
      }
    },
    xAxis: {
      type: 'time',
      min: timeRange?.start,
      max: timeRange?.end,
      axisLabel: {
        formatter: (value: number) => new Date(value).toLocaleTimeString()
      }
    },
    yAxis: {
      type: 'value',
      name: 'Altitude (m)',
      min: yMin,
      max: yMax,
      axisLabel: { formatter: '{value} m' }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: true
      },
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: 30,
        bottom: 60
      }
    ],
    series
  }
}

export const AltitudeChart: Component<AltitudeChartProps> = (props) => {
  let chartRef: HTMLDivElement | undefined
  const [chart, setChart] = createSignal<echarts.ECharts | null>(null)
  const [calibrationInfo, setCalibrationInfo] = createSignal<CalibrationInfo | null>(null)
  const [currentSeries, setCurrentSeries] = createSignal<any[]>([])
  const [fullTimeRange, setFullTimeRange] = createSignal<TimeRange | null>(null)

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
    const xMin = timeRange.start + (totalRange * start / 100)
    const xMax = timeRange.start + (totalRange * end / 100)

    // Calculate Y range for visible data
    const yRange = calculateYRange(series, xMin, xMax)

    // Update Y-axis with new range
    chartInstance.setOption({
      yAxis: {
        min: yRange.min,
        max: yRange.max
      }
    }, false)
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
          chartInstance.setOption({
            yAxis: {
              min: initialYRange.min,
              max: initialYRange.max
            }
          }, false)
        }
      })

      const handleResize = () => chartInstance.resize()
      window.addEventListener('resize', handleResize)

      onCleanup(() => {
        window.removeEventListener('resize', handleResize)
        chartInstance.off('dataZoom')
        chartInstance.off('restore')
        chartInstance.dispose()
      })
    }
  })

  createEffect(() => {
    const chartInstance = chart()
    if (!chartInstance) return

    const file1 = props.file1Data
    const file2 = props.file2Data

    if (!file1 && !file2) {
      chartInstance.clear()
      setCalibrationInfo(null)
      setCurrentSeries([])
      setFullTimeRange(null)
      return
    }

    let calibration: CalibrationInfo | null = null
    let timeRange: TimeRange | null = null

    // Calculate calibration and time range if both files are present
    if (file1 && file2 && file1.fixes.length > 0 && file2.fixes.length > 0) {
      calibration = calculateBaroCalibration(file1, file2)
      setCalibrationInfo(calibration)
      timeRange = findCommonTimeRange(file1, file2)
    } else {
      setCalibrationInfo(null)
    }

    const baro1Offset = calibration?.baro1Offset || 0
    const baro2Offset = calibration?.baro2Offset || 0
    const timeRangeFilter = createTimeRangeFilter(timeRange)

    const series: any[] = []

    // Add all series
    if (file1 && file1.fixes.length > 0) {
      series.push(createSeries(file1, 'gps1', 0, timeRangeFilter))
      series.push(createSeries(file1, 'baro1', baro1Offset, timeRangeFilter))
    }

    if (file2 && file2.fixes.length > 0) {
      series.push(createSeries(file2, 'gps2', 0, timeRangeFilter))
      series.push(createSeries(file2, 'baro2', baro2Offset, timeRangeFilter))
    }

    // Store series and time range for zoom calculations
    setCurrentSeries(series)
    setFullTimeRange(timeRange)

    // Calculate initial Y range for full data
    const initialYRange = timeRange
      ? calculateYRange(series, timeRange.start, timeRange.end)
      : { min: undefined, max: undefined }

    const option = createChartOption(
      series,
      timeRange,
      initialYRange.min,
      initialYRange.max
    )
    chartInstance.setOption(option, true)
  })

  return (
    <div class="w-full border rounded-lg p-4 bg-white shadow-sm">

      <Show when={calibrationInfo()}>
        <CalibrationInfoPanel info={calibrationInfo()!} />
      </Show>

      <FileInfoPanel file1Data={props.file1Data} file2Data={props.file2Data} />

      <div
        ref={chartRef}
        class="w-full"
        style={{ height: '600px' }}
      />
    </div>
  )
}