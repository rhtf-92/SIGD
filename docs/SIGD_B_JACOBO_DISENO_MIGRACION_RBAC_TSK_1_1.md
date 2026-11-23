# SIGD SUIZA — DISEÑO TÉCNICO DE MIGRACIÓN Y PRUEBAS FUNCIONALES V1.2
## ESPECIFICACIÓN TÉCNICA DE MIGRACIÓN RBAC, ESTRATEGIA DE REVERSIÓN Y 15 ESCENARIOS DE PRUEBAS FUNCIONALES
### INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO «SUIZA» — PUCALLPA, UCAYALI
**Rama Exclusiva:** `B_JACOBO` | **Entorno Oficial:** Entorno Aislado B_JACOBO | **Base de Datos:** `sigd_jacobo_demo` (PostgreSQL 18.6)  
**Estado:** Cierre de Brechas Funcionales (TSK-1.1B) — Propuesta Documental No Ejecutable en BD  
**Fecha:** Noviembre de 2026

---

> [!WARNING]
> **DOCUMENTACIÓN TÉCNICA EXCLUSIVA — NO EJECUTABLE EN ESTA ETAPA**  
> El código SQL presentado en este documento es una propuesta de diseño para la futura etapa de migración autorizada (TSK-1.2). Está terminantemente prohibido ejecutar este script en `sigd_jacobo_demo` o en cualquier base de datos mientras no medie instrucción y autorización expresa.

---

## 1. OBJETIVO DEL DISEÑO DE MIGRACIÓN

Establecer la hoja de ruta técnica, restricciones de integridad, dependencias relacionales, estrategia de reversión y el diseño riguroso de los quince (15) escenarios de pruebas funcionales para la transición definitiva hacia el catálogo de diez (10) roles institucionales y el subsistema de capacidades operativas independientes en el SIGD Suiza.

---

## 2. PROCEDIMIENTO DE RESPALDO Y PRECONDICIONES TÉCNICAS

Antes de autorizar cualquier mutación física sobre la base activa `sigd_jacobo_demo`, se deberá ejecutar el siguiente protocolo de aseguramiento:

### 2.1. Respaldo Lógico Atómico
```bash
# Comando obligatorio de respaldo en host Docker (Solo lectura):
docker exec sigd-postgres-1 pg_dump -U postgres -d sigd_jacobo_demo \
  --format=custom \
  --file=/var/lib/postgresql/data/backup_pre_tsk12_$(date +%Y%m%d_%H%M%S).dump
```

### 2.2. Validación de Línea Base
1. Confirmar que ningún proceso transaccional o worker outbox se encuentre en ejecución concurrente.
2. Comprobar la no existencia de bloqueos residuales en `pg_locks`.
3. Verificar que en `sigd_org.area` se conserven intactas las 3 áreas existentes (`DG`, `MP`, `SEC`).
4. Verificar la no existencia física de las tablas `sigd_org.capacidad_sistema` ni `sigd_org.usuario_capacidad`.

---

## 3. ESPECIFICACIÓN DDL/DML PROPUESTA (ANEXO DE DISEÑO NO EJECUTABLE)

