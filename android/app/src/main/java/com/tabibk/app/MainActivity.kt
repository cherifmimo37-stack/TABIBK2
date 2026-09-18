package com.tabibk.app

import android.annotation.SuppressLint
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var splashView: View

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {

        super.onCreate(savedInstanceState)

        // ============================================================
        // ألوان TABIBK
        // ============================================================

        window.statusBarColor = Color.rgb(43, 11, 61)
        window.navigationBarColor = Color.rgb(43, 11, 61)

        // ============================================================
        // ROOT
        // ============================================================

        val root = FrameLayout(this)

        // ============================================================
        // WEBVIEW
        // ============================================================

        webView = WebView(this)

        val webParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )

        webView.layoutParams = webParams

        // ============================================================
        // COOKIES
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
        // WEBVIEW CLIENT
        // ============================================================

        webView.webViewClient = object : WebViewClient() {

            override fun onPageFinished(
                view: WebView?,
                url: String?
            ) {

                super.onPageFinished(view, url)

                // ----------------------------------------------------
                // نتأكد أن Render لم يعد يعرض Application loading
                // ----------------------------------------------------

                webView.evaluateJavascript(
                    """
                    (function() {
                        return document.body
                            ? document.body.innerText
                            : "";
                    })();
                    """.trimIndent()
                ) { result ->

                    val pageText =
                        result
                            .replace("\\n", " ")
                            .replace("\\\"", "\"")

                    val renderLoading =
                        pageText.contains(
                            "Application loading",
                            ignoreCase = true
                        )

                    if (!renderLoading) {

                        hideSplash()
                    }
                }
            }
        }

        webView.webChromeClient = WebChromeClient()

        // ============================================================
        // إضافة WebView
        // ============================================================

        root.addView(webView)

        // ============================================================
        // SPLASH SCREEN
        // ============================================================

        splashView = createSplashScreen()

        root.addView(splashView)

        // ============================================================
        // إظهار التطبيق
        // ============================================================

        setContentView(root)

        // ============================================================
        // تحميل طبيبك
        // ============================================================

        webView.loadUrl(
            "https://tabibk2.onrender.com"
        )
    }

    // ================================================================
    // إنشاء شاشة البداية
    // ================================================================

    private fun createSplashScreen(): View {

        val splash = FrameLayout(this)

        splash.setBackgroundColor(
            Color.rgb(43, 11, 61)
        )

        val content =
            LinearLayout(this)

        content.orientation =
            LinearLayout.VERTICAL

        content.gravity =
            Gravity.CENTER

        val contentParams =
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )

        content.layoutParams =
            contentParams

        // ============================================================
        // شعار طبيبك
        // ============================================================

        val logo =
            ImageView(this)

        logo.setImageResource(
            R.drawable.ic_tabibk
        )

        logo.scaleType =
            ImageView.ScaleType.CENTER_INSIDE

        val logoParams =
            LinearLayout.LayoutParams(
                dp(150),
                dp(150)
            )

        logo.layoutParams =
            logoParams

        content.addView(logo)

        // ============================================================
        // طبيبك
        // ============================================================

        val title =
            TextView(this)

        title.text =
            "طبيبك"

        title.textSize =
            42f

        title.setTextColor(
            Color.rgb(233, 196, 93)
        )

        title.typeface =
            Typeface.create(
                "sans-serif",
                Typeface.BOLD
            )

        title.gravity =
            Gravity.CENTER

        val titleParams =
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )

        titleParams.topMargin =
            dp(5)

        title.layoutParams =
            titleParams

        content.addView(title)

        // ============================================================
        // TABIBK
        // ============================================================

        val tabibk =
            TextView(this)

        tabibk.text =
            "TABIBK"

        tabibk.textSize =
            20f

        tabibk.setTextColor(
            Color.WHITE
        )

        tabibk.letterSpacing =
            0.25f

        tabibk.typeface =
            Typeface.create(
                "sans-serif",
                Typeface.BOLD
            )

        tabibk.gravity =
            Gravity.CENTER

        content.addView(tabibk)

        // ============================================================
        // الشعار
        // ============================================================

        val slogan =
            TextView(this)

        slogan.text =
            "مواعيدك .. أسهل"

        slogan.textSize =
            18f

        slogan.setTextColor(
            Color.rgb(233, 196, 93)
        )

        slogan.gravity =
            Gravity.CENTER

        val sloganParams =
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )

        sloganParams.topMargin =
            dp(20)

        slogan.layoutParams =
            sloganParams

        content.addView(slogan)

        // ============================================================
        // نص التحميل
        // ============================================================

        val loading =
            TextView(this)

        loading.text =
            "جاري تجهيز طبيبك..."

        loading.textSize =
            14f

        loading.setTextColor(
            Color.LTGRAY
        )

        loading.gravity =
            Gravity.CENTER

        val loadingParams =
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )

        loadingParams.topMargin =
            dp(35)

        loading.layoutParams =
            loadingParams

        content.addView(loading)

        splash.addView(content)

        return splash
    }

    // ================================================================
    // إخفاء شاشة البداية
    // ================================================================

    private fun hideSplash() {

        if (::splashView.isInitialized &&
            splashView.visibility == View.VISIBLE
        ) {

            splashView.animate()
                .alpha(0f)
                .setDuration(350)
                .withEndAction {
                    splashView.visibility =
                        View.GONE
                }
                .start()
        }
    }

    // ================================================================
    // تحويل DP
    // ================================================================

    private fun dp(value: Int): Int {

        return (
            value *
                resources.displayMetrics.density
            ).toInt()
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
