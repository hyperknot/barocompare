import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { AltitudeChart } from './components/AltitudeChart'
import { DropZone } from './components/DropZone'
import { parseIGCFile, sortIGCFiles } from './utils/igc-parser'
import type { IGCFileWithMetadata } from './types'

export const AppUI: Component = () => {
  const [file1Data, setFile1Data] = createSignal<IGCFileWithMetadata | null>(null)
  const [file2Data, setFile2Data] = createSignal<IGCFileWithMetadata | null>(null)
  const [error, setError] = createSignal<string>('')
  const [isDragging, setIsDragging] = createSignal(false)

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setError('')

    const files = Array.from(e.dataTransfer?.files || [])
    const igcFiles = sortIGCFiles(files)

    if (igcFiles.length === 0) {
      setError('No .igc files found in drop')
      return
    }

    try {
      const data1 = await parseIGCFile(igcFiles[0])
      setFile1Data(data1)

      if (igcFiles[1]) {
        const data2 = await parseIGCFile(igcFiles[1])
        setFile2Data(data2)
      } else {
        setFile2Data(null)
      }
    } catch (err) {
      setError(`Error parsing IGC file: ${err}`)
      console.error(err)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const hasFiles = () => file1Data() !== null || file2Data() !== null

  return (
    <div
      id="appUI"
      class="flex flex-col min-h-screen"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div class="p-4 space-y-4 max-w-7xl mx-auto w-full">
        <DropZone isDragging={isDragging()} hasFiles={hasFiles()} />

        <Show when={error()}>
          <div class="text-red-600 bg-red-50 p-3 rounded border border-red-200">
            {error()}
          </div>
        </Show>

        <Show when={hasFiles()}>
          <AltitudeChart
            file1Data={file1Data()}
            file2Data={file2Data()}
          />
        </Show>
      </div>
    </div>
  )
}