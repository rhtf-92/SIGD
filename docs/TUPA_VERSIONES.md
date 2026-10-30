# Gestión de versiones del TUPA

La migración `backend/migraciones/08_sigd_tupa_version.sql` crea el esquema `sigd_tupa`: `version` almacena metadatos y estado; `tramite_version` y `tramite_requisito` contienen las fichas de cada versión; `bitacora` registra altas y transiciones de estado y bloquea `UPDATE`, `DELETE` y `TRUNCATE`. La migración nueva `09_sigd_tupa_textos_libres.sql` amplía los textos de derecho y permite dejar el plazo sin definir sin alterar la migración 08. Las versiones publicadas son inmutables. El rol administrativo de mayor privilegio que define actualmente `03_sigd_org.sql` es `ADMINISTRADOR`; la API TUPA lo exige para `/versiones`.

## Cargar el TUPA inicial

Desde `backend`, ejecutar en la sesión que ya tiene `DATABASE_URL` y `PGPASSWORD` configuradas para `sigd_tupa_test`. Los comandos de backend cargan `dotenv/config` sin reemplazar variables ya presentes en el entorno. Confirmar el destino antes de ejecutar DDL:

```powershell
node -e "require('dotenv/config'); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); p.query('select current_database() as db').then(async r=>{console.log('Base destino:',r.rows[0].db); if(r.rows[0].db!=='sigd_tupa_test') process.exitCode=1; await p.end()}).catch(async e=>{console.error('No se pudo validar la base:',e.code); process.exitCode=1; await p.end()})"
if ($LASTEXITCODE -ne 0) { throw "DATABASE_URL no apunta a sigd_tupa_test o la conexión falló." }
npm run migrate
npx tsx scripts/cargarTupa.ts
```

El cargador es transaccional e idempotente: publica `TUPA-BASE-PROYECTO`, crea `TUPA-2026-v1.0` en borrador y comprueba las 81 fichas y el total de S/ 917.50 de ACA-001 a ACA-014. No altera `sigd_doc.tipo_tramite_tupa`.

## Crear un usuario administrativo de demo

Desde `backend`, en la misma sesión que apunta a `sigd_tupa_test`, solicitar las credenciales de forma interactiva y ejecutar el script. La contraseña no se escribe en el repositorio ni en el historial de comandos:

```powershell
$env:TUPA_ADMIN_IDENTIFICADOR = Read-Host "Identificador administrativo"
$securePassword = Read-Host "Contraseña administrativa" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $env:TUPA_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    npx tsx scripts/crearUsuarioAdmin.ts
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    Remove-Item Env:TUPA_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    $securePassword.Dispose()
}
```

También acepta `identificador` y `contraseña` como argumentos de línea de comandos. El usuario recibe el rol institucional `ADMINISTRADOR`; la contraseña se almacena con `Argon2Service`.

## Endpoints

Públicos: `GET /api/v1/tupa/vigente`, `GET /api/v1/tupa/vigente/tramites?q=&rubro=&pagina=&porPagina=`, `GET /api/v1/tupa/vigente/tramites/:codigo`.

Administrativos (JWT de `ADMINISTRADOR`): `GET /api/v1/tupa/versiones`, `GET /api/v1/tupa/versiones/:id`, `GET /api/v1/tupa/versiones/:id/tramites`, `POST /api/v1/tupa/versiones`, `POST|PATCH|DELETE /api/v1/tupa/versiones/:id/tramites[/:tramiteId]`, `POST|PATCH|DELETE /api/v1/tupa/versiones/:id/tramites/:tramiteId/requisitos[/:requisitoId]`, `PUT /api/v1/tupa/versiones/:id/resolucion`, `POST /api/v1/tupa/versiones/:id/publicar`, `GET /api/v1/tupa/versiones/:id/bitacora`, `GET /api/v1/tupa/versiones/:id/resolucion`.

La carga de resolución usa `application/pdf`, `X-Nombre-Archivo`, máximo 10 MB, valida `%PDF-` y persiste SHA-256. Por defecto los PDF se guardan en `backend/storage/tupa` o en `TUPA_PDF_DIR`; con S3 configurado, seleccionar `TUPA_PDF_STORAGE=s3`.

## Demo de cinco minutos

1. Abrir `/tupa`, buscar una ficha, filtrar por rubro y consultar sus requisitos y notas.
2. Abrir `/tupa/gestion` e iniciar sesión con la cuenta administrativa creada por el script.
3. Crear una versión nueva copiando la vigente y cambiar el monto de una ficha.
4. Cargar el PDF de la resolución, completar número y fechas, y publicar con confirmación.
5. Verificar que la nueva versión figure `VIGENTE`, la anterior `SUPERSEDIDA`, revisar la bitácora y descargar el PDF.
6. Como prueba negativa, intentar editar una ficha publicada: la API debe responder HTTP 409.

Para iniciar los servidores, en dos terminales desde la raíz del monorepo: `cd backend; npm run dev` y `cd frontend; npm run dev`.
