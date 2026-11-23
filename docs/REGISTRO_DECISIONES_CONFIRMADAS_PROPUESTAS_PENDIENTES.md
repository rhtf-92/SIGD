# SIGD RENATO — REGISTRO FORMAL DE DECISIONES ARQUITECTÓNICAS Y FUNCIONALES
## TAXONOMÍA DE DECISIONES: CONFIRMADAS, IMPLEMENTADAS, PARCIALES, PROPUESTAS Y PENDIENTES
### INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO «SUIZA»
### RAMA OFICIAL: `B_JACOBO` — VERSIÓN V1.2.1 ARMONIZADA Y ENDURECIDA

---

## 1. MARCO TAXONÓMICO OBLIGATORIO

Para garantizar la honestidad técnica y evitar la confusión entre el diseño conceptual y la realidad del código fuente, cada decisión arquitectónica, normativa y funcional se clasifica de manera estricta bajo una de las siguientes cinco categorías:

* **`CONFIRMADA`:** Decisión técnica o normativa expresamente acordada y ratificada por la dirección del proyecto.
* **`IMPLEMENTADA`:** Decisión con respaldo de código fuente verificado, pruebas aprobadas y persistencia física en base de datos o scripts canónicos listos.
* **`PARCIAL`:** Decisión con código o esquemas existentes pero incompleta o pendiente de integración final.
* **`PROPUESTA`:** Recomendación técnica formulada por el equipo de arquitectura pendiente de aprobación formal.
* **`PENDIENTE`:** Asunto dependiente de definiciones administrativas o resoluciones institucionales externas.

---

## 2. REGISTRO MAESTRO DE DECISIONES CLASIFICADAS

### 2.1. Identidad, Acceso y Gobierno de Roles (RBAC)

| Código | Decisión Evaluada | Clasificación | Fundamento y Evidencia Técnica |
| :--- | :--- | :---: | :--- |
| **DEC-01** | **Catálogo Estricto de Diez Roles Institucionales** (`ADMINISTRADOR`, `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO`, `MESA_PARTES`, `DOCENTE`, `TESORERO`, `ESTUDIANTE`, `CIUDADANO`). | **CONFIRMADA** | Resuelve el modelo organizacional del IESTP Suiza. Ratificada en la directiva V1.2.1. Script de migración amplía `chk_rol_codigo` con los 10 roles canónicos sin destruir datos históricos. |
| **DEC-02** | **Descarte Definitivo de Roles Innecesarios** (`ESPECIALISTA`, `CAJERO`, `APROBADOR_DEVOLUCIONES`, `SUPERVISOR_TESORERIA`, `SUPER_ADMIN_TECNICO`). | **CONFIRMADA** | En base de datos `sigd_jacobo_demo`, los roles de tesorería residuales están en `vigente = false`. No se crearán ni reactivarán. |
| **DEC-03** | **Separación Persona vs. Cuenta vs. Asignación vs. Rol** (Nacimiento de cuentas en `INACTIVO` con 0 roles). | **IMPLEMENTADA** | Verificada en el Cierre de Fase 1 (`INFORME_CIERRE_FINAL_FASE1_SIGD_B_JACOBO.md`). Código en `UsuariosAdminService.ts`. |
| **DEC-04** | **Resolución Dinámica de Autoridad en PostgreSQL** (Revocación inmediata en tiempo real sin esperar expiración de JWT). | **IMPLEMENTADA** | Verificada en `obtenerAutorizacionCuenta(pool, idUsuario)`. Evalúa `ur.vigente_hasta > now()` y estado activo en cada petición HTTP. |
| **DEC-05** | **Ámbito del Coordinador de Área** (Circunscrito a su Programa de Estudios o ampliable a su Unidad Académica según designación, sin acceso global). | **CONFIRMADA** | Delimitación expresa de ámbitos en V1.2.1. Permite flexibilidad organizativa sin otorgar privilegios globales. |
| **DEC-06** | **Capacidades Operativas Desacopladas y Relacionalmente Normalizadas** (`DOCENTE_EVALUADOR`, `GESTOR_APOYO_AREA`, `RECEPTOR_AREA`). | **IMPLEMENTADA (TSK-1.0A)** | Modelo relacional puro en `sigd_org.capacidad_sistema`, `sigd_org.capacidad_permiso` y `sigd_org.usuario_capacidad`, reutilizando el catálogo institucional `sigd_org.permiso_sistema` (sin JSONB). `DOCENTE_EVALUADOR` implementado con historial y doble índice único parcial en `sigd_rut.expediente_evaluador` (`WHERE activo = TRUE`). `RECEPTOR_AREA` adoptado como permiso institucional de área `EXPEDIENTE_RECEPCIONAR`. |
| **DEC-07** | **Segregación Estudiante vs. Ciudadano** (`ESTUDIANTE` interno con identidad académica sin exigir dominio institucional obligatorio; `CIUDADANO` externo). | **CONFIRMADA** | Separa el canal de atención interna del portal de recepción externa ciudadana. |
| **DEC-08** | **Modelo Contextual Endurecido de Múltiples Asignaciones por Cuenta** (`UNA PERSONA → UNA CUENTA → MÚLTIPLES ASIGNACIONES → UN CONTEXTO ACTIVO POR SESIÓN`). | **IMPLEMENTADA (TSK-1.0A)** | Implementado en backend (`contexto.service.ts`, `jwt.service.ts`, `auth.guard.ts`, `auth.router.ts`) y frontend (`authStore.ts`, `SelectorContextoModal.tsx`, `SelectorContextoPill.tsx`, `LoginPage.tsx`). Login no preselecciona silenciosamente si hay >1 contextos (`requiereSeleccionContexto: true`, `permisos: []`). Claim `ctx` firmado en JWT con verificación anti-spoofing frente al header `x-contexto-id`. Rotación y revocación segura de sesión. 17 pruebas unitarias aprobadas. |

