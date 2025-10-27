import IGCParser from 'igc-parser'
import type { IGCFileWithMetadata } from '../types'

export async function parseIGCFile(file: File): Promise<IGCFileWithMetadata> {
  const text = await file.text()
  const parsed = IGCParser.parse(text, { lenient: true })
  return {
    ...parsed,
    filename: file.name
  }
}

export function sortIGCFiles(files: File[]): File[] {
  return files
    .filter(f => f.name.toLowerCase().endsWith('.igc'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 2)
}