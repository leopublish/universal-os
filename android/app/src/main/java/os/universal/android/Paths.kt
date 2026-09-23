package os.universal.android

import android.content.Context
import java.io.File
import java.io.IOException
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.attribute.BasicFileAttributes

/** Where Universal OS keeps its files inside the app's private storage. */
object Paths {
    fun rootfs(c: Context) = File(c.filesDir, "rootfs")
    fun libDir(c: Context) = File(c.filesDir, "lib")
    fun prootTmp(c: Context) = File(c.cacheDir, "proot-tmp")
    fun installedMarker(c: Context) = File(c.filesDir, "installed")
    /** Set once the Linux tree is fully unpacked, so a retry can skip the download. */
    fun extractedMarker(c: Context) = File(c.filesDir, "extracted")
    fun sessionLog(c: Context) = File(c.filesDir, "session.log")

    fun isInstalled(c: Context) = installedMarker(c).exists() && rootfs(c).isDirectory

    /** Deletes a tree without following symlinks (the Linux tree has many absolute ones). */
    fun deleteTree(root: File) {
        val start = root.toPath()
        if (!Files.exists(start, java.nio.file.LinkOption.NOFOLLOW_LINKS)) return
        Files.walkFileTree(start, object : SimpleFileVisitor<Path>() {
            override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
                file.toFile().setWritable(true)
                Files.deleteIfExists(file)
                return FileVisitResult.CONTINUE
            }

            override fun preVisitDirectory(dir: Path, attrs: BasicFileAttributes): FileVisitResult {
                dir.toFile().setWritable(true)
                dir.toFile().setExecutable(true)
                return FileVisitResult.CONTINUE
            }

            override fun visitFileFailed(file: Path, exc: IOException): FileVisitResult {
                Files.deleteIfExists(file)
                return FileVisitResult.CONTINUE
            }

            override fun postVisitDirectory(dir: Path, exc: IOException?): FileVisitResult {
                Files.deleteIfExists(dir)
                return FileVisitResult.CONTINUE
            }
        })
    }
}
