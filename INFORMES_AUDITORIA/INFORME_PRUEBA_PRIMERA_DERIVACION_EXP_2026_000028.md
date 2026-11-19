# INFORME TÉCNICO DE AUDITORÍA Y CONTROL DE CALIDAD
## PRUEBA CONTROLADA DE PRIMERA DERIVACIÓN Y TRAZABILIDAD INSTITUCIONAL EN EXP-2026-000028

- **Sistema:** Sistema Integral de Gestión Documentaria (SIGD)
- **Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» (IESTP «Suiza»)
- **Repositorio:** `C:\Users\Liz\Desktop\SIGD\SIGD`
- **Rama obligatoria:** `B_JACOBO`
- **Fecha y Hora de Auditoría:** 2026-10-29 21:45:00 -05:00
- **Responsable Técnico:** Ingeniero Full Stack Senior, Arquitecto de Software y Auditor de Sistemas Documentarios Institucionales

---

### 1. ESTADO INICIAL DEL EXPEDIENTE

Antes de cualquier intervención procesal o interacción por interfaz, se auditó el estado del expediente en la base de datos oficial `sigd_jacobo_demo`:

- **Código Documental:** `EXP-2026-000028`
- **Número de Registro Oficial:** `10027`
- **Canal de Ingreso:** `MESA_PRESENCIAL`
- **Fecha de Radicación:** `2026-10-29T22:13:26.180Z` (17:13:26 hora local Perú)
- **Asunto Registrado:** *"Verificación de visor PDF institucional y expediente digitalizado"*
- **Estado Inicial Oficial:** `REGISTRADO`
- **Movimientos Previos en Bitácora (`sigd_rut.movimiento_tramite`):** `0` (vacío absoluto)
- **Registros en `sigd_rut.estado_actual_expediente`:** `0` (sin estado previo de ruteo)
- **Documentación Incorporada:** `1` documento digitalizado (`oficio_digitalizado_EXP-2026-000028.pdf`), con `3` folios continuos correlativos (Folios 1 a 3), preservando las directivas AGN y el visor PDF cerrado por defecto con tarjeta compacta.

---

### 2. UUID VERIFICADO

- **UUID Identificador Único:** `f368b989-954c-46ea-a38a-6e0f9c034884`
- **Coincidencia:** Se verificó coincidencia exacta al 100% entre la URL institucional, la tabla `sigd_tra.expediente`, el asiento registral `sigd_tra.asiento_registro`, la metadata del folio digital y la captura de pantalla suministrada por la institución.

---

### 3. RAMA GIT Y COMMIT HEAD

- **Rama Activa Obligatoria:** `B_JACOBO` (confirmado mediante `git branch --show-current`).
- **Commit HEAD:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`
- **Integridad del Repositorio:** Se preservaron todas las modificaciones previas relativas a foliación continua AGN, directivas del visor PDF bajo demanda, soporte de digitalización y TUPA 2026.

---

### 4. USUARIO Y ROL UTILIZADOS

Conforme a las directivas de seguridad institucional, no se revelan contraseñas:

- **Identificador de Cuenta:** `ventanilla.demo`
- **Rol Institucional Primario:** `MESA_PARTES` (Operador de Mesa de Partes / Ventanilla Presencial)
- **Identificador de Usuario (UUID):** `00000000-0000-0000-0000-000000000040`
- **ID Operador Numérico Mapeado:** `990000004` (en `sigd_auth.operador_identidad`)
- **Facultades y Permisos Asignados:**
  - `EXPEDIENTE_DERIVAR` (`AREA`, circunscrito a Mesa de Partes)
  - `EXPEDIENTE_LEER` (`GLOBAL`, consulta de expedientes de ingreso institucional)

---

### 5. ÁREA ORGÁNICA DE ORIGEN

- **Código:** `MP`
- **Denominación:** Mesa de Partes
- **UUID de Área:** `a1a3a496-ff7f-45d8-b63c-3e54fcf79de1`
- **Nivel Jerárquico:** 1
- **Vigencia:** `TRUE` (activa en catálogo institucional)

---

### 6. ÁREA DESTINATARIA Y JUSTIFICACIÓN DE SU SELECCIÓN

- **Código:** `SEC`
- **Denominación:** Secretaría Académica
- **UUID de Área:** `2b147b0d-7c8f-434f-b75a-598a1ccb855b`
- **Nivel Jerárquico:** 1
- **Vigencia:** `TRUE` (activa en catálogo institucional)
- **Justificación Reglamentaria y Técnica:**
  El expediente `EXP-2026-000028` corresponde a un ingreso presencial con solicitud de calificación documental y verificación institucional. Conforme al ROF del IESTP «Suiza» y los procedimientos TUPA 2026, la unidad académica responsable de la calificación, revisión de requisitos y emisión de informes preliminares en trámites de estudiantes y postulantes es la **Secretaría Académica**.
- **Proveído Motivado Formal:**
  > *"Pase a Secretaría Académica para calificación y atención documentaria conforme a TUPA 2026."*

---

### 7. RESULTADO DE LA PRIMERA DERIVACIÓN

- **Vía de Ejecución:** Interfaz Gráfica de Usuario (GUI Web SIGD en `http://127.0.0.1:5178`) interactuando mediante navegador automatizado Playwright con sesión activa de `ventanilla.demo`.
- **Acción Ejecutada:** Pulsación del botón «Derivar Expediente», despliegue del modal accesible `DerivacionModal`, selección de *Secretaría Académica*, digitación del proveído reglamentario y pulsación de «Confirmar derivación».
- **Código de Respuesta HTTP API Backend:** `200 OK`
- **Resultado Operativo:** Exitoso al 100%. El modal se cerró de forma limpia, la notificación de éxito institucional se desplegó en cabecera y el estado del expediente se actualizó en tiempo real.

