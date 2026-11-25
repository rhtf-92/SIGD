# Arranque unico del SIGD: reutiliza procesos verificados y contenedores existentes.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repo
$backend=Join-Path $repo 'backend'
$frontend=Join-Path $repo 'frontend'
$exitCode=0

function Invoke-SigdDocker([string[]]$DockerArguments) {
    $output = & $dockerExe @DockerArguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker no pudo completar '$($DockerArguments[0])'. No se reintentara." }
    return ($output -join "`n")
}

function Get-SigdContainer($spec) {
    try { $container = @((Invoke-SigdDocker @('inspect', $spec.Name)) | ConvertFrom-Json)[0] }
    catch { throw "No se pudo inspeccionar el contenedor existente $($spec.Name)." }
    if ($container.Name -ne ('/' + $spec.Name) -or
        $container.Config.Labels.'com.docker.compose.project' -ne $spec.Project -or
        $container.Config.Labels.'com.docker.compose.service' -ne $spec.Service) {
        throw "Identidad o proyecto inesperado: $($spec.Name)."
    }
    $mounts = @($container.Mounts)
    if ($mounts.Count -ne 1 -or $mounts[0].Type -ne 'volume' -or
        $mounts[0].Name -ne $spec.Volume -or $mounts[0].Destination -ne $spec.Target) {
        throw "Almacenamiento inesperado: $($spec.Name). No se iniciara."
    }
    $bindings = @($container.HostConfig.PortBindings.PSObject.Properties | ForEach-Object {
        $port = $_.Name
        foreach ($binding in $_.Value) { "$port|$($binding.HostIp)|$($binding.HostPort)" }
    })
    if ((($bindings | Sort-Object) -join ',') -cne (($spec.Bindings | Sort-Object) -join ',')) {
        throw "Puertos inesperados o no limitados a localhost: $($spec.Name)."
    }
    if ($container.State.Status -notin @('running', 'exited') -or
        $container.State.StartedAt -like '0001-*') {
        throw "Estado no permitido o contenedor nunca iniciado: $($spec.Name)."
    }
    if ($container.State.Health.Status -eq 'unhealthy') {
        throw "$($spec.Name) esta unhealthy. Reviselo manualmente; no se reiniciara."
    }
    return $container
}

function Get-SigdListeners([int]$Port) {
    return @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq $Port)
}

function Test-SigdHttp([string]$Url) {
    try { return (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $Url).StatusCode -eq 200 }
    catch { return $false }
}

function Open-SigdBrowser {
    if ($env:SIGD_OPEN_BROWSER -eq 'false') { return }
    try { Start-Process 'http://127.0.0.1:5178/'; Write-Host '[SIGD] Navegador abierto: http://127.0.0.1:5178/' }
    catch { Write-Warning 'No se pudo abrir el navegador. Abra http://127.0.0.1:5178/ manualmente.' }
}

