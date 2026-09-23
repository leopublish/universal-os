package os.universal.android

import android.content.Context
import android.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * The Universal OS account on this phone. The password itself is never stored:
 * only a salted PBKDF2 hash, checked at every login.
 */
object Accounts {
    private const val PREFS = "account"
    private const val ITERATIONS = 120_000

    val USERNAME = Regex("^[a-z_][a-z0-9_-]{0,31}$")

    fun exists(c: Context) = prefs(c).contains("hash")
    fun fullName(c: Context): String = prefs(c).getString("full_name", "") ?: ""
    fun username(c: Context): String = prefs(c).getString("username", "user") ?: "user"

    fun save(c: Context, fullName: String, username: String, password: CharArray) {
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        prefs(c).edit()
            .putString("full_name", fullName)
            .putString("username", username)
            .putString("salt", b64(salt))
            .putString("hash", b64(hash(password, salt)))
            .apply()
    }

    fun check(c: Context, password: CharArray): Boolean {
        val p = prefs(c)
        val salt = Base64.decode(p.getString("salt", null) ?: return false, Base64.NO_WRAP)
        val expected = Base64.decode(p.getString("hash", null) ?: return false, Base64.NO_WRAP)
        return MessageDigest.isEqual(expected, hash(password, salt))
    }

    fun clear(c: Context) = prefs(c).edit().clear().apply()

    private fun hash(password: CharArray, salt: ByteArray): ByteArray {
        val spec = PBEKeySpec(password, salt, ITERATIONS, 256)
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
    }

    private fun b64(b: ByteArray) = Base64.encodeToString(b, Base64.NO_WRAP)
    private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