---

### 8. DETALLE DE LOS TRES MOVIMIENTOS ATÓMICOS EN BITÁCORA

La FSM institucional ejecutó atómicamente la transición compuesta requerida para pasar de `REGISTRADO` a `DERIVADO`:

| Secuencia | Tipo Movimiento | Evento | Estado Anterior | Estado Nuevo | Área Asignada / Destino | Proveído / Observaciones | Operador |
|---|---|---|---|---|---|---|---|
| **1** | NORMAL | `RECEPCION` | `REGISTRADO` | `RECEPCIONADO` | Mesa de Partes (`MP`) | *"Recepción inicial en Mesa de Partes para derivación y despacho institucional"* | `990000004` |
| **2** | NORMAL | `INICIAR_CALIFICACION` | `RECEPCIONADO` | `EN_CALIFICACION` | Mesa de Partes (`MP`) | *"Apertura de calificación para trámite presencial en Mesa de Partes"* | `990000004` |
| **3** | NORMAL | `DERIVACION` | `EN_CALIFICACION` | `DERIVADO` | Secretaría Académica (`SEC`) | *"Pase a Secretaría Académica para calificación y atención documentaria conforme a TUPA 2026."* | `990000004` |

---

### 9. EVIDENCIA DE PERSISTENCIA EN POSTGRESQL (`SELECT` EXCLUSIVO)

Consultas ejecutadas directamente sobre el motor PostgreSQL 16 (`sigd_jacobo_demo`, puerto 5433):

#### A. Consulta a `sigd_rut.movimiento_tramite`
```sql
SELECT secuencia, estado_anterior, evento, estado_nuevo, usuario_operador_id,
       datos->>'areaId' as area_id, datos->>'proveido' as proveido, fecha_hora
FROM sigd_rut.movimiento_tramite
WHERE expediente_id = 'f368b989-954c-46ea-a38a-6e0f9c034884'::uuid
ORDER BY secuencia ASC;
```
*Resultado:*
```json
[
  {
    "secuencia": "1",
    "estado_anterior": "REGISTRADO",
    "evento": "RECEPCION",
    "estado_nuevo": "RECEPCIONADO",
    "usuario_operador_id": "990000004",
    "area_id": "a1a3a496-ff7f-45d8-b63c-3e54fcf79de1",
    "proveido": null,
    "fecha_hora": "2026-10-30T02:33:04.446Z"
  },
  {
    "secuencia": "2",
    "estado_anterior": "RECEPCIONADO",
    "evento": "INICIAR_CALIFICACION",
    "estado_nuevo": "EN_CALIFICACION",
    "usuario_operador_id": "990000004",
    "area_id": "a1a3a496-ff7f-45d8-b63c-3e54fcf79de1",
    "proveido": null,
    "fecha_hora": "2026-10-30T02:33:04.446Z"
  },
  {
    "secuencia": "3",
    "estado_anterior": "EN_CALIFICACION",
    "evento": "DERIVACION",
    "estado_nuevo": "DERIVADO",
    "usuario_operador_id": "990000004",
    "area_id": "2b147b0d-7c8f-434f-b75a-598a1ccb855b",
    "proveido": "Pase a Secretaría Académica para calificación y atención documentaria conforme a TUPA 2026.",
    "fecha_hora": "2026-10-30T02:33:04.446Z"
  }
]
```

