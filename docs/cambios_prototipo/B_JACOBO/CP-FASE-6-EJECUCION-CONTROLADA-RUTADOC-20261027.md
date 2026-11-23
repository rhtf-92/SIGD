# SIGD IESTP SUIZA 2026 — EJECUCIÓN CONTROLADA DE RUTADOC
## Derivación Persistente del Expediente EXP-2026-000011 a Secretaría Académica

- **Fecha y Hora de Ejecución:** 27 de octubre de 2026, 14:00:00 (UTC-5) / 18:59:52 UTC
- **Entorno de Trabajo:** `C:\Users\Liz\Desktop\SIGD\SIGD`
- **Rama de Trabajo:** `B_JACOBO`
- **HEAD de Referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`
- **Base de Datos Prototipo:** `sigd_jacobo_demo` (PostgreSQL 18.6, puerto 5433)
- **Base Protegida Institucional:** `sigd_prueba` (puerto 5432, Inmutable — ZERO TOUCH)
- **Expediente Derivado:** `EXP-2026-000011` (`9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca`)
- **Asiento Registral:** `10010` (Canal `MESA_PRESENCIAL`, Fecha: `2026-10-27 18:23:27 UTC`)
- **Procedimiento TUPA:** `SUZ26-050` — Derecho de Reincorporación (Reingreso)

---

## 1. LÍNEA BASE PREVIA VERIFICADA

Antes de la ejecución de la derivación autorizada, se realizaron consultas estrictamente de solo lectura en `sigd_jacobo_demo` y `sigd_prueba`:

1. **Expediente `EXP-2026-000011` en `sigd_tra.expediente`:**
   - `expediente_id`: `9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca`
   - `codigo_expediente`: `EXP-2026-000011`
   - `estado`: `RECEPCIONADO`
   - `solicitante_id`: `4f607328-f737-4a4e-a91b-e71c73677acb`
2. **Estado en `sigd_rut.estado_actual_expediente`:**
   - `secuencia`: 1
   - `estado_nuevo`: `EN_CALIFICACION`
   - `evento`: `INICIAR_CALIFICACION`
   - `area_actual_id`: `a1a3a496-ff7f-45d8-b63c-3e54fcf79de1` (Mesa de Partes `MP`)
3. **Mapeo de Operadores en `sigd_auth.operador_identidad`:**
   - `00000000-0000-0000-0000-000000000001` (`admin`) $\rightarrow$ `990000000` (BigInt)
   - Roles: `ADMINISTRADOR` y `DIRECTOR` con asignación expresa a `MP` (`a1a3a496-ff7f-45d8-b63c-3e54fcf79de1`).
   - Permiso institucional vigente: `EXPEDIENTE_DERIVAR` (`ambito = 'AREA'`).
4. **Ausencia de derivaciones previas:**
   - `sigd_rut.movimiento_tramite` contenía exactamente 0 registros para `EXP-2026-000011`.
5. **Aislamiento institucional:**
   - `sigd_prueba`: 2 expedientes inmutables.
   - `sigd_jacobo_demo`: 11 expedientes, 10 asientos, secuencia de CUT en 11, secuencia de asientos en 10010.

---

## 2. EJECUCIÓN AUTORIZADA: ENDPOINT Y PAYLOAD

La derivación se ejecutó vía HTTP real contra el backend en ejecución (`http://127.0.0.1:3008`) a través de una identidad auténtica con el rol y permiso requeridos, sin eludir RBAC ni alterar estados manualmente mediante SQL.

- **Método y URL:** `POST http://127.0.0.1:3008/api/v1/expedientes/9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca/derivar`
- **Encabezados HTTP:**
  ```http
  Authorization: Bearer <JWT_EMITIDO_AUTH_LOGIN_ADMIN>
  Content-Type: application/json; charset=utf-8
  x-correlation-id: dac0e831-2b10-4ecd-a9f2-6efb54d26610
  ```
