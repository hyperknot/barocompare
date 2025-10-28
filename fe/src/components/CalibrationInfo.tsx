import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { CalibrationInfo } from '../types'
import type { CalibrationMethod } from '../utils/baro-calibration'

interface CalibrationInfoProps {
  info: CalibrationInfo
  method: CalibrationMethod
}

interface Parameter {
  label: string
  value: number | undefined
  format?: (v: number) => string
}

export const CalibrationInfoPanel: Component<CalibrationInfoProps> = (props) => {
  const baro1Params = (): Array<Parameter> => {
    const params: Array<Parameter> = []

    if (props.info.baro1Slope !== undefined) {
      params.push({
        label: 'Altitude Slope',
        value: props.info.baro1Slope,
        format: (v) => v.toFixed(6),
      })
    }
    if (props.info.baro1Offset !== undefined) {
      params.push({
        label: 'Altitude Offset',
        value: props.info.baro1Offset,
        format: (v) => v.toFixed(2),
      })
    }
    if (props.info.baro1PressureSlope !== undefined) {
      params.push({
        label: 'Pressure Slope',
        value: props.info.baro1PressureSlope,
        format: (v) => v.toFixed(6),
      })
    }
    if (props.info.baro1PressureOffsetPa !== undefined) {
      params.push({
        label: 'Pressure Offset',
        value: props.info.baro1PressureOffsetPa,
        format: (v) => v.toFixed(2),
      })
    }

    return params
  }

  const baro2Params = (): Array<Parameter> => {
    const params: Array<Parameter> = []

    if (props.info.baro2Slope !== undefined) {
      params.push({
        label: 'Altitude Slope',
        value: props.info.baro2Slope,
        format: (v) => v.toFixed(6),
      })
    }
    if (props.info.baro2Offset !== undefined) {
      params.push({
        label: 'Altitude Offset',
        value: props.info.baro2Offset,
        format: (v) => v.toFixed(2),
      })
    }
    if (props.info.baro2PressureSlope !== undefined) {
      params.push({
        label: 'Pressure Slope',
        value: props.info.baro2PressureSlope,
        format: (v) => v.toFixed(6),
      })
    }
    if (props.info.baro2PressureOffsetPa !== undefined) {
      params.push({
        label: 'Pressure Offset',
        value: props.info.baro2PressureOffsetPa,
        format: (v) => v.toFixed(2),
      })
    }

    return params
  }

  return (
    <div class="mb-4 space-y-4">
      {/* Calibration Parameters */}
      <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg h-30">
        <div class="text-sm font-semibold text-blue-900 mb-2">Calibration Parameters:</div>
        <div class="grid grid-cols-2 gap-4">
          {/* Baro1 */}
          <div class="space-y-1">
            <div class="text-xs font-semibold text-blue-800">Baro1:</div>
            <For each={baro1Params()}>
              {(param) => (
                <div class="text-xs text-blue-700">
                  {param.label}: {param.format ? param.format(param.value!) : param.value}
                </div>
              )}
            </For>
          </div>

          {/* Baro2 */}
          <div class="space-y-1">
            <div class="text-xs font-semibold text-blue-800">Baro2:</div>
            <For each={baro2Params()}>
              {(param) => (
                <div class="text-xs text-blue-700">
                  {param.label}: {param.format ? param.format(param.value!) : param.value}
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      <div class="flex gap-4">
        {/* Barometric Sensors Comparison */}
        <div class="flex-1 p-4 bg-gray-50 border border-gray-200 rounded">
          <h3 class="font-semibold text-gray-900 mb-3">Calibrated Baro1 vs Baro2 Difference</h3>
          <div class="text-sm space-y-1.5">
            <div class="flex justify-between">
              <span class="text-gray-600">Mean difference:</span>
              <strong>{Math.abs(props.info.baroAnalytics.meanDifference).toFixed(1)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Max difference:</span>
              <strong>{props.info.baroAnalytics.maxDifference.toFixed(1)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">95th percentile:</span>
              <strong>{props.info.baroAnalytics.percentile95.toFixed(1)}</strong>
            </div>
          </div>
        </div>

        {/* GPS Comparison */}
        <div class="flex-1 p-4 bg-gray-50 border border-gray-200 rounded">
          <h3 class="font-semibold text-gray-900 mb-3">GPS1 vs GPS2 Difference</h3>
          <div class="text-sm space-y-1.5">
            <div class="flex justify-between">
              <span class="text-gray-600">Mean difference:</span>
              <strong>{Math.abs(props.info.gpsAnalytics.meanDifference).toFixed(1)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Max difference:</span>
              <strong>{props.info.gpsAnalytics.maxDifference.toFixed(1)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">95th percentile:</span>
              <strong>{props.info.gpsAnalytics.percentile95.toFixed(1)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
