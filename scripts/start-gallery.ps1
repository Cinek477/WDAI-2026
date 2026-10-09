$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$runtime = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.local') -Directory -Filter 'node-v*-win-x64' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if ($runtime) {
    $nodePath = Join-Path $runtime.FullName 'node.exe'
} else {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (!$nodeCommand) { throw 'Zainstaluj Node.js 24 LTS, a następnie uruchom ten skrypt ponownie.' }
    $nodePath = $nodeCommand.Source
}
Write-Host 'Panel: http://localhost:3000/admin.html'
Write-Host 'Zatrzymanie serwera: Ctrl+C'
& $nodePath (Join-Path $projectRoot 'server.cjs')
