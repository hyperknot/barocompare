export interface IGCFix {
  timestamp: number
  time: string
  latitude: number
  longitude: number
  valid: boolean
  pressureAltitude: number
  gpsAltitude: number
  extensions: Record<string, any>
  enl: null | number
  fixAccuracy: null | number
}

export interface IGCData {
  numFlight: string | null
  pilot: string | null
  copilot: string | null
  gliderType: string | null
  registration: string | null
  callsign: string | null
  competitionClass: string | null
  loggerType: string | null
  firmwareVersion: string | null
  hardwareVersion: string | null
  geoDatum: string | null
  geoDatumAlgorithm: string | null
  geoPressureAlgorithm: string | null
  task: any
  fixes: IGCFix[]
}