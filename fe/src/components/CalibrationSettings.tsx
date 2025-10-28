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
  // 1-point methods first
  {
    method: 'offset-alt-1pt',
    label: '1-Point Offset (Alt)',
    description: 'Constant offset using early flight data',
  },
  {
    method: 'offset-press-1pt',
    label: '1-Point Offset (Press)',
    description: 'Constant offset in pressure space (Pa)',
  },
  {
    method: 'scale-press-1pt',
    label: '1-Point Scale (Press)',
    description: 'Constant scale factor in pressure space',
  },
  // Linear (multi-point) methods second
  {
    method: 'linear-alt',
    label: 'Linear Fit (Alt)',
    description: 'Fits scale + offset across entire flight',
    recommended: true,
  },
  {
    method: 'linear-press',
    label: 'Linear Fit (Press)',
    description: 'Fits in pressure domain (most accurate)',
  },
]

interface CalibrationSettingsProps {
  selectedMethod: CalibrationMethod
  onMethodChange: (method: CalibrationMethod) => void
}

export const CalibrationSettings: Component<CalibrationSettingsProps> = (props) => {
  return (
    <div class="mb-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 class="font-semibold text-gray-900 mb-3">Calibration Method</h3>

      <div class="flex flex-wrap gap-3 mb-4">
        <For each={CALIBRATION_OPTIONS}>
          {(option) => (
            <label
              class="flex items-center gap-2 px-3 py-2 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-300"
              classList={{
                'border-blue-500 bg-blue-50': props.selectedMethod === option.method,
                'border-gray-200': props.selectedMethod !== option.method,
              }}
            >
              <input
                type="radio"
                name="calibration-method"
                value={option.method}
                checked={props.selectedMethod === option.method}
                onChange={() => props.onMethodChange(option.method)}
                class="h-4 w-4 text-blue-600 cursor-pointer"
              />
              <div class="flex items-center gap-1.5">
                <span class="font-medium text-sm whitespace-nowrap">{option.label}</span>
                {option.recommended && (
                  <span class="px-1.5 py-0.5 text-xs font-semibold text-blue-700 bg-blue-100 rounded">
                    ★
                  </span>
                )}
              </div>
            </label>
          )}
        </For>
      </div>

      <div class="text-sm text-gray-600 mb-1 p-2 bg-gray-50 rounded">
        {CALIBRATION_OPTIONS.find((opt) => opt.method === props.selectedMethod)?.description}
      </div>
    </div>
  )
}
