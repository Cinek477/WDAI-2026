$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $projectRoot '.local\server.pid'
if (!(Test-Path -LiteralPath $pidFile)) { Write-Host 'Brak serwera uruchomionego w tle. W oknie serwera użyj Ctrl+C.'; exit }
$galleryProcessId = [int](Get-Content -LiteralPath $pidFile)
$galleryProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $galleryProcessId"
$localRuntimeRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot '.local')) + [IO.Path]::DirectorySeparatorChar
if (!$galleryProcess) { Write-Host 'Serwer jest już zatrzymany.'; exit }
if (!$galleryProcess.ExecutablePath.StartsWith($localRuntimeRoot, [StringComparison]::OrdinalIgnoreCase) -or $galleryProcess.CommandLine -notmatch 'server\.cjs') {
    throw 'Zapisany PID nie należy do lokalnego serwera tego projektu. Proces nie został zatrzymany.'
}
Stop-Process -Id $galleryProcessId
Write-Host 'Lokalny serwer galerii został zatrzymany.'
