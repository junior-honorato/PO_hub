@echo off
title PO Hub - Inicializador
echo ===================================================
echo             INICIANDO PO HUB LOCAL
echo ===================================================
echo.
echo [1/2] Iniciando Servidor Backend (FastAPI)...
start "PO Hub - Servidor Backend" cmd /k "cd backend && ..\..\rag-ia\venv\Scripts\python main.py"

echo.
echo Aguardando 5 segundos para inicializacao das portas...
timeout /t 5 /nobreak > nul

echo [2/2] Abrindo o painel no navegador padrao...
start http://localhost:8080

echo.
echo ===================================================
echo   PO Hub inicializado! Pressione Ctrl+C nas janelas
echo   de comando correspondentes para encerrar os servidores.
echo ===================================================
timeout /t 3 > nul
exit
