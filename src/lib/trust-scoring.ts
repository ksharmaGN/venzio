/** Client-safe trust score helpers — no DB imports */

export type TrustFlag =
  | 'mock_gps_suspected'
  | 'mock_location_enabled'
  | 'unknown_device'
  | 'timezone_mismatch'
  | 'vpn_suspected'
  | 'impossible_travel'

/** Server-side weights — align with Instruction-Native-App.md; tune without client changes */
export const TRUST_FLAG_DELTAS: Record<TrustFlag, number> = {
  mock_gps_suspected: -50,
  mock_location_enabled: -45,
  unknown_device: -20,
  timezone_mismatch: -10,
  vpn_suspected: -15,
  impossible_travel: -40,
}

export const TRUST_BASE_SCORE = 100

export type TrustLevel = 'verified' | 'partial' | 'suspicious'

export function trustLevelFromScore(score: number): TrustLevel {
  if (score >= 80) return 'verified'
  if (score >= 50) return 'partial'
  return 'suspicious'
}

export function computeTrustScore(flags: TrustFlag[]): number {
  let score = TRUST_BASE_SCORE
  for (const flag of flags) {
    score += TRUST_FLAG_DELTAS[flag] ?? 0
  }
  return Math.max(0, Math.min(100, score))
}
