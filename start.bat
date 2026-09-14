@echo off
title AI Autonomous Legal Content Telegram Agent (Node.js + TypeScript)
echo ========================================================
echo   O'zbekiston Huquqi AI Telegram Agent (Node.js + TS)
echo ========================================================
echo.

if not exist node_modules (
    echo [1/3] npm packages o'rnatilmoqda...
    call npm install
)

echo [2/3] Prisma Database sinxronizatsiya qilinmoqda...
call npx prisma db push

echo [3/3] AI Agent va Telegram Bot ishga tushirilmoqda...
call npm run dev

pause
