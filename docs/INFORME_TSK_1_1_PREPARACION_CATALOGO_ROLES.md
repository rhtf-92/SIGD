# SIGD SUIZA — INFORME TÉCNICO DE CIERRE TSK-1.1 / TSK-1.1A / TSK-1.1B
## CORRECCIÓN, CONSOLIDACIÓN Y CIERRE DE BRECHAS FUNCIONALES DEL DISEÑO RBAC
### INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO «SUIZA» — PUCALLPA, UCAYALI
**Rama Exclusiva:** `B_JACOBO` | **Entorno Oficial:** Entorno Aislado B_JACOBO | **Base de Datos:** `sigd_jacobo_demo` (PostgreSQL 18.6)  
**Estado:** Validación Funcional, Conciliación de Permisos y Preparación para Implementación Concluidas  
**Fecha de Emisión:** Noviembre de 2026

---

## 1. CONTROL DE METADATOS Y DOCUMENTOS CONSOLIDADOS

En cumplimiento de las directrices de las tareas **TSK-1.1**, **TSK-1.1A** y **TSK-1.1B**, se han revisado, corregido y armonizado los siete (7) documentos rectores en el repositorio oficial:

1. [`docs/SIGD_B_JACOBO_CATALOGO_ROLES_INSTITUCIONALES_V1.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/SIGD_B_JACOBO_CATALOGO_ROLES_INSTITUCIONALES_V1.md): Catálogo definitivo y canónico de los diez (10) roles institucionales del SIGD Suiza, con estricta diferenciación dogmática de atribuciones.
2. [`docs/SIGD_B_JACOBO_MATRIZ_ROLES_PERMISOS_AMBITOS_V1.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/SIGD_B_JACOBO_MATRIZ_ROLES_PERMISOS_AMBITOS_V1.md): Evaluación y conciliación definitiva de las 15 operaciones documentales frente a los 16 permisos reales de PostgreSQL (4 completos, 8 parciales, 3 brechas) y análisis del subsistema de notificaciones.
3. [`docs/SIGD_B_JACOBO_MATRIZ_CAPACIDADES_OPERATIVAS_V1.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/SIGD_B_JACOBO_MATRIZ_CAPACIDADES_OPERATIVAS_V1.md): Especificación técnica de la capacidad operativa `GESTOR_APOYO_AREA` (Apoyo de Área), explicitando que su implementación física en BD está pendiente y detallando sus 9 dependencias técnicas.
4. [`docs/SIGD_B_JACOBO_MODELO_ASIGNACIONES_MULTICONTEXTO_V1.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/SIGD_B_JACOBO_MODELO_ASIGNACIONES_MULTICONTEXTO_V1.md): Arquitectura contextual de 12 entidades ontológicas, estado real del organigrama (DG, MP, SEC) y reglas de ámbito (`area_id`) según tipo de asignación.
5. [`docs/SIGD_B_JACOBO_CONCILIACION_ROLES_HISTORICOS_V1.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/SIGD_B_JACOBO_CONCILIACION_ROLES_HISTORICOS_V1.md): Auditoría forense de los 6 UUID históricos de `ESPECIALISTA`, erradicando equivalencias automáticas y catalogándolas como pendientes de autorización institucional.
6. [`docs/SIGD_B_JACOBO_DISENO_MIGRACION_RBAC_TSK_1_1.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/SIGD_B_JACOBO_DISENO_MIGRACION_RBAC_TSK_1_1.md): Diseño técnico de migración atómica no ejecutable, plan de contingencia de respaldo (`pg_dump`) y formulación rigurosa de los 15 escenarios de pruebas funcionales ajustados a los riesgos de TSK-1.1B.
7. [`docs/INFORME_TSK_1_1B_CIERRE_BRECHAS_RBAC.md`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/INFORME_TSK_1_1B_CIERRE_BRECHAS_RBAC.md): Informe específico de cierre de brechas y orden de implementación para TSK-1.2.

---

## 2. RESOLUCIÓN DE LA CONCILIACIÓN ARITMÉTICA (15 OPERACIONES EXACTAS)

Se subsanó categóricamente la inconsistencia de conteo advertida en revisiones previas. El inventario consolidado comprende exactamente quince (15) operaciones documentales evaluadas contra los dieciséis (16) permisos reales de PostgreSQL:

* **COMPLETO (4 Operaciones):**
  1. *Lectura:* `EXPEDIENTE_LEER` (Global/Área/Titularidad).
  4. *Derivación:* `EXPEDIENTE_DERIVAR` (Área/Global).
  8. *Observación:* `TRAMICORE_DEVOLUCION_EVALUAR` (Ventanilla) / `EXPEDIENTE_RESOLVER` (Área).
  12. *Firma Digital:* `FIRMA_FIRMAR` (Global - Director acreditado).
