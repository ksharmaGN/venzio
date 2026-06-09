import Capacitor
import WebKit

class MyViewController: CAPBridgeViewController, WKUIDelegate {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeTrustPlugin())
        bridge?.registerPluginInstance(NativeSessionPlugin())
        bridge?.registerPluginInstance(NativeGeofencePlugin())
    }

    override func viewDidLoad() {
        NativeSessionPlugin.restoreFromPrefsIfNeeded()
        super.viewDidLoad()
        bridge?.webView?.uiDelegate = self
    }

    // Keep target=_blank and window.open on venzio.ai inside the app (do not hand off to Safari).
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            webView.load(URLRequest(url: url))
        }
        return nil
    }
}
