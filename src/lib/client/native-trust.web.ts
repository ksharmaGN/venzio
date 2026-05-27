import { WebPlugin } from '@capacitor/core'
import type { DeviceFingerprint, MockLocationState, NativeTrustPlugin } from './native-trust'

export class NativeTrustWeb extends WebPlugin implements NativeTrustPlugin {
  async checkMockLocation(): Promise<MockLocationState> {
    return { isMockLocation: false }
  }

  async getDeviceFingerprint(): Promise<DeviceFingerprint> {
    return { deviceHash: 'web', platform: 'web' }
  }
}
