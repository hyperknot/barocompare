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
  // Mean correction in altitude space (m) over calibration set
  baro1Offset: number
  baro2Offset: number

  // Altitude-domain linear params (when applicable)
  baro1Slope?: number
  baro2Slope?: number
  baro1Intercept?: number
  baro2Intercept?: number

  // Pressure-domain params (when applicable)
  baro1PressureSlope?: number
  baro2PressureSlope?: number
  baro1PressureOffsetPa?: number
  baro2PressureOffsetPa?: number
  baro1PressureScale?: number
  baro2PressureScale?: number

  pointsUsed: number
  baroAnalytics: BaroAnalytics
  gpsAnalytics: GPSAnalytics
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
