import type { Component } from 'solid-js'
import { Show } from 'solid-js'

interface DropZoneProps {
  isDragging: boolean
  hasFiles: boolean
}

export const DropZone: Component<DropZoneProps> = (props) => {
  return (
    <Show when={!props.hasFiles}>
      <div
        class={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          props.isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 bg-white'
        }`}
      >
        <p class="text-lg mb-2">Drop 2 .igc files here</p>
      </div>
    </Show>
  )
}