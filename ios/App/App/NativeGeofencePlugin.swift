import Foundation
import Capacitor
import CoreLocation

@objc(NativeGeofencePlugin)
public class NativeGeofencePlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "NativeGeofencePlugin"
    public let jsName = "NativeGeofence"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startMonitoring", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopMonitoring", returnType: CAPPluginReturnPromise)
    ]

    private var locationManager: CLLocationManager?
    private var regions: [CLCircularRegion] = []
    private var regionNames: [String: String] = [:]
    private var lastEnter: [String: Date] = [:]
    private let debounce: TimeInterval = 4 * 3600

    @objc func startMonitoring(_ call: CAPPluginCall) {
        guard let geofences = call.getArray("geofences", JSObject.self) else {
            call.reject("geofences required")
            return
        }
        stopMonitoringInternal()
        let manager = CLLocationManager()
        manager.delegate = self
        manager.requestAlwaysAuthorization()
        locationManager = manager

        var built: [CLCircularRegion] = []
        for obj in geofences {
            guard let id = obj["id"] as? String,
                  let lat = obj["lat"] as? Double,
                  let lng = obj["lng"] as? Double else { continue }
            let name = obj["name"] as? String ?? "Office"
            let radius = (obj["radiusM"] as? Int).map(Double.init) ?? 300
            let center = CLLocationCoordinate2D(latitude: lat, longitude: lng)
            let region = CLCircularRegion(center: center, radius: radius, identifier: id)
            region.notifyOnEntry = true
            region.notifyOnExit = false
            built.append(region)
            regionNames[id] = name
            manager.startMonitoring(for: region)
        }
        regions = built
        call.resolve()
    }

    @objc func stopMonitoring(_ call: CAPPluginCall) {
        stopMonitoringInternal()
        call.resolve()
    }

    private func stopMonitoringInternal() {
        if let manager = locationManager {
            for region in regions {
                manager.stopMonitoring(for: region)
            }
        }
        regions = []
        regionNames = [:]
        locationManager = nil
    }

    public func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        let id = region.identifier
        let now = Date()
        if let last = lastEnter[id], now.timeIntervalSince(last) < debounce { return }
        lastEnter[id] = now
        var data = JSObject()
        data["geofenceId"] = id
        data["name"] = regionNames[id] ?? "Office"
        notifyListeners("geofenceEnter", data: data)
    }
}
