```kotlin
package com.tabibk.app

import android.os.Bundle
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.animation.AlphaAnimation
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.rgb(28, 14, 43)
        window.navigationBarColor = Color.rgb(28, 14, 43)

        val root = FrameLayout(this)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadsImagesAutomatically = true
            visibility = View.INVISIBLE

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(
                    view: WebView?,
                    url: String?
                ) {
                    super.onPageFinished(view, url)
                    webView.visibility = View.VISIBLE
                    loadingScreen.visibility = View.GONE
                }
            }
        }

        root.addView(
            webView,
            FrameLayout.LayoutParams(-1, -1)
        )

        loadingScreen = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(28, 30, 28, 30)
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(
                    Color.rgb(24, 12, 40),
                    Color.rgb(67, 31, 91),
                    Color.rgb(28, 14, 43)
                )
            )
        }

        val heart = TextView(this).apply {
            text = "♥"
            textSize = 86f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(237, 202, 119))
            typeface = Typeface.DEFAULT_BOLD

            startAnimation(AlphaAnimation(0.55f, 1f).apply {
                duration = 850
                repeatMode = AlphaAnimation.REVERSE
                repeatCount = AlphaAnimation.INFINITE
            })
        }

        val ecg = TextView(this).apply {
            text = "━━━━━━ ♥ ━━━━━━"
            textSize = 17f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(237, 202, 119))
        }

        val title = TextView(this).apply {
            text = "طبيبك"
            textSize = 38f
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            setPadding(0, 18, 0, 4)
        }

        val subtitle = TextView(this).apply {
            text = "TABIBK  •  رعايتك تبدأ هنا"
            textSize = 14f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(237, 202, 119))
        }

        val message = TextView(this).apply {
            text = "جاري تحضير خدمات طبيبك..."
            textSize = 16f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            setPadding(0, 32, 0, 22)
        }

        val progress = ProgressBar(this).apply {
            isIndeterminate = true
            indeterminateTintList =
                android.content.res.ColorStateList.valueOf(
                    Color.rgb(237, 202, 119)
                )
        }

        val footer = TextView(this).apply {
            text = "رعايتك تبدأ هنا"
            textSize = 13f
            gravity = Gravity.CENTER
            setTextColor(Color.LTGRAY)
            setPadding(0, 30, 0, 0)
        }

        loadingScreen.addView(heart)
        loadingScreen.addView(ecg)
        loadingScreen.addView(title)
        loadingScreen.addView(subtitle)
        loadingScreen.addView(message)
        loadingScreen.addView(progress)
        loadingScreen.addView(footer)

        root.addView(
            loadingScreen,
            FrameLayout.LayoutParams(-1, -1)
        )

        setContentView(root)

        webView.loadUrl("https://tabibk2.onrender.com")
    }

    private lateinit var loadingScreen: LinearLayout

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
