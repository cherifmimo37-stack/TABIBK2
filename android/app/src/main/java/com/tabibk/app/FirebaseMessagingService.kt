
package com.tabibk.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class FirebaseMessagingService : FirebaseMessagingService() {

    companion object {
    private const val DEFAULT_CHANNEL_ID = "tabibk_notifications_v2"
    private const val PATIENT_CHANNEL_ID = "tabibk_patient_reminders_v1"

    private const val CHANNEL_NAME = "إشعارات طبيبك"
    private const val PATIENT_CHANNEL_NAME = "تذكيرات مواعيد المرضى"
}

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)

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

    val isPatientReminder =
    remoteMessage.data["type"] == "reminder_24h" ||
    remoteMessage.data["type"] == "reminder_1h"

    val channelId = if (isPatientReminder) {
        PATIENT_CHANNEL_ID
    } else {
        DEFAULT_CHANNEL_ID
    }

    showNotification(title, message, channelId)
}

    private fun showNotification(
    title: String,
    message: String,
    channelId: String
) {

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

        val soundUri = Uri.parse(
            "android.resource://$packageName/${R.raw.tabibk_notification}"
        )

        val notification = NotificationCompat.Builder(this, channelId)
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
            .setSound(soundUri)
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

        val soundUri = Uri.parse(
            "android.resource://$packageName/${R.raw.tabibk_notification}"
        )

        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val manager =
            getSystemService(Context.NOTIFICATION_SERVICE)
                    as NotificationManager

        // القناة القديمة: الطبيب والإدارة وباقي الإشعارات
        val defaultChannel = NotificationChannel(
            DEFAULT_CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "إشعارات المواعيد والتنبيهات في تطبيق طبيبك"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 300, 200, 300)
            setSound(soundUri, audioAttributes)
            lockscreenVisibility =
                NotificationCompat.VISIBILITY_PUBLIC
        }

        // قناة مستقلة لتذكيرات المرضى
        val patientChannel = NotificationChannel(
            PATIENT_CHANNEL_ID,
            PATIENT_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "تذكيرات مواعيد المرضى قبل الموعد"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 300, 200, 300)
            setSound(soundUri, audioAttributes)
            lockscreenVisibility =
                NotificationCompat.VISIBILITY_PUBLIC
        }

        manager.createNotificationChannel(defaultChannel)
        manager.createNotificationChannel(patientChannel)
    }
}
