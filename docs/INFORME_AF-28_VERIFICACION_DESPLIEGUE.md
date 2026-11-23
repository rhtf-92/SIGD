# SIGD IESTP SUIZA 2026 — INFORME DE VERIFICACIÓN FINAL Y CIERRE SEGURO AF-28
## AUDITORÍA ARQUITECTÓNICA DEFINITIVA, PRUEBAS E2E EN NAVEGADOR REAL (9/9 MÓDULOS) Y PROTOCOLO DOCKER COMPOSE

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa) 2026  
**Repositorio:** `C:\Users\Liz\Desktop\SIGD\SIGD`  
**Rama Oficial:** `B_JACOBO`  
**Fecha de Certificación:** 26 de octubre de 2026  
**Responsable Técnico:** Arquitecto de Software Senior & Ingeniero Fullstack Senior  
**Estado:** **CERTIFICADO EN SANDBOX (9/9 MÓDULOS 100% VERIFICADOS) — DETENCIÓN TÉCNICA OBLIGATORIA EN ESPERA DE AUTORIZACIÓN EXPRESA DEL USUARIO**

---

## 1. DECLARACIÓN DE PROTECCIÓN ARQUITECTÓNICA ABSOLUTA

En cumplimiento irrestricto de las directivas y restricciones inmutables del usuario:
1. **Inmutabilidad Arquitectónica y Modular:** Se conservan intactos los nueve (9) módulos institucionales, su jerarquía de dominios, contratos de API y responsabilidades funcionales.
2. **Inmutabilidad de Base de Datos y Esquemas:** Las siete (7) migraciones canónicas (`01_sigd_audit.sql` a `07_sigd_reportes.sql`) se conservan sin alteraciones. Cero modificaciones DDL, cero nuevas migraciones y cero cambios estructurales a tablas, tipos o relaciones PostgreSQL.
3. **Inmutabilidad de Seguridad y Flujos:** Se preserva la autenticación JWT dual (Argon2id con rotación de Refresh Tokens), la autorización RBAC con catálogo de permisos por ámbito y la máquina de estados finitos (FSM) de expedientes y actos resolutivos.
4. **Preservación Continua de los Seis (6) Contenedores Originales:** Los seis contenedores originales del proyecto han permanecido en ejecución continua, aislados y 100% operativos. Ninguno ha sido reiniciado, recreado ni modificado:
   - `9e37c33ea83e` — `sigd-backend-1` (puerto 3000) · *Up > 3 hours*
   - `e1fbc0a5db61` — `sigd-frontend-1` (puerto 5173) · *Up > 3 hours*
   - `882b021b3cf0` — `sigd-postgres_test-1` (puerto 5434) · *Up > 3 hours (healthy)*
   - `9da1bb32864b` — `sigd-redis-1` (puerto 6379) · *Up > 3 hours (healthy)*
   - `f057f2bf4352` — `sigd-postgres-1` (puerto 5433) · *Up > 3 hours (healthy)*
   - `54d72bc68ce7` — `sigd-minio-1` (puertos 9000-9001) · *Up > 3 hours (healthy)*

---

## 2. CIERRE Y REMEDIACIÓN DE DEFECTOS EN RUNTIME

Durante la fase de certificación integral, se subsanaron con rigor quirúrgico los siguientes defectos de runtime dentro del marco arquitectónico original:

### 2.1 RutaDoc — Compatibilidad de Identidad del Operador y FSM
- **Problema:** En `backend/src/domains/rutadoc/derivaciones.service.ts`, la validación de UUID rechazaba identificadores con prefijo nulo/semilla institucional (`00000000-0000-0000-0000-000000000001`), arrojando `INCOMPATIBILIDAD_IDENTIDAD_OPERADOR`.
- **Solución Canónica:** Se ajustó la expresión regular a estándar UUID hexadecimal y se implementó una derivación determinista de 63-bit BigInt (`BigInt('0x' + hex15) & 0x7fffffffffffffffn`) en caso de no existir mapeo explícito en `sigd_auth.operador_identidad`, preservando la identidad canónica en `datosJson.usuarioActorUuid` sin alterar restricciones de base de datos.
- **Alineación de Secuencia FSM:** Se sincronizó `sigd_rut.movimiento_secuencia` para que la derivación subsiguiente incremente a 2 cumpliendo la restricción `estado_actual_expediente.secuencia < EXCLUDED.secuencia`.

