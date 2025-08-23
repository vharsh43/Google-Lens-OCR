@echo off
REM Quick OCR Platform startup for Windows
title OCR Platform - Quick Start

echo Starting OCR Platform...
docker-compose down --remove-orphans && docker-compose build web && docker-compose up -d

echo.
echo OCR Platform is starting up...
echo Web application will be available at: http://localhost:3333
echo.
echo Press any key to view live logs (Ctrl+C to exit logs)...
pause >nul

docker-compose logs -f