package os.universal.android

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.progressindicator.LinearProgressIndicator
import com.google.android.material.textfield.TextInputEditText

/** First run: create the account and install. Every later launch: log in. */
class MainActivity : AppCompatActivity() {

    private lateinit var setupGroup: View
    private lateinit var progressGroup: View
    private lateinit var loginGroup: View
    private lateinit var progressText: TextView
    private lateinit var progressBar: LinearProgressIndicator
    private var installing = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        setupGroup = findViewById(R.id.setup_group)
        progressGroup = findViewById(R.id.progress_group)
        loginGroup = findViewById(R.id.login_group)
        progressText = findViewById(R.id.progress_text)
        progressBar = findViewById(R.id.progress_bar)

        findViewById<MaterialButton>(R.id.install).setOnClickListener { startInstall() }
        findViewById<MaterialButton>(R.id.login).setOnClickListener { tryLogin() }
        findViewById<TextInputEditText>(R.id.login_password).setOnEditorActionListener { _, id, _ ->
            if (id == EditorInfo.IME_ACTION_GO) { tryLogin(); true } else false
        }
        findViewById<MaterialButton>(R.id.help).setOnClickListener { showHelp() }
        findViewById<MaterialButton>(R.id.reset).setOnClickListener { confirmReset() }
        showState()
    }

    private fun showState() {
        val ready = Paths.isInstalled(this) && Accounts.exists(this)
        setupGroup.visibility = if (!ready && !installing) View.VISIBLE else View.GONE
        progressGroup.visibility = if (installing) View.VISIBLE else View.GONE
        loginGroup.visibility = if (ready && !installing) View.VISIBLE else View.GONE
        if (ready) {
            val name = Accounts.fullName(this).ifBlank { Accounts.username(this) }
            findViewById<TextView>(R.id.welcome).text = getString(R.string.welcome_back, name)
        }
    }

    private fun text(id: Int) = findViewById<TextInputEditText>(id).text?.toString() ?: ""

    private fun startInstall() {
        val error = findViewById<TextView>(R.id.setup_error)
        val fullName = text(R.id.full_name).trim()
        val username = text(R.id.username).trim()
        val password = text(R.id.password)
        val problem = when {
            "arm64-v8a" !in Build.SUPPORTED_ABIS -> "This phone isn't 64-bit (ARM64), which Universal OS needs."
            fullName.isEmpty() -> "Enter your full name."
            !Accounts.USERNAME.matches(username) -> "Username: lowercase letters, numbers, - or _, starting with a letter."
            username == "root" -> "Choose a different username."
            password.length < 6 -> "Password needs at least 6 characters."
            password != text(R.id.password2) -> "The two passwords don't match."
            filesDir.usableSpace < Installer.NEEDED_BYTES -> "Free up space first: Universal OS needs about 4 GB free."
            else -> null
        }
        if (problem != null) { error.text = problem; error.visibility = View.VISIBLE; return }
        error.visibility = View.GONE

        installing = true
        showState()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        Thread {
            try {
                Installer(this) { msg, pct ->
                    runOnUiThread { progressText.text = msg; progressBar.setProgressCompat(pct, true) }
                }.run(fullName, username, password.toCharArray())
                Accounts.save(this, fullName, username, password.toCharArray())
                runOnUiThread { finishInstall(null) }
            } catch (e: Exception) {
                runOnUiThread { finishInstall(e.message ?: e.toString()) }
            }
        }.start()
    }

    private fun finishInstall(error: String?) {
        installing = false
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        showState()
        if (error != null) {
            MaterialAlertDialogBuilder(this)
                .setTitle("Installation didn't finish")
                .setMessage(error)
                .setPositiveButton("OK", null)
                .show()
        }
    }

    private fun tryLogin() {
        val field = findViewById<TextInputEditText>(R.id.login_password)
        val error = findViewById<TextView>(R.id.login_error)
        val pw = field.text?.toString() ?: ""
        if (Accounts.check(this, pw.toCharArray())) {
            error.visibility = View.GONE
            field.setText("")
            startActivity(Intent(this, DesktopActivity::class.java))
        } else {
            error.text = "Wrong password. Try again."
            error.visibility = View.VISIBLE
        }
    }

    private fun showHelp() {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.help_title)
            .setMessage(R.string.help_body)
            .setPositiveButton("OK", null)
            .show()
    }

    private fun confirmReset() {
        MaterialAlertDialogBuilder(this)
            .setTitle("Remove Universal OS?")
            .setMessage("This deletes Universal OS, your account and every file you saved inside it. The app stays installed, so you can set it up again.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Remove") { _, _ ->
                startService(Intent(this, SessionService::class.java).setAction(SessionService.ACTION_STOP))
                installing = true; showState(); progressText.text = "Removing…"
                Thread {
                    Paths.installedMarker(this).delete()
                    Paths.extractedMarker(this).delete()
                    Paths.deleteTree(Paths.rootfs(this))
                    Accounts.clear(this)
                    runOnUiThread { installing = false; showState() }
                }.start()
            }
            .show()
    }
}
