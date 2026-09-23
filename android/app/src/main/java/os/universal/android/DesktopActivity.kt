package os.universal.android

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import java.net.InetSocketAddress
import java.net.Socket
import kotlin.math.max
import kotlin.math.min

/** Full-screen Universal OS desktop, drawn by the noVNC viewer inside the Linux session. */
class DesktopActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var loadingView: LinearLayout
    private lateinit var status: TextView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        web = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#0B1420"))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            visibility = View.INVISIBLE
        }

        status = TextView(this).apply {
            text = "Starting Universal OS…"
            setTextColor(Color.parseColor("#E6EDF1"))
            textSize = 16f
            gravity = Gravity.CENTER
            setPadding(0, 32, 0, 0)
        }
        loadingView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0B1420"))
            addView(ImageView(this@DesktopActivity).apply { setImageResource(R.drawable.ic_logo) },
                LinearLayout.LayoutParams(dp(88), dp(88)))
            addView(status, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        }

        setContentView(FrameLayout(this).apply {
            addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            addView(loadingView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        })

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = askLeave()
        })

        if (!SessionService.running()) {
            // Desktop size = screen size in density-independent pixels, landscape.
            val m = resources.displayMetrics
            val w = (max(m.widthPixels, m.heightPixels) / m.density).toInt()
            val h = (min(m.widthPixels, m.heightPixels) / m.density).toInt()
            ContextCompat.startForegroundService(this,
                Intent(this, SessionService::class.java).putExtra(SessionService.EXTRA_GEOMETRY, "${w}x$h"))
        }
        waitForDesktop()
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun waitForDesktop() {
        Thread {
            val deadline = System.currentTimeMillis() + 120_000
            var ready = false
            Thread.sleep(800)
            while (System.currentTimeMillis() < deadline) {
                if (portOpen()) { ready = true; break }
                if (!SessionService.running() && !SessionService.starting) break
                Thread.sleep(500)
            }
            runOnUiThread { if (ready) showDesktop() else showFailure() }
        }.start()
    }

    private fun portOpen(): Boolean = try {
        Socket().use { it.connect(InetSocketAddress("127.0.0.1", SessionService.PORT), 400); true }
    } catch (_: Exception) { false }

    private fun showDesktop() {
        val url = "http://127.0.0.1:${SessionService.PORT}/vnc.html" +
            "?autoconnect=true&resize=remote&reconnect=true&reconnect_delay=1000" +
            "&show_dot=true&password=${SessionService.secret}"
        web.loadUrl(url)
        web.visibility = View.VISIBLE
        loadingView.animate().alpha(0f).setDuration(400).withEndAction { loadingView.visibility = View.GONE }
    }

    private fun showFailure() {
        val log = runCatching { Paths.sessionLog(this).readText().takeLast(1500) }.getOrDefault("")
        status.text = "Universal OS didn't start."
        MaterialAlertDialogBuilder(this)
            .setTitle("Universal OS didn't start")
            .setMessage(
                "Try again. If it keeps happening, see “Desktop closes by itself?” on the login screen.\n\nDetails:\n$log"
            )
            .setPositiveButton("Close") { _, _ -> finish() }
            .setCancelable(false)
            .show()
    }

    private fun askLeave() {
        MaterialAlertDialogBuilder(this)
            .setTitle("Leave the desktop?")
            .setMessage("Keep Universal OS running to come back to your open apps, or shut it down.")
            .setNeutralButton("Cancel", null)
            .setNegativeButton("Shut down") { _, _ ->
                startService(Intent(this, SessionService::class.java).setAction(SessionService.ACTION_STOP))
                finish()
            }
            .setPositiveButton("Keep running") { _, _ -> moveTaskToBack(true) }
            .show()
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }
}
