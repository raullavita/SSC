@echo off
setlocal
cd /d "%~dp0frontend"
echo == Building React bundle for production API ==
call yarn cap:sync
if errorlevel 1 exit /b 1
cd android
echo == Building debug APK (Firebase App Distribution) ==
call gradlew.bat assembleDebug
if errorlevel 1 exit /b 1
echo.
echo DONE: frontend\android\app\build\outputs\apk\debug\app-debug.apk
echo Upload in Firebase Console - App Distribution - Releases
endlocal