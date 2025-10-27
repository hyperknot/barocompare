import type { IGCFileWithMetadata, CalibrationInfo, TimeRange, BRecord, BaroAnalytics, GPSAnalytics } from '../types'

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
    file2GpsMap: new Map()
  }

  file1.fixes.forEach(fix => {
    const secondTimestamp = Math.floor(fix.timestamp / 1000)
    if (fix.pressureAltitude !== null) {
      maps.file1BaroMap.set(secondTimestamp, fix.pressureAltitude)
    }
    if (fix.gpsAltitude !== null) {
      maps.file1GpsMap.set(secondTimestamp, fix.gpsAltitude)
    }
  })

  file2.fixes.forEach(fix => {
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

function findSharedSeconds(maps: DataMaps): number[] {
  const sharedSeconds: number[] = []

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
  calibrationPoints: number[],
  maps: DataMaps
): { baro1Offset: number; baro2Offset: number; referenceAltitude: number } {
  const baro1Diffs: number[] = []
  const baro2Diffs: number[] = []
  let sumGpsAvg = 0

  for (const second of calibrationPoints) {
    const gps1 = maps.file1GpsMap.get(second)!
    const gps2 = maps.file2GpsMap.get(second)!
    const avgGps = (gps1 + gps2) / 2
    sumGpsAvg += avgGps

    const baro1 = maps.file1BaroMap.get(second)!
    const baro2 = maps.file2BaroMap.get(second)!

    baro1Diffs.push(avgGps - baro1)
    baro2Diffs.push(avgGps - baro2)
  }

  const baro1Offset = baro1Diffs.reduce((acc, val) => acc + val, 0) / baro1Diffs.length
  const baro2Offset = baro2Diffs.reduce((acc, val) => acc + val, 0) / baro2Diffs.length
  const referenceAltitude = sumGpsAvg / calibrationPoints.length

  return { baro1Offset, baro2Offset, referenceAltitude }
}

function calculateBaroAnalytics(
  allSharedSeconds: number[],
  maps: DataMaps,
  baro1Offset: number,
  baro2Offset: number
): BaroAnalytics {
  const differences: number[] = []

  for (const second of allSharedSeconds) {
    const baro1 = maps.file1BaroMap.get(second)
    const baro2 = maps.file2BaroMap.get(second)

    if (baro1 !== undefined && baro2 !== undefined) {
      const calibratedBaro1 = baro1 + baro1Offset
      const calibratedBaro2 = baro2 + baro2Offset
      differences.push(calibratedBaro1 - calibratedBaro2)
    }
  }

  if (differences.length === 0) {
    return {
      meanDifference: 0,
      maxDifference: 0,
      percentile95: 0
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
    percentile95
  }
}

function calculateGPSAnalytics(
  allSharedSeconds: number[],
  gpsMap: Map<number, number>,
  otherGpsMap: Map<number, number>
): GPSAnalytics {
  const differences: number[] = []

  for (const second of allSharedSeconds) {
    const gps1 = gpsMap.get(second)
    const gps2 = otherGpsMap.get(second)

    if (gps1 !== undefined && gps2 !== undefined) {
      const avgGps = (gps1 + gps2) / 2
      differences.push(gps1 - avgGps)
    }
  }

  if (differences.length === 0) {
    return {
      meanDifference: 0,
      maxDifference: 0,
      percentile95: 0
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
    percentile95
  }
}

export function calculateBaroCalibration(
  file1: IGCFileWithMetadata,
  file2: IGCFileWithMetadata
): CalibrationInfo {
  const maps = createDataMaps(file1, file2)
  const sharedSeconds = findSharedSeconds(maps)

  if (sharedSeconds.length === 0) {
    return {
      baro1Offset: 0,
      baro2Offset: 0,
      pointsUsed: 0,
      referenceAltitude: 0,
      baroAnalytics: {
        meanDifference: 0,
        maxDifference: 0,
        percentile95: 0
      },
      gps1Analytics: {
        meanDifference: 0,
        maxDifference: 0,
        percentile95: 0
      },
      gps2Analytics: {
        meanDifference: 0,
        maxDifference: 0,
        percentile95: 0
      }
    }
  }

  // Use first 60 seconds for calibration
  const calibrationPoints = sharedSeconds.slice(0, 60)
  const { baro1Offset, baro2Offset, referenceAltitude } = calculateOffsets(calibrationPoints, maps)

  // Calculate baro analytics using all shared points
  const baroAnalytics = calculateBaroAnalytics(sharedSeconds, maps, baro1Offset, baro2Offset)

  // Calculate GPS analytics using all shared points
  const gps1Analytics = calculateGPSAnalytics(sharedSeconds, maps.file1GpsMap, maps.file2GpsMap)
  const gps2Analytics = calculateGPSAnalytics(sharedSeconds, maps.file2GpsMap, maps.file1GpsMap)

  return {
    baro1Offset,
    baro2Offset,
    pointsUsed: calibrationPoints.length,
    referenceAltitude,
    baroAnalytics,
    gps1Analytics,
    gps2Analytics
  }
}

function getTimestampsWithCompleteData(file: IGCFileWithMetadata): number[] {
  return file.fixes
    .filter(fix => fix.gpsAltitude !== null && fix.pressureAltitude !== null)
    .map(fix => fix.timestamp)
}

export function findCommonTimeRange(
  file1: IGCFileWithMetadata,
  file2: IGCFileWithMetadata
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