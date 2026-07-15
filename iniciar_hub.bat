@echo off
title PO Hub - Inicializador
echo ===================================================
echo             INICIANDO PO HUB LOCAL
echo ===================================================
echo.

:: Define valores padrões
set PORT=8080
set HOST=0.0.0.0

:: Tenta ler PORT e HOST do backend/.env
if exist backend\.env (
    for /f "tokens=2 delims==" %%i in ('findstr /i "^PORT=" backend\.env 2^>nul') do set PORT=%%i
    for /f "tokens=2 delims==" %%i in ('findstr /i "^HOST=" backend\.env 2^>nul') do set HOST=%%i
)

:: Remove espaços em branco das variáveis
set PORT=%PORT: =%
set HOST=%HOST: =%

echo [1/2] Iniciando Servidor Backend (FastAPI)...
start "PO Hub - Servidor Backend" cmd /k "cd backend && ..\..\rag-ia\venv\Scripts\python main.py"

echo.
echo Aguardando 5 segundos para inicializacao das portas...
timeout /t 5 /nobreak > nul

:: Detecta o IP da rede local usando PowerShell
set LOCAL_IP=
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where IPAddress -notlike '127.*' | Where IPAddress -notlike '169.254.*' | Select -Expand IPAddress -First 1)"`) do (
    set LOCAL_IP=%%i
)
set LOCAL_IP=%LOCAL_IP: =%

echo.
echo ===================================================
echo   PO Hub inicializado com sucesso!
echo.
if not "%LOCAL_IP%"=="" (
    echo   Acesso na Rede Interna: http://%LOCAL_IP%:%PORT%
    echo   Acesso Local:          http://localhost:%PORT%
) else (
    echo   Acesso Local:          http://localhost:%PORT%
)
echo.
echo   Pressione Ctrl+C nas janelas de comando
echo   correspondentes para encerrar os servidores.
echo ===================================================

echo [2/2] Abrindo o painel no navegador padrao...
if not "%LOCAL_IP%"=="" (
    start http://%LOCAL_IP%:%PORT%
) else (
    start http://localhost:%PORT%
)

timeout /t 3 > nul
exit
