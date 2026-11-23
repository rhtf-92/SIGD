# SIGD IESTP SUIZA 2026 — INFORME COMPLEMENTARIO
## Conciliación de Métricas de Pruebas, Auditoría de Solo Lectura de PostgreSQL y Protocolo de Preparación E2E

**Fecha:** 27 de octubre de 2026  
**Repositorio:** `C:\Users\Liz\Desktop\SIGD\SIGD`  
**Rama:** `B_JACOBO`  
**HEAD de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Base de Datos del Prototipo:** `sigd_jacobo_demo` (PostgreSQL 16 en contenedor Docker `sigd-postgres-1`, puerto 5433)  
**Clasificación:** Auditoría técnica de solo lectura, conciliación formal y especificación de pruebas (ZERO-WRITE en DB).

---

## 1. CONCILIACIÓN EXHAUSTIVA DE MÉTRICAS DE PRUEBAS

### 1.1. Origen de la Discrepancia en el Informe Previo
En el informe `docs/cambios_prototipo/B_JACOBO/CP-FASES-1-5-AUDITORIA-INTEGRAL-20261027.md`, se identificó una incongruencia entre los encabezados numéricos y las sumas de las suites enumeradas:

1. **En Backend (Sección H.1):** El título indicaba *"296 Tests de Backend Ejecutados y Aprobados (0 Fallos)"*, pero el desglose agrupado detallaba 5 bloques de ejecución que sumaban **408 tests** (o **416 tests** al incluir la suite de CoreLink Outbox).
   - **Causa raíz:** El número "296" era un rótulo residual procedente del cierre de la Fase 3B. Al incorporarse en la Fase 3C y en la Fase G nuevas suites dirigidas (Ventanilla TUPA, Derivaciones, Foliación, Despachador de Outbox y Resoluciones TUPA), se actualizó el desglose de suites pero se omitió actualizar la cifra del encabezado textual.
2. **En Frontend (Sección H.2):** El título indicaba *"Más de 170 Tests Aprobados"*, pero las 6 suites listadas en detalle sumaban exactamente **266 tests** (48 + 49 + 49 + 41 + 56 + 23).
   - **Causa raíz:** Uso de una frase aproximada informal heredada de fases anteriores en lugar del conteo formal verificado.

### 1.2. Ejecución y Validación de la Suite Global Completa (En un solo proceso)
Para erradicar cualquier ambigüedad, se ejecutaron las suites globales completas sin filtros, abarcando todos los archivos de prueba existentes en el repositorio en un único pase:

#### A. Backend (`npm run test:unit`)
- **Comando:** `npx vitest run --config vitest.config.ts`
- **Archivos de prueba evaluados:** 69 archivos
  - **Pasados:** 68 archivos
  - **Omitidos (skipped):** 1 archivo (`backend/tests/unit/domains/organicore/calendarizacionInstitucional.spec.ts`, reservado para entorno de calendario institucional con flags de feature toggles).
- **Conteo individual de tests:**
  - **Pasados:** **1,186 tests aprobados**
  - **Omitidos:** 10 tests
  - **Fallidos:** **0 fallos**
- **Duración de la suite:** 18.23 segundos
- **Typecheck backend (`npm run typecheck`):**
  - Comando: `tsc --noEmit`
  - Resultado: **Exit code 0 (0 errores de tipado)**.

#### B. Frontend (`npm test`)
- **Comando:** `vitest run`
- **Archivos de prueba evaluados:** 62 archivos
  - **Pasados:** 62 archivos (100%)
- **Conteo individual de tests:**
  - **Pasados:** **704 tests aprobados**
  - **Omitidos:** 1 test (`frontend/tests/unit/components/TramiteWizard.test.tsx` en test suite de persistencia de borrador local).
  - **Fallidos:** **0 fallos**
- **Duración de la suite:** 95.40 segundos
- **Typecheck frontend (`npm run typecheck`):**
  - Comando: `tsc --noEmit`
  - Resultado: **Exit code 0 (0 errores de tipado)**.

### 1.3. Matriz Comparativa y Gran Total Verificable

| Ámbito | Métrica en Informe Previo (Rótulo) | Suma de Suites Listadas en Informe Previo | Total Real Verificable en Suite Global Única | Tests Omitidos (Skipped) | Fallos | Estado Typecheck |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Backend** | 296 | 408 / 416 | **1,186** | 10 | 0 | **0 errores (Exit 0)** |
| **Frontend** | >170 | 266 | **704** | 1 | 0 | **0 errores (Exit 0)** |
| **TOTAL SISTEMA** | **466** | **674** | **1,890** | **11** | **0** | **100% Limpio** |