- **Payload Enviado:**
  ```json
  {
    "destinos": [
      {
        "area_destino_id": "2b147b0d-7c8f-434f-b75a-598a1ccb855b",
        "es_copia": false
      }
    ],
    "proveido": "Pase a Secretaría Académica para evaluación de procedencia académica y emisión de informe conforme al TUPA SUZ26-050."
  }
  ```

---

## 3. RESPUESTA DEL BACKEND (EVIDENCIA VERIFICABLE)

El servicio procesó y confirmó atómicamente la transacción con código **HTTP 200 OK**:

```json
{
  "ok": true,
  "mensaje": "Derivación procesada y registrada exitosamente.",
  "expediente_id": "9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca",
  "derivacionId": "9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca",
  "nuevoEstado": "DERIVADO"
}
```

---

## 4. ESTADO ANTERIOR Y POSTERIOR COMPROBADO

| Componente / Atributo | Estado Anterior | Estado Posterior | Verificación |
| :--- | :---: | :---: | :---: |
| **`sigd_rut.estado_actual_expediente.estado_nuevo`** | `EN_CALIFICACION` | **`DERIVADO`** | Conforme a FSM institucional |
| **`sigd_rut.estado_actual_expediente.evento`** | `INICIAR_CALIFICACION` | **`DERIVACION`** | Conforme a trigger institucional |
| **`sigd_rut.estado_actual_expediente.secuencia`** | `1` | **`2`** | Asignación secuencial atómica |
| **`sigd_rut.estado_actual_expediente.area_actual_id`** | `a1a3a496-ff7f-45d8-b63c-3e54fcf79de1` (MP) | **`2b147b0d-7c8f-434f-b75a-598a1ccb855b`** (SEC) | Actualizado vía `datos->>'areaId'` |
| **`sigd_rut.estado_actual_expediente.usuario_operador_id`** | `1` | **`990000000`** | Mapeado desde `admin` UUID |
| **Pestaña Operativa en RutaDoc (`/api/v1/expedientes`)** | `PENDIENTES` | **`DERIVADOS`** | Confirmado vía API HTTP |
| **`sigd_tra.expediente.codigo_expediente`** | `EXP-2026-000011` | `EXP-2026-000011` | Inalterado |
| **`sigd_doc.expediente.codigo_expediente`** | `EXP-2026-000011` | `EXP-2026-000011` | Inalterado |
| **`sigd_tra.asiento_registro.numero_registro`** | `10010` | `10010` | Inalterado |

---

## 5. TRAZABILIDAD Y MOVIMIENTO REGISTRADO

### 5.1. Registro en `sigd_rut.movimiento_tramite`
- **`id_movimiento`:** `bf4904fb-d58b-4d71-a51c-25b1c4a168ff`
- **`secuencia`:** 2
- **`estado_anterior`:** `EN_CALIFICACION`
- **`evento`:** `DERIVACION`
- **`estado_nuevo`:** `DERIVADO`
- **`usuario_operador_id`:** `990000000`
- **`fecha_hora`:** `2026-10-27 18:59:52.018 UTC`
- **`datos` (JSONB):**
  ```json
  {
    "areaId": "2b147b0d-7c8f-434f-b75a-598a1ccb855b",
    "motivo": "Pase a Secretaría Académica para evaluación de procedencia académica y emisión de informe conforme al TUPA SUZ26-050.",
    "esCopia": false,
    "proveido": "Pase a Secretaría Académica para evaluación de procedencia académica y emisión de informe conforme al TUPA SUZ26-050.",
    "areaOrigenId": "a1a3a496-ff7f-45d8-b63c-3e54fcf79de1",
    "areaDestinoId": "2b147b0d-7c8f-434f-b75a-598a1ccb855b",
    "usuarioActorUuid": "00000000-0000-0000-0000-000000000001",
    "usuarioAsignadoId": null
  }
  ```

