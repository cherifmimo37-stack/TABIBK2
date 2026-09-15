package com.tabibk.app

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // لون خلفية التطبيق
        window.statusBarColor = Color.rgb(43, 11, 61)
        window.navigationBarColor = Color.rgb(43, 11, 61)

        webView = WebView(this)

        // ============================================================
        // WEBVIEW / COOKIES
        // ============================================================

        val cookieManager = CookieManager.getInstance()

        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(
            webView,
            true
        )

        // ============================================================
        // WEBVIEW SETTINGS
        // ============================================================

        with(webView.settings) {

            javaScriptEnabled = true

            domStorageEnabled = true

            databaseEnabled = true

            loadsImagesAutomatically = true

            javaScriptCanOpenWindowsAutomatically = true

            setSupportMultipleWindows(false)

            cacheMode = WebSettings.LOAD_DEFAULT

            allowFileAccess = true

            allowContentAccess = true

            mixedContentMode =
                WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE

            userAgentString =
                "$userAgentString TABIBK-Android"
        }

        // ============================================================
        // WEBVIEW CLIENTS
        // ============================================================

        webView.webViewClient = WebViewClient()

        webView.webChromeClient = WebChromeClient()

        // ============================================================
        // منع قص الواجهة تحت شريط الهاتف
        // ============================================================

        webView.setPadding(
            0,
            0,
            0,
            0
        )

        webView.layoutParams =
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )

        // ============================================================
        // تحميل طبيبك
        // ============================================================

        webView.loadUrl(
            "https://tabibk2.onrender.com"
        )

        setContentView(webView)
    }

    // ================================================================
    // زر الرجوع
    // ================================================================

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {

        if (webView.canGoBack()) {

            webView.goBack()

        } else {

            super.onBackPressed()
        }
    }
}
