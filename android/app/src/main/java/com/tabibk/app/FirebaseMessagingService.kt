package com.tabibk.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class FirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val CHANNEL_ID = "tabibk_notifications"
        private const val CHANNEL_NAME = "إشعارات طبيبك"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)

        // نحتفظ بالـ FCM Token مؤقتًا
        getSharedPreferences("TABIBK_FCM", Context.MODE_PRIVATE)
            .edit()
            .putString("fcm_token", token)
            .apply()
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val title = remoteMessage.notification?.title
            ?: remoteMessage.data["title"]
            ?: "طبيبك 🔔"

        val message = remoteMessage.notification?.body
            ?: remoteMessage.data["body"]
            ?: "لديك إشعار جديد"

        showNotification(title, message)
    }

    private fun showNotification(title: String, message: String) {

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or
                    PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_tabibk)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText(message)
            )
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(pendingIntent)
            .setVibrate(longArrayOf(0, 300, 200, 300))
            .build()

        val manager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        manager.notify(
            System.currentTimeMillis().toInt(),
            notification
        )
    }

    private fun createNotificationChannel() {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {

                description = "إشعارات المواعيد والتنبيهات في تطبيق طبيبك"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 300, 200, 300)
                lockscreenVisibility =
                    NotificationCompat.VISIBILITY_PUBLIC
            }

            val manager =
                getSystemService(Context.NOTIFICATION_SERVICE)
                        as NotificationManager

            manager.createNotificationChannel(channel)
        }
    }
}
