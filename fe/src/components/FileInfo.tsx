import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import type { IGCFileWithMetadata } from '../types'

interface FileInfoProps {
  file1Data: IGCFileWithMetadata | null
  file2Data: IGCFileWithMetadata | null
}

export const FileInfoPanel: Component<FileInfoProps> = (props) => {
  const getInstrument = (file: IGCFileWithMetadata) => {
    const parts = []
    if (file.loggerManufacturer) parts.push(file.loggerManufacturer)
    if (file.loggerType) parts.push(file.loggerType)
    return parts.length > 0 ? parts.join(' - ') : 'Unknown'
  }

  return (
    <div class="mb-4 p-4 bg-gray-50 border border-gray-200 rounded">
      <h3 class="font-semibold text-gray-900 mb-3">Flight Files</h3>
      <div class="space-y-2 text-sm">
        <Show when={props.file1Data}>
          <div>
            <div class="flex items-center">
              <span class="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
              <span class="font-medium">File 1:</span>
              <span class="ml-2">{props.file1Data!.filename}</span>
            </div>
            <div class="ml-5 text-gray-600">
              Instrument: {getInstrument(props.file1Data!)}
            </div>
          </div>
        </Show>
        <Show when={props.file2Data}>
          <div>
            <div class="flex items-center">
              <span class="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
              <span class="font-medium">File 2:</span>
              <span class="ml-2">{props.file2Data!.filename}</span>
            </div>
            <div class="ml-5 text-gray-600">
              Instrument: {getInstrument(props.file2Data!)}
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}