. (Join-Path $PSScriptRoot 'procesos-sigd.ps1')
$requestedAt = [DateTime]::UtcNow
$coordinator = $null
$state = $null
$startedHere = @()
try {
    $coordinator = Enter-SigdLock
    if ((& git -C $repo branch --show-current) -notin @('B_JACOBO', 'F_JESUS', 'B_TAPULLIMA') -or $LASTEXITCODE -ne 0) { throw 'Este iniciador requiere B_JACOBO, F_JESUS o B_TAPULLIMA. No se cambia de rama.' }
    $nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
    $dockerExe = (Get-Command docker.exe -ErrorAction Stop).Source
    $version = [version]((& $nodeExe --version).TrimStart('v'))
    if ($version -lt [version]'24.19.0' -or $version.Major -ne 24) { throw 'Se requiere Node >=24.19.0 y <25. No se instalaran dependencias.' }
    try { $null = Invoke-SigdDocker @('info','--format','{{.ServerVersion}}') }
    catch { throw ('Docker Desktop no est{0} disponible. Abre Docker Desktop manualmente, espera a que Docker Engine est{0} funcionando y vuelve a ejecutar npm run dev' -f [char]0xE1) }
    foreach ($directory in @($backend,$frontend)) {
        $manifest = Get-Content -Raw (Join-Path $directory 'package.json') | ConvertFrom-Json
        foreach ($name in $manifest.dependencies.PSObject.Properties.Name) {
            if (-not (Test-Path -LiteralPath (Join-Path $directory ('node_modules/' + $name)))) { throw "Falta dependencia instalada: $name. No se instalaran paquetes." }
        }
    }
    foreach ($file in @('backend/node_modules/tsx/dist/loader.mjs','frontend/node_modules/vite/bin/vite.js','scratch/serve_demo.ts')) {
        if (-not (Test-Path -LiteralPath (Join-Path $repo $file))) { throw "Falta $file." }
    }
    $existingBackend = Get-SigdServer 3008 $backend 'server.ts'
    $existingFrontend = Get-SigdServer 5178 $frontend 'vite'
    $previous = Read-SigdState
    if ($previous -and $previous.root -ine $repo) { throw 'El registro de procesos pertenece a otro repositorio. No se sobrescribira.' }
    $state = [pscustomobject]@{ version=2; root=$repo; completedUtc=$null; demoOmitirPago=$null; backend=$existingBackend; frontend=$existingFrontend }
    if ($previous -and $previous.version -eq 2) {
        $state.demoOmitirPago = $previous.demoOmitirPago
        $state.backend = Merge-SigdOwnership $existingBackend $previous.backend $repo
        $state.frontend = Merge-SigdOwnership $existingFrontend $previous.frontend $repo
    }
    if ($existingBackend) {
        if ($state.demoOmitirPago -ne $null -and $state.demoOmitirPago -cne $existingBackend.demoOmitirPago) { throw 'Cambio inesperado en la configuracion economica del backend activo.' }
        $state.demoOmitirPago = $existingBackend.demoOmitirPago
    }
    $specs = @(
        @{Name='sigd-postgres-1';Project='sigd';Service='postgres';Volume='sigd-integrado_pgdata';VolumeProject='sigd-integrado';Target='/var/lib/postgresql';Bindings=@('5432/tcp|127.0.0.1|5433')},
        @{Name='sigd-redis-1';Project='sigd';Service='redis';Volume='sigd-integrado_redisdata';VolumeProject='sigd-integrado';Target='/data';Bindings=@('6379/tcp|127.0.0.1|6379')},
        @{Name='sigd-minio-1';Project='sigd';Service='minio';Volume='sigd-integrado_miniodata';VolumeProject='sigd-integrado';Target='/data';Bindings=@('9000/tcp|127.0.0.1|9000','9001/tcp|127.0.0.1|9001')}
    )
    $containers = @{}
    foreach ($spec in $specs) {
        $containers[$spec.Name] = Get-SigdContainer $spec
        $volume = @((Invoke-SigdDocker @('volume','inspect',$spec.Volume)) | ConvertFrom-Json)[0]
        if ($volume.Name -ne $spec.Volume -or $volume.Labels.'com.docker.compose.project' -ne $spec.VolumeProject) { throw "Volumen inesperado: $($spec.Volume)." }
        if ($containers[$spec.Name].State.Status -eq 'exited') {
            foreach ($binding in $spec.Bindings) {
                if (@(Get-SigdListeners ([int]($binding.Split('|')[-1]))).Count -gt 0) { throw "Puerto ocupado para $($spec.Name)." }
            }
        }
    }
    foreach ($spec in $specs) {
        $originalId = $containers[$spec.Name].Id
        if ($containers[$spec.Name].State.Status -eq 'exited') { $null = Invoke-SigdDocker @('start',$spec.Name) }
        $deadline = [DateTime]::UtcNow.AddSeconds(90)
        do {
            $container = Get-SigdContainer $spec
            if ($container.Id -ne $originalId -or $container.State.Status -ne 'running') { throw "El contenedor $($spec.Name) cambio o no esta ejecutandose." }
            if ($container.State.Health.Status -eq 'healthy') { break }
            if ([DateTime]::UtcNow -ge $deadline) { throw "Timeout de salud: $($spec.Name)." }
            Start-Sleep -Seconds 1
        } while ($true)
        Write-Host "[SIGD] $($spec.Name): healthy, mismo ID y volumen original."
    }
    Write-SigdState $state
    $loader = ([uri](Join-Path $backend 'node_modules/tsx/dist/loader.mjs')).AbsoluteUri
    $runner = Join-Path $repo 'scratch/serve_demo.ts'
    & $nodeExe --import $loader $runner --check
    if ($LASTEXITCODE -ne 0) { throw 'No se valido la configuracion privada PostgreSQL/Redis/MinIO. No se iniciaron servidores.' }
    foreach ($component in @('backend','frontend')) {
        $port = if ($component -eq 'backend') {3008} else {5178}
        $directory = Join-Path $repo $component
        $marker = if ($component -eq 'backend') {'server.ts'} else {'vite'}
        if (-not $state.$component) {
            $raced = Get-SigdServer $port $directory $marker
            if ($raced) { $state.$component = $raced }
            else {
                $nonce = [guid]::NewGuid().ToString()
                $env:SIGD_START_ID = $nonce
                & $nodeExe --import $loader $runner ("--"+$component)
                $launchExit = $LASTEXITCODE
                $pending = Get-Content -LiteralPath (Join-Path (Get-SigdRuntime) 'pending-launch.json') -Raw | ConvertFrom-Json
                if ($pending.root -ine $repo -or $pending.nonce -ne $nonce) { throw 'No se pudo verificar el supervisor recien iniciado.' }
                $manager = @($pending.managers | Where-Object component -eq $component)[0]
                $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($manager.pid)" -ErrorAction Stop
                $manager | Add-Member -NotePropertyName createdUtc -NotePropertyValue $process.CreationDate.ToUniversalTime().ToString('o')
                if (-not (Test-SigdManager $manager $repo)) { throw 'Identidad del supervisor npm inesperada.' }
                $state.$component = [pscustomobject]@{pid=$null; owned=$true; manager=$manager; port=$port}
                $startedHere += $component
                Write-SigdState $state
                if ($launchExit -ne 0) { throw "Fallo del lanzador interno $component." }
                $deadline = [DateTime]::UtcNow.AddSeconds(60)
                do {
                    $server = Get-SigdServer $port $directory $marker
                    if ($server) {
                        if (-not (Test-SigdDescendant $server.pid $manager.pid)) { throw 'El listener no pertenece al supervisor iniciado.' }
                        $server.owned=$true; $server.manager=$manager; $state.$component=$server
                        break
                    }
                    if (-not (Test-SigdManager $manager $repo)) { throw "El supervisor $component termino. Revise $($manager.log)." }
                    if ([DateTime]::UtcNow -ge $deadline) { throw "Timeout iniciando $component. Revise $($manager.log)." }
                    Start-Sleep -Milliseconds 500
                } while ($true)
            }
        }
        $urls = if ($component -eq 'backend') {@('http://127.0.0.1:3008/health','http://127.0.0.1:3008/ready')} else {@('http://127.0.0.1:5178/')}
        foreach ($url in $urls) {
            $deadline=[DateTime]::UtcNow.AddSeconds(60)
            while (-not (Test-SigdHttp $url)) {
                if ([DateTime]::UtcNow -ge $deadline) { throw "No responde $url. No se reiniciaran servicios preexistentes." }
                Start-Sleep -Milliseconds 500
            }
        }
    }
    $health=Invoke-RestMethod -TimeoutSec 3 'http://127.0.0.1:3008/health'
    if ($health.servicio -ne 'SIGD Backend' -or $health.estado -ne 'UP') { throw 'La respuesta HTTP no identifica al backend SIGD.' }
    $ui=Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 'http://127.0.0.1:5178/src/config/env.ts'
    if ($ui.Content -notmatch 'http://127\.0\.0\.1:3008') { throw 'Vite no apunta al backend 3008 esperado.' }
    $coalesced = $previous -and $previous.completedUtc -and ([DateTime]::Parse($previous.completedUtc).ToUniversalTime() -ge $requestedAt)
    $state.completedUtc=[DateTime]::UtcNow.ToString('o')
    Write-SigdState $state
    Write-Host "[SIGD] Listo. Backend PID $($state.backend.pid), frontend PID $($state.frontend.pid). Base sigd_jacobo_demo; migraciones desactivadas."
    if (-not $coalesced) { Open-SigdBrowser } else { Write-Host '[SIGD] Arranque concurrente reutilizado; no se abrira otra pestana.' }
} catch {
    Write-Host "[SIGD] $($_.Exception.Message)" -ForegroundColor Red
    $exitCode=1
    if ($state -and $startedHere.Count -gt 0) {
        $cleanup=[pscustomobject]@{version=2;root=$repo;backend=$null;frontend=$null}
        foreach ($name in $startedHere) { $cleanup.$name=$state.$name }
        try { Stop-SigdOwned $cleanup $repo } catch { Write-Warning 'No se pudo verificar el cierre de procesos propios. Los ajenos se conservaron.' }
        # Conservar el registro completo, incluyendo servidores preexistentes.
        foreach ($name in $startedHere) { $state.$name=$cleanup.$name }
        Write-SigdState $state
    }
} finally { Exit-SigdLock $coordinator }
exit $exitCode