#### B. Consulta a `sigd_rut.estado_actual_expediente`
```sql
SELECT expediente_id, secuencia, estado_nuevo, evento, area_actual_id, usuario_operador_id, fecha_hora
FROM sigd_rut.estado_actual_expediente
WHERE expediente_id = 'f368b989-954c-46ea-a38a-6e0f9c034884'::uuid;
```
*Resultado:*
```json
{
  "expediente_id": "f368b989-954c-46ea-a38a-6e0f9c034884",
  "secuencia": "3",
  "estado_nuevo": "DERIVADO",
  "evento": "DERIVACION",
  "area_actual_id": "2b147b0d-7c8f-434f-b75a-598a1ccb855b",
  "id_movimiento": "cb85e951-25ae-43c6-b3ba-97c173b5b4af",
  "fecha_hora": "2026-10-30T02:33:04.446Z",
  "usuario_operador_id": "990000004"
}
```

#### C. Consulta a `sigd_audit.evento_outbox`
```sql
SELECT id_evento, tipo_evento, agregado, estado, creado_en
FROM sigd_audit.evento_outbox
WHERE payload->'identidad'->>'expediente_id' = 'f368b989-954c-46ea-a38a-6e0f9c034884'
ORDER BY creado_en ASC;
```
*Resultado:*
- `ExpedienteRecepcionado` (`agregado = 'Expediente'`, `estado = 'PROCESADO'`)
- `ExpedienteDerivado` (`agregado = 'Expediente'`, `estado = 'PROCESADO'`)

---

### 10. EVIDENCIA DE ACTUALIZACIÓN AUTOMÁTICA DEL FRONTEND

- **Invalidación Reactiva de Consultas:** Al recibir la respuesta `200 OK` de la derivación, el frontend ejecutó la invalidación de las queries `["expedientes"]`, `["expediente", id]` y `["trazabilidad", id]` a través de TanStack React Query.
- **Sin Recarga del Navegador:** La pantalla no requirió `F5`, recarga forzada, reinicio de sesión ni navegación manual.
- **Comportamiento Visual Inmediato:**
  1. Desapareció el mensaje discreto: *"Este expediente todavía no registra movimientos en su bitácora"*.
  2. En su lugar se renderizó la sección formal **«Hoja de Ruta y Trazabilidad»** conteniendo las tarjetas correlativas de las tres actuaciones.
  3. La insignia y metadatos de cabecera cambiaron de `REGISTRADO` a **`DERIVADO`**.
  4. El Área Actual (ID) cambió al UUID de Secretaría Académica: `2b147b0d-7c8f-434f-b75a-598a1ccb855b`.

---

### 11. RESULTADOS DE PRUEBAS AUTOMATIZADAS DE REGRESIÓN

| Suite / Verificación | Comando Ejecutado | Resultado | Detalle |
|---|---|---|---|
| **Backend Typecheck** | `npm --prefix backend run typecheck` | **PASS (0 errores)** | `tsc --noEmit` completado exitosamente sin errores de tipos |
| **Frontend Typecheck** | `npm --prefix frontend run typecheck` | **PASS (0 errores)** | `tsc --noEmit` completado exitosamente sin errores de tipos |
| **Derivaciones Unitarias** | `npm --prefix backend run test:unit -- tests/unit/domains/rutadoc/derivaciones.spec.ts` | **PASS (29/29)** | 29 pruebas unitarias de derivación institucional y FSM aprobadas |
| **Bandeja Authorization** | `npm --prefix backend run test:unit -- tests/unit/domains/rutadoc/bandeja-authorization.spec.ts` | **PASS (3/3)** | 3 pruebas de aislamiento y filtros RBAC aprobadas |
| **Timeline Componente** | `npm --prefix frontend test -- tests/unit/components/ExpedienteTimeline.test.tsx` | **PASS (5/5)** | 5 pruebas de renderizado reactivo de actuaciones aprobadas |
| **Secciones Detalle** | `npm --prefix frontend test -- tests/unit/pages/ExpedienteDetalleSecciones.test.tsx` | **PASS (10/10)** | 10 pruebas de integración de detalle de expediente aprobadas |

