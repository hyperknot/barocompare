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

function calculateOffsets(
  calibrationPoints: Array<number>,
  maps: DataMaps,
): { baro1Offset: number; baro2Offset: number } {
  const baro1Diffs: Array<number> = []
  const baro2Diffs: Array<number> = []

  for (const second of calibrationPoints) {
    const gps1 = maps.file1GpsMap.get(second)!
    const gps2 = maps.file2GpsMap.get(second)!
    const avgGps = (gps1 + gps2) / 2

    const baro1 = maps.file1BaroMap.get(second)!
    const baro2 = maps.file2BaroMap.get(second)!

    baro1Diffs.push(avgGps - baro1)
    baro2Diffs.push(avgGps - baro2)
  }

  const baro1Offset = baro1Diffs.reduce((acc, val) => acc + val, 0) / baro1Diffs.length
  const baro2Offset = baro2Diffs.reduce((acc, val) => acc + val, 0) / baro2Diffs.length

  return { baro1Offset, baro2Offset }
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

  // Mean difference
  const meanDifference = differences.reduce((a, b) => a + b, 0) / differences.length

  // Max absolute difference
  const maxDifference = Math.max(...differences.map(Math.abs))

  // 95th percentile of absolute differences
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

  // Mean difference
  const meanDifference = differences.reduce((a, b) => a + b, 0) / differences.length

  // Max absolute difference
  const maxDifference = Math.max(...differences.map(Math.abs))

  // 95th percentile of absolute differences
  const sortedAbsDifferences = differences.map(Math.abs).sort((a, b) => a - b)
  const p95Index = Math.floor(sortedAbsDifferences.length * 0.95)
  const percentile95 = sortedAbsDifferences[p95Index] || 0

  return {
    meanDifference,
    maxDifference,
    percentile95,
  }
}

// Legacy: default behavior (offset-only with first 60 seconds), kept for backwards compatibility.
// You can now pass an optional 'options' parameter to use advanced methods (see below).
export function calculateBaroCalibration(
  file1: IGCFileWithMetadata,
  file2: IGCFileWithMetadata,
  options?: BaroCalibrationOptions,
): CalibrationInfo {
  if (!options) {
    const maps = createDataMaps(file1, file2)
    const sharedSeconds = findSharedSeconds(maps)

    if (sharedSeconds.length === 0) {
      return {
        baro1Offset: 0,
        baro2Offset: 0,
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

    // Use first 60 seconds for calibration
    const calibrationPoints = sharedSeconds.slice(0, 60)
    const { baro1Offset, baro2Offset } = calculateOffsets(calibrationPoints, maps)

    // Calculate baro analytics using all shared points with offset-only calibration
    const calibrate1 = (h: number) => h + baro1Offset
    const calibrate2 = (h: number) => h + baro2Offset
    const baroAnalytics = calculateBaroAnalytics(sharedSeconds, maps, calibrate1, calibrate2)

    // Calculate GPS1 vs GPS2 analytics using all shared points
    const gpsAnalytics = calculateGPSAnalytics(sharedSeconds, maps.file1GpsMap, maps.file2GpsMap)

    return {
      baro1Offset,
      baro2Offset,
      pointsUsed: calibrationPoints.length,
      baroAnalytics,
      gpsAnalytics,
    }
  }

  // Advanced path using options
  return calculateBaroCalibrationAdvanced(file1, file2, options)
}

// Advanced calibration: multi-method, robust, pressure/altitude space, multi-point.
export function calculateBaroCalibrationAdvanced(
  file1: IGCFileWithMetadata,
  file2: IGCFileWithMetadata,
  options?: BaroCalibrationOptions,
): CalibrationInfo {
  const maps = createDataMaps(file1, file2)
  const sharedSeconds = findSharedSeconds(maps)

  if (sharedSeconds.length === 0) {
    return {
      baro1Offset: 0,
      baro2Offset: 0,
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
  const vsLimit = options?.verticalSpeedLimit ?? null

  // Build reference altitude per second
  const refAlt = new Map<number, number>()
  for (const s of sharedSeconds) {
    const g1 = maps.file1GpsMap.get(s)!
    const g2 = maps.file2GpsMap.get(s)!
    const r = referenceMode === 'gps1' ? g1 : referenceMode === 'gps2' ? g2 : (g1 + g2) / 2
    refAlt.set(s, r)
  }

  // Compute reference vertical speed (central difference), if needed
  let secondsForCalib = [...sharedSeconds]
  if (!useAllShared) {
    secondsForCalib = sharedSeconds.slice(0, calibrationSeconds)
  }

  const computeVs = (secs: Array<number>): Array<number> => {
    if (secs.length === 0) return []
    const vs: Array<number> = Array(secs.length).fill(0)
    for (let i = 0; i < secs.length; i++) {
      if (i === 0) {
        const dt = secs[1] - secs[0] || 1
        vs[i] = (refAlt.get(secs[1])! - refAlt.get(secs[0])!) / dt
      } else if (i === secs.length - 1) {
        const dt = secs[i] - secs[i - 1] || 1
        vs[i] = (refAlt.get(secs[i])! - refAlt.get(secs[i - 1])!) / dt
      } else {
        const dt = secs[i + 1] - secs[i - 1] || 2
        vs[i] = (refAlt.get(secs[i + 1])! - refAlt.get(secs[i - 1])!) / dt
      }
    }
    return vs
  }

  const vsAll = computeVs(secondsForCalib)
  const filterByVs = (secs: Array<number>, vs: Array<number>): Array<number> => {
    if (vsLimit === null) return secs
    const kept: Array<number> = []
    for (let i = 0; i < secs.length; i++) {
      if (Math.abs(vs[i]) <= vsLimit) kept.push(secs[i])
    }
    return kept
  }

  const calibSeconds = filterByVs(secondsForCalib, vsAll)

  // Build calibration pairs for each sensor
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

  const pairs1 = buildPairs(1, calibSeconds)
  const pairs2 = buildPairs(2, calibSeconds)

  const calibrator1 = buildCalibrator(pairs1.hRaw, pairs1.hRef, options)
  const calibrator2 = buildCalibrator(pairs2.hRaw, pairs2.hRef, options)

  // Baro analytics across all shared seconds
  const baroAnalytics = calculateBaroAnalytics(sharedSeconds, maps, calibrator1.fn, calibrator2.fn)

  // GPS analytics unchanged
  const gpsAnalytics = calculateGPSAnalytics(sharedSeconds, maps.file1GpsMap, maps.file2GpsMap)

  // For backward compatibility, report "offset" fields as the mean correction over calibration set
  const baro1Offset = calibrator1.offsetAtMean ?? 0
  const baro2Offset = calibrator2.offsetAtMean ?? 0
  const pointsUsed = Math.min(calibrator1.pointsUsed, calibrator2.pointsUsed)

  return {
    baro1Offset,
    baro2Offset,
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
