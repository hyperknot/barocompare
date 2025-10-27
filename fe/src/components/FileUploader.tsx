import type { Component } from 'solid-js'
import type IGCParser from 'igc-parser'
import IGCParserLib from 'igc-parser'

interface FileUploaderProps {
  label: string
  data: IGCParser.IGCFile | null
  onDataLoaded: (data: IGCParser.IGCFile) => void
  onError: (error: string) => void
}

export const FileUploader: Component<FileUploaderProps> = (props) => {
  const handleFileSelect = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]

    if (!file) return

    try {
      const text = await file.text()
      const parsed = IGCParserLib.parse(text, { lenient: true })
      props.onDataLoaded(parsed)
      props.onError('')
    } catch (err) {
      props.onError(`Failed to parse IGC file: ${err}`)
      console.error('Parse error:', err)
    }
  }

  return (
    <div class="flex flex-col gap-2">
      <label class="font-semibold">{props.label}:</label>
      <input
        type="file"
        accept=".igc"
        onChange={handleFileSelect}
        class="border rounded px-3 py-2"
      />
      {props.data && (
        <div class="text-sm text-green-600">
          ✓ Loaded: {props.data.pilot || 'Unknown pilot'}
        </div>
      )}
    </div>
  )
}