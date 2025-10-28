// Barometric calibration helpers: altitude/pressure conversions and fitting methods.

export type CalibrationMethod =
  | 'offset-alt-1pt' // h_cal = h_raw + const (median offset)
  | 'linear-alt' // h_cal = a*h_raw + b  (robust linear fit)
  | 'quadratic-alt' // h_cal = a2*h^2 + a1*h + a0 (rarely needed)
  | 'offset-press' // P_cal = P_raw + const (median pressure offset), then to altitude
  | 'linear-press' // P_cal = a*P_raw + b (robust linear in P), then to altitude

export interface BaroCalibrationOptions {
  method?: CalibrationMethod
  referenceMode?: 'avg-gps' | 'gps1' | 'gps2' // how to build reference altitude
  useAllShared?: boolean // if false, use only first calibrationSeconds
  calibrationSeconds?: number // default: 60 if useAllShared === false
  verticalSpeedLimit?: number | null // m/s; if set, filter points by |V| <= limit (computed on ref alt)
  robust?: boolean // use robust weighting in regression fits
  outlierSigma?: number // sigma threshold for hard outlier rejection (default 4)
  // ISA constants (overridable if desired)
  p0?: number
  t0?: number
  lapseRate?: number
}

// ISA constants and conversions
const ISA = {
  p0: 101_325, // Pa
  t0: 288.15, // K
  L: 0.0065, // K/m (tropospheric lapse rate)
  g0: 9.80665, // m/s^2
  R: 8.3144598, // J/(mol*K)
  M: 0.0289644, // kg/mol
}

// exponent n = gM/(RL) ~ 5.25588
const nExp = (ISA.g0 * ISA.M) / (ISA.R * ISA.L)

export function pressureFromAltitudeISA(h: number, p0 = ISA.p0, t0 = ISA.t0, L = ISA.L): number {
  // p = p0 * (1 - L*h/T0)^(n)
  const ratio = 1 - (L * h) / t0
  // Guard small negative at very high altitudes
  const safe = Math.max(ratio, 1e-8)
  return p0 * safe ** nExp
}

export function altitudeFromPressureISA(p: number, p0 = ISA.p0, t0 = ISA.t0, L = ISA.L): number {
  // h = (T0/L) * (1 - (p/p0)^(1/n))
  const r = Math.max(p / p0, 1e-12)
  return (t0 / L) * (1 - r ** (1 / nExp))
}

// Numerical derivative d(alt)/d(p) by central difference
function dAlt_dP(p: number, p0 = ISA.p0, t0 = ISA.t0, L = ISA.L): number {
  const dp = Math.max(0.1, Math.abs(p) * 1e-6)
  const ap = altitudeFromPressureISA(p + dp, p0, t0, L)
  const am = altitudeFromPressureISA(p - dp, p0, t0, L)
  return (ap - am) / (2 * dp)
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
  // k * 1.4826 * MAD is a robust threshold
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
    // fallback: pure offset
    const b = (Sy - Number(Sx)) / (S || 1)
    return { a: 1, b }
  }
  const a = (S * Sxy - Sx * Sy) / denom
  const b = (Sy - a * Sx) / (S || 1)
  return { a, b }
}

// Weighted quadratic regression y ~ A*x^2 + B*x + C
function weightedQuadraticRegression(
  x: Array<number>,
  y: Array<number>,
  w?: Array<number>,
): { A: number; B: number; C: number } {
  const n = x.length
  if (n < 3) {
    // fallback to linear
    const lin = weightedLinearRegression(x, y, w)
    return { A: 0, B: lin.a, C: lin.b }
  }
  const ww = w ?? Array(n).fill(1)
  let S0 = 0
  let S1 = 0
  let S2 = 0
  let S3 = 0
  let S4 = 0
  let T0 = 0
  let T1 = 0
  let T2 = 0
  for (let i = 0; i < n; i++) {
    const wi = ww[i]
    const xi = x[i]
    const yi = y[i]
    const x2 = xi * xi
    const x3 = x2 * xi
    const x4 = x3 * xi
    S0 += wi
    S1 += wi * xi
    S2 += wi * x2
    S3 += wi * x3
    S4 += wi * x4
    T0 += wi * yi
    T1 += wi * xi * yi
    T2 += wi * x2 * yi
  }
  // Solve symmetric 3x3:
  // [S4 S3 S2][A] = [T2]
  // [S3 S2 S1][B]   [T1]
  // [S2 S1 S0][C]   [T0]
  const A = [
    [S4, S3, S2],
    [S3, S2, S1],
    [S2, S1, S0],
  ]
  const B = [T2, T1, T0]
  const sol = solve3x3(A, B)
  if (!sol) {
    // fallback to linear
    const lin = weightedLinearRegression(x, y, w)
    return { A: 0, B: lin.a, C: lin.b }
  }
  return { A: sol[0], B: sol[1], C: sol[2] }
}

