
package com.tabibk.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
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
import android.widget.TextView
import android.widget.VideoView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var splashView: View
    private lateinit var introVideo: VideoView

    private var tabibkReady = false
    private var checkingPage = false
    private var introFinished = false
    private var activityDestroyed = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Firebase notifications token
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    Log.d("TABIBK_FCM_TOKEN", task.result)
                } else {
                    Log.w(
                        "TABIBK_FCM_TOKEN",
                        "تعذر الحصول على رمز الإشعارات",
                        task.exception
                    )
                }
            }

        // Android 13+ notification permission
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

        window.statusBarColor = Color.rgb(43, 11, 61)
        window.navigationBarColor = Color.rgb(43, 11, 61)

        // WebView
        webView = WebView(this)

        webView.visibility = View.INVISIBLE

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

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

                webView.visibility = View.INVISIBLE
                checkingPage = false

                webView.postDelayed({
                    if (!activityDestroyed && !tabibkReady) {
                        webView.reload()
                    }
                }, 2500)
            }
        }

        webView.webChromeClient = WebChromeClient()

        // Root and intro video
        val root = FrameLayout(this)

        root.addView(
            webView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        splashView = createSplashScreen()
        root.addView(splashView)

        setContentView(root)

        // Start video while the website loads
        startIntroVideo()

        // Load TABIBK website
        webView.loadUrl("https://tabibk2.onrender.com")
    }

    // ============================================================
    // INTRO VIDEO
    // File: app/src/main/res/raw/tabibk_intro.mp4
    // ============================================================

    private fun startIntroVideo() {
        try {
            introVideo.setVideoURI(
                Uri.parse(
                    "android.resource://$packageName/${R.raw.tabibk_intro}"
                )
            )

            introVideo.setOnPreparedListener { player ->
                if (activityDestroyed) {
                    player.release()
                    return@setOnPreparedListener
                }

                // Let the MP4 play its own audio
                player.isLooping = false
                player.setVolume(1f, 1f)
                introVideo.start()
            }

            introVideo.setOnCompletionListener {
                if (activityDestroyed) return@setOnCompletionListener

                introFinished = true

                if (tabibkReady) {
                    showTabibk()
                } else {
                    // Keep the cinematic intro playing while
                    // Render is still starting up.
                    introFinished = false
                    introVideo.seekTo(0)
                    introVideo.start()
                }
            }

            introVideo.setOnErrorListener { _, what, extra ->
                Log.e(
                    "TABIBK_INTRO",
                    "Video playback error: $what / $extra"
                )

                // If the video cannot play, continue using
                // the branded splash and wait for the website.
                introFinished = true
                true
            }

        } catch (e: Exception) {
            Log.e(
                "TABIBK_INTRO",
                "Could not start intro video",
                e
            )

            introFinished = true
        }
    }

    // ============================================================
    // CHECK WEBSITE READINESS
    // ============================================================

    private fun checkTabibkReady() {
        if (
            activityDestroyed ||
            tabibkReady ||
            checkingPage
        ) {
            return
        }

        checkingPage = true

        webView.postDelayed({

            if (activityDestroyed || tabibkReady) {
                checkingPage = false
                return@postDelayed
            }

            webView.evaluateJavascript(
                """
                (function() {
                    return JSON.stringify({
                        body: document.body
                            ? document.body.innerText : "",
                        title: document.title || "",
                        url: window.location.href || ""
                    });
                })();
                """.trimIndent()
            ) { result ->

                if (activityDestroyed || tabibkReady) {
                    checkingPage = false
                    return@evaluateJavascript
                }

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

                val hasTabibk =
                    pageText.contains("طبيبك", ignoreCase = true) ||
                    pageText.contains("TABIBK", ignoreCase = true)

                if (renderPage) {
                    webView.postDelayed({
                        if (!activityDestroyed && !tabibkReady) {
                            webView.reload()
                        }
                    }, 2000)

                    return@evaluateJavascript
                }

                if (correctUrl && hasTabibk) {
                    tabibkReady = true

                    // Wait for the intro to finish before
                    // revealing the actual application.
                    if (introFinished) {
                        showTabibk()
                    }

                    return@evaluateJavascript
                }

                webView.postDelayed({
                    if (!activityDestroyed && !tabibkReady) {
                        checkTabibkReady()
                    }
                }, 1000)
            }
        }, 500)
    }

    // ============================================================
    // SHOW THE WEBSITE
    // ============================================================

    private fun showTabibk() {
        if (
            activityDestroyed ||
            !tabibkReady ||
            !introFinished
        ) {
            return
        }

        runOnUiThread {
            if (activityDestroyed) return@runOnUiThread

            webView.visibility = View.VISIBLE

            splashView.animate()
                .alpha(0f)
                .setDuration(400)
                .withEndAction {
                    splashView.visibility = View.GONE

                    if (::introVideo.isInitialized) {
                        introVideo.stopPlayback()
                    }
                }
                .start()
        }
    }

    // ============================================================
    // SPLASH SCREEN WITH VIDEO
    // ============================================================

    private fun createSplashScreen(): View {
        val splash = FrameLayout(this)

        splash.setBackgroundColor(
            Color.rgb(43, 11, 61)
        )

        introVideo = VideoView(this).apply {
            setBackgroundColor(Color.rgb(43, 11, 61))
        }

        splash.addView(
            introVideo,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        // Subtle loading label over the video
        val loading = TextView(this).apply {
            text = "جاري تجهيز طبيبك..."
            textSize = 14f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(
                dp(18),
                dp(10),
                dp(18),
                dp(10)
            )

            setBackgroundColor(
                Color.argb(110, 43, 11, 61)
            )
        }

        val loadingParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
        )

        loadingParams.bottomMargin = dp(36)

        splash.addView(loading, loadingParams)

        return splash
    }

    private fun dp(value: Int): Int {
        return (
            value * resources.displayMetrics.density
        ).toInt()
    }

    // ============================================================
    // CLEANUP
    // ============================================================

    override fun onDestroy() {
        activityDestroyed = true

        if (::introVideo.isInitialized) {
            introVideo.stopPlayback()
        }

        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.destroy()
        }

        super.onDestroy()
    }

    // ============================================================
    // BACK BUTTON
    // ============================================================

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (
            ::webView.isInitialized &&
            webView.canGoBack()
        ) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