```sql
-- ============================================================================
-- SCRIPT DE MIGRACIÓN RBAC INSTITUCIONAL - PROPUESTA TÉCNICA TSK-1.2
-- ESTADO: NO EJECUTABLE EN TSK-1.1B (SOLO DISEÑO DOCUMENTAL)
-- ============================================================================

BEGIN;

-- 1. ALTA DE ROLES CANÓNICOS FALTANTES EN sigd_org.rol_sistema
INSERT INTO sigd_org.rol_sistema (rol_id, codigo, nombre, descripcion, vigente)
VALUES 
    (gen_random_uuid(), 'JEFE_UNIDAD_ACADEMICA', 'Jefe de Unidad Académica', 
     'Supervisión pedagógica y gestión transversal de programas de su unidad.', TRUE),
    (gen_random_uuid(), 'COORDINADOR_AREA', 'Coordinador de Área', 
     'Gestión operativa de expedientes de su carrera y asignación a docentes.', TRUE),
    (gen_random_uuid(), 'DOCENTE', 'Docente Institucional', 
     'Presentación de trámites y evaluación técnica de expedientes asignados.', TRUE),
    (gen_random_uuid(), 'ESTUDIANTE', 'Estudiante Institucional', 
     'Rol interno de la comunidad educativa para gestión de expedientes académicos propios.', TRUE)
ON CONFLICT (codigo) DO UPDATE 
SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, vigente = TRUE;

-- 2. ASOCIACIÓN DE PERMISOS BÁSICOS EN sigd_org.rol_permiso
-- JEFE_UNIDAD_ACADEMICA
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r, sigd_org.permiso_sistema p
 WHERE r.codigo = 'JEFE_UNIDAD_ACADEMICA' 
   AND p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RESOLVER', 'REPORTE_LEER')
ON CONFLICT DO NOTHING;

-- COORDINADOR_AREA
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r, sigd_org.permiso_sistema p
 WHERE r.codigo = 'COORDINADOR_AREA' 
   AND p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RESOLVER')
ON CONFLICT DO NOTHING;

-- DOCENTE
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r, sigd_org.permiso_sistema p
 WHERE r.codigo = 'DOCENTE' 
   AND p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_RESOLVER')
ON CONFLICT DO NOTHING;

-- ESTUDIANTE
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
  FROM sigd_org.rol_sistema r, sigd_org.permiso_sistema p
 WHERE r.codigo = 'ESTUDIANTE' 
   AND p.codigo IN ('EXPEDIENTE_LEER')
ON CONFLICT DO NOTHING;

-- 3. CREACIÓN DE TABLAS DE CAPACIDADES OPERATIVAS INDEPENDIENTES
CREATE TABLE IF NOT EXISTS sigd_org.capacidad_sistema (
    id_capacidad UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(60) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    ambito_permitido VARCHAR(20) NOT NULL DEFAULT 'AREA',
    vigente BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO sigd_org.capacidad_sistema (codigo, nombre, descripcion, ambito_permitido)
VALUES ('GESTOR_APOYO_AREA', 'Apoyo de Área', 'Asistencia administrativa delegada dentro de un área académica u oficina.', 'AREA')
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS sigd_org.usuario_capacidad (
    id_usuario_capacidad UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    id_capacidad UUID NOT NULL REFERENCES sigd_org.capacidad_sistema(id_capacidad) ON DELETE RESTRICT,
    codigo VARCHAR(60) NOT NULL DEFAULT 'GESTOR_APOYO_AREA',
    area_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    vigente_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
    vigente_hasta TIMESTAMPTZ,
    asignado_por UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuario_capacidad_activo 
ON sigd_org.usuario_capacidad (id_usuario, id_usuario_capacidad) WHERE activo = TRUE;

-- 4. TRATAMIENTO DE ROLES HISTÓRICOS (SIN REASIGNACIONES AUTOMÁTICAS)
-- Retirar formalmente ESPECIALISTA del catálogo vigente de asignaciones
UPDATE sigd_org.rol_sistema
   SET vigente = FALSE
 WHERE codigo = 'ESPECIALISTA';

-- NOTA CRÍTICA: Las asignaciones en usuario_rol de cuentas históricas (operador.demo, 
-- especialista.demo, trabajador.h2.*) SE CONSERVAN INTACTAS.
-- Cualquier reasignación futura se realizará individualmente mediante resoluciones 
-- o decisiones expresas de la Dirección, nunca de forma automática en este script.

COMMIT;
```

---

## 4. ESTRATEGIA DE REVERSIÓN (ROLLBACK DETERMINISTA)

En caso de detectarse alguna anomalía en la consistencia de datos durante la fase de aplicación:

