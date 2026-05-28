@echo off
REM =====================================================================
REM  ROMPEX Intranet - Instalador da Automação Fiscal (NFS-e)
REM  Roda 1 vez no computador para preparar o ambiente.
REM =====================================================================

echo ============================================================
echo   AUTOMACAO FISCAL ROMPEX - INSTALACAO
echo ============================================================
echo.

REM --- 1) Verifica se o Python esta instalado -------------------------
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Python nao foi encontrado neste computador.
    echo.
    echo   1. Baixe Python 3.10 ou superior em: https://www.python.org/downloads/
    echo   2. Durante a instalacao, marque a opcao "Add Python to PATH".
    echo   3. Rode este instalador novamente.
    echo.
    pause
    exit /b 1
)

echo [1/3] Python encontrado.
python --version
echo.

REM --- 2) Instala as dependencias ------------------------------------
echo [2/3] Instalando dependencias (playwright, openpyxl)...
python -m pip install --upgrade pip --quiet
python -m pip install playwright openpyxl --quiet
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao instalar dependencias Python.
    pause
    exit /b 1
)
echo      OK!
echo.

REM --- 3) Baixa o Chrome do Playwright -------------------------------
echo [3/3] Instalando o Chrome utilizado pela automacao...
python -m playwright install chrome
if %ERRORLEVEL% NEQ 0 (
    echo [AVISO] Nao foi possivel instalar o Chrome do Playwright.
    echo Continue mesmo assim - a automacao tentara usar o Chrome do sistema.
)
echo.

echo ============================================================
echo   INSTALACAO CONCLUIDA!
echo ============================================================
echo.
echo Para rodar a automacao a partir de agora, basta dar 2 cliques em:
echo     baixar_nfse.py
echo.
echo Ou abra um cmd na pasta e digite:
echo     python baixar_nfse.py
echo.
pause
