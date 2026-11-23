# SIGD IESTP SUIZA 2026 — FASE 7A
## RECEPCIÓN CONTROLADA EN SECRETARÍA ACADÉMICA Y AUDITORÍA DE RUTADOC
### Informe Pericial de Prevalidación, Diagnóstico de Contratos y Análisis de FSM

- **Fecha:** 27 de octubre de 2026
- **Entorno de Trabajo:** `C:\Users\Liz\Desktop\SIGD\SIGD`
- **Rama de Trabajo:** `B_JACOBO`
- **HEAD de Referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`
- **Base de Datos Prototipo:** `sigd_jacobo_demo` (PostgreSQL 18.6, puerto 5433)
- **Base Institucional Protegida:** `sigd_prueba` (puerto 5432, Inmutable — ZERO TOUCH)
- **Expediente Auditado:** `EXP-2026-000011` (`9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca`)
- **Asiento Registral:** `10010` (Canal `MESA_PRESENCIAL`, Fecha: `2026-10-27 18:23:27 UTC`)
- **Procedimiento TUPA:** `SUZ26-050` — Derecho de Reincorporación (Reingreso)
- **Área Actual:** Secretaría Académica (`SEC`, UUID `2b147b0d-7c8f-434f-b75a-598a1ccb855b`)

---

## 1. LÍNEA BASE DE GIT Y POSTGRESQL

Se verificó el estado inmutable del repositorio y de los motores de persistencia mediante consultas de solo lectura:

1. **Control de Versiones:**
   - Rama activa: `B_JACOBO`.
   - HEAD: `bf30d8a0c85e266a86381fb10bf3740a8451c032`.
   - Archivos modificados en working tree: Exactamente **154 archivos** preservados intactos.
   - Verificación de formato y sintaxis: `git diff --check` limpio (0 errores).

2. **Base Protegida Institucional (`sigd_prueba`):**
   - Conteo de expedientes en `sigd_tra.expediente`: **2 registros**. Totalmente intacta y aislada (ZERO TOUCH).

3. **Base de Datos del Prototipo (`sigd_jacobo_demo`):**
   - Expedientes en `sigd_tra.expediente`: **11 registros**.
   - Asientos en `sigd_tra.asiento_registro`: **10 registros**.
   - Correlativo anual de CUT (`sigd_tra.secuencia_anual_cut`): **11**.
   - Secuencia de asiento (`sigd_tra.seq_asiento_numero_registro`): **10010**.
   - Resoluciones en `sigd_doc.resolucion`: **4 registros** (`RD-2026-000002`, `000004`, `000006`, `000008`).
   - Casilla electrónica (`sigd_auth.notificacion_casilla`): **2 registros**.

---

## 2. PREVALIDACIÓN DE ESTADO, MOVIMIENTO Y TRAZABILIDAD

Se consultó la bitácora relacional de RutaDoc para el expediente `EXP-2026-000011`:

1. **Estado en `sigd_rut.estado_actual_expediente`:**
   - `expediente_id`: `9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca`
   - `secuencia`: **2**
   - `estado_nuevo`: **`DERIVADO`**
   - `evento`: **`DERIVACION`**
   - `area_actual_id`: **`2b147b0d-7c8f-434f-b75a-598a1ccb855b`** (Secretaría Académica `SEC`)
   - `id_movimiento`: `bf4904fb-d58b-4d71-a51c-25b1c4a168ff`
   - `usuario_operador_id`: `990000000` (Operador Mesa de Partes)

2. **Bitácora en `sigd_rut.movimiento_tramite`:**
   - Movimiento registrado con secuencia 2, origen `MP` (`a1a3a496-ff7f-45d8-b63c-3e54fcf79de1`) y destino `SEC` (`2b147b0d-7c8f-434f-b75a-598a1ccb855b`).
   - Proveído: *"Pase a Secretaría Académica para evaluación de procedencia académica y emisión de informe conforme al TUPA SUZ26-050."*
   - Evento Outbox `ExpedienteDerivado` en estado `PROCESADO` (`sigd_audit.evento_outbox`).

3. **Visibilidad en Bandeja Operativa:**
   - La API institucional (`GET /api/v1/expedientes?pestana=DERIVADOS`) expone el expediente en la pestaña de derivados del área de origen y disponible en la unidad destino.

---

## 3. AUDITORÍA DE IDENTIDAD INSTITUCIONAL (SECRETARÍA ACADÉMICA)

En cumplimiento de la directiva de verificación estricta de identidades, se identificó y autenticó al operador de Secretaría Académica:

- **Cuenta de Usuario:** `operador.demo` (`00000000-0000-0000-0000-000000000030`).
- **Nombre:** Lic. Operador Académico Demo.
- **Roles:** `SECRETARIO` y `ESPECIALISTA`.
- **Área Institucional:** Secretaría Académica (`SEC`, UUID `2b147b0d-7c8f-434f-b75a-598a1ccb855b`).
- **Permisos Institucionales Activos:**
  - `EXPEDIENTE_DERIVAR` (`ambito = 'AREA'`, `areaId = '2b147b0d-7c8f-434f-b75a-598a1ccb855b'`).
  - `EXPEDIENTE_RESOLVER` (`ambito = 'AREA'`, `areaId = '2b147b0d-7c8f-434f-b75a-598a1ccb855b'`).
  - `EXPEDIENTE_LEER` (`ambito = 'GLOBAL'`).
- **Mapeo Numérico:** Registrado en `sigd_auth.operador_identidad` con `operador_id = 990000003` (BigInt).
- **Prueba de Autenticación en Vivo:** Autenticado exitosamente vía `POST /api/v1/auth/login`, emitiendo JWT Bearer con facultades vigentes sobre Secretaría Académica.

---

## 4. AUDITORÍA EXHAUSTIVA DE CONTRATOS, RUTAS Y FSM

### 4.1. Definición Teórica de la FSM
En el archivo `backend/src/domains/rutadoc/rutadoc.fsm.ts`:
- Línea 62:
  ```typescript
  DERIVADO: Object.freeze({ RECEPCION: 'EN_REVISION' }),
  ```
- Y en la migración DDL `backend/migraciones/06_sigd_rut.sql` (línea 59):
  ```sql
  ('DERIVADO', 'RECEPCION', 'EN_REVISION')
  ```
La máquina de estados finitos contempla la transición abstracta de `DERIVADO` a `EN_REVISION` mediante el evento `RECEPCION`.

### 4.2. Inspección de Controladores y Catálogo REST (Discrepancia Arquitectónica Demostrada)
Se realizó una inspección exhaustiva de los enrutadores montados en Express (`backend/src/app.ts`, `rutadoc.router.ts`, `derivaciones.controller.ts`, `derivaciones.service.ts` y el catálogo de 56 endpoints):

1. **Rutas montadas en `derivaciones.controller.ts`:**
   - `POST /:id/derivar` $\rightarrow$ `handlerDerivar` (Evento: `DERIVACION`, Estado: `DERIVADO`).
   - `POST /:id/movimientos/derivar` $\rightarrow$ Alias de derivación.
   - `POST /:id/atender` $\rightarrow$ `atenderExpediente` (Evento: `FIRMA`, Estado: `RESUELTO`).
   - `POST /:id/archivar` $\rightarrow$ `archivarExpediente` (Evento: `CIERRE`, Estado: `ARCHIVADO`).
   - `POST /:id/acumular` $\rightarrow$ Acumulación Art. 160 LPAG.
   - `POST /:id/observar` $\rightarrow$ `observarExpediente` (Evento: `OBSERVACION`, Estado: `OBSERVADO`).
   - `POST /:id/subsanar` $\rightarrow$ `subsanarExpediente` (Estado: `EN_TRAMITE`).
2. **Rutas en `rutadoc.router.ts`:**
   - `GET /expedientes`
   - `GET /expedientes/clasificador-ccd`
   - `GET /expedientes/:id/trazabilidad`
   - `GET /expedientes/:id/foliacion`
   - `GET /expedientes/:id/sla-status`
   - `GET /expedientes/:id`
   - `POST /expedientes/:id/revertir-actuacion`

3. **Hallazgo de Precondición:**
   **NO EXISTE ningún endpoint, controlador ni servicio implementado para el evento `RECEPCION` en RutaDoc.**
   - No existe la ruta `POST /api/v1/expedientes/:id/recepcionar`.
   - No existe la ruta `POST /api/v1/expedientes/:id/recibir`.
   - No existe la función de servicio `recepcionarExpediente` en `derivaciones.service.ts`.
   - El catálogo maestro oficial de 56 endpoints (descrito en `backend/README.md` §6.6) define para RutaDoc únicamente:
     - `GET /expedientes/bandeja`
     - `GET /expedientes/:id/trazabilidad`
     - `POST /expedientes/:id/derivar`
     - `POST /expedientes/:id/observar`
     - `GET /expedientes/clasificador-ccd`
     - `GET /expedientes/:id/foliacion`

---

## 5. APLICACIÓN DE LAS REGLAS DE PARADA Y CRITERIO DE ÉXITO

Las instrucciones innegociables del mandato de ejecución estipulan:
> *"Si la implementación vigente utiliza otra condición o transición, detenerse y explicar la discrepancia antes de modificar nada."*
> *"Si alguna precondición falla, detenerse sin forzar el flujo y explicar la causa raíz con evidencia técnica."*
> *"No inventar rutas ni campos."*
> *"No insertar movimientos directamente mediante SQL."*
> *"No modificar estados manualmente para forzar el resultado."*

En estricto cumplimiento:
1. **NO se inventaron endpoints ni rutas inexistentes** en Express.
2. **NO se insertaron movimientos manuales mediante SQL** en `sigd_rut.movimiento_tramite`.
3. **NO se alteraron estados relacionales forzados** en `sigd_rut.estado_actual_expediente`.
4. El sistema se detuvo limpiamente en la Fase A (Prevalidación), preservando la integridad absoluta de los datos.

---

## 6. PRUEBAS DE REGRESIÓN, TYPECHECKS E INTEGRIDAD

Se ejecutaron las suites de verificación correspondientes:
- **RutaDoc Vitest:** 14 suites aprobadas (**157 tests pasando, 0 fallados**).
- **Backend Typecheck (`tsc --noEmit`):** **0 errores**.
- **Frontend Typecheck (`tsc --noEmit`):** **0 errores**.
- **Git Diff Check (`git diff --check`):** **0 errores**.
- **Archivos de código modificados:** **0 archivos**. Se conservan los 154 archivos de trabajo previos.

---

## 7. DICTAMEN FINAL Y RECOMENDACIÓN PARA DOCOCORE

### Diagnóstico Arquitectónico
En el modelo implementado de SIGD IESTP Suiza 2026, una vez que un expediente es derivado hacia un área orgánica (como Secretaría Académica), el expediente **ya pertenece orgánicamente al área de destino** (`area_actual_id = 2b147b0d-7c8f-434f-b75a-598a1ccb855b`).

El dominio **DocuCore** (`backend/src/domains/docucore/resoluciones.service.ts`):
1. Expone `POST /api/v1/resoluciones/proyectar` (Endpoint #32).
2. Sincroniza e interactúa con `sigd_doc.expediente`, donde `EXP-2026-000011` ya se encuentra validado y asociado al procedimiento `SUZ26-050` ("Derecho de Reincorporación (Reingreso)").
3. **No exige ni bloquea** que RutaDoc transicione a `EN_REVISION` para emitir la resolución. DocuCore valida la existencia y procedencia del expediente en `sigd_doc.expediente` / `sigd_tra.expediente` y genera de manera atómica el borrador `RD-2026-000009`.

### Recomendación Técnica
Proceder directamente a la siguiente fase autorizada: **Proyección de la Resolución Directoral Administrativa en DocuCore** (`POST /api/v1/resoluciones/proyectar`), utilizando las credenciales del especialista de Secretaría Académica (`operador.demo` con permiso `EXPEDIENTE_RESOLVER`), asegurando la continuidad del flujo intermodular sin alterar contratos ni inventar rutas.