### 2.2. Trazabilidad, Flujogramas y RutaDoc

| Código | Decisión Evaluada | Clasificación | Fundamento y Evidencia Técnica |
| :--- | :--- | :---: | :--- |
| **DEC-09** | **La Cuádruple Separación en Trazabilidad** (Estado procesal, Custodia institucional, Responsable operativo y Estado de notificación). | **CONFIRMADA** | Principio rector adoptado de Geric para evitar pérdida de trazabilidad en suplencias y notificaciones. |
| **DEC-10** | **Historial Append-Only en `sigd_rut.movimiento_tramite`** (Prohibición de `UPDATE`/`DELETE` en movimientos históricos; correcciones como nuevos eventos). | **PARCIAL** | Tabla particionada y triggers existentes; falta blindar a nivel de API la inmutabilidad absoluta de proveídos anteriores. |
| **DEC-11** | **Reasignación Auditada con Motivo Obligatorio** (La reasignación conserva historial y no cambia estado ni custodia). | **CONFIRMADA / IMPLEMENTADA PARCIAL (TSK-1.0A)** | Modelo relacional e índices parciales para evaluadores implementados en migración canónica `20261111_tsk1_0_rbac_contextual.sql`. Servicios de reasignación en controller listos para Fase 3. |
| **DEC-12** | **Flujos Adaptados a TUPA (No Monolíticos)** (Aprobación automática, desistimientos, suspensiones, devoluciones). | **CONFIRMADA** | El motor de estados debe reflejar la diversidad de procedimientos reglamentarios del TUPA 2026. |
| **DEC-13** | **No Universalidad de Plazos Administrativos** (Plazos fijados según la ficha TUPA de cada procedimiento, no plazos universales de 48h/10d). | **CONFIRMADA** | Se erradica la generalización arbitraria de plazos. Todo plazo no comprobado en TUPA se clasifica como `PENDIENTE`. |

### 2.3. Criptografía, Documentación y Almacenamiento (DocuCore)

| Código | Decisión Evaluada | Clasificación | Fundamento y Evidencia Técnica |
| :--- | :--- | :---: | :--- |
| **DEC-14** | **Segregación Criptográfica Estricta** (CVD != QR != SHA-256 != HMAC != Firma Digital PAdES). | **CONFIRMADA** | El CVD no sustituye la firma digital y el QR no acredita por sí mismo la autenticidad. La verificación produce resultados independientes. |
| **DEC-15** | **CVD Crockford Base32 de 128 Bits de Entropía Pura** (`SZ26-[0-7]...`). | **CONFIRMADA** | Reemplaza el formato legacy `CVD-YYYY-...` para garantizar un espacio de $2^{128}$ estados ($64\times$ mayor que UUIDv4). |
| **DEC-16** | **Token de Autenticación HMAC en QR** (`v1:kid:cvd` para habilitar acceso seguro Nivel 2). | **CONFIRMADA** | Especificación técnica consolidada en RF-QR-01/02. Pendiente de codificar en backend. |
| **DEC-17** | **Modo de Resiliencia `VERIFICACIÓN PARCIAL`** (HTTP 200 con datos de PostgreSQL ante caída de MinIO). | **CONFIRMADA** | Elimina el fallo HTTP 503 de la implementación previa cuando el storage S3 está degradado. |
| **DEC-18** | **Saga Transaccional PostgreSQL–MinIO con Compensación** (Rollback distribuido para evitar huérfanos). | **PARCIAL** | Integración S3 `@aws-sdk/client-s3` existe; la orquestación de compensación formal está pendiente de codificación. |

### 2.4. Infraestructura, Notificaciones y Tesorería

