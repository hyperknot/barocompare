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
      <div class="mx-8 text-sm">
        <Show when={props.file1Data}>
          <div class="flex items-center">
            <span class="inline-block w-3 h-3 rounded-full bg-blue-500 mr-1"/>
            <span class="inline-block w-3 h-3 rounded-full bg-red-500 mr-2"/>
            <span class="font-medium">File 1:</span>
            <span class="ml-2">{props.file1Data!.filename}</span>
            <span class="ml-2 text-gray-600">({getInstrument(props.file1Data!)})</span>
          </div>
        </Show>
        <Show when={props.file2Data}>
          <div class="flex items-center">
            <span class="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"/>
            <span class="inline-block w-3 h-3 rounded-full bg-orange-500 mr-2"/>
            <span class="font-medium">File 2:</span>
            <span class="ml-2">{props.file2Data!.filename}</span>
            <span class="ml-2 text-gray-600">({getInstrument(props.file2Data!)})</span>
          </div>
        </Show>
      </div>
  )
}