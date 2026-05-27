import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from './app-channel'

export interface MockLocationState {
  isMockLocation: boolean
  hasDeveloperOptions?: boolean
  suspiciousApps?: string[]
}

export interface DeviceFingerprint {
  deviceHash: string
  platform: 'android' | 'ios' | 'web'
}

export interface NativeTrustPlugin {
  checkMockLocation(): Promise<MockLocationState>
  getDeviceFingerprint(): Promise<DeviceFingerprint>
}

const NativeTrust = registerPlugin<NativeTrustPlugin>('NativeTrust', {
  web: () => import('./native-trust.web').then((m) => new m.NativeTrustWeb()),
})

export async function checkMockLocation(): Promise<MockLocationState> {
  if (!isNativeApp()) return { isMockLocation: false }
  try {
    return await NativeTrust.checkMockLocation()
  } catch {
    return { isMockLocation: false }
  }
}

export async function getDeviceFingerprint(): Promise<DeviceFingerprint | null> {
  if (!isNativeApp()) return null
  try {
    return await NativeTrust.getDeviceFingerprint()
  } catch {
    return null
  }
}