* **PARCIAL (8 Operaciones):**
  5. *Recepción:* Apoyada en `EXPEDIENTE_DERIVAR` en área destino + mutación de estado a `RECEPCIONADO`.
  6. *Asignación:* Apoyada en `EXPEDIENTE_RESOLVER` + regla relacional de misma área.
  7. *Reasignación:* Apoyada en `EXPEDIENTE_RESOLVER` + regla de motivación en WORM.
  10. *Evaluación:* Apoyada en `EXPEDIENTE_RESOLVER` + verificación de asignación activa en `sigd_doc.expediente_asignacion`.
  11. *Aprobación Institucional:* Apoyada en `EXPEDIENTE_RESOLVER` + habilitación en `sigd_org.facultad_despacho`.
  13. *Notificación:* Despacho asíncrono Outbox/SSE/Casilla por eventos del sistema; consulta ciudadana por titularidad.
  14. *Cierre:* Apoyada en `EXPEDIENTE_RESOLVER` + comprobación de proveído final o resolución.
  15. *Archivo:* Apoyada en `EXPEDIENTE_RESOLVER` + custodia central y foliación continua AGN.
* **BRECHA (3 Operaciones):**
  2. *Registro / Radicación:* Controlada por router de ventanilla (`MESA_PARTES`) o sesión ciudadana. Brecha de permiso atómico `EXPEDIENTE_REGISTRAR`.
  3. *Edición de Borradores:* Controlada en servicio de documentos sobre borradores no suscritos. Brecha de permiso atómico `DOCUMENTO_EDITAR`.
  9. *Subsanación:* Controlada por router de casilla ciudadana con validación de plazo perentorio. Brecha de permiso atómico `EXPEDIENTE_SUBSANAR`.

$$\mathbf{4\text{ (Completo)}} + \mathbf{8\text{ (Parcial)}} + \mathbf{3\text{ (Brecha)}} = \mathbf{15\text{ Operaciones Conciliadas}}$$

---

## 3. SUBSISTEMA DE NOTIFICACIONES (ANÁLISIS DE CASILLA Y OUTBOX)

1. **Notificaciones Automáticas:** Son disparadas en la misma transacción PostgreSQL de las operaciones sustantivas hacia `sigd_audit.outbox_eventos` (`casilla_notificacion`, `expediente_observado`, `expediente_resuelto`, `resolucion_emitida`, `tesoreria_notificacion`). El demonio `OutboxWorker` las despacha asíncronamente sin requerir permisos interactivos de usuario.
2. **Notificaciones Manuales:** Son iniciadas por operadores autorizados al registrar observaciones o proveídos. La acción se autoriza por la operación sustantiva que la origina (`TRAMICORE_DEVOLUCION_EVALUAR` o `EXPEDIENTE_RESOLVER`).
3. **Prevención de Duplicados e Idempotencia:** Garantizada mediante clave de unicidad sobre la columna `referencia` en `sigd_auth.notificacion_casilla` y bloqueo transaccional consultivo `pg_advisory_xact_lock`.
4. **Consulta por Titularidad:** Los administrados y estudiantes consultan su Casilla mediante `/api/v1/casilla/bandeja` y `/api/v1/casilla/notificaciones/:id`, autorizados por **estricta titularidad de cuenta** (`usuario_id = sub`).
5. **Conclusión Normativa:** **No se requiere inventar un permiso `NOTIFICACION_ENVIAR` en el catálogo RBAC**.

---

## 4. DIFERENCIACIÓN DOGMÁTICA DE ATRIBUCIONES INSTITUCIONALES

Se ratifican los cinco conceptos claramente delimitados:
1. **Proyección Documental:** Redacción técnica de borradores (Secretaría Académica o Coordinación). No confiere fuerza vinculante.
2. **Certificación Administrativa:** Constancia formal de autenticidad documental emitida por Secretaría Académica en el marco de facultades reglamentarias expresas. **No se le atribuye fe pública institucional automática**.
3. **Aprobación Institucional:** Acto sustantivo jerárquico que da conformidad de fondo al trámite o proyecto de resolución (Director General).
4. **Firma Digital:** Suscripción criptográfica asimétrica con certificado acreditado bajo la Ley N.° 27269, privativa del Director General para emitir resoluciones.
5. **Verificación Criptográfica (CVD):** Mecanismo tecnológico de cotejo algorítmico de integridad mediante código o hash SHA-256; **bajo ninguna circunstancia equivale a una firma digital**.

---

## 5. CATÁLOGO DEFINITIVO DE DIEZ (10) ROLES INSTITUCIONALES

Se mantiene inalterado el catálogo cerrado de 10 roles:
1. `ADMINISTRADOR` (Interno — Global Técnico)
2. `DIRECTOR` (Interno — Global Directivo)
3. `JEFE_UNIDAD_ACADEMICA` (Interno — Supervisión de Unidad)
4. `COORDINADOR_AREA` (Interno — Gestión de Área/Carrera)
5. `SECRETARIO` (Interno — Fe Administrativa y Custodia)
6. `MESA_PARTES` (Interno — Ventanilla y Radicación)
7. `DOCENTE` (Interno — Evaluación Asignada)
8. `TESORERO` (Interno — Operador Financiero Único)
9. `ESTUDIANTE` (Interno — Comunidad Estudiantil)
10. `CIUDADANO` (Externo — Administrado General)

---

