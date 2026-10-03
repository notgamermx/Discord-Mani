$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$releasePath = Join-Path $projectRoot 'release'
$null = New-Item -ItemType Directory -Force -Path $releasePath
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'manifest.json') -Raw | ConvertFrom-Json
$archivePath = Join-Path $releasePath ("morrow-" + $manifest.version + ".zip")
$runtimeFiles = @('manifest.json', 'options.html', 'popup.html', 'ui.css', 'src', 'icons', 'README.md') | ForEach-Object { Join-Path $projectRoot $_ }
Compress-Archive -LiteralPath $runtimeFiles -DestinationPath $archivePath -Force
Write-Output $archivePath