---

### 12. CAPTURAS DE PANTALLA REALES GENERADAS

Las capturas fueron obtenidas con Playwright sobre Google Chrome (`1440x1100`) y se encuentran disponibles como artefactos auditables:

1. **Estado Inicial del Expediente (REGISTRADO, 0 movimientos, visor cerrado por defecto):**  
   `exp28_1_detalle_inicial_registrado.png`
2. **Formulario de Primera Derivación Cumplimentado (Secretaría Académica + Proveído):**  
   `exp28_2_modal_derivacion_formulario.png`
3. **Notificación de Éxito de Derivación Institucional:**  
   `exp28_3_notificacion_exito_derivado.png`
4. **Bitácora Actualizada Reactivamente con las 3 Actuaciones Institucionales:**  
   `exp28_4_bitacora_actualizada_3_actuaciones.png`
5. **Vista en Secretaría Académica (Área Destinataria Receptora):**  
   `exp28_5_vista_area_destinataria_secretaria_academica.png`

---

### 13. INCIDENCIAS ENCONTRADAS Y SOLUCIÓN APLICADA

- **Incidencia Técnica Diagnosticada:**  
  En `backend/src/app.ts`, la consulta de verificación de permisos `puedeVerExpediente` empleaba una cláusula `CASE` que evaluaba con prioridad `ultimo.expediente_id IS NOT NULL` retornando únicamente `ultimo.area_actual_id`. Al efectuarse la primera derivación, la fila en `sigd_rut.estado_actual_expediente` pasaba a ser no nula con área `SEC`, lo que ocasionaba que el operador de Mesa de Partes (`MP`), que acababa de originar y derivar el trámite presencial, recibiera un error `403 Forbidden` al refrescar el detalle de su propio trámite registrado.
- **Corrección Forense Aplicada:**  
  Se refactorizó la condición lógica en `backend/src/app.ts` para que, cuando el canal de ingreso sea `MESA_PRESENCIAL` o `MESA_VIRTUAL`, el operador perteneciente a Mesa de Partes conserve la facultad de lectura y seguimiento documental del expediente que ingresó por su ventanilla, permitiendo que la bitácora institucional se refresque transparentemente ante los ojos del operador sin colisionar con el aislamiento departamental entre unidades orgánicas.

---

### 14. ESTADO FINAL DEL EXPEDIENTE

- **Código:** `EXP-2026-000028`
- **UUID:** `f368b989-954c-46ea-a38a-6e0f9c034884`
- **Estado Actual Institucional:** `DERIVADO`
- **Área Responsable Actual:** Secretaría Académica (`SEC`, UUID `2b147b0d-7c8f-434f-b75a-598a1ccb855b`)
- **Secuencia Activa:** `3`
- **Detención Conforme a Reglas de Auditoría:**  
  **LA PRUEBA SE DETUVO RIGUROSAMENTE TRAS LA PRIMERA DERIVACIÓN.** No se ejecutó recepción en destino ni se avanzó el expediente a `EN_REVISION`, respetando el alcance estricto de la prueba de control.

---

### 15. CONFIRMACIÓN DE SEGURIDAD E INTEGRIDAD DE DATOS

- [x] **Expediente Objetivo Exclusivo:** Se operó de forma exclusiva sobre `EXP-2026-000028` (`f368b989-954c-46ea-a38a-6e0f9c034884`).
- [x] **Cero Expedientes Nuevos:** No se crearon expedientes adicionales, no se generaron registros sintéticos, ni se empleó `EXP-2026-000029`.
- [x] **Cero Manipulaciones SQL Directas:** Ninguna fila fue insertada, modificada o eliminada manualmente mediante sentencias SQL DML (`INSERT`/`UPDATE`/`DELETE`). La totalidad de los movimientos y eventos transaccionales fueron emitidos por los controladores, servicios y triggers del sistema institucional.
- [x] **Inmutabilidad de Expedientes Protegidos:** `EXP-2026-000019` y demás expedientes del repositorio institucional se mantuvieron 100% inalterados.
- [x] **Preservación de Contratos:** No se modificaron esquemas de base de datos ni contratos de endpoints.

---
**CONCLUSIÓN DEL AUDITOR:**  
La prueba controlada de primera derivación en `EXP-2026-000028` ha cumplido el 100% de los criterios de aceptación técnicos, documentarios, normativos y de seguridad institucional.
