import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import type { CalibrationInfo } from '../types'
import type { CalibrationMethod } from '../utils/baro-calibration'

interface CalibrationInfoProps {
  info: CalibrationInfo
  method: CalibrationMethod
}

const METHOD_LABELS: Record<CalibrationMethod, string> = {
  'offset-alt-1pt': '1-Point Offset (Altitude)',
  'offset-press': '1-Point Offset (Pressure)',
  'scale-press-1pt': '1-Point Scale (Pressure)',
  'linear-alt': 'Linear Fit (Altitude)',
  'linear-press': 'Linear Fit (Pressure)',
}

export const CalibrationInfoPanel: Component<CalibrationInfoProps> = (props) => {
  const isLinear = () => props.method === 'linear-alt' || props.method === 'linear-press'
  const isOffset = () => props.method === 'offset-alt-1pt' || props.method === 'offset-press'

  return (
    <div class="mb-4 space-y-4">
      {/* Current Method Info with Parameters */}
      <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div class="flex items-start justify-between mb-3">
          <div>
            <h3 class="font-semibold text-blue-900 mb-1">Active: {METHOD_LABELS[props.method]}</h3>
            <p class="text-sm text-blue-700">Using {props.info.pointsUsed} data points</p>
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

        {/* Calibration Parameters */}
        <div class="pt-3 border-t border-blue-200">
          <div class="text-sm font-semibold text-blue-900 mb-2">Calibration Parameters:</div>
          <div class="grid grid-cols-2 gap-4">
            {/* Baro1 Parameters */}
            <div class="space-y-1">
              <div class="text-xs font-semibold text-blue-800">Baro1:</div>
              <Show when={isLinear()}>
                <div class="text-xs text-blue-700">
                  Slope: {props.info.baro1Slope?.toFixed(6) ?? 'N/A'}
                </div>
              </Show>
              <div class="text-xs text-blue-700">
                Offset: {props.info.baro1Offset >= 0 ? '+' : ''}
                {props.info.baro1Offset.toFixed(2)} m
              </div>
              <Show when={props.info.baro1Intercept !== undefined}>
                <div class="text-xs text-blue-700">
                  Intercept: {props.info.baro1Intercept?.toFixed(2)} m
                </div>
              </Show>
            </div>

            {/* Baro2 Parameters */}
            <div class="space-y-1">
              <div class="text-xs font-semibold text-blue-800">Baro2:</div>
              <Show when={isLinear()}>
                <div class="text-xs text-blue-700">
                  Slope: {props.info.baro2Slope?.toFixed(6) ?? 'N/A'}
                </div>
              </Show>
              <div class="text-xs text-blue-700">
                Offset: {props.info.baro2Offset >= 0 ? '+' : ''}
                {props.info.baro2Offset.toFixed(2)} m
              </div>
              <Show when={props.info.baro2Intercept !== undefined}>
                <div class="text-xs text-blue-700">
                  Intercept: {props.info.baro2Intercept?.toFixed(2)} m
                </div>
              </Show>
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