## 6. ORGANIGRAMA Y CONDICIONES DE ÁMBITO (`area_id`)

1. **Estado Real de `sigd_org.area`:** Actualmente existen únicamente tres (3) áreas de nivel 1: `DG` (Dirección General), `MP` (Mesa de Partes) y `SEC` (Secretaría Académica). Las unidades académicas intermedias y programas formativos se incorporarán exclusivamente cuando se cuente con la estructura institucional confirmada.
2. **Condiciones de Ámbito por Asignación:**
   - **Institucionales / Globales (`ADMINISTRADOR`, `DIRECTOR`, `TESORERO`):** `area_id` NULL o Nivel Institucional.
   - **Vinculados a Unidad (`JEFE_UNIDAD_ACADEMICA`):** `area_id` de Unidad Académica obligatorio.
   - **Vinculados a Área (`COORDINADOR_AREA`, `MESA_PARTES`, `SECRETARIO`, `DOCENTE`):** `area_id` de oficina o programa formativo obligatorio.
   - **Personales por Titularidad (`ESTUDIANTE`, `CIUDADANO`):** `area_id` obligatoriamente NULL (acceso regido por `solicitante_id = persona.id_persona`).

---

## 7. CONCILIACIÓN HISTÓRICA DE `ESPECIALISTA`

1. **Roles Deprecados:** `CAJERO`, `APROBADOR_DEVOLUCIONES` y `SUPERVISOR_TESORERIA` ya figuran con `vigente = FALSE` y poseen **0 asignaciones**.
2. **Seis UUID de `ESPECIALISTA`:**
   - Se mantienen intactos los 6 registros en `sigd_org.usuario_rol`.
   - Se erradican las equivalencias automáticas.
   - Todas las cuentas quedan formalmente registradas como **PENDIENTES DE AUTORIZACIÓN INSTITUCIONAL**.
   - Cero borrados físicos y cero mutaciones de cargos en base de datos.

---

## 8. CAPACIDAD OPERATIVA `GESTOR_APOYO_AREA`

* Se ratifica como capacidad operativa de asistencia delegada y **no como un rol institucional**.
* Su implementación física está **PENDIENTE**, dado que la tabla `sigd_org.usuario_capacidad` no existe en el esquema activo `sigd_jacobo_demo`.
* Se detallaron sus **9 dependencias técnicas** requeridas para la futura migración y sus estrictas restricciones funcionales (prohibición de aprobación, de firma digital, de acceso inter-áreas y de acumulación automática de facultades).

---

## 9. QUINCE (15) ESCENARIOS DE PRUEBAS FUNCIONALES DEFINITIVOS

Se formularon los 15 escenarios funcionales estructurados por `Estado inicial`, `Actor`, `Contexto`, `Acción`, `Resultado esperado`, `Regla de autorización`, `Riesgo` y `Evidencia de auditoría`, cubriendo:
1. Notificación automática frente a manual.
2. Envío duplicado de notificaciones (Idempotencia y Advisory Lock).
3. Docente que intenta consultar expedientes ajenos.
4. Coordinador que intenta reasignar fuera de su ámbito.
5. Apoyo de Área que intenta aprobar una resolución.
6. Estudiante que intenta consultar documentos de otro estudiante.
7. Ciudadano que intenta acceder a módulos internos.
8. Revocación de capacidad durante una sesión abierta.
9. Cambio de unidad académica.
10. Pérdida de una designación institucional.
11. Cambio de cargo conservando otros roles.
12. Operación financiera sin permiso específico.
13. Intento de firma sin facultad.
14. Cierre de un expediente sin cumplir sus condiciones.
15. Archivo de un expediente sin completar las etapas requeridas.

---

## 10. VERIFICACIÓN GIT Y ESTADO DE PROTECCIÓN

* `git branch --show-current`: `B_JACOBO`.
* `git status --short docs/`: Modificaciones limitadas exclusivamente a los documentos de diseño.
* Cero modificaciones en código fuente (backend y frontend intactos).
* Cero commits y cero push ejecutados.

---

## 11. CERTIFICACIÓN TERMINANTE DE NO MUTACIÓN EN POSTGRESQL

> [!IMPORTANT]
> **CERTIFICACIÓN DE PROTECCIÓN DE POSTGRESQL:**  
> Se certifica de manera categórica que **NO se ha ejecutado ninguna operación de DDL (`CREATE`, `ALTER`, `DROP`), DML (`INSERT`, `UPDATE`, `DELETE`) ni migración sobre la base de datos `sigd_jacobo_demo`**.  
> No se ha creado ninguna base de datos ni entorno paralelo. El entorno oficial aislado `B_JACOBO` permanece 100% puro e intacto.

---

## 12. DECLARACIÓN DE CIERRE Y CONDICIÓN DE PARADA

La tarea **`TSK-1.1B`** queda declarada **TERMINADA Y CERRADA SATISFACTORIAMENTE**.

> [!CAUTION]
> **CONDICIÓN DE PARADA ACTIVA:**  
> Se detienen todas las intervenciones. No se iniciará la migración ni la tarea **`TSK-1.2`** hasta recibir tu instrucción expresa y autorización formal.
