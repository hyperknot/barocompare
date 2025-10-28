import type { Component } from 'solid-js'
import { For } from 'solid-js'
import type { CalibrationMethod } from '../utils/baro-calibration'

interface CalibrationOption {
  method: CalibrationMethod
  label: string
  description: string
  recommended?: boolean
}

const CALIBRATION_OPTIONS: Array<CalibrationOption> = [
  {
    method: 'offset-alt-1pt',
    label: '1-Point Offset (Altitude)',
    description:
      'Simple constant offset using first 60 seconds. Best when you only have ground-level reference. Cannot correct scale errors.',
  },
  {
    method: 'linear-alt',
    label: 'Linear Fit (Altitude)',
    description:
      'Fits scale + offset across entire flight using GPS altitude as reference. Corrects both offset and scale errors in altitude space.',
    recommended: true,
  },
  {
    method: 'linear-press',
    label: 'Linear Fit (Pressure)',
    description:
      'Fits scale + offset in pressure domain, then converts to altitude. Most physically accurate as sensors measure pressure. Best for wide altitude ranges.',
  },
  {
    method: 'offset-press',
    label: '1-Point Offset (Pressure)',
    description:
      'Constant offset in pressure space using first 60 seconds. Like QNH adjustment. Cannot correct scale errors.',
  },
  {
    method: 'quadratic-alt',
    label: 'Quadratic Fit (Altitude)',
    description:
      'Adds curvature correction on top of linear fit. Rarely needed; use only if linear methods show systematic residuals.',
  },
]

interface CalibrationSettingsProps {
  selectedMethod: CalibrationMethod
  onMethodChange: (method: CalibrationMethod) => void
}

export const CalibrationSettings: Component<CalibrationSettingsProps> = (props) => {
  return (
    <div class="mb-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 class="font-semibold text-gray-900 mb-3 text-lg">Calibration Method</h3>
      <div class="space-y-3">
        <For each={CALIBRATION_OPTIONS}>
          {(option) => (
            <label class="flex items-start cursor-pointer group">
              <input
                type="radio"
                name="calibration-method"
                value={option.method}
                checked={props.selectedMethod === option.method}
                onChange={() => props.onMethodChange(option.method)}
                class="mt-1 h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              <div class="ml-3 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                    {option.label}
                  </span>
                  {option.recommended && (
                    <span class="px-2 py-0.5 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full">
                      Recommended
                    </span>
                  )}
                </div>
                <p class="text-sm text-gray-600 mt-0.5">{option.description}</p>
              </div>
            </label>
          )}
        </For>
      </div>

      <div class="mt-4 pt-4 border-t border-gray-200">
        <div class="text-sm text-gray-600 space-y-1">
          <p>
            <strong>All methods use GPS1+GPS2 average as reference.</strong>
          </p>
          <p>
            • <strong>1-Point methods:</strong> Use first 60 seconds only (suitable for single
            altitude)
          </p>
          <p>
            • <strong>Multi-point methods:</strong> Use entire flight data (corrects scale errors)
          </p>
          <p>
            • <strong>Robust fitting:</strong> Automatically filters outliers and reduces turbulence
            effects
          </p>
        </div>
      </div>
    </div>
  )
}
