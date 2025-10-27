import type IGCParser from 'igc-parser'

export interface BaroAnalytics {
  meanDifference: number
  maxDifference: number
  percentile95: number
}

export interface GPSAnalytics {
  meanDifference: number
  maxDifference: number
  percentile95: number
}

export interface CalibrationInfo {
  baro1Offset: number
  baro2Offset: number
  pointsUsed: number
  referenceAltitude: number
  baroAnalytics: BaroAnalytics
  gps1Analytics: GPSAnalytics
  gps2Analytics: GPSAnalytics
}

export interface TimeRange {
  start: number
  end: number
}

export type IGCFile = IGCParser.IGCFile
export type BRecord = IGCParser.BRecord

export interface IGCFileWithMetadata extends IGCFile {
  filename: string
}