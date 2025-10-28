import type {
  BaroAnalytics,
  BRecord,
  CalibrationInfo,
  GPSAnalytics,
  IGCFileWithMetadata,
  TimeRange,
} from '../types'
import { type BaroCalibrationOptions, buildCalibrator } from './baro-calibration'

interface DataMaps {
  file1BaroMap: Map<number, number>
  file1GpsMap: Map<number, number>
  file2BaroMap: Map<number, number>
  file2GpsMap: Map<number, number>
}

function createDataMaps(file1: IGCFileWithMetadata, file2: IGCFileWithMetadata): DataMaps {
  const maps: DataMaps = {
    file1BaroMap: new Map(),
    file1GpsMap: new Map(),
    file2BaroMap: new Map(),
    file2GpsMap: new Map(),
  }

  file1.fixes.forEach((fix) => {
    const secondTimestamp = Math.floor(fix.timestamp / 1000)
    if (fix.pressureAltitude !== null) {
      maps.file1BaroMap.set(secondTimestamp, fix.pressureAltitude)
    }
    if (fix.gpsAltitude !== null) {
      maps.file1GpsMap.set(secondTimestamp, fix.gpsAltitude)
    }
  })

  file2.fixes.forEach((fix) => {
    const secondTimestamp = Math.floor(fix.timestamp / 1000)
    if (fix.pressureAltitude !== null) {
      maps.file2BaroMap.set(secondTimestamp, fix.pressureAltitude)
    }
    if (fix.gpsAltitude !== null) {
      maps.file2GpsMap.set(secondTimestamp, fix.gpsAltitude)
    }
  })

  return maps
}

function findSharedSeconds(maps: DataMaps): Array<number> {
  const sharedSeconds: Array<number> = []

  for (const [second] of maps.file1BaroMap) {
    if (
      maps.file1GpsMap.has(second) &&
      maps.file2BaroMap.has(second) &&
      maps.file2GpsMap.has(second)
    ) {
      sharedSeconds.push(second)
    }
  }

  return sharedSeconds.sort((a, b) => a - b)
}

function calculateBaroAnalytics(
  allSharedSeconds: Array<number>,
  maps: DataMaps,
  calibrate1: (h: number) => number,
  calibrate2: (h: number) => number,
): BaroAnalytics {
  const differences: Array<number> = []

  for (const second of allSharedSeconds) {
    const baro1 = maps.file1BaroMap.get(second)
    const baro2 = maps.file2BaroMap.get(second)

    if (baro1 !== undefined && baro2 !== undefined) {
      const calibratedBaro1 = calibrate1(baro1)
      const calibratedBaro2 = calibrate2(baro2)
      differences.push(calibratedBaro1 - calibratedBaro2)
    }
  }

  if (differences.length === 0) {
    return {
      meanDifference: 0,
      maxDifference: 0,
      percentile95: 0,
    }
  }

  const meanDifference = differences.reduce((a, b) => a + b, 0) / differences.length
  const maxDifference = Math.max(...differences.map(Math.abs))
  const sortedAbsDifferences = differences.map(Math.abs).sort((a, b) => a - b)
  const p95Index = Math.floor(sortedAbsDifferences.length * 0.95)
  const percentile95 = sortedAbsDifferences[p95Index] || 0

  return {
    meanDifference,
    maxDifference,
    percentile95,
  }
}

function calculateGPSAnalytics(
  allSharedSeconds: Array<number>,
  gps1Map: Map<number, number>,
  gps2Map: Map<number, number>,
): GPSAnalytics {
  const differences: Array<number> = []

  for (const second of allSharedSeconds) {
    const gps1 = gps1Map.get(second)
    const gps2 = gps2Map.get(second)

    if (gps1 !== undefined && gps2 !== undefined) {
      differences.push(gps1 - gps2)
    }
  }

  if (differences.length === 0) {
    return {
      meanDifference: 0,
      maxDifference: 0,
      percentile95: 0,
    }
  }

  const meanDifference = differences.reduce((a, b) => a + b, 0) / differences.length
  const maxDifference = Math.max(...differences.map(Math.abs))
  const sortedAbsDifferences = differences.map(Math.abs).sort((a, b) => a - b)
  const p95Index = Math.floor(sortedAbsDifferences.length * 0.95)
  const percentile95 = sortedAbsDifferences[p95Index] || 0

  return {
    meanDifference,
    maxDifference,
    percentile95,
  }
}

