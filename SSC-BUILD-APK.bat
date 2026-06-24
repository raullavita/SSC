@echo off
setlocal
cd /d "%~dp0frontend"
echo == Clean production web bundle (no source maps) ==
set GENERATE_SOURCEMAP=false
call yarn cap:sync
if errorlevel 1 exit /b 1
cd android
echo == Clean + release build (signed, R8, phone ABIs only) ==
call gradlew.bat clean bundleRelease assembleRelease
if errorlevel 1 exit /b 1
if not exist "C:\Users\smash\Desktop\SSC\APK" mkdir "C:\Users\smash\Desktop\SSC\APK"
copy /Y app\build\outputs\apk\release\app-release.apk C:\Users\smash\Desktop\SSC\APK\SSC-app-release.apk
copy /Y app\build\outputs\bundle\release\app-release.aab C:\Users\smash\Desktop\SSC\APK\SSC-app-release.aab
echo.
echo DONE (release — Google Play ready):
echo   APK  C:\Users\smash\Desktop\SSC\APK\SSC-app-release.apk
echo   AAB  C:\Users\smash\Desktop\SSC\APK\SSC-app-release.aab
echo Firebase App Distribution: upload SSC-app-release.apk
endlocal