1. **Reversión de Transacción Abierta:** Si el fallo ocurre durante la ejecución, el bloque `ROLLBACK;` garantiza el retorno al estado inicial cero.
2. **Reversión Posterior:** Si la anomalía se manifiesta en tiempo de ejecución:
   ```sql
   BEGIN;
   -- Reactivar rol ESPECIALISTA si fuera indispensable para contingencia
   UPDATE sigd_org.rol_sistema SET vigente = TRUE WHERE codigo = 'ESPECIALISTA';
   COMMIT;
   ```
3. **Restauración Integral:** Invocación del archivo dump generado en el punto 2.1.

---

## 5. DISEÑO DE LOS QUINCE (15) ESCENARIOS DE PRUEBAS FUNCIONALES DEFINITIVOS

A continuación se detallan los 15 escenarios de prueba rigurosamente armonizados con la taxonomía y riesgos del SIGD Suiza:

### Escenario 1: Notificación automática frente a manual
* **Estado Inicial:** Expediente en trámite observado por requisitos incompletos.
* **Actor:** Proceso del sistema (OutboxWorker) vs. Operador de Mesa de Partes.
* **Contexto:** Motor transaccional automático vs. Contexto `MESA_PARTES` en `MP`.
* **Acción:** (A) El sistema detecta el evento `expediente_observado` en `sigd_audit.outbox_eventos` y lo despacha asíncronamente; (B) El operador de ventanilla invoca el endpoint de emisión de observación con cédula manual.
* **Resultado Esperado:** En (A), el despachador entrega a Casilla y SSE sin requerir permisos de usuario; en (B), el operador requiere `TRAMICORE_DEVOLUCION_EVALUAR` en ámbito de Mesa de Partes para asentar la observación.
* **Regla de Autorización:** Las notificaciones automáticas operan por arquitectura de eventos interna; las manuales se autorizan por la operación documental sustantiva del operador.
* **Riesgo:** Confundir la autorización del demonio con un permiso interactivo innecesario.
* **Evidencia de Auditoría:** Asiento en `sigd_audit.outbox_eventos` con estado `ENVIADO` y registro en `sigd_auth.notificacion_casilla`.

---

### Escenario 2: Envío duplicado de notificaciones (Idempotencia y Bloqueo)
* **Estado Inicial:** Evento `tesoreria_notificacion` generado con `id_evento = UUID_1`.
* **Actor:** Despachador asíncrono `OutboxWorker` (dos hilos de ejecución concurrentes).
* **Contexto:** Proceso daemon en segundo plano.
* **Acción:** Dos instancias intentan despachar simultáneamente la misma notificación hacia la Casilla Electrónica.
* **Resultado Esperado:** La primera adquiere `pg_advisory_xact_lock` e inserta la notificación; la segunda detecta que `referencia = UUID_1` ya existe en `sigd_auth.notificacion_casilla` y omite la inserción limpiamente sin generar registros duplicados ni emitir alertas erróneas.
* **Regla de Autorización:** Control de concurrencia e idempotencia estricta por advisory lock y clave de unicidad de referencia.
* **Riesgo:** Cédulas de notificación duplicadas y saturación de la casilla del administrado.
* **Evidencia de Auditoría:** Exactamente 1 fila en `sigd_auth.notificacion_casilla` con `referencia = UUID_1`.

---

### Escenario 3: Docente que intenta consultar expedientes ajenos
* **Estado Inicial:** Docente A autenticado con rol `DOCENTE` en un área formativa.
* **Actor:** Docente A.
* **Contexto:** Rol activo `DOCENTE`.
* **Acción:** Invoca `GET /api/v1/expedientes/:id` indicando el identificador de un expediente asignado formalmente al Docente B.
* **Resultado Esperado:** Respuesta `403 FORBIDDEN` y exclusión del expediente en la bandeja de entrada del Docente A.
* **Regla de Autorización:** `EXPEDIENTE_LEER` en docente evalúa la titularidad de asignación activa en `sigd_doc.expediente_asignacion` (`asignado_a = cu.id_usuario`).
* **Riesgo:** Violación del secreto de evaluaciones pedagógicas y acceso indebido a información académica de terceros.
* **Evidencia de Auditoría:** Asiento de rechazo `403` en logs de API y auditoría en `rutadoc.repository.ts`.

