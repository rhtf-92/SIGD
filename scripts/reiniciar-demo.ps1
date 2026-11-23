# La parada compartida solo afecta procesos propios; el inicio reutiliza los ajenos.
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'detener-demo.ps1')
if (-not $?) { exit 1 }
& (Join-Path $PSScriptRoot 'iniciar-sigd-local.ps1')
