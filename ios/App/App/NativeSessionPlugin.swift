import Foundation
import Capacitor
import WebKit

@objc(NativeSessionPlugin)
public class NativeSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSessionPlugin"
    public let jsName = "NativeSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "persistSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restoreSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearSession", returnType: CAPPluginReturnPromise)
    ]

    private static let prefsKey = "venzio_native_session"
    private static let tokenKey = "session_token"
    private static let originKey = "server_origin"
    private static let cookieSession = "vnz_session"
    private static let cookieUI = "vnz_ui"

    @objc func persistSession(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), let origin = call.getString("origin") else {
            call.reject("token and origin required")
            return
        }
        Self.save(token: token, origin: origin)
        Self.applyCookies(origin: origin, token: token)
        call.resolve()
    }

    @objc func restoreSession(_ call: CAPPluginCall) {
        guard let origin = call.getString("origin") else {
            call.reject("origin required")
            return
        }
        let defaults = UserDefaults.standard
        guard
            let token = defaults.string(forKey: Self.tokenKey),
            let savedOrigin = defaults.string(forKey: Self.originKey),
            savedOrigin == origin
        else {
            call.resolve()
            return
        }
        Self.applyCookies(origin: origin, token: token)
        call.resolve()
    }

    @objc func clearSession(_ call: CAPPluginCall) {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: Self.tokenKey)
        defaults.removeObject(forKey: Self.originKey)
        if let origin = call.getString("origin") {
            Self.clearCookies(origin: origin)
        }
        call.resolve()
    }

    static func restoreFromPrefsIfNeeded() {
        let defaults = UserDefaults.standard
        guard
            let token = defaults.string(forKey: tokenKey),
            let origin = defaults.string(forKey: originKey)
        else { return }
        applyCookies(origin: origin, token: token)
    }

    static func readServerOrigin() -> String {
        guard
            let url = Bundle.main.url(forResource: "capacitor.config", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let server = json["server"] as? [String: Any],
            let urlStr = server["url"] as? String,
            let components = URLComponents(string: urlStr),
            let host = components.host,
            let scheme = components.scheme
        else { return "https://venzio.ai" }
        return "\(scheme)://\(host)"
    }

    private static func save(token: String, origin: String) {
        let defaults = UserDefaults.standard
        defaults.set(token, forKey: tokenKey)
        defaults.set(origin, forKey: originKey)
    }

    private static func applyCookies(origin: String, token: String) {
        guard let url = URL(string: origin) else { return }
        let secure = origin.hasPrefix("https://")
        let securePart = secure ? "; Secure" : ""
        let store = WKWebsiteDataStore.default().httpCookieStore
        let maxAge = 60 * 60 * 24 * 30
        let sessionProps: [HTTPCookiePropertyKey: Any] = [
            .name: cookieSession,
            .value: token,
            .domain: url.host ?? "",
            .path: "/",
            .maximumAge: maxAge,
            .secure: secure
        ]
        let uiProps: [HTTPCookiePropertyKey: Any] = [
            .name: cookieUI,
            .value: "1",
            .domain: url.host ?? "",
            .path: "/",
            .maximumAge: maxAge,
            .secure: secure
        ]
        if let c1 = HTTPCookie(properties: sessionProps) { store.setCookie(c1) }
        if let c2 = HTTPCookie(properties: uiProps) { store.setCookie(c2) }
        HTTPCookieStorage.shared.cookieAcceptPolicy = .always
        _ = securePart
    }

    private static func clearCookies(origin: String) {
        guard let url = URL(string: origin), let host = url.host else { return }
        let store = WKWebsiteDataStore.default().httpCookieStore
        for name in [cookieSession, cookieUI] {
            let props: [HTTPCookiePropertyKey: Any] = [
                .name: name,
                .value: "",
                .domain: host,
                .path: "/",
                .maximumAge: 0
            ]
            if let c = HTTPCookie(properties: props) { store.setCookie(c) }
        }
    }
}