---

### Escenario 4: Coordinador que intenta reasignar fuera de su ámbito
* **Estado Inicial:** Coordinador de Área asignado a la carrera de Computación (`area_id = COMP`).
* **Actor:** Coordinador de Computación.
* **Contexto:** Rol activo `COORDINADOR_AREA` en `COMP`.
* **Acción:** Envía payload `POST /api/v1/expedientes/:id/asignar` intentando reasignar un expediente radicado en el área de Enfermería (`area_id = ENF`).
* **Resultado Esperado:** Rechazo inmediato con `403 FORBIDDEN` ("El expediente no pertenece al área autorizada del coordinador").
* **Regla de Autorización:** El ámbito `AREA` restringe las facultades de `EXPEDIENTE_RESOLVER` a expedientes cuyo `area_actual_id` coincida exactamente con el `area_id` de la asignación activa.
* **Riesgo:** Invasión de competencias interdepartamentales y desorganización de la trazabilidad formativa.
* **Evidencia de Auditoría:** Registro de denegación por discrepancia de área en bitácora WORM.

---

### Escenario 5: Apoyo de Área que intenta aprobar una resolución
* **Estado Inicial:** Personal administrativo con capacidad operativa `GESTOR_APOYO_AREA` en Secretaría Académica (`area_id = SEC`).
* **Actor:** Personal de apoyo administrativo.
* **Contexto:** Contexto activo `GESTOR_APOYO_AREA` en `SEC`.
* **Acción:** Envía petición `POST /api/v1/resoluciones/:id/aprobar` intentando aprobar un proyecto de resolución.
* **Resultado Esperado:** Rechazo tajante con `403 FORBIDDEN`.
* **Regla de Autorización:** La capacidad operativa excluye expresamente mediante lista negra en `auth.guard.ts` los permisos `EXPEDIENTE_RESOLVER` y `FIRMA_FIRMAR`.
* **Riesgo:** Personal subordinado emitiendo actos administrativos o aprobaciones reservadas a autoridades.
* **Evidencia de Auditoría:** Log de violación de seguridad por intento de invocación de endpoint restringido.

---

### Escenario 6: Estudiante que intenta consultar documentos de otro estudiante
* **Estado Inicial:** Estudiante Juan con cuenta activa y rol `ESTUDIANTE`.
* **Actor:** Estudiante Juan.
* **Contexto:** Rol activo `ESTUDIANTE` (Titularidad propia).
* **Acción:** Invoca `GET /api/v1/expedientes/:id` solicitando el expediente de matrícula y convalidaciones del Estudiante Pedro.
* **Resultado Esperado:** Respuesta `403 FORBIDDEN` o `404 NOT FOUND`.
* **Regla de Autorización:** El rol `ESTUDIANTE` opera bajo estricta titularidad de cuenta; la consulta relacional fuerza el filtro `e.solicitante_id = persona.id_persona`.
* **Riesgo:** Fuga de datos personales sensibles y notas académicas protegidas por ley.
* **Evidencia de Auditoría:** Alerta de seguridad en bitácora por intento de lectura no autorizado.

---

### Escenario 7: Ciudadano que intenta acceder a módulos internos
* **Estado Inicial:** Administrado externo con cuenta activa y rol `CIUDADANO`.
* **Actor:** Ciudadano externo.
* **Contexto:** Rol activo `CIUDADANO`.
* **Acción:** Intenta consultar `GET /api/v1/admin/usuarios` o `GET /api/v1/admin/organigrama`.
* **Resultado Esperado:** Rechazo con `403 FORBIDDEN`.
* **Regla de Autorización:** `exigirAdministracionUsuarios` exige el permiso `ADMIN_USUARIOS` en ámbito `GLOBAL`. El rol `CIUDADANO` carece de dicho permiso.
* **Riesgo:** Intrusión de terceros en la gestión de personal institucional y configuración del sistema.
* **Evidencia de Auditoría:** Asiento en bitácora WORM de denegación en ruta administrativa.

