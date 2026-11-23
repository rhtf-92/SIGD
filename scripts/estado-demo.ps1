# Consultas de salud sin ejecutar arranque, migraciones ni comandos de negocio.
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'procesos-sigd.ps1')
$repo=Split-Path -Parent $PSScriptRoot
try {
    & docker.exe info --format 'Docker Engine: {{.ServerVersion}}' 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Host 'Docker Engine no disponible. Abralo manualmente.' }
    foreach($name in @('sigd-postgres-1','sigd-redis-1','sigd-minio-1')) {
        & docker.exe inspect --format '{{.Name}}: {{.State.Status}} / {{.State.Health.Status}}' $name 2>$null
    }
    $state=Read-SigdState
    foreach($name in @('backend','frontend')) {
        $port=if($name -eq 'backend'){3008}else{5178}
        $marker=if($name -eq 'backend'){'server.ts'}else{'vite'}
        $server=Get-SigdServer $port (Join-Path $repo $name) $marker
        if(-not $server){ Write-Host "$name : detenido ($port)"; continue }
        $owned=$false
        if($state -and $state.version -eq 2) { $server=Merge-SigdOwnership $server $state.$name $repo; $owned=$server.owned }
        Write-Host "$name : PID $($server.pid), 127.0.0.1:$port, directorio $($server.directory), administrado=$owned"
    }
    foreach($url in @('http://127.0.0.1:3008/health','http://127.0.0.1:3008/ready','http://127.0.0.1:5178/')) {
        try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 $url; Write-Host "$url : HTTP $($r.StatusCode)" }
        catch { Write-Host "$url : no disponible" }
    }
    $loader=([uri](Join-Path $repo 'backend/node_modules/tsx/dist/loader.mjs')).AbsoluteUri
    & node.exe --import $loader (Join-Path $repo 'scratch/serve_demo.ts') --check
    if ($LASTEXITCODE -ne 0) { throw 'Configuracion o conexiones no verificadas.' }
} catch { Write-Error $_; exit 1 }
