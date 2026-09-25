@echo off
title Push HOMBRE UID Gateway to GitHub
echo ========================================================
echo   HOMBRE UID Bypass Gateway - GitHub Push Utility
echo ========================================================
echo.
set /p REPO_URL="Enter your GitHub Repository URL: "
if "%REPO_URL%"=="" (
    echo [ERROR] Repository URL cannot be empty.
    pause
    exit /b
)
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
echo.
echo Pushing repository to GitHub...
git push -u origin main
echo.
echo ========================================================
echo   SUCCESS: Code pushed to GitHub!
echo   Next Step: Go to https://dashboard.render.com -> New Web Service
echo ========================================================
pause
