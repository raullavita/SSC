package com.supersecurechat.app

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.Button
import android.widget.LinearLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import android.webkit.CookieManager
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

/**
 * SSC Android installed client — polished WebView shell (Step 17).
 */
class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var offlinePanel: LinearLayout
    private lateinit var nativeBridge: SscNativeBridge
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var currentUrl: String = BuildConfig.SSC_WEB_URL

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        // targetSdk 35 draws edge-to-edge; pad content below the status bar ourselves.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.parseColor("#0B141A")
        window.navigationBarColor = Color.parseColor("#0B141A")

        setContentView(R.layout.activity_main)
        val root = findViewById<View>(R.id.root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        webView = findViewById(R.id.webview)
        swipeRefresh = findViewById(R.id.swipe_refresh)
        offlinePanel = findViewById(R.id.offline_panel)
        findViewById<Button>(R.id.retry_button).setOnClickListener { reloadCurrentUrl() }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?,
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(
                        Intent.EXTRA_MIME_TYPES,
                        arrayOf("application/json", "application/octet-stream", "*/*"),
                    )
                }
                startActivityForResult(Intent.createChooser(intent, "Choose file"), FILE_CHOOSER_REQUEST)
                return true
            }
        }

        nativeBridge = SscNativeBridge(this, webView, filesDir)
        webView.addJavascriptInterface(nativeBridge, "__sscBridge")

        swipeRefresh.setColorSchemeColors(Color.parseColor("#00A884"))
        swipeRefresh.setOnRefreshListener { webView.reload() }

        webView.webViewClient = ApiClient.webViewClient(
            activity = this,
            baseUrl = BuildConfig.SSC_WEB_URL,
            webView = webView,
            onPageFinished = { swipeRefresh.isRefreshing = false },
            onLoadError = { showOfflinePanel(true) },
            onLoadSuccess = { showOfflinePanel(false) },
        )

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            },
        )

        loadEntryUrl(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        loadEntryUrl(intent)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != FILE_CHOOSER_REQUEST) return
        val callback = filePathCallback ?: return
        filePathCallback = null
        val result = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
        callback.onReceiveValue(result)
    }

    private fun loadEntryUrl(intent: Intent?) {
        currentUrl = SscDeepLink.resolveToWebUrl(intent, BuildConfig.SSC_WEB_URL)
        showOfflinePanel(false)
        webView.loadUrl(currentUrl)
    }

    private fun reloadCurrentUrl() {
        showOfflinePanel(false)
        webView.loadUrl(currentUrl)
    }

    private fun showOfflinePanel(show: Boolean) {
        offlinePanel.visibility = if (show) View.VISIBLE else View.GONE
        swipeRefresh.visibility = if (show) View.GONE else View.VISIBLE
    }

    companion object {
        private const val FILE_CHOOSER_REQUEST = 9101
    }
}