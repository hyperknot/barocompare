// Barometric calibration helpers: altitude/pressure conversions and fitting methods.

export type CalibrationMethod =
  | '1pt-offset-alt' // h_cal = h_raw + const (median/mean offset in altitude)
  | '1pt-offset-press' // P_cal = P_raw + const (median pressure offset), then to altitude
  | '1pt-scale-press' // P_cal = s * P_raw (median scale), then to altitude
  | 'linear-alt' // h_cal = a*h_raw + b  (robust linear fit)
  | 'linear-press' // P_cal = a*P_raw + b (robust linear in P), then to altitude

export interface BaroCalibrationOptions {
  method?: CalibrationMethod
  referenceMode?: 'avg-gps' | 'gps1' | 'gps2'
  useAllShared?: boolean
  calibrationSeconds?: number
  robust?: boolean
  outlierSigma?: number
  maxCalibrationPoints?: number

  // ISA constants (overridable if desired)
  p0?: number
  t0?: number
  lapseRate?: number
}

// ISA constants and conversions
const ISA = {
  p0: 101_325, // Pa
  t0: 288.15, // K
  L: 0.0065, // K/m
  g0: 9.80665, // m/s^2
  R: 8.3144598, // J/(mol*K)
  M: 0.0289644, // kg/mol
}

const nExp = (ISA.g0 * ISA.M) / (ISA.R * ISA.L)

export function pressureFromAltitudeISA(h: number, p0 = ISA.p0, t0 = ISA.t0, L = ISA.L): number {
  const ratio = 1 - (L * h) / t0
  const safe = Math.max(ratio, 1e-8)
  return p0 * safe ** nExp
}

export function altitudeFromPressureISA(p: number, p0 = ISA.p0, t0 = ISA.t0, L = ISA.L): number {
  const r = Math.max(p / p0, 1e-12)
  return (t0 / L) * (1 - r ** (1 / nExp))
}

// Robust helpers
function median(v: Array<number>): number {
  if (v.length === 0) return 0
  const arr = [...v].sort((a, b) => a - b)
  const mid = Math.floor(arr.length / 2)
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2
}

function mad(arr: Array<number>): number {
  if (arr.length === 0) return 0
  const m = median(arr)
  const dev = arr.map((x) => Math.abs(x - m))
  return median(dev)
}

function huberWeights(residuals: Array<number>, k = 1.345): Array<number> {
  const s =
    1.4826 * mad(residuals) ||
    (residuals.length ? Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / residuals.length) : 1)
  const c = k * (s || 1)
  return residuals.map((r) => {
    const ar = Math.abs(r)
    return ar <= c ? 1 : c / ar
  })
}

// Weighted linear regression y ~ a*x + b
function weightedLinearRegression(
  x: Array<number>,
  y: Array<number>,
  w?: Array<number>,
): { a: number; b: number } {
  const n = x.length
  if (n === 0) return { a: 1, b: 0 }
  const ww = w ?? Array(n).fill(1)
  let S = 0
  let Sx = 0
  let Sy = 0
  let Sxx = 0
  let Sxy = 0
  for (let i = 0; i < n; i++) {
    const wi = ww[i]
    const xi = x[i]
    const yi = y[i]
    S += wi
    Sx += wi * xi
    Sy += wi * yi
    Sxx += wi * xi * xi
    Sxy += wi * xi * yi
  }
  const denom = S * Sxx - Sx * Sx
  if (Math.abs(denom) < 1e-12) {
    const b = Sy / (S || 1)
    return { a: 1, b }
  }
  const a = (S * Sxy - Sx * Sy) / denom
  const b = (Sy - a * Sx) / (S || 1)
  return { a, b }
}

export interface Calibrator {
  fn: (hRaw: number) => number
  pointsUsed: number

  // Internal parameters (reporting)
  altitudeSlope?: number
  altitudeOffset?: number
  pressureSlope?: number
  pressureOffset?: number
}

