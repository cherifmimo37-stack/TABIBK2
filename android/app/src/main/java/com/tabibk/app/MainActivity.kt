
package com.tabibk.app

import android.Manifest
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.media.MediaPlayer
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
    private var checkingPage = false

    // صوت المقدمة وحركة الشعار
    private var introPlayer: MediaPlayer? = null
    private var logoPulseAnimator: AnimatorSet? = null

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
                    Log.d("TABIBK_FCM_TOKEN", token)
                } else {
                    Log.w(
                        "TABIBK_FCM_TOKEN",
                        "تعذر الحصول على رمز الإشعارات",
                        task.exception
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
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                1001
            )
        }

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

        // لا نظهر الموقع حتى نتأكد من جاهزية طبيبك
        webView.visibility = View.INVISIBLE

        // ============================================================
        // COOKIES
        // ============================================================

        val cookieManager = CookieManager.getInstance()

        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

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

            userAgentString = "$userAgentString TABIBK-Android"
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
                checkTabibkReady()
            }

            @Deprecated("Deprecated in Java")
            override fun onReceivedError(
                view: WebView?,
                errorCode: Int,
                description: String?,
                failingUrl: String?
            ) {
                super.onReceivedError(
                    view,
                    errorCode,
                    description,
                    failingUrl
                )

                // نبقى على شاشة البداية ونحاول مجددًا
                webView.visibility = View.INVISIBLE
                checkingPage = false

                webView.postDelayed({
                    if (!tabibkReady) {
                        webView.reload()
                    }
                }, 2500)
            }
        }

        webView.webChromeClient = WebChromeClient()

        root.addView(webView)

        // ============================================================
        // SPLASH
        // ============================================================

        splashView = createSplashScreen()
        root.addView(splashView)

        setContentView(root)

        // تشغيل الصوت بعد عرض شاشة البداية
        startIntroSound()

        // ============================================================
        // تحميل TABIBK
        // ============================================================

        webView.loadUrl("https://tabibk2.onrender.com")
    }

    // ================================================================
    // تشغيل صوت المقدمة
    // الملف المطلوب: app/src/main/res/raw/tabibk_intro.wav
    // ================================================================

    private fun startIntroSound() {
        stopIntroSound()

        val soundId = resources.getIdentifier(
            "tabibk_intro",
            "raw",
            packageName
        )

        if (soundId == 0) {
            Log.w(
                "TABIBK_SPLASH",
                "لم يتم العثور على res/raw/tabibk_intro.wav"
            )
            return
        }

        try {
            introPlayer = MediaPlayer.create(this, soundId)

            introPlayer?.apply {
                setOnCompletionListener { player ->
                    if (introPlayer === player) {
                        introPlayer = null
                    }

                    player.release()
                }

                setOnErrorListener { player, what, extra ->
                    Log.e(
                        "TABIBK_SPLASH",
                        "خطأ في الصوت: $what / $extra"
                    )

                    if (introPlayer === player) {
                        introPlayer = null
                    }

                    player.release()
                    true
                }

                start()
            }
        } catch (e: Exception) {
            Log.e(
                "TABIBK_SPLASH",
                "تعذر تشغيل صوت المقدمة",
                e
            )

            stopIntroSound()
        }
    }

    // ================================================================
    // إيقاف الصوت وتحرير موارده
    // ================================================================

    private fun stopIntroSound() {
        val player = introPlayer ?: return

        // نصفر المرجع قبل تحرير المورد
        introPlayer = null

        try {
            player.setOnCompletionListener(null)
            player.setOnErrorListener(null)

            if (player.isPlaying) {
                player.stop()
            }
        } catch (e: IllegalStateException) {
            Log.w(
                "TABIBK_SPLASH",
                "مشغل الصوت توقف مسبقًا",
                e
            )
        } finally {
            player.release()
        }
    }

    // ================================================================
    // حركة نبض الشعار
    // ================================================================

    private fun startLogoPulse(logo: ImageView) {
        stopLogoPulse()

        val pulseX = ObjectAnimator.ofFloat(
            logo,
            View.SCALE_X,
            1f,
            1.07f,
            1f
        ).apply {
            duration = 900
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.RESTART
        }

        val pulseY = ObjectAnimator.ofFloat(
            logo,
            View.SCALE_Y,
            1f,
            1.07f,
            1f
        ).apply {
            duration = 900
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.RESTART
        }

        logoPulseAnimator = AnimatorSet().apply {
            playTogether(pulseX, pulseY)
            start()
        }
    }

    private fun stopLogoPulse() {
        logoPulseAnimator?.cancel()
        logoPulseAnimator = null
    }

    // ================================================================
    // فحص جاهزية TABIBK
    // ================================================================

    private fun checkTabibkReady() {
        if (tabibkReady || checkingPage) {
            return
        }

        checkingPage = true

        webView.postDelayed({

            webView.evaluateJavascript(
                """
                (function() {
                    var bodyText = document.body
                        ? document.body.innerText
                        : "";

                    var title = document.title || "";
                    var currentUrl = window.location.href || "";

                    return JSON.stringify({
                        body: bodyText,
                        title: title,
                        url: currentUrl
                    });
                })();
                """.trimIndent()
            ) { result ->

                checkingPage = false

                val pageText = result
                    .replace("\\n", " ")
                    .replace("\\r", " ")
                    .replace("\\\"", "\"")
                    .replace("\\/", "/")

                val currentUrl = webView.url ?: ""

                val correctUrl = currentUrl.contains(
                    "tabibk2.onrender.com",
                    ignoreCase = true
                )

                // كشف صفحة انتظار Render
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
                    ) ||
                    pageText.contains(
                        "Your application is loading",
                        ignoreCase = true
                    )

                // كشف واجهة طبيبك
                val hasTabibk =
                    pageText.contains(
                        "طبيبك",
                        ignoreCase = true
                    ) ||
                    pageText.contains(
                        "TABIBK",
                        ignoreCase = true
                    )

                if (renderPage) {
                    webView.visibility = View.INVISIBLE

                    webView.postDelayed({
                        if (!tabibkReady) {
                            webView.reload()
                        }
                    }, 2000)

                    return@evaluateJavascript
                }

                if (correctUrl && hasTabibk) {
                    tabibkReady = true
                    showTabibk()
                    return@evaluateJavascript
                }

                // لم نتأكد من الجاهزية بعد
                webView.visibility = View.INVISIBLE

                webView.postDelayed({
                    if (!tabibkReady) {
                        checkTabibkReady()
                    }
                }, 1000)
            }
        }, 500)
    }

    // ================================================================
    // إظهار واجهة طبيبك الحقيقية
    // ================================================================

    private fun showTabibk() {
        runOnUiThread {
            if (tabibkReady) {

                // إيقاف الصوت والنبض قبل الانتقال
                stopIntroSound()
                stopLogoPulse()

                webView.visibility = View.VISIBLE

                splashView.animate()
                    .alpha(0f)
                    .setDuration(350)
                    .withEndAction {
                        splashView.visibility = View.GONE
                    }
                    .start()
            }
        }
    }

    // ================================================================
    // إنشاء شاشة البداية
    // ================================================================

    private fun createSplashScreen(): View {
        val splash = FrameLayout(this)

        splash.setBackgroundColor(
            Color.rgb(43, 11, 61)
        )

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
        }

        val contentParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )

        content.layoutParams = contentParams

        // ------------------------------------------------------------
        // شعار طبيبك
        // ------------------------------------------------------------

        val logo = ImageView(this)

        logo.setImageResource(R.drawable.ic_tabibk)
        logo.scaleType = ImageView.ScaleType.CENTER_INSIDE

        logo.layoutParams = LinearLayout.LayoutParams(
            dp(150),
            dp(150)
        )

        content.addView(logo)

        // نبض الشعار أثناء الانتظار
        startLogoPulse(logo)

        // ------------------------------------------------------------
        // الاسم العربي
        // ------------------------------------------------------------

        val title = TextView(this).apply {
            text = "طبيبك"
            textSize = 42f
            setTextColor(Color.rgb(233, 196, 93))
            typeface = Typeface.create(
                "sans-serif",
                Typeface.BOLD
            )
            gravity = Gravity.CENTER
        }

        val titleParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        )

        titleParams.topMargin = dp(5)
        title.layoutParams = titleParams

        content.addView(title)

        // ------------------------------------------------------------
        // TABIBK
        // ------------------------------------------------------------

        val tabibk = TextView(this).apply {
            text = "TABIBK"
            textSize = 20f
            setTextColor(Color.WHITE)
            letterSpacing = 0.25f
            typeface = Typeface.create(
                "sans-serif",
                Typeface.BOLD
            )
            gravity = Gravity.CENTER
        }

        content.addView(tabibk)

        // ------------------------------------------------------------
        // الشعار النصي
        // ------------------------------------------------------------

        val slogan = TextView(this).apply {
            text = "مواعيدك .. أسهل"
            textSize = 18f
            setTextColor(Color.rgb(233, 196, 93))
            gravity = Gravity.CENTER
        }

        val sloganParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        )

        sloganParams.topMargin = dp(20)
        slogan.layoutParams = sloganParams

        content.addView(slogan)

        // ------------------------------------------------------------
        // نص التحميل
        // ------------------------------------------------------------

        val loading = TextView(this).apply {
            text = "جاري تجهيز طبيبك..."
            textSize = 14f
            setTextColor(Color.LTGRAY)
            gravity = Gravity.CENTER
        }

        val loadingParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        )

        loadingParams.topMargin = dp(35)
        loading.layoutParams = loadingParams

        content.addView(loading)

        splash.addView(content)

        return splash
    }

    // ================================================================
    // تحويل DP
    // ================================================================

    private fun dp(value: Int): Int {
        return (
            value * resources.displayMetrics.density
        ).toInt()
    }

    // ================================================================
    // تنظيف الموارد عند إغلاق النشاط
    // ================================================================

    override fun onDestroy() {
        stopIntroSound()
        stopLogoPulse()

        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.destroy()
        }

        super.onDestroy()
    }

    // ================================================================
    // زر الرجوع
    // ================================================================

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
