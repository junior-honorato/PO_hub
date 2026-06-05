@echo off
title PO Hub - Inicializador
echo ===================================================
echo             INICIANDO PO HUB LOCAL
echo ===================================================
echo.
echo [1/3] Iniciando Servidor Backend (FastAPI)...
start "PO Hub - Backend (Porta 5000)" cmd /k "cd backend && ..\..\venv\Scripts\python -m uvicorn main:app --port 5000"

echo [2/3] Iniciando Servidor Frontend (Vite/React)...
start "PO Hub - Frontend (Vite)" cmd /k "cd frontend && npm run dev"

echo.
echo Aguardando 5 segundos para inicializacao das portas...
timeout /t 5 /nobreak > nul

echo [3/3] Abrindo o painel no navegador padrao...
start http://localhost:5000

echo.
echo ===================================================
echo   PO Hub inicializado! Pressione Ctrl+C nas janelas
echo   de comando correspondentes para encerrar os servidores.
echo ===================================================
timeout /t 3 > nul
exit
