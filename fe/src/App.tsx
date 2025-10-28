import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { AltitudeChart } from './components/AltitudeChart'
import type { IGCFileWithMetadata } from './types'
import { parseIGCFile, sortIGCFiles } from './utils/igc-parser'

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
        <Show when={!hasFiles()}>
          <div class="max-w-3xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h1 class="text-3xl font-bold text-gray-900 mb-1">Welcome to barocompare</h1>

            <p class="text-lg text-gray-700 mb-4">
              Analyze and compare IGC tracks from two instruments used on the same flight.
            </p>

            <div class="space-y-3 text-gray-600 mb-6">
              <p>
                <strong>What you can compare:</strong>
              </p>
              <ul class="list-disc list-inside space-y-2 ml-4">
                <li>
                  <strong>GPS1</strong> vs <strong>GPS2</strong> altitude
                </li>
                <li>
                  <strong>Baro1</strong> vs <strong>Baro2</strong> altitude
                </li>
              </ul>
            </div>

            <div class="pt-4 border-t border-gray-200">
              <p class="text-sm text-gray-600">
                This is an open source project by Zsolt Ero. View the code on{' '}
                <a
                  href="https://github.com/hyperknot/barocompare"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-600 hover:text-blue-800 underline"
                >
                  GitHub
                </a>
              </p>
            </div>
          </div>

          <div
            class={`max-w-3xl mx-auto border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging() ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
            }`}
          >
            <p class="text-lg mb-2">Drop 2 .igc files here</p>
          </div>
        </Show>

        <Show when={error()}>
          <div class="text-red-600 bg-red-50 p-3 rounded border border-red-200">{error()}</div>
        </Show>

        <Show when={hasFiles()}>
          <AltitudeChart file1Data={file1Data()} file2Data={file2Data()} />
        </Show>
      </div>
    </div>
  )
}
