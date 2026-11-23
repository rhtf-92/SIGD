# Detiene exclusivamente ?rboles npm creados por el lanzador, nunca servidores reutilizados.
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'procesos-sigd.ps1')
$repo=Split-Path -Parent $PSScriptRoot
$mutex=$null
try {
    if ((& git -C $repo branch --show-current) -ne 'B_JACOBO') { throw 'Se requiere B_JACOBO.' }
    $mutex=Enter-SigdLock
    Stop-SigdOwned (Read-SigdState) $repo
    Write-Host '[SIGD] Los procesos reutilizados y Docker permanecen intactos.'
} catch { Write-Error $_; exit 1 }
finally { Exit-SigdLock $mutex }