function solve3x3(A: Array<Array<number>>, b: Array<number>): [number, number, number] | null {
  // Simple Gaussian elimination with partial pivoting
  const M = A.map((row) => row.slice())
  const v = b.slice()
  const n = 3
  for (let i = 0; i < n; i++) {
    // pivot
    let pivot = i
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(M[r][i]) > Math.abs(M[pivot][i])) pivot = r
    }
    if (Math.abs(M[pivot][i]) < 1e-12) return null
    if (pivot !== i) {
      ;[M[i], M[pivot]] = [M[pivot], M[i]]
      ;[v[i], v[pivot]] = [v[pivot], v[i]]
    }
    // eliminate
    const diag = M[i][i]
    for (let r = i + 1; r < n; r++) {
      const f = M[r][i] / diag
      for (let c = i; c < n; c++) M[r][c] -= f * M[i][c]
      v[r] -= f * v[i]
    }
  }
  // back-substitute
  const x = Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let s = v[i]
    for (let c = i + 1; c < n; c++) s -= M[i][c] * x[c]
    x[i] = s / M[i][i]
  }
  return [x[0], x[1], x[2]]
}

export interface Calibrator {
  fn: (hRaw: number) => number // maps raw baro altitude -> calibrated altitude
  describe: () => string // short description of method/params
  offsetAtMean?: number // mean(h_cal - h_raw) over calibration set
  pointsUsed: number
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

  // Defensive copies
  let pairs = hRaw
    .map((h, i) => ({ h, href: hRef[i] }))
    .filter((p) => Number.isFinite(p.h) && Number.isFinite(p.href))

  if (pairs.length === 0) {
    return {
      fn: (h) => h,
      describe: () => 'identity (no data)',
      pointsUsed: 0,
      offsetAtMean: 0,
    }
  }

  // Initial linear residuals for outlier pruning (very light)
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
  const meanOffsetAt = (fn: (h: number) => number) => {
    const diffs = pairs.map((p) => fn(p.h) - p.h)
    return diffs.reduce((a, d) => a + d, 0) / (diffs.length || 1)
  }

  if (method === 'offset-alt-1pt') {
    // Single-point or median offset in altitude domain
    const offsets = pairs.map((p) => p.href - p.h)
    const off = median(offsets)
    const fn = (h: number) => h + off
    return {
      fn,
      describe: () => `offset-alt-1pt: +${off.toFixed(2)} m`,
      pointsUsed: n,
      offsetAtMean: meanOffsetAt(fn),
    }
  }

  if (method === 'linear-alt') {
    // Robust linear fit in altitude space
    const x = pairs.map((p) => p.h)
    const y = pairs.map((p) => p.href)
    let a = 1
    let b = 0
    // IRLS
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
      describe: () => `linear-alt: a=${a.toFixed(6)}, b=${b.toFixed(2)}`,
      pointsUsed: n,
      offsetAtMean: meanOffsetAt(fn),
    }
  }

  if (method === 'quadratic-alt') {
    const x = pairs.map((p) => p.h)
    const y = pairs.map((p) => p.href)
    // Simple robusting: one pass weights from linear residuals
    let w: Array<number> | undefined
    if (robust) {
      const lin = weightedLinearRegression(x, y)
      const res = y.map((yi, i) => yi - (lin.a * x[i] + lin.b))
      w = huberWeights(res)
    }
    const fit = weightedQuadraticRegression(x, y, w)
    const fn = (h: number) => fit.A * h * h + fit.B * h + fit.C
    return {
      fn,
      describe: () =>
        `quadratic-alt: A=${fit.A.toExponential(3)}, B=${fit.B.toFixed(6)}, C=${fit.C.toFixed(2)}`,
      pointsUsed: n,
      offsetAtMean: meanOffsetAt(fn),
    }
  }

  if (method === 'offset-press' || method === 'linear-press') {
    // Work in pressure domain: map P_raw -> P_cal, then convert to altitude via ISA.
    const pRaw = pairs.map((p) => pressureFromAltitudeISA(p.h, p0, t0, L))
    const pRef = pairs.map((p) => pressureFromAltitudeISA(p.href, p0, t0, L))

    if (method === 'offset-press') {
      // Median constant offset in Pascal space
      const diffs = pRef.map((pr, i) => pr - pRaw[i])
      const b = median(diffs)
      const fn = (h: number) => {
        const pr = pressureFromAltitudeISA(h, p0, t0, L)
        const pc = pr + b
        // clamp to valid range
        const pcClamped = Math.min(Math.max(pc, 5_000), 110_000)
        return altitudeFromPressureISA(pcClamped, p0, t0, L)
      }
      return {
        fn,
        describe: () => `offset-press: +${b.toFixed(1)} Pa`,
        pointsUsed: n,
        offsetAtMean: meanOffsetAt(fn),
      }
    }

    if (method === 'linear-press') {
      // Robust linear fit: p_ref ≈ a * p_raw + b
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
        describe: () => `linear-press: a=${a.toFixed(6)}, b=${b.toFixed(1)} Pa`,
        pointsUsed: n,
        offsetAtMean: meanOffsetAt(fn),
      }
    }
  }

  // Fallback (should not reach)
  return {
    fn: (h) => h,
    describe: () => 'identity (fallback)',
    pointsUsed: pairs.length,
    offsetAtMean: 0,
  }
}
