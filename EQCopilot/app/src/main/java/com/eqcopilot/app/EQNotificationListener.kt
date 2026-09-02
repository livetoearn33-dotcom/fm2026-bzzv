package com.eqcopilot.app

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

class EQNotificationListener : NotificationListenerService() {

    companion object {
        private const val TAG = "EQNotification"
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.d(TAG, "✅ Notification Listener connected")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        super.onNotificationPosted(sbn)

        val extras = sbn.notification.extras

        val packageName = sbn.packageName
        val title = extras
            .getCharSequence(Notification.EXTRA_TITLE)
            ?.toString()

        val text = extras
            .getCharSequence(Notification.EXTRA_TEXT)
            ?.toString()

        val bigText = extras
            .getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?.toString()

        Log.d(
            TAG,
            """
            ===== NEW NOTIFICATION =====
            package = $packageName
            title   = $title
            text    = $text
            bigText = $bigText
            time    = ${sbn.postTime}
            ============================
            """.trimIndent()
        )
    }
}