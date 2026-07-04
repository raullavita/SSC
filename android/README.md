# SSC Android (scaffold)

Gradle project stub for the installed Android client. Uses official `libsignal-android` per `memory/SIGNAL_CHARTER.md`.

Engine 10 delivers project structure only — **no APK build** in this gate.

## Next steps (platform release)

1. Uncomment `libsignal-android` in `app/build.gradle.kts`
2. Wire `X-SSC-Client: android/0.1.0/{build}` on all API calls
3. Implement Signal session store + sealed sender client-side
4. `./gradlew assembleRelease`