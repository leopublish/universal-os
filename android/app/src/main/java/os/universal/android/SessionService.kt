package os.universal.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.PowerManager
import java.security.SecureRandom

/**
 * Keeps the Universal OS desktop running (X server + XFCE + web viewer bridge)
 * as a foreground service, so Android doesn't stop it in the background.
 */
class SessionService : Service() {

    companion object {
        const val ACTION_STOP = "os.universal.android.STOP"
        const val EXTRA_GEOMETRY = "geometry"
        const val PORT = 6080
        private const val CHANNEL = "session"

        @Volatile var process: Process? = null
        @Volatile var starting = false
        /** One-time password between the viewer and this session's VNC server. */
        @Volatile var secret: String = ""

        fun running() = process?.isAlive == true
    }

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSession()
            stopForeground(true)
            stopSelf()
            return START_NOT_STICKY
        }
        startForeground(1, notification())
        if (!running() && !starting) startSession(intent?.getStringExtra(EXTRA_GEOMETRY) ?: "1280x720")
        return START_NOT_STICKY
    }

    private fun startSession(geometry: String) {
        starting = true
        val chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        val rnd = SecureRandom()
        secret = (1..8).map { chars[rnd.nextInt(chars.length)] }.joinToString("")

        wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "universal:session").apply { acquire() }

        val pb = Proot.command(
            this, "exec /usr/local/bin/universal-start", Accounts.username(this),
            env = mapOf("UNIVERSAL_VNC_PASS" to secret, "UNIVERSAL_GEOMETRY" to geometry)
        )
        pb.redirectOutput(Paths.sessionLog(this))
        try {
            val p = pb.start()
            process = p
            Thread {
                p.waitFor()
                process = null
                releaseWakeLock()
                stopForeground(true)
                stopSelf()
            }.start()
        } catch (e: Exception) {
            Paths.sessionLog(this).appendText("\nCould not start: ${e.message}\n")
            releaseWakeLock()
            stopSelf()
        } finally {
            starting = false
        }
    }

    private fun stopSession() {
        process?.destroy()
        process = null
        releaseWakeLock()
    }

    private fun releaseWakeLock() {
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
    }

    override fun onDestroy() {
        releaseWakeLock()
        super.onDestroy()
    }

    private fun notification(): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Universal OS session", NotificationManager.IMPORTANCE_LOW))
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, DesktopActivity::class.java), PendingIntent.FLAG_IMMUTABLE
        )
        val stop = PendingIntent.getService(
            this, 1, Intent(this, SessionService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE
        )
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Universal OS is running")
            .setContentText("Tap to open the desktop")
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(null, "Shut down", stop).build())
            .build()
    }
}
