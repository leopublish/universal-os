package os.universal.android

import android.content.Context
import android.system.Os
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.gzip.GzipCompressorInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FilterInputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest

/**
 * Downloads the Universal OS Linux tree (built by GitHub Actions), unpacks it
 * into app storage, and creates the user account inside it.
 */
class Installer(private val c: Context, private val progress: (String, Int) -> Unit) {

    companion object {
        const val ROOTFS_URL =
            "https://github.com/leopublish/universal-os/releases/download/android/universal-rootfs-arm64.tar.gz"
        const val NEEDED_BYTES = 4L * 1024 * 1024 * 1024
    }

    fun run(fullName: String, username: String, password: CharArray) {
        val archive = File(c.cacheDir, "universal-rootfs.tar.gz")
        val rootfs = Paths.rootfs(c)
        Paths.installedMarker(c).delete()
        val extracted = Paths.extractedMarker(c)

        if (extracted.exists() && rootfs.isDirectory) {
            progress("Universal OS is already downloaded. Finishing setup…", 92)
        } else {
            extracted.delete()
            if (rootfs.exists()) { progress("Removing an unfinished install…", 0); Paths.deleteTree(rootfs) }

            val expected = fetchText("$ROOTFS_URL.sha256").trim().split(Regex("\\s+")).first().lowercase()
            download(ROOTFS_URL, archive)                       // 0–55 %
            progress("Checking the download…", 56)
            val actual = sha256(archive)
            if (actual != expected) { archive.delete(); throw IOException("The download was damaged. Please try again.") }

            extract(archive, rootfs)                            // 57–92 %
            archive.delete()
            extracted.writeText("1")
        }

        progress("Setting up networking…", 93)
        File(rootfs, "etc/resolv.conf").apply { delete(); writeText("nameserver 8.8.8.8\nnameserver 1.1.1.1\n") }
        File(rootfs, "etc/hosts").writeText("127.0.0.1 localhost\n::1 localhost\n127.0.1.1 universal\n")
        File(rootfs, "tmp").apply { mkdirs(); Os.chmod(path, 1023 /* 0o1777 */) }

        progress("Creating your account…", 96)
        createUser(fullName, username, password)

        Paths.installedMarker(c).writeText("1")
        progress("Done", 100)
    }

    private fun fetchText(url: String): String = open(url).inputStream.bufferedReader().use { it.readText() }

    private fun open(url: String): HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 20_000
        conn.readTimeout = 60_000
        conn.instanceFollowRedirects = true
        if (conn.responseCode !in 200..299) throw IOException("Download failed (HTTP ${conn.responseCode}). Check your internet connection.")
        return conn
    }

    private fun download(url: String, dest: File) {
        val conn = open(url)
        val total = conn.contentLengthLong.takeIf { it > 0 } ?: -1L
        var done = 0L
        var lastPct = -1
        conn.inputStream.use { input ->
            dest.outputStream().use { out ->
                val buf = ByteArray(256 * 1024)
                while (true) {
                    val n = input.read(buf); if (n < 0) break
                    out.write(buf, 0, n); done += n
                    val pct = if (total > 0) (done * 55 / total).toInt() else 0
                    if (pct != lastPct) {
                        lastPct = pct
                        val mb = done / (1024 * 1024)
                        val of = if (total > 0) " of ${total / (1024 * 1024)} MB" else " MB"
                        progress("Downloading Universal OS… $mb$of", pct)
                    }
                }
            }
        }
    }

    private fun sha256(f: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        f.inputStream().use { input ->
            val buf = ByteArray(1024 * 1024)
            while (true) { val n = input.read(buf); if (n < 0) break; md.update(buf, 0, n) }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    private fun extract(archive: File, dest: File) {
        dest.mkdirs()
        val destPath = dest.toPath().toAbsolutePath().normalize()
        val total = archive.length()
        val counter = CountingStream(archive.inputStream())
        val hardLinks = mutableListOf<Pair<File, File>>()
        var lastPct = -1

        TarArchiveInputStream(GzipCompressorInputStream(BufferedInputStream(counter, 1 shl 16))).use { tar ->
            while (true) {
                val e = tar.nextEntry ?: break
                val name = e.name.removePrefix("./").trimEnd('/')
                if (name.isEmpty()) continue
                val target = destPath.resolve(name).normalize()
                if (!target.startsWith(destPath)) continue          // never write outside the tree
                val out = target.toFile()

                when {
                    e.isDirectory -> {
                        out.mkdirs()
                        Os.chmod(out.path, (e.mode and 511) or 448)   // keep rwx for the app
                    }
                    e.isSymbolicLink -> {
                        out.parentFile?.mkdirs()
                        if (Files.exists(target, java.nio.file.LinkOption.NOFOLLOW_LINKS)) out.delete()
                        Os.symlink(e.linkName, out.path)
                    }
                    e.isLink -> hardLinks += out to destPath.resolve(e.linkName.removePrefix("./")).normalize().toFile()
                    e.isFile -> {
                        out.parentFile?.mkdirs()
                        if (Files.exists(target, java.nio.file.LinkOption.NOFOLLOW_LINKS)) out.delete()
                        out.outputStream().use { tar.copyTo(it, 1 shl 16) }
                        Os.chmod(out.path, (e.mode and 511) or 384)
                    }
                    else -> Unit                                        // devices, fifos: not needed
                }

                val pct = 57 + (counter.count * 35 / total).toInt()
                if (pct != lastPct) { lastPct = pct; progress("Installing Universal OS…", pct) }
            }
        }
        // proot's --link2symlink handles new hard links; existing ones become copies.
        for ((link, source) in hardLinks) {
            if (!source.exists()) continue
            link.parentFile?.mkdirs()
            Files.copy(source.toPath(), link.toPath(), StandardCopyOption.REPLACE_EXISTING)
            Os.chmod(link.path, 493 /* 0o755 */)
        }
    }

    private fun createUser(fullName: String, username: String, password: CharArray) {
        val script = """
            set -e
            IFS= read -r P
            id -u "${'$'}U_NAME" >/dev/null 2>&1 || useradd -m -u 1000 -s /bin/bash -c "${'$'}U_FULL" -G sudo "${'$'}U_NAME"
            printf '%s:%s\n' "${'$'}U_NAME" "${'$'}P" | chpasswd
        """.trimIndent()
        val pb = Proot.command(c, script, user = null, env = mapOf("U_NAME" to username, "U_FULL" to fullName.replace(":", " ")))
        val p = pb.start()
        // The password goes over stdin, never on a command line.
        p.outputStream.use { it.write((String(password) + "\n").toByteArray()) }
        val log = p.inputStream.bufferedReader().readText()
        if (p.waitFor() != 0) throw IOException("Could not create the account:\n${log.takeLast(600)}")
    }

    private class CountingStream(input: InputStream) : FilterInputStream(input) {
        var count = 0L
        override fun read(): Int = super.read().also { if (it >= 0) count++ }
        override fun read(b: ByteArray, off: Int, len: Int): Int = super.read(b, off, len).also { if (it > 0) count += it }
    }
}
