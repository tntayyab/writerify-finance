@echo off
title KYROS Portfolio Command Center
cd /d "%~dp0"
echo ========================================================
echo   👑 KYROS PORTFOLIO & REVENUE COMMAND CENTER
echo   Supreme Authority: Boss TN TAYYAB
echo   Custodian: Messi (Chief AI Manager)
echo   Live Web Hub: http://localhost:5050
echo   Database: SQLite WAL Persistent Mode
echo ========================================================
echo Starting local engine...
start "" http://localhost:5050
node server.mjs
pause
