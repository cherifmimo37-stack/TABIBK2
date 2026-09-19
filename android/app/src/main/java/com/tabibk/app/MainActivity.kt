package com.tabibk.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
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
import androidx.core.app.ActivityCompat
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var splashView: View

    private var tabibkReady = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {

        super.onCreate(savedInstanceState)

        // ============================================================
        // FCM TOKEN
        // ============================================================

        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->

                if (task.isSuccessful) {

                    val token = task.result

                    // تسجيل الـToken في Log فقط
                    // بدون عرضه للمستخدم
                    Log.d(
                        "TABIBK_FCM_TOKEN",
                        token
                    )
                }
            }

        // ============================================================
        // صلاحية الإشعارات Android 13+
        // ============================================================

        if (
            android.os.Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {

            ActivityCompat.requestPermissions(
                this,
                arrayOf(
                    Manifest.permission.POST_NOTIFICATIONS
                ),
                1001
            )
        }

        // ============================================================
        // ألوان TABIBK
        // ============================================================

        window.statusBarColor =
            Color.rgb(43, 11, 61)

        window.navigationBarColor =
            Color.rgb(43, 11, 61)

        // ============================================================
        // ROOT
        // ============================================================

        val root =
            FrameLayout(this)

        // ============================================================
        // WEBVIEW
        // ============================================================

        webView =
            WebView(this)

        val webParams =
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )

        webView.layoutParams =
            webParams

        // مهم جدًا:
        // WebView مخفي بالكامل أثناء تشغيل Render

        webView.visibility =
            View.INVISIBLE

        // ============================================================
        // COOKIES
        // ============================================================

        val cookieManager =
            CookieManager.getInstance()

        cookieManager.setAcceptCookie(true)

        cookieManager.setAcceptThirdPartyCookies(
            webView,
            true
        )

        // ============================================================
        // WEBVIEW SETTINGS
        // ============================================================

        with(webView.settings) {

            javaScriptEnabled =
                true

            domStorageEnabled =
                true

            databaseEnabled =
                true

            loadsImagesAutomatically =
                true

            javaScriptCanOpenWindowsAutomatically =
                true

            setSupportMultipleWindows(false)

            cacheMode =
                WebSettings.LOAD_DEFAULT

            allowFileAccess =
                true

            allowContentAccess =
                true

            mixedContentMode =
                WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE

            userAgentString =
                "$userAgentString TABIBK-Android"
        }

        // ============================================================
        // WEBVIEW CLIENT
        // ============================================================

        webView.webViewClient =
            object : WebViewClient() {

                override fun onPageFinished(
                    view: WebView?,
                    url: String?
                ) {

                    super.onPageFinished(
                        view,
                        url
                    )

                    checkTabibkReady()
                }
            }

        webView.webChromeClient =
            WebChromeClient()

        // ============================================================
        // إضافة WebView
        // ============================================================

        root.addView(webView)

        // ============================================================
        // SPLASH
        // ============================================================

        splashView =
            createSplashScreen()

        root.addView(splashView)

        // ============================================================
        // إظهار ROOT
        // ============================================================

        setContentView(root)

        // ============================================================
        // تحميل TABIBK
        // ============================================================

        webView.loadUrl(
            "https://tabibk2.onrender.com"
        )
    }

    // ================================================================
    // فحص جاهزية TABIBK
    // ================================================================

private fun checkTabibkReady() {

    if (tabibkReady) {
        return
    }

    webView.postDelayed({

        webView.evaluateJavascript(
            """
            (function() {

                var bodyText =
                    document.body
                        ? document.body.innerText
                        : "";

                var title =
                    document.title || "";

                var currentUrl =
                    window.location.href || "";

                return JSON.stringify({
                    body: bodyText,
                    title: title,
                    url: currentUrl
                });

            })();
            """.trimIndent()
        ) { result ->

            val pageText =
                result
                    .replace("\\n", " ")
                    .replace("\\r", " ")
                    .replace("\\\"", "\"")
                    .replace("\\/", "/")

            // ====================================================
            // صفحة Render
            // ====================================================

            val renderPage =
                pageText.contains(
                    "Application loading",
                    ignoreCase = true
                ) ||
                pageText.contains(
                    "Application is loading",
                    ignoreCase = true
                ) ||
                pageText.contains(
                    "Loading application",
                    ignoreCase = true
                )

            // ====================================================
            // TABIBK الحقيقي
            // ====================================================

            val hasTabibk =
                pageText.contains(
                    "طبيبك",
                    ignoreCase = true
                )

            val hasTabibkUrl =
                pageText.contains(
                    "tabibk2.onrender.com",
                    ignoreCase = true
                )

            // ====================================================
            // إذا كانت Render
            // نبقى على Splash
            // ====================================================

            if (renderPage) {

                webView.visibility =
                    View.INVISIBLE

                webView.postDelayed(
                    {
                        webView.reload()
                    },
                    2000
                )

                return@evaluateJavascript
            }

            // ====================================================
            // TABIBK جاهز
            // ====================================================

            if (
                hasTabibk &&
                hasTabibkUrl
            ) {

                tabibkReady =
                    true

                showTabibk()

                return@evaluateJavascript
            }

            // ====================================================
            // لم نتأكد بعد
            // ====================================================

            webView.visibility =
                View.INVISIBLE

            webView.postDelayed(
                {
                    checkTabibkReady()
                },
                1000
            )
        }

    }, 500)
}
    // ================================================================
    // إظهار TABIBK الحقيقي
    // ================================================================

    private fun showTabibk() {

        runOnUiThread {

            // أولًا نظهر WebView الحقيقي
            webView.visibility =
                View.VISIBLE

            // ثم نخفي Splash
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
    // إنشاء شاشة البداية
    // ================================================================

    private fun createSplashScreen(): View {

        val splash =
            FrameLayout(this)

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
