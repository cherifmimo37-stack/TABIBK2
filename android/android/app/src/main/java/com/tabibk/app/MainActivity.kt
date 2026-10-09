```kotlin
package com.tabibk.app

import android.media.AudioManager
import android.media.ToneGenerator
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.animation.AlphaAnimation
import android.view.animation.Animation
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var root: FrameLayout
    private lateinit var loadingScreen: LinearLayout
    private lateinit var statusText: TextView
    private lateinit var retryButton: Button
    private lateinit var progressBar: ProgressBar
    private lateinit var heartLogo: TextView

    private val handler = Handler(Looper.getMainLooper())
    private var pageReady = false
    private var retryScheduled = false
    private var soundPlayed = false
    private var toneGenerator: ToneGenerator? = null

    private val websiteUrl = "https://tabibk2.onrender.com"

    private val retryRunnable = Runnable {
        retryScheduled = false
        if (!pageReady && !isFinishing) {
            statusText.text = "جاري إعادة الاتصال بخدمات طبيبك..."
            webView.reload()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.rgb(30, 15, 48)
        window.navigationBarColor = Color.rgb(30, 15, 48)

        createInterface()
        playWelcomeSound()

        webView.loadUrl(websiteUrl)
    }

    private fun createInterface() {

        root = FrameLayout(this)

        webView = WebView(this).apply {
            visibility = View.INVISIBLE

            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadsImagesAutomatically = true

            webViewClient = object : WebViewClient() {

                override fun onPageStarted(
                    view: WebView?,
                    url: String?,
                    favicon: android.graphics.Bitmap?
                ) {
                    if (!pageReady) {
                        statusText.text =
                            "جاري الاتصال بخدمات طبيبك..."
                    }
                }

                override fun onPageFinished(
                    view: WebView?,
                    url: String?
                ) {
                    super.onPageFinished(view, url)

                    // Keep the native screen while Render wakes up.
                    view?.evaluateJavascript(
                        """
                        (function() {
                            return document.body
                                ? document.body.innerText
                                    .substring(0, 3000)
                                    .toLowerCase()
                                : '';
                        })();
                        """.trimIndent()
                    ) { result ->

                        if (pageReady || isFinishing) return@evaluateJavascript

                        val text = result
                            ?.lowercase()
                            ?.replace("\\n", " ")
                            ?.replace("\\\"", "\"")
                            ?: ""

                        val renderWaiting =
                            text.contains("service is waking up") ||
                            text.contains("waking up") ||
                            text.contains("loading your service") ||
                            text.contains("taking longer than expected")

                        if (renderWaiting) {
                            statusText.text =
                                "خدمات طبيبك تستعد للعمل، لحظات فقط..."
                            scheduleRetry()
                        } else {
                            showWebsite()
                        }
                    }
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)

                    if (request?.isForMainFrame == true && !pageReady) {
                        statusText.text =
                            "الاتصال تأخر قليلًا، نحاول من جديد..."
                        scheduleRetry()
                    }
                }
            }
        }

        root.addView(
            webView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )

        createLoadingScreen()
        setContentView(root)
    }

    private fun createLoadingScreen() {

        loadingScreen = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(28), dp(30), dp(28), dp(30))

            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(
                    Color.rgb(23, 12, 39),
                    Color.rgb(48, 22, 72),
                    Color.rgb(24, 14, 42)
                )
            )
        }

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
        }

        heartLogo = TextView(this).apply {
            text = "♥"
            textSize = 76f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(232, 195, 105))
            typeface = Typeface.DEFAULT_BOLD
            elevation = dp(8).toFloat()
        }

        val pulse = AlphaAnimation(0.65f, 1f).apply {
            duration = 900
            repeatMode = Animation.REVERSE
            repeatCount = Animation.INFINITE
        }
        heartLogo.startAnimation(pulse)

        val ecg = TextView(this).apply {
            text = "━━━━━━  ♥  ━━━━━━"
            textSize = 15f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(232, 195, 105))
        }

        val brand = TextView(this).apply {
            text = "طبيبك"
            textSize = 36f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(14), 0, dp(2))
        }

        val subtitle = TextView(this).apply {
            text = "TABIBK  •  رعايتك تبدأ هنا"
            textSize = 13f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(232, 195, 105))
        }

        val divider = View(this).apply {
            background = GradientDrawable().apply {
                setColor(Color.rgb(190, 150, 75))
                cornerRadius = dp(3).toFloat()
            }
        }

        statusText = TextView(this).apply {
            text = "جاري الاتصال بخدمات طبيبك..."
            textSize = 15f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            setPadding(0, dp(22), 0, dp(18))
        }

        progressBar = ProgressBar(this).apply {
            isIndeterminate = true
            indeterminateTintList =
                android.content.res.ColorStateList.valueOf(
                    Color.rgb(232, 195, 105)
                )
        }

        val footer = TextView(this).apply {
            text = "نعتني بك، أينما كنت"
            textSize = 12f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(195, 180, 210))
            setPadding(0, dp(26), 0, dp(10))
        }

        retryButton = Button(this).apply {
            text = "إعادة المحاولة"
            visibility = View.GONE
            setTextColor(Color.rgb(30, 15, 48))
            background = GradientDrawable().apply {
                setColor(Color.rgb(232, 195, 105))
                cornerRadius = dp(14).toFloat()
            }
            setOnClickListener {
                pageReady = false
                statusText.text = "جاري إعادة الاتصال..."
                retryButton.visibility = View.GONE
                webView.visibility = View.INVISIBLE
                loadingScreen.visibility = View.VISIBLE
                webView.loadUrl(websiteUrl)
            }
        }

        content.addView(
            heartLogo,
            LinearLayout.LayoutParams(dp(120), dp(100))
        )
        content.addView(ecg)
        content.addView(brand)
        content.addView(subtitle)

        val dividerParams = LinearLayout.LayoutParams(
            dp(100), dp(3)
        ).apply {
            topMargin = dp(22)
        }
        content.addView(divider, dividerParams)

        content.addView(statusText)
        content.addView(
            progressBar,
            LinearLayout.LayoutParams(dp(42), dp(42))
        )
        content.addView(footer)
        content.addView(
            retryButton,
            LinearLayout.LayoutParams(
                dp(190), dp(52)
            ).apply {
                topMargin = dp(12)
            }
        )

        loadingScreen.addView(
            content,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        )

        root.addView(
            loadingScreen,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
    }

    private fun showWebsite() {
        if (pageReady || isFinishing) return

        pageReady = true
        retryScheduled = false
        handler.removeCallbacks(retryRunnable)

        webView.visibility = View.VISIBLE

        loadingScreen.animate()
            .alpha(0f)
            .setDuration(450)
            .withEndAction {
                loadingScreen.visibility = View.GONE
                loadingScreen.alpha = 1f
            }
            .start()
    }

    private fun scheduleRetry() {
        if (retryScheduled || pageReady || isFinishing) return

        retryScheduled = true
        handler.postDelayed(retryRunnable, 8000)
    }

    private fun playWelcomeSound() {
        if (soundPlayed) return
        soundPlayed = true

        try {
            toneGenerator = ToneGenerator(
                AudioManager.STREAM_NOTIFICATION,
                25
            )

            handler.postDelayed({
                try {
                    toneGenerator?.startTone(
                        ToneGenerator.TONE_PROP_ACK,
                        140
                    )
                } catch (_: Exception) {
                    // Sound is optional.
                }
            }, 350)

        } catch (_: Exception) {
            // Continue normally if sound is unavailable.
        }
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        toneGenerator?.release()
        toneGenerator = null
        webView.stopLoading()
        webView.destroy()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
```
