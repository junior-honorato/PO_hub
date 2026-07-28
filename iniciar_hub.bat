@echo off
title PO Hub - Inicializador Automatico
echo ===================================================
echo             INICIANDO PO HUB LOCAL
echo ===================================================
echo.

:: 1. Procurar e validar o Python no sistema
set "PYTHON_CMD="

:: A. Tentar rodar python diretamente (se estiver no PATH)
python --version >nul 2>&1
if errorlevel 1 goto try_py
set "PYTHON_CMD=python"
goto python_found

:try_py
:: B. Tentar rodar py (Python Launcher para Windows)
py --version >nul 2>&1
if errorlevel 1 goto try_windowsapps
set "PYTHON_CMD=py"
goto python_found

:try_windowsapps
:: C. Verificar no caminho do WindowsApps (Microsoft Store)
if not exist "%USERPROFILE%\AppData\Local\Microsoft\WindowsApps\python.exe" goto try_user_programs
"%USERPROFILE%\AppData\Local\Microsoft\WindowsApps\python.exe" --version >nul 2>&1
if errorlevel 1 goto try_user_programs
set "PYTHON_CMD=%USERPROFILE%\AppData\Local\Microsoft\WindowsApps\python.exe"
goto python_found

:try_user_programs
:: D. Verificar nos caminhos padrao do instalador oficial do Python (Escopo de Usuario)
for /d %%d in ("%USERPROFILE%\AppData\Local\Programs\Python\Python*") do (
    if exist "%%d\python.exe" (
        set "PYTHON_CMD=%%d\python.exe"
        goto python_found
    )
)

:: E. Verificar no Program Files (Escopo de Maquina)
for /d %%d in ("%SystemDrive%\Program Files\Python*") do (
    if exist "%%d\python.exe" (
        set "PYTHON_CMD=%%d\python.exe"
        goto python_found
    )
)

:python_found
if not "%PYTHON_CMD%"=="" goto python_ok
echo [ERRO] Python nao encontrado no sistema!
echo Por favor, instale o Python 3.10 ou superior e marque a opcao "Add Python to PATH" no instalador.
echo.
pause
exit /b

:python_ok
echo [OK] Python detectado: %PYTHON_CMD%
echo.

:: 2. Definir caminhos locais
set "BACKEND_DIR=%~dp0backend"
set "VENV_DIR=%BACKEND_DIR%\venv"

:: 3. Criar ambiente virtual local se nao existir
if exist "%VENV_DIR%" goto venv_exists
echo [1/3] Criando ambiente virtual Python (venv) local...
"%PYTHON_CMD%" -m venv "%VENV_DIR%"
if errorlevel 1 goto venv_failed
goto venv_exists

:venv_failed
echo [ERRO] Falha ao criar o ambiente virtual local com %PYTHON_CMD%.
pause
exit /b

:venv_exists

:: 4. Garantir que o arquivo requirements.txt existe
if not exist "%BACKEND_DIR%\requirements.txt" (
    echo [!] Criando arquivo de dependencias requirements.txt...
    (
    echo fastapi
    echo uvicorn
    echo pydantic
    echo python-dotenv
    echo requests
    echo google-generativeai
    ) > "%BACKEND_DIR%\requirements.txt"
)

:: 5. Instalar ou atualizar dependencias automaticamente
echo [2/3] Verificando dependencias (requirements.txt)...
"%VENV_DIR%\Scripts\pip" install -r "%BACKEND_DIR%\requirements.txt" --quiet
if errorlevel 1 echo [AVISO] Falha ao atualizar dependencias. Tentando iniciar de qualquer forma...

:: 6. Determinar porta e host (padrao ou do .env)
set PORT=8080
set HOST=0.0.0.0
if exist "%BACKEND_DIR%\.env" (
    for /f "tokens=2 delims==" %%i in ('findstr /i "^PORT=" "%BACKEND_DIR%\.env" 2^>nul') do set PORT=%%i
    for /f "tokens=2 delims==" %%i in ('findstr /i "^HOST=" "%BACKEND_DIR%\.env" 2^>nul') do set HOST=%%i
)
set PORT=%PORT: =%
set HOST=%HOST: =%

:: 7. Iniciar o servidor backend FastAPI
echo [3/3] Iniciando Servidor Backend (FastAPI)...
start "PO Hub - Servidor Backend" cmd /k "cd /d "%BACKEND_DIR%" && venv\Scripts\python main.py"

echo Aguardando inicializacao da porta...
timeout /t 5 /nobreak > nul

:: Detecta o IP da rede local usando PowerShell
set LOCAL_IP=
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where IPAddress -notlike '127.*' | Where IPAddress -notlike '169.254.*' | Select -Expand IPAddress -First 1)"`) do (
    set LOCAL_IP=%%i
)
set LOCAL_IP=%LOCAL_IP: =%

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
echo   Para encerrar, feche a janela do console do Backend.
echo ===================================================

:: 8. Abrir o navegador
if not "%LOCAL_IP%"=="" (
    start http://%LOCAL_IP%:%PORT%
) else (
    start http://localhost:%PORT%
)

timeout /t 3 > nul
exit
