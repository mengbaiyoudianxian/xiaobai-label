# Run 小白标注 on this PC for development.
#   .\tools\run-local.ps1 -Python <python.exe of a venv with label-studio==1.23.2> [-Data <data dir>] [-Port 18092]
param(
  [Parameter(Mandatory)][string]$Python,
  [string]$Data = (Join-Path $env:TEMP 'xiaobai-label-data'),
  [int]$Port = 18092
)
$root = Split-Path $PSScriptRoot -Parent
New-Item -ItemType Directory -Force $Data | Out-Null
$env:LABEL_STUDIO_BASE_DATA_DIR = $Data
$env:PYTHONPATH = $root
$env:DJANGO_SETTINGS_MODULE = 'xiaobai_label.settings'
$env:SENTRY_DSN = 'http://off@127.0.0.1:9/0'
$env:COLLECT_ANALYTICS = 'false'
$env:NO_PROXY = '*'
# images under <Data> can be imported as /data/local-files/?d=<relative path>
$env:LABEL_STUDIO_LOCAL_FILES_SERVING_ENABLED = 'true'
$env:LABEL_STUDIO_LOCAL_FILES_DOCUMENT_ROOT = $Data
$ls = Join-Path (Split-Path $Python -Parent) 'label-studio.exe'
& $ls start --no-browser --internal-host 127.0.0.1 --port $Port
