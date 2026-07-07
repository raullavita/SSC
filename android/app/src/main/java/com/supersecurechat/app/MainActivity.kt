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
import com.supersecurechat.app.oauth.GoogleAuthHelper

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = result.data?.data?.let { arrayOf(it) } ?: emptyArray()
        fileUploadCallback?.onReceiveValue(uris)
        fileUploadCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        swipeRefreshLayout = SwipeRefreshLayout(this)
        webView = WebView(this).also { wv ->
            wv.settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccessFromFileURLs = false
                allowUniversalAccessFromFileURLs = false
            }
            wv.webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView,
                    filePathCallback: ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams,
                ): Boolean {
                    fileUploadCallback?.onReceiveValue(null)
                    fileUploadCallback = filePathCallback
                    fileChooserLauncher.launch(fileChooserParams.createIntent())
                    return true
                }
            }
            wv.webViewClient = ApiClient(this@MainActivity)
        }

        swipeRefreshLayout.addView(webView)
        swipeRefreshLayout.setOnRefreshListener {
            webView.reload()
            swipeRefreshLayout.isRefreshing = false
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
            ?: run {
                GoogleAuthHelper.parseOAuthCode(intent)?.let { code ->
                    webView.evaluateJavascript(
                        "window.__sscOAuthCode=\"${code}\";window.dispatchEvent(new Event('ssc-oauth'));",
                        null,
                    )
                }
            }
    }
}