---

### Escenario 8: Revocación de capacidad durante una sesión abierta
* **Estado Inicial:** Usuario operando en una sesión activa con el contexto `GESTOR_APOYO_AREA` (`ctx = UUID_CAP`).
* **Actor:** Administrador del Sistema revoca la capacidad operativa en BD.
* **Contexto:** Usuario con sesión en vuelo.
* **Acción:** El administrador marca `activo = FALSE` en `sigd_org.usuario_capacidad`. El usuario envía una petición protegida inmediata.
* **Resultado Esperado:** El middleware detecta la pérdida de vigencia en PostgreSQL relacional y responde `403 CONTEXT_REVOKED`. La sesión del usuario permanece viva y el frontend despliega el selector de contexto alterno.
* **Regla de Autorización:** Política B de revocación inmediata de contexto (DEC-24 y DEC-25).
* **Riesgo:** Continuidad de operaciones no autorizadas mediante tokens zombi.
* **Evidencia de Auditoría:** Registro de revocación en `sigd_auth.auditoria_usuarios` y evento `CONTEXT_REVOKED`.

---

### Escenario 9: Cambio de unidad académica
* **Estado Inicial:** Jefe de Unidad Académica A asignado a la Unidad Tecnológica.
* **Actor:** Administrador del Sistema.
* **Contexto:** Traslado de jefatura.
* **Acción:** Se actualiza su asignación en `usuario_rol` trasladándolo a la Unidad Agropecuaria. El usuario envía una petición con su token activo previo.
* **Resultado Esperado:** El middleware revalida contra PostgreSQL relacional: el acceso a los expedientes de la Unidad Tecnológica es denegado al instante, y sus facultades se recalculan sobre la Unidad Agropecuaria.
* **Regla de Autorización:** Recálculo dinámico en vuelo de los permisos y ámbito según `usuario_rol.area_id`.
* **Riesgo:** Autoridad trasladada interviniendo en decisiones de su unidad previa.
* **Evidencia de Auditoría:** Asiento de traslado en auditoría y rechazo de acceso a la unidad previa.

---

### Escenario 10: Pérdida de una designación institucional
* **Estado Inicial:** Funcionario que ostentaba el rol `DIRECTOR` concluye su encargo.
* **Actor:** Administrador / Autoridad de Personal.
* **Contexto:** Conclusión de mandato directivo.
* **Acción:** Se actualiza `vigente_hasta = now()` en `usuario_rol` para la asignación de Director y se inhabilita su registro en `sigd_org.facultad_despacho`.
* **Resultado Esperado:** Cualquier intento posterior de aprobar resoluciones o firmar digitalmente es rechazado con `403 FORBIDDEN` / `CONTEXT_REVOKED`.
* **Regla de Autorización:** La validez de firma exige tanto rol activo como designación vigente en `facultad_despacho`.
* **Riesgo:** Emisión de resoluciones directivas por autoridades salientes sin competencia legal.
* **Evidencia de Auditoría:** Bitácora de cese de facultades y denegación de firma.

---

### Escenario 11: Cambio de cargo conservando otros roles
* **Estado Inicial:** Usuario con dos asignaciones vigentes: `DOCENTE` y `COORDINADOR_AREA`.
* **Actor:** Administrador del Sistema.
* **Contexto:** Usuario con asignaciones plurales legítimas.
* **Acción:** Se revoca únicamente la asignación de `COORDINADOR_AREA`. El usuario intenta realizar una actuación docente.
* **Resultado Esperado:** El usuario conmuta a su contexto `DOCENTE`; el sistema permite la evaluación de expedientes asignados normalmente sin requerir nuevo login ni regeneración de credenciales.
* **Regla de Autorización:** Preservación de contextos legítimos no afectados ante revocación parcial de roles.
* **Riesgo:** Inoperatividad del docente por revocación indiscriminada de cuenta.
* **Evidencia de Auditoría:** Registro de conmutación de contexto a `DOCENTE` en bitácora.