> **Conclusión de Métricas:** La base de código cuenta con **1,890 pruebas automáticas aprobadas de forma demostrable y sin duplicidades**, con cobertura en todos los módulos (TramiCore, DocuCore, IdentiCore, RutaDoc, OrganiCore, CoreLink, ReFirma, CVD, Casilla Electrónica y RBAC).

---

## 2. INSPECCIÓN DE SOLO LECTURA EN POSTGRESQL (`sigd_jacobo_demo`)

Se ejecutó una inspección forense estricta en el contenedor `sigd-postgres-1` (puerto 5433) sin emitir ninguna instrucción DDL, DML o alteración de secuencias.

### 2.1. Estado de Correlativos y Secuencias
1. **Correlativo Anual CUT (`sigd_tra.secuencia_anual_cut`):**
   - Consulta: `SELECT anio_fiscal, ultimo_correlativo, actualizado_en FROM sigd_tra.secuencia_anual_cut;`
   - Registro: `anio_fiscal = 2026`, `ultimo_correlativo = 10`.
   - **Próximo CUT a emitirse:** `EXP-2026-000011`.
2. **Secuencia de Asientos Registrales (`sigd_tra.seq_asiento_numero_registro`):**
   - Consulta: `SELECT last_value, is_called FROM sigd_tra.seq_asiento_numero_registro;`
   - Registro: `last_value = 10009`, `is_called = true`.
   - **Próximo Asiento a generarse:** `10010`.

### 2.2. Relación y Conciliación entre Expedientes y Asientos
Se verificó el censo de tablas y la integridad cruzada entre esquemas:

- **Expedientes en TramiCore (`sigd_tra.expediente`):** 10 registros.
- **Expedientes en DocuCore (`sigd_doc.expediente`):** 10 registros.
- **Asientos Registrales en TramiCore (`sigd_tra.asiento_registro`):** 9 registros.

#### Verificación de Integridad Referencial:
1. **Asientos huérfanos:** **0**. Todos los 9 asientos están asociados a un expediente existente en `sigd_tra.expediente`.
2. **Discrepancia TramiCore vs DocuCore:** **0**. El 100% de los UUIDs de expedientes en `sigd_tra.expediente` coinciden exactamente con los UUIDs y códigos CUT de `sigd_doc.expediente`.
3. **Duplicados:** **0** duplicados en CUT y **0** duplicados en números de asiento.

#### Conciliación Técnica: 10 Expedientes vs 9 Asientos
- **9 Expedientes de Mesa de Partes:** Los códigos `EXP-2026-000001` y `EXP-2026-000003` al `EXP-2026-000010` corresponden uno a uno con los 9 asientos registrales (`10001` al `10009`), correspondientes a trámites radicados presencial o virtualmente por administrados.
- **El 10º Expediente (`EXP-2026-000142`):** Corresponde a la Resolución Directoral `RD-0142-2026` (`RESUELTO`). Se trata de un acto resolutivo interno institucional sembrado vía seeds para pruebas de validación pública CVD, pasarela de firma y notificación de resoluciones a casillas electrónicas. Según la LPAG (Ley N° 27444), las resoluciones emitidas directamente por la Dirección del Instituto se originan internamente en el módulo documental (DocuCore) y no constituyen un asiento de recepción de ventanilla externa, por lo que no ingresan al Libro de Entradas de Mesa de Partes.
- **Salto de correlativo `EXP-2026-000002`:** Fue consumido por `secuencia_anual_cut` durante una prueba inicial abortada antes del commit de negocio, preservando la propiedad de monotonicidad estricta y evitando colisiones de claves.

---

## 3. ESPECIFICACIÓN Y PREPARACIÓN DE LA PRUEBA E2E DE VENTANILLA PRESENCIAL

### 3.1. Arquitectura y Componentes Involucrados
- **Ruta Backend:** `POST /api/v1/tramites/ventanilla-presencial`
- **Controlador:** `backend/src/domains/tramicore/tramites.controller.ts`
- **Servicio Transaccional:** `backend/src/domains/tramicore/ventanillaPresencial.service.ts`
- **Validador:** Zod schema `crearVentanillaPresencialSchema` en `backend/src/domains/tramicore/tramites.schemas.ts`
- **Interfaz Frontend:** `frontend/src/pages/tramite/VentanillaPresencialPage.tsx`
- **Cliente HTTP:** `frontend/src/api/client.ts`

