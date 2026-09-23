plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release signing comes from CI secrets; without them the build falls back to
// the debug key (still installable, but updates then need a reinstall).
val keystorePath: String? = System.getenv("UNIVERSAL_KEYSTORE")
val keystorePassword: String? = System.getenv("UNIVERSAL_KEYSTORE_PASSWORD")
val hasReleaseKey = keystorePath != null && keystorePassword != null && file(keystorePath).exists()

android {
    namespace = "os.universal.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "os.universal.android"
        minSdk = 26
        // Kept at 28 on purpose: newer targets forbid running programs from app
        // storage, which the Linux environment (proot) needs. Sideloading works.
        targetSdk = 28
        versionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
        versionName = "1.0"
        ndk { abiFilters += "arm64-v8a" }
    }

    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                storeFile = file(keystorePath!!)
                storePassword = keystorePassword
                keyAlias = System.getenv("UNIVERSAL_KEY_ALIAS") ?: "universal"
                keyPassword = keystorePassword
                storeType = "pkcs12"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName(if (hasReleaseKey) "release" else "debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    // proot and its loader must exist as real files in nativeLibraryDir.
    packaging { jniLibs { useLegacyPackaging = true } }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("org.apache.commons:commons-compress:1.27.1")
}
