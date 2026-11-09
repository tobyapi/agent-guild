@echo off
chcp 65001 > nul
rem AIギルドを開発モードで起動する（ダブルクリックで実行）
cd /d "%~dp0"

where node > nul 2>&1
if errorlevel 1 (
  echo Node.js が見つかりません。https://nodejs.org からインストールしてください。
  pause
  exit /b 1
)

if not exist node_modules (
  echo 初回の準備: 依存パッケージをインストールしています…
  call npm install
  if errorlevel 1 (
    echo インストールに失敗しました。
    pause
    exit /b 1
  )
)

echo AIギルドを起動しています（初回や Rust の変更後はビルドに数分かかります）…
call npm run app
if errorlevel 1 (
  echo.
  echo 起動に失敗しました。上のメッセージを確認してください。
  pause
)