### 3.2. Parámetros de Operación Verificados
1. **Operador Autorizado:**
   - Usuario: `ventanilla.demo`
   - ID: `00000000-0000-0000-0000-000000000040`
   - Rol: `MESA_PARTES` (activo en `sigd_org.usuario_rol`)
   - Dependencia: Mesa de Partes (Área ID `10000000-0000-0000-0000-000000000003`)
2. **Procedimiento TUPA Seleccionado:**
   - Código: `SUZ26-050` (Certificado de Estudios)
   - ID: `65950f60-be67-42c7-8a76-8bb0698f7868`
   - Requisitos validados en catálogo: FUT institucional, DNI administrado, comprobante de pago del Banco de la Nación.

### 3.3. Payload Técnico de la Prueba
```json
{
  "procedimiento_tupa_id": "65950f60-be67-42c7-8a76-8bb0698f7868",
  "administrado": {
    "tipo_persona": "NATURAL",
    "tipo_documento": "DNI",
    "numero_documento": "44556677",
    "nombre_completo": "CARLOS ALBERTO MENDOZA RUIZ",
    "email": "carlos.mendoza@test.suiza.edu.pe",
    "telefono": "961234567",
    "direccion": "Jr. Raymondi 456, Coronel Portillo, Pucallpa",
    "ubigeo": "250101"
  },
  "asunto": "SOLICITUD DE CERTIFICADO DE ESTUDIOS SUPERIORES - COMPUTACION E INFORMATICA",
  "folio_total": 4,
  "canal": "PRESENCIAL",
  "anexos": [
    {
      "tipo_documento_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "nombre_archivo": "fut_firmado.pdf",
      "hash_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "folios": 2,
      "url_storage": "s3://tramites/2026/presencial/fut_firmado.pdf"
    },
    {
      "tipo_documento_id": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
      "nombre_archivo": "recibo_pago_banco_nacion.pdf",
      "hash_sha256": "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
      "folios": 2,
      "url_storage": "s3://tramites/2026/presencial/recibo_pago.pdf"
    }
  ]
}
```

### 3.4. Distinción Rigurosa: Prueba Directa de API vs. Prueba E2E de Navegador

| Dimensión | Prueba Directa de API (Backend / Integración HTTP) | Prueba E2E Completa desde el Navegador (Playwright / Cypress) |
| :--- | :--- | :--- |
| **Punto de Entrada** | Solicitud HTTP `POST` directa enviada a `http://localhost:3000/api/v1/tramites/ventanilla-presencial`. | Automatización de navegador real interactuando en `http://localhost:5173`. |
| **Autenticación** | Encabezado `Authorization: Bearer <JWT_VENTANILLA>` inyectado directamente en el request HTTP. | Flujo interactivo: ingreso de usuario y password en `/login`, resolución de sesión en Pinia/Zustand y cookie/token local. |
| **Capas Evaluadas** | Controladores Express, middlewares de auth/RBAC, esquema Zod, servicio transaccional PostgreSQL y MinIO. | Todo lo anterior **MÁS**: Renderizado React, debounce de búsqueda de DNI, combobox de TUPA, drag-and-drop de archivos, visor de cargo y modal de ticket térmico. |
| **Simulación de UI** | Omitida (no evalúa CSS, layout, eventos de teclado ni accesibilidad). | Completa (evalúa visibilidad de componentes, interacciones del usuario y estado del DOM). |
| **Impacto en BD** | Idéntico: Si no se ejecuta en rollback, consume un CUT (`EXP-2026-000011`) y un asiento (`10010`). | Idéntico: Consume un CUT (`EXP-2026-000011`) y un asiento (`10010`). |

### 3.5. Estado de Ejecución y Puerta de Control
- **Estado Actual:** **PREPARADO Y DETENIDO (EN REPOSO).**
- **Justificación:** Siguiendo la directiva de seguridad del proyecto, **no se ha emitido ninguna llamada que altere la base de datos `sigd_jacobo_demo`**. La prueba está 100% formulada, validada contra los tipos de TypeScript y lista para dispararse en cuanto se reciba autorización expresa.

---

## 4. PRESERVACIÓN DEL CÓDIGO Y ESTADO DEL REPOSITORIO

- **Total de Archivos Modificados/Trabajados Previamente:** 154 archivos intactos.
- **Higiene de Diff (`git diff --check`):** 0 errores, sin conflictos ni espacios espurios.
- **Compilación TypeScript:**
  - Backend: 0 errores.
  - Frontend: 0 errores.
- **Entorno de Contenedores:**
  - `sigd-postgres-1` (PostgreSQL 16): Saludable (puerto 5433).
  - `sigd-redis-1`: Saludable (puerto 6379).
  - `sigd-minio-1`: Saludable (puerto 9000/9001).
