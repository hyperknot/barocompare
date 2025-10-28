import type { Component } from 'solid-js'
import type { CalibrationInfo } from '../types'
import type { CalibrationMethod } from '../utils/baro-calibration'

interface CalibrationInfoProps {
  info: CalibrationInfo
  method: CalibrationMethod
}

const METHOD_LABELS: Record<CalibrationMethod, string> = {
  'offset-alt-1pt': '1-Point Offset (Altitude)',
  'linear-alt': 'Linear Fit (Altitude)',
  'linear-press': 'Linear Fit (Pressure)',
  'offset-press': '1-Point Offset (Pressure)',
  'quadratic-alt': 'Quadratic Fit (Altitude)',
}

export const CalibrationInfoPanel: Component<CalibrationInfoProps> = (props) => {
  const isMultiPoint = () => {
    const method = props.method
    return method === 'linear-alt' || method === 'linear-press' || method === 'quadratic-alt'
  }

  return (
    <div class="mb-4 space-y-4">
      {/* Current Method Info */}
      <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-semibold text-blue-900 mb-1">
              Active Calibration: {METHOD_LABELS[props.method]}
            </h3>
            <p class="text-sm text-blue-700">
              {isMultiPoint()
                ? `Using ${props.info.pointsUsed} data points across entire flight`
                : `Using ${props.info.pointsUsed} data points from first 60 seconds`}
            </p>
          </div>
          <div class="text-right">
            <div class="text-sm text-blue-700">Mean correction</div>
            <div class="font-semibold text-blue-900">
              Baro1: {props.info.baro1Offset >= 0 ? '+' : ''}
              {props.info.baro1Offset.toFixed(1)} m
            </div>
            <div class="font-semibold text-blue-900">
              Baro2: {props.info.baro2Offset >= 0 ? '+' : ''}
              {props.info.baro2Offset.toFixed(1)} m
            </div>
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
              <strong>{Math.abs(props.info.baroAnalytics.meanDifference).toFixed(1)} m</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Max difference:</span>
              <strong>{props.info.baroAnalytics.maxDifference.toFixed(1)} m</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">95th percentile:</span>
              <strong>{props.info.baroAnalytics.percentile95.toFixed(1)} m</strong>
            </div>
          </div>
        </div>

        {/* GPS Comparison */}
        <div class="flex-1 p-4 bg-gray-50 border border-gray-200 rounded">
          <h3 class="font-semibold text-gray-900 mb-3">GPS1 vs GPS2 Difference</h3>
          <div class="text-sm space-y-1.5">
            <div class="flex justify-between">
              <span class="text-gray-600">Mean difference:</span>
              <strong>{Math.abs(props.info.gpsAnalytics.meanDifference).toFixed(1)} m</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Max difference:</span>
              <strong>{props.info.gpsAnalytics.maxDifference.toFixed(1)} m</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">95th percentile:</span>
              <strong>{props.info.gpsAnalytics.percentile95.toFixed(1)} m</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
