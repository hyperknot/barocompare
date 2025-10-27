import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { FileUploader } from './components/FileUploader'
import { AltitudeChart } from './components/AltitudeChart'
import type { IGCData } from './types/igc'

export const AppUI: Component = () => {
  const [file1Data, setFile1Data] = createSignal<IGCData | null>(null)
  const [file2Data, setFile2Data] = createSignal<IGCData | null>(null)
  const [error, setError] = createSignal<string>('')

  return (
    <div id="appUI" class="flex flex-col min-h-screen bg-gray-50">
      <div class="p-4 space-y-4 max-w-7xl mx-auto w-full">
        <h1 class="text-2xl font-bold mb-4">IGC Flight Comparison</h1>

        <div class="flex gap-4 flex-wrap">
          <FileUploader
            label="File 1"
            data={file1Data()}
            onDataLoaded={setFile1Data}
            onError={setError}
          />
          <FileUploader
            label="File 2"
            data={file2Data()}
            onDataLoaded={setFile2Data}
            onError={setError}
          />
        </div>

        <Show when={error()}>
          <div class="text-red-600 bg-red-50 p-3 rounded border border-red-200">
            {error()}
          </div>
        </Show>

        <Show when={file1Data() || file2Data()}>
          <AltitudeChart
            file1Data={file1Data()}
            file2Data={file2Data()}
          />
        </Show>

        <Show when={file1Data() || file2Data()}>
          <details class="border rounded p-3 bg-white">
            <summary class="cursor-pointer font-semibold">
              View Parsed Data
            </summary>
            <pre class="mt-2 text-xs overflow-auto max-h-96 bg-gray-50 p-3 rounded">
              {JSON.stringify(
                { file1: file1Data(), file2: file2Data() },
                null,
                2
              )}
            </pre>
          </details>
        </Show>
      </div>
    </div>
  )
}