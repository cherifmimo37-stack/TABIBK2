kotlin
package com.tabibk.app
import android.content.Intent
import android.webkit.WebChromeClient
import android.webkit.ValueCallback
import android.webkit.WebResourceRequest
import android.os.Bundle
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
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
import androidx.activity.result.contract.ActivityResultContracts
import android.os.Handler
import android.os.Looper
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

        private val imagePicker =
        registerForActivityResult(
            ActivityResultContracts.GetContent()
        ) { uri ->
            val results = uri?.let {
                arrayOf(it)
            }

            fileChooserCallback?.onReceiveValue(results)
            fileChooserCallback = null
        }

    private lateinit var webView: WebView
    private lateinit var loadingScreen: LinearLayout
    private lateinit var message: TextView
    private lateinit var progress: ProgressBar
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
private val FILE_CHOOSER_REQUEST_CODE = 1001

    private val handler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()

    private val websiteUrl = "https://tabibk2.onrender.com"
    private var checking = false
    private var openingWebsite = false
    private var pageOpened = false

    private val checkAgain = object : Runnable {
        override fun run() {
            checkServer()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        createTabibkNotificationChannel()

        window.statusBarColor = Color.rgb(28, 14, 43)
        window.navigationBarColor = Color.rgb(28, 14, 43)

        val root = FrameLayout(this)

        webView = WebView(this).apply {
            visibility = View.INVISIBLE

            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadsImagesAutomatically = true

            webChromeClient = object : WebChromeClient() {
    override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: WebChromeClient.FileChooserParams?
    ): Boolean {
        this@MainActivity.fileChooserCallback?.onReceiveValue(null)
        this@MainActivity.fileChooserCallback = filePathCallback

                return try {
            imagePicker.launch("image/*")
            true
        } catch (error: Exception) {
            this@MainActivity.fileChooserCallback?.onReceiveValue(null)
            this@MainActivity.fileChooserCallback = null
            false
        }
    }
}

            webViewClient = object : WebViewClient() {

                override fun onPageFinished(
                    view: WebView?,
                    url: String?
                ) {
                    super.onPageFinished(view, url)

                    if (view == null || pageOpened || isFinishing) {
                        return
                    }

                    // Check that this is the actual TABIBK website,
                    // not Render's waiting page.
                    view.evaluateJavascript(
                        """
                        (function() {
                            var text = (
                                document.title + ' ' +
                                (document.body
                                    ? document.body.innerText
                                    : '')
                            ).toLowerCase();

                            var waiting =
                                text.includes('service waking up') ||
                                text.includes('service is waking up') ||
                                text.includes('application loading') ||
                                text.includes('allocating compute resources') ||
                                text.includes('preparing instance for initialization');

                            var app =
                                !!document.querySelector(
                                    '.header-content, #doctorLogin, #patientLogin'
                                ) ||
                                text.includes('tabibk') ||
                                text.includes('طبيبك');

                            return JSON.stringify({
                                waiting: waiting,
                                app: app
                            });
                        })();
                        """.trimIndent()
                    ) { result ->

                        if (pageOpened || isFinishing) return@evaluateJavascript

                        val isWaiting =
                            result?.contains("\"waiting\":true") == true

                        val isApp =
                            result?.contains("\"app\":true") == true

                        if (isWaiting || !isApp) {
                            webView.visibility = View.INVISIBLE
                            loadingScreen.visibility = View.VISIBLE
                            openingWebsite = false
                            webView.stopLoading()
                            scheduleCheck()
                        } else {
                            pageOpened = true
                            loadingScreen.visibility = View.GONE
                            webView.visibility = View.VISIBLE
                        }
                    }
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: android.webkit.WebResourceRequest?,
                    error: android.webkit.WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)

                    if (request?.isForMainFrame == true && !pageOpened) {
                        webView.visibility = View.INVISIBLE
                        loadingScreen.visibility = View.VISIBLE
                        openingWebsite = false
                        message.text = "جاري إعادة الاتصال بخدمات طبيبك..."
                        scheduleCheck()
                    }
                }

                                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val url = request?.url?.toString() ?: return false
                    return handleTabibkUrl(url)
                }

                @Suppress("DEPRECATION")
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    url: String?
                ): Boolean {
                    if (url.isNullOrBlank()) return false
                    return handleTabibkUrl(url)
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

        message = TextView(this).apply {
            text = "جاري الاتصال بخدمات طبيبك..."
            textSize = 16f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            setPadding(0, 32, 0, 22)
        }

        progress = ProgressBar(this).apply {
            isIndeterminate = true
            indeterminateTintList =
                android.content.res.ColorStateList.valueOf(
                    Color.rgb(237, 202, 119)
                )
        }

        val footer = TextView(this).apply {
            text = "نعتني بك، أينما كنت"
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

        // Start checking without displaying Render's waiting page.
        checkServer()
    }

    private fun checkServer() {
        if (checking || pageOpened || isFinishing) return

        checking = true
        message.text = "جاري الاتصال بخدمات طبيبك..."

        executor.execute {
            var ready = false

            try {
                val connection =
                    URL(websiteUrl).openConnection() as HttpURLConnection

                connection.requestMethod = "GET"
                connection.connectTimeout = 15000
                connection.readTimeout = 15000
                connection.instanceFollowRedirects = true
                connection.setRequestProperty(
                    "User-Agent",
                    "TABIBK-Android"
                )

                try {
                    val code = connection.responseCode

                    if (code in 200..299) {
                        val stream = connection.inputStream
                        val body = stream.bufferedReader().use {
                            it.readText().take(500000)
                        }.lowercase()

                        val renderWaiting =
                            body.contains("service waking up") ||
                            body.contains("service is waking up") ||
                            body.contains("application loading") ||
                            body.contains("allocating compute resources") ||
                            body.contains("preparing instance for initialization")

                        val tabibkPage =
                            body.contains("tabibk") ||
                            body.contains("طبيبك") ||
                            body.contains("header-content")

                        ready = !renderWaiting && tabibkPage
                    }
                } finally {
                    connection.disconnect()
                }
            } catch (_: Exception) {
                ready = false
            }

            handler.post {
                checking = false

                if (isFinishing || pageOpened) return@post

                if (ready) {
                    if (!openingWebsite) {
                        openingWebsite = true
                        message.text = "تم الاتصال، جاري فتح طبيبك..."
                        webView.loadUrl(websiteUrl)
                    }
                } else {
                    message.text =
                        "خدمات طبيبك تستعد للعمل، لحظات فقط..."

                    scheduleCheck()
                }
            }
        }
    }

    private fun scheduleCheck() {
        handler.removeCallbacks(checkAgain)
        handler.postDelayed(checkAgain, 8000)
    }

        
private fun handleTabibkUrl(url: String): Boolean {
    val uri = Uri.parse(url)
    val scheme = uri.scheme?.lowercase()
    val host = uri.host?.lowercase()

    if (scheme == "http" || scheme == "https") {

        if (host == "tabibk2.onrender.com") {
            return false
        }

        val isFacebook =
            host == "facebook.com" ||
            host?.endsWith(".facebook.com") == true ||
            host == "fb.watch" ||
            host == "fb.me"

        return try {
            if (isFacebook) {
                try {
                    val facebookIntent =
                        Intent(Intent.ACTION_VIEW, uri).apply {
                            setPackage("com.facebook.katana")
                        }

                    startActivity(facebookIntent)
                } catch (_: Exception) {
                    val browserIntent =
                        Intent(Intent.ACTION_VIEW, uri)

                    startActivity(browserIntent)
                }
            } else {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
            }
            true
        } catch (_: Exception) {
            true
        }
    }

    if (scheme == "tel" || scheme == "mailto") {
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        } catch (_: Exception) {
            true
        }
    }

    return false
}

        
@Deprecated("Deprecated in Java")
override fun onActivityResult(
    requestCode: Int,
    resultCode: Int,
    data: Intent?
) {
    super.onActivityResult(requestCode, resultCode, data)

    if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
        val results = if (resultCode == RESULT_OK) {
            val clipData = data?.clipData

            when {
                clipData != null -> Array(clipData.itemCount) { index ->
                    clipData.getItemAt(index).uri
                }
                data?.data != null -> arrayOf(data.data!!)
                else -> null
            }
        } else null

        fileChooserCallback?.onReceiveValue(results)
        fileChooserCallback = null
    }
}
    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        executor.shutdownNow()

        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.destroy()
        }

        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && pageOpened && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    private fun createTabibkNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

        val soundUri = Uri.parse(
            "android.resource://$packageName/${R.raw.tabibk_notification}"
        )

        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
            
        val channel = NotificationChannel(
            "tabibk_patient_reminders_v1",
            "تذكيرات مواعيد المرضى",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "تذكيرات المرضى قبل موعد الطبيب"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 300, 200, 300)
            setSound(soundUri, audioAttributes)
        }

        val manager =
            getSystemService(NOTIFICATION_SERVICE) as NotificationManager

        manager.createNotificationChannel(channel)
    }
}
}

