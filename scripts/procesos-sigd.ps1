# Funciones compartidas del lanzador. No inicia ni detiene servicios al importarse.
function Initialize-SigdProcessReader {
    if ('SigdProcessReader' -as [type]) { return }
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class SigdProcessReader {
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll")] static extern bool ReadProcessMemory(IntPtr h, IntPtr address, byte[] data, int size, out IntPtr read);
    [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h, int kind, IntPtr[] data, int size, out int returned);
    static byte[] Read(IntPtr h, long address, int size) {
        var data = new byte[size]; IntPtr read;
        if (!ReadProcessMemory(h, new IntPtr(address), data, size, out read) || read.ToInt64()!=size)
            throw new InvalidOperationException("No se pudo verificar el proceso Windows.");
        return data;
    }
    public static string[] Inspect(int pid) {
        if (IntPtr.Size!=8) throw new InvalidOperationException("Se requiere PowerShell de 64 bits.");
        IntPtr h=OpenProcess(0x410, false, pid);
        if(h==IntPtr.Zero) throw new InvalidOperationException("No se pudo abrir el proceso para lectura.");
        try {
            var info=new IntPtr[6]; int returned;
            if(NtQueryInformationProcess(h,0,info,IntPtr.Size*6,out returned)!=0) throw new InvalidOperationException("No se pudo consultar el proceso.");
            long parameters=BitConverter.ToInt64(Read(h,info[1].ToInt64()+0x20,8),0);
            var cwd=Read(h,parameters+0x38,16);
            string directory=Encoding.Unicode.GetString(Read(h,BitConverter.ToInt64(cwd,8),BitConverter.ToUInt16(cwd,0)));
            long environment=BitConverter.ToInt64(Read(h,parameters+0x80,8),0);
            var text=new StringBuilder(); bool ended=false;
            for(int i=0;i<65536;i++) {
                char c=(char)BitConverter.ToUInt16(Read(h,environment+i*2,2),0);
                if(c=='\0' && text.Length>0 && text[text.Length-1]=='\0') { ended=true; break; }
                text.Append(c);
            }
            if(!ended) throw new InvalidOperationException("Entorno del proceso fuera del limite de lectura.");
            string flag=null, database=null, migrate=null, redis=null, storage=null, bucket=null;
            foreach(var line in text.ToString().Split('\0')) {
                if(line.StartsWith("SIGD_DEMO_OMITIR_PAGO=",StringComparison.OrdinalIgnoreCase)) flag=line.Substring(22);
                if(line.StartsWith("DATABASE_URL=",StringComparison.OrdinalIgnoreCase)) database=Target(line.Substring(13));
                if(line.StartsWith("MIGRATE_ON_BOOT=",StringComparison.OrdinalIgnoreCase)) migrate=line.Substring(16);
                if(line.StartsWith("REDIS_URL=",StringComparison.OrdinalIgnoreCase)) redis=Target(line.Substring(10));
                if(line.StartsWith("S3_ENDPOINT=",StringComparison.OrdinalIgnoreCase)) storage=Target(line.Substring(12));
                if(line.StartsWith("S3_BUCKET=",StringComparison.OrdinalIgnoreCase)) bucket=line.Substring(10);
            }
            return new string[]{directory,flag,database,migrate,redis,storage,bucket};
        } finally { CloseHandle(h); }
    }
    static string Target(string value) {
        var uri=new Uri(value);
        // No devolver usuario, contraseña, parámetros ni fragmentos.
        return uri.Host+":"+uri.Port+uri.AbsolutePath;
    }
}
'@
}

function Get-SigdRuntime {
    $directory = Join-Path $env:LOCALAPPDATA 'SIGD/runtime'
    if (-not (Test-Path -LiteralPath $directory)) { $null = New-Item -ItemType Directory -Path $directory -Force }
    return $directory
}

function Read-SigdState {
    $file = Join-Path (Get-SigdRuntime) 'demo-processes.json'
    if (-not (Test-Path -LiteralPath $file)) { return $null }
    try { return Get-Content -LiteralPath $file -Raw | ConvertFrom-Json }
    catch { throw 'El registro local de procesos no es valido. No se sobrescribira ni se detendran procesos.' }
}

function Write-SigdState($State) {
    $file = Join-Path (Get-SigdRuntime) 'demo-processes.json'
    $temporary = $file + '.' + $PID + '.tmp'
    $State | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $file -Force
}