---

### Escenario 12: Operación financiera sin permiso específico
* **Estado Inicial:** Usuario con rol `MESA_PARTES` o `ADMINISTRADOR`.
* **Actor:** Operador no financiero.
* **Contexto:** Contexto administrativo o de ventanilla.
* **Acción:** Envía petición `POST /api/v1/tesoreria/ordenes-pago/:id/confirmar` intentando cobrar un arancel.
* **Resultado Esperado:** Rechazo inmediato con `403 FORBIDDEN`.
* **Regla de Autorización:** Las operaciones de caja y confirmación financiera exigen con exclusividad el rol `TESORERO` y el permiso `TESORERIA_PAGO_REGISTRAR`.
* **Riesgo:** Desvío de fondos o recaudaciones paralelas por personal no autorizado de ventanilla.
* **Evidencia de Auditoría:** Asiento en bitácora WORM de intento de operación financiera no autorizada.

---

### Escenario 13: Intento de firma sin facultad
* **Estado Inicial:** Secretario Académico autenticado con rol `SECRETARIO`.
* **Actor:** Secretario Académico.
* **Contexto:** Proyección documental en Secretaría Académica (`SEC`).
* **Acción:** Invoca directamente `/api/v1/firma/firmar` intentando estampar firma digital sobre un proyecto de resolución de titulación.
* **Resultado Esperado:** Rechazo tajante con `403 FORBIDDEN`.
* **Regla de Autorización:** `verificarFacultadFirma` exige el rol `DIRECTOR` y registro activo en `sigd_org.facultad_despacho`. El Secretario solo proyecta y certifica administrativamente, pero no firma resoluciones.
* **Riesgo:** Nulidad de pleno derecho del título profesional por usurpación de la potestad resolutiva del Director.
* **Evidencia de Auditoría:** Registro de intento de firma no autorizada en bitácora WORM.

---

### Escenario 14: Cierre de un expediente sin cumplir sus condiciones
* **Estado Inicial:** Expediente en trámite con observaciones pendientes de subsanación ciudadana no vencidas.
* **Actor:** Operador de Secretaría.
* **Contexto:** Rol `SECRETARIO`.
* **Acción:** Envía petición para mutar el estado del expediente a `CONCLUIDO` o `ARCHIVADO`.
* **Resultado Esperado:** Rechazo con `409 CONFLICT` o `400 BAD REQUEST` ("El expediente mantiene observaciones abiertas en plazo de subsanación").
* **Regla de Autorización:** La operación de cierre valida que no existan hitos pendientes, órdenes de pago impagas o plazos perentorios en curso.
* **Riesgo:** Vulneración del debido procedimiento administrativo y perjuicio al administrado.
* **Evidencia de Auditoría:** Fallo de validación documental asentado en bitácora.

---

### Escenario 15: Archivo de un expediente sin completar las etapas requeridas
* **Estado Inicial:** Expediente administrativo sin proveído final ni resolución directoral suscrita.
* **Actor:** Encargado de archivo.
* **Contexto:** Custodia documental en Secretaría Académica.
* **Acción:** Intenta trasladar el expediente al archivo definitivo asignando número de legajo AGN.
* **Resultado Esperado:** Rechazo con `400 BAD REQUEST` ("No se puede archivar un expediente en estado activo sin resolución final firme").
* **Regla de Autorización:** El archivo institucional exige estado previo `CONCLUIDO` y foliación continua completa.
* **Riesgo:** Pérdida y dispersión de expedientes vivos en el archivo pasivo institucional.
* **Evidencia de Auditoría:** Intento de archivamiento irregular registrado en logs de RutaDoc.

---

## 6. CONCLUSIÓN TÉCNICA

Los quince (15) escenarios de pruebas funcionales formulados cubren con exactitud la totalidad de los riesgos operacionales y jurídicos identificados, respetando rigurosamente las atribuciones del personal, el aislamiento de capacidades y la coherencia del motor transaccional del SIGD Suiza.