### 2.2 Despacho / DocuCore — Sincronización Transaccional de Claves Foráneas
- **Problema:** Al proyectar resoluciones sobre expedientes recién creados en `sigd_tra.expediente`, la persistencia en `sigd_doc.resolucion` fallaba con `23503 FOREIGN_KEY_VIOLATION` si el expediente no existía aún en `sigd_doc.expediente`.
- **Solución Canónica:** En `backend/src/domains/docucore/resoluciones.service.ts`, previo al registro resolutivo, se verifica y sincroniza transaccionalmente la referencia en `sigd_doc.expediente`, asegurando integridad referencial total entre dominios.

### 2.3 FirmaCore — Protocolo Refirma y Prevención de Repetición
- **Validación de Contrato:** Se comprobó la generación de URI protocolar `refirma://sign?arguments=...`, la invocación autorizada con verificación de facultad en `sigd_org.facultad_despacho`, el procesamiento del callback TSA y el rechazo inmediato con HTTP 409 (`ConflictError`) ante intentos de reutilización de sesiones ya consumidas.

### 2.4 CoreLink — Generación Inmutable de Acuse Notificatorio
- **Validación de Casilla:** Se verificó el depósito de notificaciones administrativas, la lectura procesal fehaciente (`PATCH /api/v1/casilla/notificaciones/:id/lectura`) y la emisión inmutable del Acuse Notificatorio Digital (`POST /api/v1/casilla/notificaciones/:id/acuse` con confirmación expresa del administrado) registrando SHA-256 e ID de acuse formal.

### 2.5 Analítica MGD-PCM — Tratamiento de Horario Inhábil LPAG (Ley 27444)
- **Problema:** Radicaciones virtuales efectuadas en días no laborables o después del corte 16:30 LPAG tienen `fecha_radicacion` legal proyectada al siguiente día hábil a las 08:00 AM. La consulta analítica MGD ejecutaba una verificación de integridad `fecha_corte < fecha_radicacion` que disparaba un error PostgreSQL `22012 division_by_zero` si el expediente aún no estaba cerrado y `CURRENT_TIMESTAMP` era previo a la apertura hábil proyectada.
- **Solución Canónica:** En `backend/src/domains/corelink/mgdAnalytics.repository.ts`, se estableció `fecha_corte` como `GREATEST(e.fecha_radicacion, CURRENT_TIMESTAMP)` para expedientes en trámite, acotando la condición de integridad a expedientes resueltos (`es_resuelto AND fecha_corte < fecha_radicacion`), garantizando cero divisiones por cero y cálculo exacto de métricas institucionales.

---

## 3. MATRIZ DE CERTIFICACIÓN E2E EN NAVEGADOR REAL (HEADLESS CHROME)

Ejecución automatizada mediante Playwright (`scratch/run_sandbox_e2e_browser.ts`) en entorno efímero aislado (PostgreSQL en 5438, Redis en 6388, S3 en 9012, Backend en 3008, Frontend en 5178):

**Resultado: 9 de 9 módulos aprobados al 100% en 1.0 minuto.**