// Build a calibrator from raw altitude -> calibrated altitude, using the chosen method.
export function buildCalibrator(
  hRaw: Array<number>,
  hRef: Array<number>,
  options?: BaroCalibrationOptions,
): Calibrator {
  const method = options?.method ?? 'linear-alt'
  const robust = options?.robust ?? true
  const outlierSigma = options?.outlierSigma ?? 4
  const p0 = options?.p0 ?? ISA.p0
  const t0 = options?.t0 ?? ISA.t0
  const L = options?.lapseRate ?? ISA.L

  let pairs = hRaw
    .map((h, i) => ({ h, href: hRef[i] }))
    .filter((p) => Number.isFinite(p.h) && Number.isFinite(p.href))

  if (pairs.length === 0) {
    return {
      fn: (h) => h,
      pointsUsed: 0,
    }
  }

  // Light outlier pruning with a quick linear fit in altitude
  if (pairs.length >= 5) {
    const x = pairs.map((p) => p.h)
    const y = pairs.map((p) => p.href)
    const lin0 = weightedLinearRegression(x, y)
    const res = pairs.map((p) => p.href - (lin0.a * p.h + lin0.b))
    const s = 1.4826 * mad(res) || Math.sqrt(res.reduce((a, r) => a + r * r, 0) / res.length) || 1
    const thr = outlierSigma * s
    pairs = pairs.filter((_, i) => Math.abs(res[i]) <= thr)
  }

  const n = pairs.length

  if (method === '1pt-offset-alt') {
    const offsets = pairs.map((p) => p.href - p.h)
    const off = median(offsets)
    const fn = (h: number) => h + off
    return {
      fn,
      pointsUsed: n,
      altitudeSlope: 1,
      altitudeOffset: off,
    }
  }

  if (method === 'linear-alt') {
    const x = pairs.map((p) => p.h)
    const y = pairs.map((p) => p.href)
    let a = 1
    let b = 0
    let w = Array(n).fill(1)
    for (let iter = 0; iter < (robust ? 3 : 1); iter++) {
      const fit = weightedLinearRegression(x, y, w)
      a = fit.a
      b = fit.b
      const res = y.map((yi, i) => yi - (a * x[i] + b))
      if (!robust) break
      w = huberWeights(res)
    }
    const fn = (h: number) => a * h + b
    return {
      fn,
      pointsUsed: n,
      altitudeSlope: a,
      altitudeOffset: b,
    }
  }

  if (method === '1pt-offset-press' || method === 'linear-press' || method === '1pt-scale-press') {
    const pRaw = pairs.map((p) => pressureFromAltitudeISA(p.h, p0, t0, L))
    const pRef = pairs.map((p) => pressureFromAltitudeISA(p.href, p0, t0, L))

    if (method === '1pt-offset-press') {
      const diffs = pRef.map((pr, i) => pr - pRaw[i])
      const b = median(diffs)
      const fn = (h: number) => {
        const pr = pressureFromAltitudeISA(h, p0, t0, L)
        const pc = pr + b
        const pcClamped = Math.min(Math.max(pc, 5_000), 110_000)
        return altitudeFromPressureISA(pcClamped, p0, t0, L)
      }
      return {
        fn,
        pointsUsed: n,
        pressureOffset: b,
      }
    }

    if (method === '1pt-scale-press') {
      const ratios = pRef.map((pref, i) => pref / (pRaw[i] || 1))
      const s = median(ratios)
      const fn = (h: number) => {
        const pr = pressureFromAltitudeISA(h, p0, t0, L)
        const pc = s * pr
        const pcClamped = Math.min(Math.max(pc, 5_000), 110_000)
        return altitudeFromPressureISA(pcClamped, p0, t0, L)
      }
      return {
        fn,
        pointsUsed: n,
        pressureSlope: s,
      }
    }

    // linear-press
    let a = 1
    let b = 0
    let w = Array(n).fill(1)
    for (let iter = 0; iter < (robust ? 3 : 1); iter++) {
      const fit = weightedLinearRegression(pRaw, pRef, w)
      a = fit.a
      b = fit.b
      const res = pRef.map((pref, i) => pref - (a * pRaw[i] + b))
      if (!robust) break
      w = huberWeights(res)
    }
    const fn = (h: number) => {
      const pr = pressureFromAltitudeISA(h, p0, t0, L)
      const pc = a * pr + b
      const pcClamped = Math.min(Math.max(pc, 5_000), 110_000)
      return altitudeFromPressureISA(pcClamped, p0, t0, L)
    }
    return {
      fn,
      pointsUsed: n,
      pressureSlope: a,
      pressureOffset: b,
    }
  }

  // Fallback
  return {
    fn: (h) => h,
    pointsUsed: pairs.length,
  }
}