### 5.2. Evento Outbox en `sigd_audit.evento_outbox`
- **`id_evento`:** `21b7a921-6100-41f9-ace5-6e32c0d5e8d2`
- **`tipo_evento`:** `ExpedienteDerivado`
- **`agregado`:** `Expediente`
- **`correlation_id`:** `dac0e831-2b10-4ecd-a9f2-6efb54d26610`
- **`estado`:** `PROCESADO`
- **`creado_en`:** `2026-10-27 18:59:52.017964 UTC`

### 5.3. Trazabilidad Pública (`GET /api/v1/expedientes/:id/trazabilidad`)
La API HTTP institucional expone la actuación formal:
```json
{
  "expedienteId": "9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca",
  "actuaciones": [
    {
      "movimientoId": "bf4904fb-d58b-4d71-a51c-25b1c4a168ff",
      "secuencia": "2",
      "fechaHora": "2026-10-27T18:59:52.018Z",
      "estadoAnterior": "EN_CALIFICACION",
      "evento": "DERIVACION",
      "estadoNuevo": "DERIVADO",
      "usuarioOperadorId": "990000000",
      "areaDestinoId": "2b147b0d-7c8f-434f-b75a-598a1ccb855b",
      "proveido": "Pase a Secretaría Académica para evaluación de procedencia académica y emisión de informe conforme al TUPA SUZ26-050.",
      "tipoActuacion": "NORMAL"
    }
  ]
}
```

---

## 6. INTEGRIDAD GLOBAL Y PRUEBAS DE REGRESIÓN

### 6.1. Inmutabilidad de Conteos y Cero Duplicados
- **Expedientes en `sigd_tra.expediente`:** 11 (cero duplicados, cero creados).
- **Asientos en `sigd_tra.asiento_registro`:** 10 (cero duplicados).
- **Correlativo anual de CUT (`sigd_tra.secuencia_anual_cut`):** 11 (cero consumo no autorizado).
- **Secuencia de asientos (`sigd_tra.seq_asiento_numero_registro`):** 10010 (cero consumo).
- **Resoluciones en `sigd_doc.resolucion`:** 4 (cero creadas, cero correlativos consumidos).
- **Notificaciones en `sigd_auth.notificacion_casilla`:** 2 (cero creadas).
- **Base institucional protegida `sigd_prueba`:** Conteo 2 (100% intacta).

### 6.2. Baterías de Regresión y Typecheck
- **RutaDoc Vitest Suite:** 14 suites aprobadas (157 pruebas pasadas, 0 falladas).
- **Backend Typecheck (`tsc --noEmit`):** **0 errores**.
- **Frontend Typecheck (`tsc --noEmit`):** **0 errores**.
- **Git Diff Check (`git diff --check`):** **0 errores**.
- **Archivos modificados en working tree:** **154 archivos** preservados sin alteraciones de código.

---

## 7. CUMPLIMIENTO ESTRICTO DE LÍMITES Y PRÓXIMOS PASOS

Conforme al mandato de autorización acotada:
1. **NO se ejecutó** la proyección de resolución en DocuCore.
2. **NO se consumió** ningún correlativo anual de resolución.
3. **NO se invocó** la pasarela de firma digital real.
4. **NO se ejecutó** ningún callback de firma con efectos persistentes.
5. **NO se emitieron** notificaciones a la Casilla Electrónica.
6. **NO se generaron** acuses legales.

### Recomendación Técnica para la Siguiente Etapa
El expediente `EXP-2026-000011` se encuentra formalmente ubicado en la bandeja de **Secretaría Académica** (`SEC`), en estado **`DERIVADO`**.

La siguiente etapa natural del circuito corresponde a:
1. Recepción en el área de destino: Transición a `EN_REVISION` mediante evento `RECEPCION` en Secretaría Académica.
2. Proyección de la Resolución Directoral de Reincorporación en DocuCore (`POST /api/v1/resoluciones/proyectar`), asignando el correlativo `RD-2026-000009`.

> **ESTADO FINAL:** OPERACIÓN EXITOSA, AUDITADA Y CONCLUIDA. SISTEMA DETENIDO ESPERANDO AUTORIZACIÓN PARA LA SIGUIENTE ETAPA.
