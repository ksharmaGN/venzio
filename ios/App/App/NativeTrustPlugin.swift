import Foundation
import Capacitor
import UIKit
import CommonCrypto

@objc(NativeTrustPlugin)
public class NativeTrustPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeTrustPlugin"
    public let jsName = "NativeTrust"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkMockLocation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDeviceFingerprint", returnType: CAPPluginReturnPromise)
    ]

    @objc func checkMockLocation(_ call: CAPPluginCall) {
        var ret = JSObject()
        ret["isMockLocation"] = false
        ret["hasDeveloperOptions"] = false
        call.resolve(ret)
    }

    @objc func getDeviceFingerprint(_ call: CAPPluginCall) {
        var ret = JSObject()
        let vendor = UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
        let raw = "\(vendor)|\(UIDevice.current.model)|\(UIDevice.current.systemVersion)"
        ret["deviceHash"] = Self.sha256(raw)
        ret["platform"] = "ios"
        call.resolve(ret)
    }

    private static func sha256(_ input: String) -> String {
        guard let data = input.data(using: .utf8) else { return "" }
        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes {
            _ = CC_SHA256($0.baseAddress, CC_LONG(data.count), &hash)
        }
        return hash.map { String(format: "%02x", $0) }.joined()
    }
}
