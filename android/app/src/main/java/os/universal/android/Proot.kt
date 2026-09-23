package os.universal.android

import android.content.Context
import android.system.Os
import java.io.File

/**
 * Runs commands inside the Universal OS Linux tree with proot: a user-space
 * "chroot" that needs no root access and doesn't change Android.
 * proot, its loader and libtalloc ship in the APK as native libraries.
 */
object Proot {
    private const val FAKE_PROC = "/usr/share/universal/proc"

    private fun prepare(c: Context) {
        // proot is linked against "libtalloc.so.2"; APK libraries must be named lib*.so.
        val lib = Paths.libDir(c).apply { mkdirs() }
        val link = File(lib, "libtalloc.so.2")
        val target = File(c.applicationInfo.nativeLibraryDir, "libtalloc.so").absolutePath
        runCatching { if (Os.readlink(link.absolutePath) == target) return@runCatching; link.delete(); Os.symlink(target, link.absolutePath) }
            .onFailure { link.delete(); Os.symlink(target, link.absolutePath) }
        Paths.prootTmp(c).mkdirs()
    }

    /**
     * @param user null to run as root (setup tasks), or the account name for the desktop.
     * @param env extra, non-secret environment variables for the Linux side.
     */
    fun command(c: Context, script: String, user: String?, env: Map<String, String> = emptyMap()): ProcessBuilder {
        prepare(c)
        val nativeDir = c.applicationInfo.nativeLibraryDir
        val rootfs = Paths.rootfs(c).absolutePath
        val home = if (user == null) "/root" else "/home/$user"

        val args = mutableListOf(
            "$nativeDir/libproot.so",
            "--kill-on-exit",
            "--link2symlink",
            "--sysvipc",
            "-r", rootfs,
            "-b", "/dev",
            "-b", "/proc",
            "-b", "/sys",
            "-b", "$rootfs/tmp:/dev/shm",
            // Android hides these from apps; give Linux programs harmless stand-ins.
            "-b", "$rootfs$FAKE_PROC/stat:/proc/stat",
            "-b", "$rootfs$FAKE_PROC/vmstat:/proc/vmstat",
            "-b", "$rootfs$FAKE_PROC/loadavg:/proc/loadavg",
        )
        if (user == null) args += listOf("-0", "-w", home)
        else args += listOf("--change-id=1000:1000", "-w", home)

        args += listOf(
            "/usr/bin/env", "-i",
            "HOME=$home",
            "USER=${user ?: "root"}",
            "LOGNAME=${user ?: "root"}",
            "SHELL=/bin/bash",
            "LANG=C.UTF-8",
            "TERM=xterm-256color",
            "TMPDIR=/tmp",
            "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        )
        env.forEach { (k, v) -> args += "$k=$v" }
        args += listOf("/bin/sh", "-c", script)

        return ProcessBuilder(args).redirectErrorStream(true).also {
            it.environment()["PROOT_LOADER"] = "$nativeDir/libproot-loader.so"
            it.environment()["PROOT_TMP_DIR"] = Paths.prootTmp(c).absolutePath
            it.environment()["LD_LIBRARY_PATH"] = "${Paths.libDir(c).absolutePath}:$nativeDir"
        }
    }
}