export function calculateBaroCalibration(
  file1: IGCFileWithMetadata,
  file2: IGCFileWithMetadata,
  options?: BaroCalibrationOptions,
): CalibrationInfo {
  const maps = createDataMaps(file1, file2)
  const sharedSeconds = findSharedSeconds(maps)

  if (sharedSeconds.length === 0) {
    return {
      pointsUsed: 0,
      baroAnalytics: {
        meanDifference: 0,
        maxDifference: 0,
        percentile95: 0,
      },
      gpsAnalytics: {
        meanDifference: 0,
        maxDifference: 0,
        percentile95: 0,
      },
    }
  }

  const method = options?.method ?? 'linear-alt'
  const referenceMode = options?.referenceMode ?? 'avg-gps'
  const useAllShared = options?.useAllShared ?? true
  const calibrationSeconds = options?.calibrationSeconds ?? 60

  // Build reference altitude per second
  const refAlt = new Map<number, number>()
  for (const s of sharedSeconds) {
    const g1 = maps.file1GpsMap.get(s)!
    const g2 = maps.file2GpsMap.get(s)!
    const r = referenceMode === 'gps1' ? g1 : referenceMode === 'gps2' ? g2 : (g1 + g2) / 2
    refAlt.set(s, r)
  }

  // Determine which seconds to use for calibration
  const secondsForCalib = useAllShared
    ? [...sharedSeconds]
    : sharedSeconds.slice(0, calibrationSeconds)

  // Build calibration pairs for both sensors
  const buildPairs = (sensor: 1 | 2, secs: Array<number>) => {
    const baroMap = sensor === 1 ? maps.file1BaroMap : maps.file2BaroMap
    const hRaw: Array<number> = []
    const hRef: Array<number> = []
    for (const s of secs) {
      const h = baroMap.get(s)
      const r = refAlt.get(s)
      if (h !== undefined && r !== undefined && Number.isFinite(h) && Number.isFinite(r)) {
        hRaw.push(h)
        hRef.push(r)
      }
    }
    return { hRaw, hRef }
  }

  const pairs1 = buildPairs(1, secondsForCalib)
  const pairs2 = buildPairs(2, secondsForCalib)

  const calibrator1 = buildCalibrator(pairs1.hRaw, pairs1.hRef, options)
  const calibrator2 = buildCalibrator(pairs2.hRaw, pairs2.hRef, options)

  const baroAnalytics = calculateBaroAnalytics(sharedSeconds, maps, calibrator1.fn, calibrator2.fn)
  const gpsAnalytics = calculateGPSAnalytics(sharedSeconds, maps.file1GpsMap, maps.file2GpsMap)
  const pointsUsed = Math.min(calibrator1.pointsUsed, calibrator2.pointsUsed)

  return {
    // Altitude domain params (only if defined)
    baro1Slope: calibrator1.altitudeSlope,
    baro2Slope: calibrator2.altitudeSlope,
    baro1Offset: calibrator1.altitudeOffset,
    baro2Offset: calibrator2.altitudeOffset,

    // Pressure domain params (only if defined)
    baro1PressureSlope: calibrator1.pressureSlope,
    baro2PressureSlope: calibrator2.pressureSlope,
    baro1PressureOffsetPa: calibrator1.pressureOffset,
    baro2PressureOffsetPa: calibrator2.pressureOffset,

    pointsUsed,
    baroAnalytics,
    gpsAnalytics,
  }
}

function getTimestampsWithCompleteData(file: IGCFileWithMetadata): Array<number> {
  return file.fixes
    .filter((fix) => fix.gpsAltitude !== null && fix.pressureAltitude !== null)
    .map((fix) => fix.timestamp)
}

export function findCommonTimeRange(
  file1: IGCFileWithMetadata,
  file2: IGCFileWithMetadata,
): TimeRange | null {
  const file1Times = getTimestampsWithCompleteData(file1)
  const file2Times = getTimestampsWithCompleteData(file2)

  if (file1Times.length === 0 || file2Times.length === 0) {
    return null
  }

  const start = Math.max(Math.min(...file1Times), Math.min(...file2Times))
  const end = Math.min(Math.max(...file1Times), Math.max(...file2Times))

  return start >= end ? null : { start, end }
}

export function createTimeRangeFilter(timeRange: TimeRange | null) {
  return (fix: BRecord) => {
    if (!timeRange) return true
    return fix.timestamp >= timeRange.start && fix.timestamp <= timeRange.end
  }
}
