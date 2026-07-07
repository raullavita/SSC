package com.supersecurechat.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

/**
 * Main activity for the SSC Android installed-client shell.
 * Loads the bundled web frontend from [BuildConfig.SSC_BUNDLED_ENTRY_URL] inside a
 * [WebView] wrapped in a [SwipeRefreshLayout] for pull-to-refresh UX.
 */
class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        filePathCallback?.onReceiveValue(uris.toTypedArray())
        filePathCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        webView = WebView(this).also { wv ->
            wv.settings.javaScriptEnabled = true
            wv.settings.domStorageEnabled = true
            wv.settings.allowFileAccessFromFileURLs = true
            wv.webViewClient = ApiClient()
            wv.webChromeClient = SscWebChromeClient()
        }

        swipeRefreshLayout = SwipeRefreshLayout(this).also { srl ->
            srl.addView(webView)
            srl.setOnRefreshListener { webView.reload() }
        }
        setContentView(swipeRefreshLayout)

        val startUrl = SscDeepLink.resolveToWebUrl(intent)
            ?: BuildConfig.SSC_BUNDLED_ENTRY_URL
        webView.loadUrl(startUrl)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        SscDeepLink.resolveToWebUrl(intent)?.let { webView.loadUrl(it) }
    }

    private inner class SscWebChromeClient : WebChromeClient() {
        override fun onShowFileChooser(
            webView: WebView,
            filePathCallback: ValueCallback<Array<Uri>>,
            fileChooserParams: FileChooserParams,
        ): Boolean {
            this@MainActivity.filePathCallback = filePathCallback
            fileChooserLauncher.launch("*/*")
            return true
        }

        override fun onProgressChanged(view: WebView, newProgress: Int) {
            swipeRefreshLayout.isRefreshing = newProgress < 100
        }
    }
}