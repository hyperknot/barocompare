import type { Component } from 'solid-js'
import { createEffect, createSignal, onMount, onCleanup } from 'solid-js'
import type { IGCData } from '../types/igc'
import * as echarts from 'echarts'

interface AltitudeChartProps {
  file1Data: IGCData | null
  file2Data: IGCData | null
}

export const AltitudeChart: Component<AltitudeChartProps> = (props) => {
  let chartRef: HTMLDivElement | undefined
  const [chart, setChart] = createSignal<echarts.ECharts | null>(null)

  onMount(() => {
    if (chartRef) {
      const chartInstance = echarts.init(chartRef)
      setChart(chartInstance)

      const handleResize = () => {
        chartInstance.resize()
      }

      window.addEventListener('resize', handleResize)

      onCleanup(() => {
        window.removeEventListener('resize', handleResize)
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
      return
    }

    const series: any[] = []

    if (file1 && file1.fixes.length > 0) {
      series.push({
        name: file1.pilot || 'File 1',
        type: 'line',
        data: file1.fixes.map(fix => [fix.timestamp, fix.pressureAltitude]),
        smooth: false,
        symbol: 'none',
        lineStyle: {
          width: 2
        }
      })
    }

    if (file2 && file2.fixes.length > 0) {
      series.push({
        name: file2.pilot || 'File 2',
        type: 'line',
        data: file2.fixes.map(fix => [fix.timestamp, fix.pressureAltitude]),
        smooth: false,
        symbol: 'none',
        lineStyle: {
          width: 2
        }
      })
    }

    const option: echarts.EChartsOption = {
      title: {
        text: 'Barometric Altitude Comparison',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        formatter: (params: any) => {
          if (!Array.isArray(params)) return ''

          const timestamp = params[0].value[0]
          const date = new Date(timestamp)
          const timeStr = date.toLocaleTimeString()

          let result = `<strong>${timeStr}</strong><br/>`
          params.forEach((param: any) => {
            result += `${param.marker} ${param.seriesName}: ${param.value[1].toFixed(0)} m<br/>`
          })

          // Show difference if both files are present
          if (params.length === 2) {
            const diff = Math.abs(params[0].value[1] - params[1].value[1])
            result += `<br/><strong>Difference: ${diff.toFixed(0)} m</strong>`
          }

          return result
        }
      },
      legend: {
        data: series.map(s => s.name),
        top: 30
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: 80,
        containLabel: true
      },
      toolbox: {
        feature: {
          dataZoom: {
            yAxisIndex: 'none',
            title: {
              zoom: 'Zoom',
              back: 'Reset Zoom'
            }
          },
          restore: {
            title: 'Restore'
          },
          saveAsImage: {
            title: 'Save as Image'
          }
        }
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLabel: {
          formatter: (value: number) => {
            const date = new Date(value)
            return date.toLocaleTimeString()
          }
        }
      },
      yAxis: {
        type: 'value',
        name: 'Altitude (m)',
        axisLabel: {
          formatter: '{value} m'
        }
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
        },
        {
          type: 'slider',
          yAxisIndex: 0,
          start: 0,
          end: 100,
          width: 20,
          right: 10
        }
      ],
      series: series
    }

    chartInstance.setOption(option, true)
  })

  return (
    <div class="w-full border rounded-lg p-4 bg-white shadow-sm">
      <div class="text-sm text-gray-600 mb-2">
        <strong>Zoom controls:</strong> Mouse wheel to zoom, drag to pan, or use the sliders below and on the right
      </div>
      <div
        ref={chartRef}
        class="w-full"
        style={{ height: '600px' }}
      />
    </div>
  )
}