| Código | Decisión Evaluada | Clasificación | Fundamento y Evidencia Técnica |
| :--- | :--- | :---: | :--- |
| **DEC-19** | **Régimen Legal de Notificaciones** (Depósito en Casilla != Eficacia legal automática; régimen LPAG art. 20-25 con 4 evidencias). | **CONFIRMADA** | Evita contingencias de nulidad procesal por notificaciones defectuosas. |
| **DEC-20** | **Control de Concentración y Conciliación Estricta en Tesorería** (Incompatibilidad de auto-operación y trazabilidad WORM; rol único `TESORERO` con sus 9 permisos atómicos históricos reales). | **CONFIRMADA / IMPLEMENTADA (TSK-1.0B)** | Preservación de los 9 permisos históricos atómicos en BD y código (`TESORERIA_PAGO_VERIFICAR`, `TESORERIA_PAGO_REGISTRAR`, `TESORERIA_LEER`, `TESORERIA_REPORTES`, `TESORERIA_DEVOLUCION_EVALUAR`, `TESORERIA_DEVOLUCION_APROBAR`, `TESORERIA_DEVOLUCION_EJECUTAR`, `TESORERIA_TARIFA_PROPONER`, `TESORERIA_TARIFA_VALIDAR`). Permisos documentarios circunscritos estrictamente al área de Tesorería (`ambito = 'AREA'`), con prohibición de acceso a bandejas académicas. |
| **DEC-21** | **Doble Aprobación para Devoluciones de Tesorería que Superen Monto Umbral** (Visación de Dirección/Administración). | **PROPUESTA** | Recomendación de control financiero sujeta a la fijación del monto umbral por la Dirección. |
| **DEC-22** | **Conciliación Forense de Cuentas ESPECIALISTA** (Descarte de cargos ficticios no documentados y congelamiento de reasignaciones). | **CONFIRMADA / IMPLEMENTADA (TSK-1.0B)** | De las 6 asignaciones históricas: 2 están expiradas (milisegundos en tests H2), 1 pertenece a cuenta inactiva, y 2 son cuentas de sandbox funcional (`operador.demo` y `especialista.demo`) que permanecen pendientes de confirmación institucional. Cero reasignaciones ejecutadas en BD activa. |
| **DEC-23** | **Blindaje de Script de Rollback frente a Chequeo Relacional** (Tolerancia condicional en `chk_rol_codigo` si existen asignaciones asociadas). | **IMPLEMENTADA (TSK-1.0B)** | Bloque `DO $$` en rollback que detecta si `v_asignaciones > 0`, tolerando códigos desactivados para evitar aborto de transacción por chequeo relacional al restaurar el constraint. |
| **DEC-24** | **Revocación Inmediata de Autorizaciones y Sesiones (Política B)** (Sustitución formal de la antigua política de conservación de permisos hasta logout. Retiro de rol o capacidad con efecto inmediato en peticiones subsiguientes; desactivación atómica de cuenta con revocación de todas las sesiones activas en todos los dispositivos; recálculo inmediato por cambio de ámbito). | **CONFIRMADA / IMPLEMENTADA (TSK-1.0C)** | Implementado en `auth.guard.ts` (`obtenerAutorizacionCuenta`, `exigirContextoValido`), `usuariosAdmin.service.ts` (`actualizarUsuario`, `revocarRol`, `revocarCapacidad`, `asignarCapacidad`), controllers de rutas protegidas y `authStore.ts`. Emisión de 403 `CONTEXT_REVOKED` ante contextos desvinculados, preservación de contextos alternos válidos, bloqueo pesimista `FOR UPDATE` contra carreras administrativas y auditoría WORM en `sigd_audit.bitacora_auditoria`. 17 pruebas unitarias certificadas en `rbac-revocacion-inmediata-tsk10c.spec.ts`. |

---

## 3. REGISTRO DE DECISIONES INSTITUCIONALES PENDIENTES (COMITÉ/DIRECCIÓN)

Estas materias corresponden a la esfera de gobierno institucional del IESTP Suiza y **no deben ser asumidas unilateralmente como aprobaciones técnicas**:

| Código | Asunto Institucional Pendiente | Impacto en el Sistema | Estado Actual |
| :--- | :--- | :--- | :---: |
| **H-03** | **Aprobación de la Tabla de Retención Documental (TRD)** | Define las series documentales y los plazos de conservación antes del pase a Archivo Histórico o expurgo. | **PENDIENTE** |
| **H-05** | **Infraestructura para Replicación Física y Servidor Secundario** | Permite activar el modo PITR (Point-In-Time Recovery) y alta disponibilidad en PostgreSQL de producción. | **PENDIENTE** |
| **H-11** | **Resolución Directoral de Designación de Roles Clave** | Formaliza qué servidores asumirán las funciones de Administrador, Tesorero y custodios de certificados. | **PENDIENTE** |
| **H-12** | **Política Institucional de Transparencia de Metadatos en Verificación QR** | Fija qué datos de un trámite son públicos y cuáles se reservan cuando el ciudadano escanea el QR sin HMAC. | **PENDIENTE** |
| **H-14** | **Umbral Monetario para Doble Aprobación de Devoluciones** | Define a partir de qué monto una devolución evaluada por el Tesorero requiere firma de Dirección. | **PENDIENTE** |
| **H-15** | **Validación de Plazos Específicos de Procedimientos No Estandarizados en TUPA** | Plazos de subsanación de trámites no detallados en el catálogo 2026. | **PENDIENTE** |
