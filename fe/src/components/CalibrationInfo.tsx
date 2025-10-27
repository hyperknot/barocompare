import type { Component } from 'solid-js'
import type { CalibrationInfo } from '../types'

interface CalibrationInfoProps {
  info: CalibrationInfo
}

export const CalibrationInfoPanel: Component<CalibrationInfoProps> = (props) => {
  return (
    <div class="mb-4 space-y-4">

      {/* Barometric Sensors Comparison */}
      <div class="p-4 bg-gray-50 border border-gray-200 rounded">
        <h3 class="font-semibold text-gray-900 mb-3">Calibrated Baro1 vs Baro2 Difference</h3>
        <div class="text-sm space-y-1.5">
          <div class="flex justify-between">
            <span class="text-gray-600">Mean difference:</span>
            <strong>{props.info.baroAnalytics.meanDifference.toFixed(1)} m</strong>
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
      <div class="grid md:grid-cols-2 gap-4">
        <div class="p-4 bg-gray-50 border border-gray-200 rounded">
          <h3 class="font-semibold text-gray-900 mb-3 flex items-center">
            <span class="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2"/>
            GPS1 vs Average
          </h3>
          <div class="text-sm space-y-1.5">
            <div class="flex justify-between">
              <span class="text-gray-600">Mean difference:</span>
              <strong>{props.info.gps1Analytics.meanDifference.toFixed(1)} m</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Max difference:</span>
              <strong>{props.info.gps1Analytics.maxDifference.toFixed(1)} m</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">95th percentile:</span>
              <strong>{props.info.gps1Analytics.percentile95.toFixed(1)} m</strong>
            </div>
          </div>
        </div>

        <div class="p-4 bg-gray-50 border border-gray-200 rounded">
          <h3 class="font-semibold text-gray-900 mb-3 flex items-center">
            <span class="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
            GPS2 vs Average
          </h3>
          <div class="text-sm space-y-1.5">
            <div class="flex justify-between">
              <span class="text-gray-600">Mean difference:</span>
              <strong>{props.info.gps2Analytics.meanDifference.toFixed(1)} m</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Max difference:</span>
              <strong>{props.info.gps2Analytics.maxDifference.toFixed(1)} m</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">95th percentile:</span>
              <strong>{props.info.gps2Analytics.percentile95.toFixed(1)} m</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}