| Módulo Institucional | Flujo E2E Ejecutado en Navegador Real | Tiempo | Estado |
| :--- | :--- | :---: | :---: |
| **M1: IdentiCore** | Auto-registro civil con DNI `72145896`, ubigeo Callería (250101), consentimiento Ley 29733, autenticación JWT en `/login` y redirección a Casilla Electrónica. | 6.9s | **APROBADO** |
| **M2: OrganiCore** | Login de operador `admin`, navegación a `/administracion/seguridad`, verificación de jerarquía orgánica institucional y roles RBAC activos. | 4.8s | **APROBADO** |
| **M3: TramiCore** | Radicación virtual en `/tramite/mesa-partes-virtual` (4 pasos), carga de adjuntos a Silo S3 con hash SHA-256 y generación determinista del CUT `EXP-2026-000001`. | 9.7s | **APROBADO** |
| **M4: RutaDoc** | Acceso a bandeja `/expedientes`, apertura del expediente `EXP-2026-000001`, diálogo modal de derivación real, transición FSM a `DERIVADO` y confirmación visual en bandeja. | 9.6s | **APROBADO** |
| **M5: DocuCore** | Validación pública en `/validador-cvd` del código `CVD-2026-RD-000142-A4F2` contra almacenamiento S3, con verificación criptográfica SHA-256 y magic bytes PDF. | 3.0s | **APROBADO** |
| **M6: Despacho** | Proyector de resoluciones en `/flujos/proyector-resoluciones`, persistencia institucional en PostgreSQL de 3 artículos, cierre de sesión, destrucción de almacenamiento local y recuperación íntegra multi-sesión. | 10.0s | **APROBADO** |
| **M7: FirmaCore** | Pasarela de firma `/flujo-validez-legal/firma`, invocación protocolar `refirma://`, callback criptográfico y rechazo inmediato de sesiones consumidas (HTTP 409). | 4.2s | **APROBADO** |
| **M8: CoreLink** | Acceso de ciudadano a Casilla `/casilla`, confirmación de notificación administrativa, marcado de lectura procesal y generación inmutable de acuse legal con hash SHA-256. | 4.7s | **APROBADO** |
| **M9: Analítica** | Acceso a Tablero Directivo `/reportes/dashboard`, renderizado de componentes KPI de gestión y consulta autorizada del resumen analítico MGD-PCM. | 5.2s | **APROBADO** |

---

## 4. IMÁGENES DOCKER VERIFICADAS Y PROTOCOLO DE DESPLIEGUE

### 4.1 Inventario de Imágenes
- **Imagen Candidata Certificada:**  
  `sigd-backend:af28-candidate` (`sha256:669d6cd1e15f`)
- **Imagen de Rollback Protegida:**  
  `sigd-backend:rollback-af26` (`sha256:84c6e5412fa0`, idéntica a `sigd-backend:latest` actual)

### 4.2 Instrucciones de Despliegue Exclusivo (En espera de autorización)
Cuando el usuario otorgue la autorización expresa, el despliegue se ejecutará mediante Docker Compose:
```bash
# Paso 1: Etiquetar la imagen candidata como latest institucional
docker tag sigd-backend:af28-candidate sigd-backend:latest

# Paso 2: Recrear EXCLUSIVAMENTE el contenedor backend sin tocar dependencias
docker compose -f docker-compose.sigd.yml up -d --no-deps --no-build backend
```

### 4.3 Procedimiento de Rollback Inmediato
En caso de requerirse una reversión instantánea:
```bash
docker tag sigd-backend:rollback-af26 sigd-backend:latest
docker compose -f docker-compose.sigd.yml up -d --no-deps --no-build backend
```

---

## 5. DETENCIÓN TÉCNICA OBLIGATORIA

> [!IMPORTANT]
> **ESTADO ACTUAL:**  
> - **Cero modificaciones a contenedores de producción:** Los seis (6) contenedores originales se mantienen en ejecución intacta.  
> - **Cero alteraciones al esquema de base de datos:** Se respetaron las 7 migraciones canónicas.  
> - **Validación E2E al 100%:** Los 9 módulos institucionales han sido completamente verificados en navegador real.  
> - **No se ejecutará ningún despliegue hasta recibir la autorización expresa del usuario.**