function Enter-SigdLock([string]$Name = 'Local\SIGD-3008-5178-start', [string]$Runtime = '') {
    $mutex = New-Object System.Threading.Mutex($false, $Name)
    try {
        try { $locked = $mutex.WaitOne(180000) }
        catch [System.Threading.AbandonedMutexException] { $locked = $true }
        if (-not $locked) { throw 'Otro coordinador SIGD sigue activo. No se quitara su bloqueo ni se iniciaran duplicados.' }
        # El mutex del sistema operativo es la autoridad; este archivo identifica a su propietario.
        if (-not $Runtime) { $Runtime = Get-SigdRuntime }
        $owner = Join-Path $Runtime 'startup-owner.json'
        $mutex | Add-Member -NotePropertyName SigdOwnerPath -NotePropertyValue $owner
        @{ pid=$PID; createdUtc=(Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o') } |
            ConvertTo-Json | Set-Content -LiteralPath $owner -Encoding UTF8
        return $mutex
    } catch { $mutex.Dispose(); throw }
}

function Exit-SigdLock($Mutex) {
    if ($Mutex) {
        # Solo el propietario del mutex puede limpiar el identificador auxiliar.
        $owner = $Mutex.SigdOwnerPath
        if (Test-Path -LiteralPath $owner) { Remove-Item -LiteralPath $owner -Force }
        $Mutex.ReleaseMutex(); $Mutex.Dispose()
    }
}

function Get-SigdServer([int]$Port, [string]$Directory, [string]$Marker) {
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq $Port)
    if ($listeners.Count -eq 0) { return $null }
    $ids = @($listeners.OwningProcess | Sort-Object -Unique)
    if ($ids.Count -ne 1 -or @($listeners | Where-Object LocalAddress -ne '127.0.0.1').Count -gt 0) {
        throw "Listener inesperado en $Port. No se iniciara ni detendra ningun servidor."
    }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($ids[0])" -ErrorAction Stop
    if ($process.Name -ne 'node.exe' -or -not $process.CommandLine -or
        $process.CommandLine.Replace('/','\').IndexOf($Directory.Replace('/','\'), [StringComparison]::OrdinalIgnoreCase) -lt 0 -or
        $process.CommandLine.IndexOf($Marker, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw "El proceso de $Port no pertenece al servidor esperado de este repositorio."
    }
    Initialize-SigdProcessReader
    $identity = [SigdProcessReader]::Inspect([int]$process.ProcessId)
    if ($identity[0].TrimEnd('\') -ine $Directory.TrimEnd('\')) { throw "Directorio de trabajo inesperado en $Port." }
    if ($Port -eq 3008 -and ($identity[2] -cne '127.0.0.1:5433/sigd_jacobo_demo' -or
        $identity[3] -cne 'false' -or $identity[4] -cne '127.0.0.1:6379/1' -or
        $identity[5] -cne '127.0.0.1:9000/' -or $identity[6] -cne 'sigd-sandbox-e2e')) {
        throw 'El backend activo no utiliza la configuracion de demostracion esperada. No se reutilizara ni reiniciara.'
    }
    return [pscustomobject]@{ pid=[int]$process.ProcessId; createdUtc=$process.CreationDate.ToUniversalTime().ToString('o');
        directory=$identity[0]; port=$Port; demoOmitirPago=$identity[1]; owned=$false; manager=$null }
}

function Test-SigdManager($Manager, [string]$Repo) {
    if (-not $Manager -or -not $Manager.pid -or -not $Manager.createdUtc) { return $false }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($Manager.pid)" -ErrorAction SilentlyContinue
    if (-not $process -or $process.Name -ne 'cmd.exe' -or
        $process.CreationDate.ToUniversalTime().ToString('o') -ne $Manager.createdUtc -or
        $process.CommandLine -notmatch 'npm(?:\.cmd)?["\s]+run dev:(api|ui)') { return $false }
    Initialize-SigdProcessReader
    $identity = [SigdProcessReader]::Inspect([int]$process.ProcessId)
    return ($identity[0].TrimEnd('\') -ieq (Join-Path $Repo $Manager.component).TrimEnd('\'))
}

function Test-SigdDescendant([int]$Child, [int]$Ancestor) {
    $seen = @{}
    while ($Child -gt 0 -and -not $seen.ContainsKey($Child)) {
        if ($Child -eq $Ancestor) { return $true }
        $seen[$Child] = $true
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$Child" -ErrorAction SilentlyContinue
        if (-not $process) { return $false }
        $Child = [int]$process.ParentProcessId
    }
    return $false
}

function Merge-SigdOwnership($Server, $Previous, [string]$Repo) {
    if ($Server -and $Previous -and $Previous.owned -eq $true -and
        (Test-SigdManager $Previous.manager $Repo) -and
        (Test-SigdDescendant $Server.pid $Previous.manager.pid)) {
        $Server.owned = $true; $Server.manager = $Previous.manager
    }
    return $Server
}

function Stop-SigdOwned($State, [string]$Repo) {
    if (-not $State -or $State.version -ne 2 -or $State.root -ine $Repo) {
        Write-Host '[SIGD] Sin procesos administrados verificables. Los servidores preexistentes se conservan.'
        return
    }
    foreach ($name in @('frontend','backend')) {
        $entry = $State.$name
        if (-not $entry -or -not $entry.owned) { continue }
        if (-not (Test-SigdManager $entry.manager $Repo)) {
            throw "El administrador registrado de $name no coincide. No se detendra por PID o puerto."
        }
        $port = if ($name -eq 'backend') {3008} else {5178}
        $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq $port)
        foreach ($listener in $listeners) {
            if (-not (Test-SigdDescendant $listener.OwningProcess $entry.manager.pid)) { throw "El listener $port es ajeno al proceso administrado." }
        }
        & taskkill.exe /PID $entry.manager.pid /T /F *> $null
        if ($LASTEXITCODE -ne 0) { throw "No se pudo cerrar el arbol propio de $name." }
        $entry.owned = $false; $entry.manager = $null
        Write-Host "[SIGD] Arbol propio de $name detenido. Infraestructura conservada."
    }
    Write-SigdState $State
}
