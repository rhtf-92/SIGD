# WORKING-CONTEXT.md (SIGD 2026 - IESTP Suiza)

> **Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)  
> **Rama de Trabajo:** `B_GERIC`  
> **Commit Base Certificado:** `9bc201e74bd8a99af66dca350814d31af13ca25e`  
> **Fecha de Actualización:** 24 de Octubre de 2026

---

## 1. Stack Tecnológico Canónico
- **Runtime:** Node.js v24.17.0 (LTS Iron).
- **Backend:** Express 5.1, TypeScript 5 (NodeNext ESM), PostgreSQL (`pg` 8.14) con conexión a Docker PostgreSQL 18.6 (`sigd_prueba` en puerto 5432 / WSL2 IP `172.20.157.19:5432`), Redis 7, MinIO S3 API.
- **Frontend:** React 18, Vite 6.4, TypeScript 5, Tailwind CSS, TanStack Query 5, React Router DOM 6.
- **Criptografía y Autenticación:** Argon2id nativo (`m=65536, t=3, p=4`), JWT nativo HMAC-SHA256 (`src/core/auth/jwt.service.ts`).

---

## 2. Segmentación Modular y Matriz RBAC Canónica

### 2.1 Roles Canónicos (7)
1. `CIUDADANO`
2. `MESA_PARTES`
3. `ESPECIALISTA`
4. `SECRETARIO`
5. `DIRECTOR`
6. `ADMINISTRADOR`
7. `TESORERIA`

### 2.2 Segmentación de Rutas y Destinos Post-Login
- **Módulos Públicos (Sin JWT):**
  - `/` (Inicio)
  - `/login` (Iniciar Sesión)
  - `/registro` (Registro Ciudadano)
  - `/consulta` y `/consulta/:cut` (Consulta Pública con minimización de datos Ley 29733)
  - `/validador-cvd` (Verificador público de Código de Verificación Digital)
  - `/flujo-validez-legal` (Centro de Coordinación Módulo 04)
  - `/acceso-denegado` (Página de bloqueo)
- **Ciudadano Autenticado (`CIUDADANO`):**
  - Destino post-login: `/tramite`
  - `/tramite` (Mesa de Partes Virtual 24/7)
  - `/mis-expedientes` (Consulta estricta de expedientes propios, endpoint `/api/v1/tramites/mis-expedientes` protegido contra BOLA)
  - `/casilla` (Casilla Electrónica Ciudadana)
- **Mesa de Partes (`MESA_PARTES`):**
  - Destino post-login: `/tramite/ventanilla-presencial`
  - `/tramite/ventanilla-presencial` (Ventanilla física presencial, búsqueda de ciudadano y ticket térmico)
  - `/expedientes` y `/expedientes/:id` (Bandeja institucional y generación de orden de pago)
- **Tesorería (`TESORERIA`):**
  - Destino post-login: `/tesoreria`
  - `/tesoreria` (Bandeja de órdenes, cobro Efectivo con vuelto, Yape asistido, emisión de recibos oficiales)
- **Especialista (`ESPECIALISTA`):**
  - Destino post-login: `/expedientes`
  - `/expedientes` y `/expedientes/:id` (Revisión y derivación)
- **Secretario (`SECRETARIO`):**
  - Destino post-login: `/expedientes`
  - `/expedientes` y `/expedientes/:id` (Derivación y acumulación)
- **Director (`DIRECTOR`):**
  - Destino post-login: `/reportes/dashboard`
  - `/reportes` y `/reportes/dashboard` (Tablero Directivo Ejecutivo)
  - `/expedientes` y `/expedientes/:id` (Supervisión institucional)
- **Administrador (`ADMINISTRADOR`):**
  - Destino post-login: `/administracion`
  - `/administracion/*` (Panel de Administración)
  - `/calendarizacion-institucional` (Calendario Laboral)
  - `/tesoreria` (Control institucional de órdenes)
  - `/expedientes` y `/expedientes/:id`
  - `/tramite/ventanilla-presencial`
  - `/reportes/dashboard`

---

## 3. Cuentas de Laboratorio Idempotentes (`npm run seed:lab`)
- `ciudadano_demo` (`CIUDADANO`, Área: N/A) -> Contraseña: `CiudadanoDemo#2026` (Variable: `LAB_CIUDADANO_PASSWORD`)
- `mesa_partes_demo` (`MESA_PARTES`, Área: `DIR`) -> Contraseña: `MesaPartesDemo#2026` (Variable: `LAB_MESA_PARTES_PASSWORD`)
- `especialista_demo` (`ESPECIALISTA`, Área: `SDA`) -> Contraseña: `EspecialistaDemo#2026` (Variable: `LAB_ESPECIALISTA_PASSWORD`)
- `secretario_demo` (`SECRETARIO`, Área: `SDA`) -> Contraseña: `SecretarioDemo#2026` (Variable: `LAB_SECRETARIO_PASSWORD`)
- `director_demo` (`DIRECTOR`, Área: `DIR`) -> Contraseña: `DirectorDemo#2026` (Variable: `LAB_DIRECTOR_PASSWORD`)
- `administrador_demo` (`ADMINISTRADOR`, Área: `DIR`) -> Contraseña: `AdministradorDemo#2026` (Variable: `LAB_ADMINISTRADOR_PASSWORD`)
- `tesoreria_demo` (`TESORERIA`, Área: `DIR`) -> Contraseña: `TesoreriaDemo#2026` (Variable: `LAB_TESORERIA_PASSWORD`)

Salvaguradas: Aborta inmediatamente si `NODE_ENV === 'production'`.

---

## 4. Reglas Críticas de Seguridad
1. **BOLA Protection:** Prohibida la inyección de `idPersona` en queries/bodies de `/api/v1/tramites/mis-expedientes`. Se resuelve exclusivamente desde `claims.sub` en la cuenta de usuario.
2. **Storage Download:** Prohibido abrir `GET /api/v1/storage/download/:bucket/:key` como endpoint público general; debe conservar salvaguardas BOLA y autorización estricta.
3. **Fail-Closed Frontend:** Rutas no autorizadas redirigen inmediatamente a `/acceso-denegado` o `/login`.
4. **Contexto de Login al solicitar acceso TUPA:** Al navegar desde `/solicitud-acceso-tupa` se propaga `intent=SOLICITAR_ACCESO_TUPA` y `from=/solicitud-acceso-tupa`.
   - `CIUDADANO`: Retorna a `/solicitud-acceso-tupa` conservando sesión para completar la solicitud.
   - Cuentas Institucionales (`ADMINISTRADOR`, `MESA_PARTES`, `DIRECTOR`, `SECRETARIO`, `ESPECIALISTA`): No redirigen a su panel habitual ni crean solicitudes; despliegan la pantalla informativa "Acceso institucional detectado" con opciones directas hacia `/tupa` y `/`.
   - Backend Fail-Closed: Los endpoints `POST /api/v1/tramites/tupa/acceso/solicitar` y `/solicitudes` bloquean de forma determinista la creación desde cuentas institucionales con HTTP 400 y código `TUPA_ACCESS_ALREADY_GRANTED_BY_ROLE`.

---

## 5. Doble Representación Canónica del TUPA 2026
1. **Copia Oficial Escaneada (Respaldo Documental en MinIO/S3):**
   - Archivo físico: `sigd-expedientes` key `tupa/2026/TUPA_2026_OFICIAL.pdf` (1,375,801 bytes, SHA-256: `4642d10722bd0b027f41215c2f5f4a05c9ef6992cd0d987e44c6edc1f4d6560f`).
   - La base de datos (`sigd_doc.tupa_version`) almacena únicamente metadatos: storage key, nombre, checksum SHA-256, mime, tamaño y cargador.
   - Migración 17 aditiva (`17_sigd_tupa_documento_oficial.sql`) y bitácora de auditoría histórica inmutable (`sigd_doc.tupa_documento_oficial_historial`).
   - El reemplazo solo actualiza el archivo en MinIO y genera una traza en la bitácora sin afectar la BD relacional.
2. **Catálogo Estructurado (Base de Datos PostgreSQL):**
   - 72 entradas estructuradas independientes (18 con CUT/Expediente, 49 solicitudes no documentarias SOL, 5 internas).
   - Utilizado directamente por Mesa de Partes Virtual y Ventanilla Presencial.
3. **Gestión en `/administracion/tupa` (4 Pestañas):**
   - `[Resumen]`: Métricas consolidadas (72 total, 18 CUT, 49 SOL, 5 internas), principio de doble representación y estado de vinculación.
   - `[Copia oficial]`: Metadatos documentales, integridad SHA-256 con botón copiar, botones `[Ver PDF]` (visor modal) y `[Descargar PDF]` (URL prefirmada), botón `[Reemplazar copia oficial]` (exclusivo `ADMINISTRADOR` con motivo y auditoría) y bitácora histórica.
   - `[Catálogo estructurado]`: Buscador, filtros y tabla de 72 procedimientos con edición en borrador.
   - `[Historial de versiones]`: Navegación entre versiones históricas/vigente y modal para nueva versión borrador.

---

## 6. Módulo de Tesorería y Control de Pagos TUPA
1. **Tabla y Correlativos Atómicos:**
   - Tabla `sigd_tra.orden_pago` con secuencias de BD `seq_orden_pago_correlativo` (`PAG-YYYY-NNNNNN`) y `seq_recibo_pago_correlativo` (`REC-YYYY-NNNNNN`).
   - Rol institucional canónico `'TESORERIA'` en `sigd_org.rol_sistema` y RBAC frontend (`ROLES_TESORERIA`).
2. **Integración con FSM y Derivación:**
   - Trámites TUPA con arancel (`costo > 0`): derivación bloqueada deterministamente con HTTP 409 `PAGO_PENDIENTE` si no existe pago confirmado.
   - Trámites de control gratuitos (`costo = 0`): derivación habilitada inmediatamente sin requerir orden de pago.
3. **Caja y Recaudación:**
   - Cobro en Efectivo con cálculo en tiempo real de vuelto y validación de monto recibido.
   - Cobro digital asistido por Yape con verificación de número de operación y QR institucional.
   - Emisión de comprobante oficial de caja con trazabilidad inmutable, outbox event `PAGO_CONFIRMADO` y bitácora de auditoría.
4. **Atención Presencial:**
   - Búsqueda administrativa de administrados por Tipo + Número de documento (`/api/v1/mesa-partes/personas/buscar`) reservada a `MESA_PARTES` y `ADMINISTRADOR`, con minimización de datos y checkbox de verificación de documento físico.
5. **Cierre Funcional Pre-Demo y Herramientas:**
   - Reset de base de datos de desarrollo mediante herramienta `backend/src/tools/reset-demo-dev.ts` (`npm run db:reset-demo`) con bypass controlado de triggers WORM (`DISABLE TRIGGER ALL`), preservación intacta del catálogo TUPA 2026 (72 procedimientos) y cuentas institucionales/demo, reiniciando correlativos a 1 (`EXP-2026-000001`, `PAG-2026-000001`, `REC-2026-000001`).
   - Activo personal QR Yape (`yape-qr-demo.png`) integrado bajo `frontend/public/local-assets/` y excluido estrictamente en `.gitignore` mediante configuración de entorno `VITE_YAPE_QR_PATH`.
   - Manejo numérico robusto en backend para montos de procedimientos TUPA (`sigd_doc.tupa_procedimiento.monto` y sanitización regex de textos `S/ ...`), previniendo errores de casteo en PostgreSQL.
   - Aceptación de UUIDs canónicos estándar en DTOs de derivación (`REGEX_UUID`) para compatibilidad con identificadores de semillas/fixtures del sistema.
   - Verificación E2E real en vivo aprobada: Bloqueo 409 por pago pendiente -> Pago asistido por Yape con registro de operación -> Emisión de Constancia de Pago / Recibo Interno de Tesorería -> Desbloqueo y derivación exitosa -> Consulta ciudadana y en ventanilla por DNI.
   - *Nota:* Este archivo `WORKING-CONTEXT.md` se mantiene para memoria contextual local y está expresamente excluido de commits y stage.
5. **Integración QR Automático — TAYPI Sandbox (Migración 22):**
   - Migración relacional `22_sigd_tesoreria_taypi_sandbox.sql` (`chk_tra_orden_pago_metodo` actualizado con `QR_AUTOMATICO_SANDBOX`, columnas de proveedor y webhook: `payment_provider`, `provider_payment_id`, `provider_checkout_token`, `provider_qr_image`, `provider_checkout_url`, `provider_status`, `provider_expires_at`, `confirmed_source`, `provider_reference`, índice `idx_tra_orden_pago_provider_payment_id`).
   - Captura no intrusiva de `req.rawBody` en `express.json({ verify })` en `backend/src/app.ts` para validación criptográfica HMAC-SHA256 con `crypto.timingSafeEqual` ante webhooks de TAYPI (`POST /api/v1/webhooks/taypi`).
   - Confirmación transaccional con bloqueo pesimista `SELECT ... FOR UPDATE`, verificación de moneda `PEN` y monto exacto, emisión de correlativo `REC-YYYY-NNNNNN`, traza de auditoría, evento outbox `PAGO_CONFIRMADO` y transición FSM automática a `REGISTRADO` (desbloqueo de expediente).
   - Frontend Tesorería (`TesoreriaPage.tsx`) con 3 pestañas operativas (`Efectivo`, `Yape Asistido`, `QR Automático Sandbox`), polling defensivo en tiempo real con ejecución inmediata de verificación, renderizado de QR dinámico, botón de contingencia/regeneración ante expiración y enlace al simulador móvil de sandbox (`https://sandbox.taypi.pe/simulator`).
   - Guía de demostración documentada bajo `docs/TAYPI_SANDBOX_DEMO.md` sin exposición de credenciales sensibles.

---

## 7. Presentación Institucional y Scoping de Bandejas por Rol (RutaDoc)
1. **Mapeo Institucional de Áreas (`frontend/src/utils/areaPresentacion.ts`):**
   - Mapeo centralizado de UUIDs canónicos a badges accesibles y nombres institucionales claros:
     - `a0000000-0000-0000-0000-000000000001` -> Subdirección Académica (`SDA`).
     - `a0000000-0000-0000-0000-000000000002` -> Dirección General (`DIR`).
     - `null` / `undefined` -> Mesa de Partes (`MESA`).
   - Regla UI: Queda terminantemente prohibido exponer UUIDs crudos al usuario en headers, tablas o formularios de búsqueda.
2. **Scoping de Bandeja en Backend (`ServicioRutaDoc.listar`):**
   - Cuando el actor es `ESPECIALISTA` o `SECRETARIO` y no cuenta con rol de supervisión global (`ADMINISTRADOR`, `DIRECTOR`), el backend restringe por omisión `filtrosEfectivos.areaId = actor.unidadOrganicaId`.
   - Evita que roles de área operativa visualicen expedientes pendientes en Mesa de Partes que no han sido derivados a su despacho, previniendo errores 403 Forbidden al inspeccionar el detalle.
3. **Consistencia de Relación de Área en Base de Datos (`rutadoc.repository.ts`):**
   - Uso de `COALESCE(ultimo.area_actual_id, e.area_destino_id::text)` al vincular con `sigd_org.area` (`area_actual_nombre`, `area_actual_codigo`), garantizando seguimiento ininterrumpido a lo largo de transiciones de estado documentales.
4. **Compatibilidad Estricta de Pruebas de Integración (Vitest):**
   - Los títulos por rol en la bandeja de expedientes deben mantener el prefijo canónico `Bandeja de expedientes — [Subtítulo]`.
   - El campo de filtrado por área conserva `aria-label="Área UUID"` mientras exhibe etiquetas y selectores amigables para el usuario.
   - La pestaña por defecto se preserva en `PENDIENTES` para compatibilidad de suite.

---

## 8. Fase 5B — Identidad, Cuentas y Vínculos Institucionales (Migración 31 y 32)
1. **Separación Ontológica Estricta:**
   - `PERSONA` (`sigd_auth.persona`): Identidad civil biológica o legal (DNI, nombres, apellidos, correo, teléfono).
   - `CUENTA` (`sigd_auth.cuenta_usuario`): Credenciales y autenticación para acceso digital al sistema.
   - `VÍNCULO INSTITUCIONAL` (`sigd_auth.vinculo_institucional`): Relación jurídica temporal y clasificada con el IESTP (Postulante, Estudiante activo, Egresado, Titulado, Docente, Personal administrativo, Aliado externo).
   - `ASIGNACIÓN / CARGO` (`sigd_org.asignacion_personal`): Puesto orgánico operativo en la estructura jerárquica del instituto.
2. **Transición del Ciclo Académico y Simultaneidad:**
   - Soporta la evolución histórica de un estudiante: `POSTULANTE` -> `ESTUDIANTE_ACTIVO` -> `EGRESADO` -> `TITULADO`.
   - Permite múltiples vínculos activos simultáneos legítimos (ej. `TITULADO` + `DOCENTE`).
3. **Modelado en Base de Datos (Migración 31 y 32):**
   - Tablas creadas: `sigd_auth.tipo_vinculo_institucional` (catálogo con clasificación canónica) y `sigd_auth.vinculo_institucional`.
   - Constraints: `chk_vinculo_inst_estado` (`ACTIVO`, `FINALIZADO`, `ANULADO`), `chk_vinculo_inst_vigencia` (`fecha_fin >= fecha_inicio`), `chk_vinculo_inst_anulacion` (garantiza que anulaciones registren motivo y autor).
   - Índices en llaves foráneas: B-Tree en `persona_id`, `tipo_vinculo_id`, `programa_estudios_id` y `anulado_por` (previniendo table lock por FK).
4. **Seguridad y Minimización de Datos:**
   - BOLA mitigation: endpoint `/personas/:personaId/vinculos` restringido a `ADMINISTRADOR` o al propio titular si coincide el `personaId`.
   - Ley 29733: Vínculos anulados son filtrados para ciudadanos, y campos sensibles internos (`anulado_por`) se anonimizan (`null`) en vistas de administrados.
   - WORM Audit: Cada mutación transaccional registra evento en `sigd_audit.bitacora_auditoria`.

---

## 9. Fase 5C — Organización, Jerarquía y Responsabilidades Temporales (Migración 33)
1. **Separación Estructural vs. Temporal:**
   - `ÁREA` (`sigd_org.area`): Nodo en la jerarquía organizativa institucional modelado con `ltree` (`codigo_arbol`).
   - `CARGO` (`sigd_org.cargo`): Posición orgánica tipificada (`DIRECTOR_GENERAL`, `JEFE_UNIDAD`, `SECRETARIO_ACADEMICO`, `ESPECIALISTA`, etc.).
   - `ASIGNACIÓN DE PERSONAL` (`sigd_org.asignacion_personal`): Relación titular estructural entre una persona y un cargo con dedicación y vigencia.
   - `RESPONSABILIDAD TEMPORAL` (`sigd_org.responsabilidad_temporal`): Encargaturas, suplencias y delegaciones con acto resolutivo y alcance dinámico JSONB.
2. **Tipos de Responsabilidad Temporal:**
   - `ENCARGATURA`: Asume la titularidad interina de un área/cargo acéfalo o vacante.
   - `SUPLENCIA`: Reemplaza temporalmente al titular por ausencia justificada (licencia, comisión, etc.).
   - `DELEGACION`: Ejerce atribuciones específicas conferidas por el titular sin desplazar su titularidad.
3. **Inmutabilidad y Auditoría:**
   - Auditoría transaccional estricta mediante `sigd_audit.bitacora_auditoria`.
   - Estados de responsabilidad: `ACTIVA`, `FINALIZADA`, `REVOCADA`, `ANULADA` (con registro obligatorio de acto administrativo sustentatorio).

---

## 10. Fase 5D — Autorización Contextual, Perfiles Operativos y Segregación (Migraciones 34 y 35)
1. **Ecuación de Autorización Contextual:**
   $$\text{AUTORIZACIÓN} = \text{CUENTA} + \text{PERSONA} + \text{VÍNCULO} + \text{ASIGNACIÓN} + \text{RESPONSABILIDAD TEMPORAL} + \text{PERFIL OPERATIVO} + \text{ALCANCE} + \text{RECURSO} + \text{ACCIÓN} + \text{VIGENCIA}$$
2. **Principios de Seguridad Fail-Closed:**
   - Desacople estricto: Cuenta inactiva (`activo = false`) deniega inmediatamente toda autorización (`CUENTA_DESHABILITADA`).
   - Autoridad no demostrada en tiempo de ejecución resulta en HTTP 403 `ForbiddenError`.
   - Puente de compatibilidad transicional: Los roles RBAC JWT solo operan como prefiltros y permisos de lectura básica, pero NO confieren facultades sustantivas ni financieras definitivas.
3. **Perfiles Operativos Canónicos (`sigd_org.perfil_operativo`):**
   - `ADMINISTRADOR_SIGD`: Control técnico, gestión de infraestructura y administración orgánica. Requiere perfil activo para `ORGANIZACION_GESTIONAR`.
   - `APROBADOR_DIRECCION`: Aprobación institucional, resolución final de expedientes y suscripción directiva.
   - `GESTOR_RECEPCION_DOCUMENTAL`: Recepción, verificación, observación y calificación en ventanilla y mesa de partes (`DEVOLUCION_REVISAR`).
   - `AUTORIZADOR_DEVOLUCION` (Migración 35): Perfil funcional independiente (`DISEÑO_SIGD`) con competencia formal para autorizar solicitudes de devolución (`DEVOLUCION_AUTORIZAR`).
   - `GESTOR_AREA_ACADEMICA`: Gestión de expedientes en su área de competencia orgánica.
   - `GESTOR_ADMINISTRATIVO`: Gestión de apoyo, archivo y derivación interna.
   - `GESTOR_TESORERIA`: Recaudación, órdenes de pago, comprobantes y ejecución financiera de desembolsos (`DEVOLUCION_EJECUTAR`).
4. **Segregación Estricta de Funciones en Devoluciones (Casos A-I):**
   - Anti-Self-Approval: Solicitante no puede autorizar su devolución (`DENY`).
   - Segregación Ejecutora: Quien autoriza no puede ejecutar el desembolso (`DENY`).
   - Autoridad no asumida: `MESA_PARTES` legacy sin `AUTORIZADOR_DEVOLUCION` -> `DENY`.
   - Poder técnico acotado: `ADMINISTRADOR` sin perfil sustantivo -> `DENY`.
   - Ejecución condicionada: `TESORERIA` legacy sin `GESTOR_TESORERIA` -> `DENY`.
   - Temporalidad y vigencia: Perfil vencido (`vigente_hasta <= now()`) -> `DENY`.
   - Integridad de cuenta: Cuenta deshabilitada (`activo = false`) -> `DENY`.
5. **Adopción en Organización:**
   - Mutaciones de unidades orgánicas, cargos, asignaciones y responsabilidades temporales protegidas con `ORGANIZACION_GESTIONAR` vía `AuthorizationService`.

---

## 11. Fase 5E — TUPA Operativo, Versionado y Trazabilidad Histórica (Migración 36)
1. **Inmutabilidad Absoluta del TUPA Histórico:**
   - Regla institucional: `SIGD no reescribe el TUPA histórico`.
   - Una versión en estado `VIGENTE` o `HISTORICO` queda terminantemente bloqueada contra edición directa de sus procedimientos (`ConflictError` en backend y salvaguardas transaccionales).
   - Cualquier modificación (tarifas, requisitos, plazos, denominaciones) exige crear una nueva versión o revisión en estado `BORRADOR` (vía clonación o creación incremental).
2. **Ciclo de Vida de Versiones y Revisiones Intra-anuales:**
   - Estados canónicos: `BORRADOR`, `PENDIENTE_VALIDACION`, `VIGENTE`, `HISTORICO`, `ANULADO`.
   - Soporte de múltiples revisiones en un mismo ejercicio fiscal: restricción de unicidad compuesta `uq_tupa_version_anio_revision (anio, revision)` (ej. `2027 R1`, `2027 R2`).
   - Activación atómica con Advisory Lock (`987654330`): la activación de una nueva versión archiva la versión vigente previa a `HISTORICO` con `vigente_hasta = fechaActivacion` y activa la nueva versión con `vigente_desde = fechaActivacion`.
3. **Clasificación Operativa Canónica (7 Categorías):**
   - `PROCEDIMIENTO_APROBADO`: Procedimientos formales institucionales.
   - `SERVICIO_ACADEMICO`: Constancias, certificados, duplicados, solicitudes académicas.
   - `SERVICIO_ADMINISTRATIVO`: Trámites administrativos internos o de gestión.
   - `SOLICITUD_NO_DOCUMENTARIA`: Solicitudes operativas o atenciones sin expediente formal.
   - `TRAMITE_INTERNO`: Trámites de uso exclusivo entre dependencias.
   - `TRAMITE_URGENTE`: Procedimientos de atención prioritaria.
   - `OTRO`: Procedimientos excepcionales o residuales.
4. **Desacople Semántico: `genera_expediente` !== `requiere_pago`:**
   - Existen trámites con expediente formal gratuitos (`genera_expediente = true`, `monto = 0`).
   - Existen servicios de pago directo en ventanilla sin apertura de expediente documentario (`genera_expediente = false`, `monto > 0`).
   - Existen trámites gratuitos sin expediente (`genera_expediente = false`, `monto = 0`) y trámites documentarios arancelados (`genera_expediente = true`, `monto > 0`).
5. **Vinculación Histórica e Inmutabilidad de Expedientes (Snapshots WORM):**
   - Cada expediente radicado queda vinculado de forma vitalicia a la versión TUPA y procedimiento vigentes en el instante exacto de su presentación (`sigd_doc.expediente_tupa_vinculo`).
   - Los triggers de base de datos `tr_tupa_vinculo_inmutable` y `tr_tupa_vinculo_no_truncar` impiden cualquier modificación (`UPDATE`), eliminación (`DELETE`) o truncado (`TRUNCATE`) del vínculo histórico.
   - Cambios de arancel o denominación en versiones posteriores (ej. TUPA 2027) no alteran el monto, requisitos ni versión del expediente radicado bajo TUPA 2026.
6. **Diferenciador Estructurado de Versiones (`Diff`):**
   - Servicio comparador campo por campo (`obtenerDiffVersiones`) entre dos versiones cualesquiera (`A` y `B`).
   - Clasificación determinista de cambios: `agregados`, `eliminados`, `modificados` (con desglose `campo`, `antes`, `despues`), y `sinCambios`.
7. **Autorización Contextual 5D:**
   - Permiso `TUPA_GESTIONAR`: Permite listar versiones completas, crear borradores, clonar versiones, modificar procedimientos en borrador e inspeccionar diffs. Asignado al perfil operativo `GESTOR_TUPA`.
   - Permiso `TUPA_ACTIVAR`: Exclusivo para autorizar la publicación y activación de versiones TUPA en producción. Reservado a `APROBADOR_TUPA` / `APROBADOR_DIRECCION`.
   - Fail-closed: El rol técnico `ADMINISTRADOR_SIGD` carece de autoridad para activar versiones en caliente sin contar con el perfil de aprobación sustantiva. Cuentas inactivas o tokens inválidos son rechazados con HTTP 403 / 401.

---

## 12. Fase C3 — Pre-Enrutamiento TUPA, Responsables Operativos y Homologación Técnica (Migraciones 46, 47, 48, 49)
1. **Doble Capa de Gobierno TUPA:**
   - Capa A (Versión Institucional): `sigd_doc.tupa_version` en estado `VIGENTE` o `HISTORICO`.
   - Capa B (Procedencia Técnica): `sigd_doc.tupa_registro_version` con `estado_validacion = 'APROBADO'` y referencia sustentatoria inmutable.
   - El trigger `sigd_doc.fn_tupa_vinculo_validar()` bloquea cualquier radicación si el procedimiento no posee `estado_validacion = 'APROBADO'`.
2. **Homologación Técnica 72/72 (Migración 49):**
   - Los 18 procedimientos del prototipo inicial conservan: `referencia_aprobacion = 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1'`.
   - Los 54 procedimientos complementarios fueron formalmente homologados bajo: `referencia_aprobacion = 'HOMOLOGACION_TECNICA_SIGD:TUPA-SUIZA-2026:C3.3'`.
   - Radicabilidad plena demostrada: 72 / 72 procedimientos superan `fn_tupa_vinculo_validar()`.
3. **Reglas Operativas de Pre-enrutamiento y Derivación:**
   - Mesa de Partes (DIR) recibe físicamente toda radicación externa.
   - El pre-enrutamiento (`GET /api/v1/expedientes/:id/destino-tupa`) resuelve automáticamente la unidad responsable técnica (`SDA` para académicos con `GESTOR_AREA_ACADEMICA`, `DIR` para administrativos con `GESTOR_ADMINISTRATIVO`).
   - Anti-Autoatención (`CONFLICTO_INTERES_EXPEDIENTE_PROPIO`): el solicitante no puede derivar su propio trámite (HTTP 403).
   - Desviación Motivada (`JUSTIFICACION_DESVIACION_REQUERIDA`): si el operador deriva a un área distinta de la unidad responsable TUPA, se exige obligatoriamente una justificación motivada (mínimo 10 caracteres) y se registra el evento outbox `DesviacionDestinoTupaRegistrada`.
   - Destino no enrutable: Si el área de destino no cuenta con personal operativo activo y vigente, la derivación se rechaza con HTTP 422 `AREA_NO_ENRUTABLE`.
   - Asignación formal: La asignación individual de un expediente debe realizarse a través del servicio formal `POST /api/v1/expedientes/:id/asignar` (asignación embebida prohibida).
4. **Integridad Criptográfica de Migraciones:**
   - Migración 48: `bdc1b3dc3f30a6eef20d9fafa5ca1a103c64b5e8cd0e5b5a01e86f3fff242bb3` (MATCH).
   - Migración 49: `c7950761359c51b3f191408aa6342dfb7ae23b8b0087e52805f4cf79dd2cc64b` (MATCH).
5. **Fase C3.5 — Coherencia de Radicación y `genera_expediente`:**
   - Principio ontológico: `RESOLVER DESTINO ≠ AUTORIZAR RADICACIÓN` y `HOMOLOGACIÓN ≠ RADICACIÓN`.
   - Homologación técnica 72/72 en `APROBADO` certifica procedencia y requisitos; no obliga a que todo trámite abra expediente documentario SIGD.
   - Centralización de dominio en `TupaVersionRepository.validarElegibilidadRadicacion`:
     * `genera_expediente === true` -> ALLOW (18 procedimientos documentarios abren expediente y CUT).
     * `genera_expediente === false` -> DENY con HTTP 409 `PROCEDIMIENTO_NO_GENERA_EXPEDIENTE` (49 procedimientos operativos/servicios directos). Cero mutaciones.
     * `genera_expediente === null` -> DENY con HTTP 409 `RADICACION_TUPA_NO_DETERMINADA` (5 procedimientos fail-closed). Cero mutaciones.
   - Todos los puntos de entrada backend (`radicacion-virtual`, `ventanilla-presencial`, `mesa-partes-digital`) invocan esta validación dentro de la transacción ANTES de `CutService.generar()` y antes de cualquier persistencia.
   - `TupaDestinoService.resolverDestinoProcedimiento` resuelve deterministamente el destino institucional (`SDA`, `DIR`) y enrutabilidad para los 72 procedimientos sin crear expedientes dummy.
   - Suite de integración C3 ampliada a 18 casos con 18/18 PASS y 0 FAIL.
6. **Certificación Final de Regresión y Armonización de Arnés C3:**
   - Frontend: Normalizado `justificacionDesviacion: valor.justificacionDesviacion ?? ''` en `DerivacionModal.tsx` resolviendo tipado estricto `string`.
   - Backend Unit Mocks: Fixtures sintéticos en `fase2-mesa-partes-vinculacion.spec.ts`, `radicacion-orden-pago.spec.ts`, `ventanilla-integridad-identidad.spec.ts` y `workflow-derivaciones-5g.spec.ts` alineados contractualmente al validador C3.5 (`validarElegibilidadRadicacion`) y pre-enrutamiento TUPA.
   - Concurrencia Vitest: Configurado `testTimeout: 15000` en `backend/vitest.unit.config.ts` mitigando saturación de CPU por Argon2id native en Windows.
   - Estado Certificado: 100% de suites en verde (Frontend: 878/878 PASS; Backend unit: 1247/1247 PASS; Backend C3 física: 18/18 PASS; Backend C0, C1, C2, 5K.1, 5K.2: 100% PASS; Typecheck y Build: 0 errores).

---

## 13. Fase C3.6 — Circuito Operativo Real por TUPA (Migración 50 y Motor Workflow)
1. **Principio Canónico Institucional:**
   - `ÁREA ≠ ROL ≠ PERFIL ≠ FUNCIÓN ≠ PASO DE WORKFLOW`.
   - Solo existen dos áreas institucionales operativas físicas: Dirección General (`DIR`) y Subdirección Académica (`SDA`). No se crean áreas artificiales por trámite.
2. **Migración 50 (`50_sigd_workflow_tupa_circuitos.sql`):**
   - Registrada y aplicada con hash SHA-256 verificado y script de rollback idempotente.
   - 3 Definiciones canónicas: `WF_TUPA_DOC_SDA_DIR` (Patrón 1: SDA -> DIR), `WF_TUPA_DOC_DIR_DIR` (Patrón 2: DIR -> DIR), `WF_TUPA_DOC_SDA_SDA` (Patrón 3: SDA -> SDA).
   - 3 Versiones V1.0 con 6 pasos estructurados: `REVISION_REQUISITOS`, `VALIDACION_PAGO`, `DERIVACION_AREA`, `ATENCION_TECNICA`, `APROBACION_FIRMA`, `ARCHIVO`.
   - 18 Mapeos de procedimientos documentarios (`genera_expediente = true`): 15 en Patrón 1, 1 en Patrón 2, 2 en Patrón 3.
3. **Piloto Completo Certificado (10 Pasos):**
   - Procedimiento: `p1-fila-06` ("Certificado de Suficiencia de Idioma Inglés").
   - Flujo Institucional: Mesa Pública (Virtual) -> Mesa de Partes interna (DIR) -> Calificación Documental -> Emisión Orden de Pago (S/ 100) -> Pago Confirmado en Tesorería -> Derivación Formal a SDA -> Asignación a Especialista -> Calificación y Envío a Firma -> Firma Electrónica Sandbox y Resolución por Director General -> Notificación vía Outbox (`PAGO_CONFIRMADO`, `ExpedienteAtendido`) -> Archivado Físico con ubicación (Estante, Balda, Caja).
4. **Bypass Legítimo de Tesorería:**
   - Procedimientos con `monto = 0` / `NO_REQUIERE_PAGO` omiten la intervención de Tesorería y habilitan la derivación directa tras la revisión documental.
5. **Circuito de Observación y Subsanación:**
   - La observación documentaria congela los plazos y transiciona el expediente a `OBSERVADO`. La subsanación ciudadana lo devuelve a `EN_REVISION` para reevaluación.
6. **Segregación de Funciones y Fail-Closed:**
   - Derivación bloqueada si el pago está pendiente (HTTP 409 `PAGO_PENDIENTE`).
   - Bloqueo determinista de autoatención (HTTP 403) para administrados y ciudadanos intentando derivar o resolver sus propios trámites.
7. **Estado de Regresión Integral:**
   - Suite C3.6: 5 / 5 PASS (0 FAIL).
   - Suite C3: 18 / 18 PASS (0 FAIL).
   - Suite C2: 20 / 20 PASS (0 FAIL).
   - Suite C1: 9 / 9 PASS (0 FAIL).
   - Suite C0: 19 / 19 PASS (0 FAIL).
   - Suites 5K.1 y 5K.2: 23 / 23 PASS (0 FAIL).
   - Backend Unit Tests: 1,247 / 1,247 PASS (0 FAIL across 88 suites).
   - Frontend Test Suite: 878 / 878 PASS (0 FAIL across 97 suites).
   - Typecheck y Builds (Backend y Frontend): 0 errores.

---

## 14. Fase C3.6.2: Cierre Funcional de Gate de Requisitos y FSM Subsanado (Certificado)
1. **Gate Documental Obligatorio (`C3_6_HALLAZGO_GATE_REQUISITOS`):**
   - El endpoint `POST /api/v1/expedientes/:id/derivar` evalúa determinísticamente mediante `evaluarElegibilidadDerivacion`:
     * Todos los requisitos documentales obligatorios y activos (`tipo_requisito = 'DOCUMENTAL' AND obligatorio = true AND activo = true`) de la versión snapshot exacta del expediente (`sigd_doc.expediente_tupa_vinculo.registro_version_id`).
     * Deben contar con evidencia en estado `VALIDADO` o `CONFORME` en `sigd_doc.expediente_evidencia_requisito`.
     * Si alguno está ausente, observado o pendiente de validación, la derivación se rechaza fail-closed con HTTP 409 `REQUISITOS_DOCUMENTALES_PENDIENTES` y delta transaccional cero.
     * Procedimientos con 0 requisitos documentales obligatorios (e.g. `p1-fila-06`) satisfacen el gate documental automáticamente.
     * La obligación financiera (`PAGO_PENDIENTE`, HTTP 409) opera como gate independiente: requiere que el pago esté formalmente `CONFIRMADO` en `sigd_tra.orden_pago`.
2. **FSM Subsanado Institucional (`C3_6_HALLAZGO_FSM_SUBSANACION`):**
   - La operación ciudadana `POST /api/v1/expedientes/:id/subsanar` culmina de forma determinista y transaccional en `sigd_tra.expediente.estado = 'SUBSANADO'` y proyección `sigd_rut.estado_actual_expediente.estado_nuevo = 'SUBSANADO'` (movimiento WORM único: `OBSERVADO -> CORRECCION -> SUBSANADO`).
   - Queda estrictamente prohibida la autoderivación o autoavance instantáneo a `EN_REVISION` en la misma transacción ciudadana.
   - Todo intento de derivar directamente desde `SUBSANADO` es bloqueado con HTTP 400/422 `ESTADO_INVALIDO`.
   - Se habilitó el servicio institucional formal `POST /api/v1/expedientes/:id/iniciar-revision` (y `/movimientos/iniciar-revision`), accesible exclusivamente por funcionarios con custodia y rol autorizado (`MESA_PARTES`, `ESPECIALISTA`, `SECRETARIO`, `DIRECTOR`, `ADMINISTRADOR`). Un intento de administrado/ciudadano es bloqueado con HTTP 403 `ADMINISTRADO_NO_AUTORIZADO`. Genera movimiento WORM independiente `SUBSANADO -> INICIAR_REVISION -> EN_REVISION`.
3. **Contrato de Elegibilidad Centralizado y Frontend:**
   - Implementado `evaluarElegibilidadDerivacion` expuesto en `GET /api/v1/expedientes/:id/elegibilidad-derivacion` y embebido en `/api/v1/expedientes/:id/resumen`.
   - Frontend (`ExpedienteDetallePage.tsx` y `DerivacionModal.tsx`): desactiva el botón "Derivar" con tooltip explicativo si existen requisitos pendientes o si el estado es `SUBSANADO`. Muestra banner explicativo y botón institucional "Iniciar Revisión Formal" según corresponda.
4. **Certificación y Cero Regresiones:**
   - Suite C3.6.2: 9 / 9 PASS (0 FAIL).
   - Suite C3.6: 5 / 5 PASS (0 FAIL).
   - Suite C3: 18 / 18 PASS (0 FAIL).
   - Suites Previas (C0, C1, C2, 5K.1, 5K.2): 71 / 71 PASS (0 FAIL).
   - Backend Unit Suites: 1,248 / 1,248 PASS (0 FAIL across 88 suites).
   - Frontend Unit Suites: 878 / 878 PASS (0 FAIL across 97 suites).
   - Typechecks y Builds (Backend y Frontend): 0 errores.
   - Seguridad: 0 vulnerabilidades (npm audit limpio).
   - Datos e Integridad: Matriz canónica 72 TUPA (18 true, 49 false, 5 null), 32 vínculos históricos, hashes migraciones 46–50 100% MATCH, 0 migraciones DDL espurias.

---

## 15. Fase UX/UI 4 — Saneamiento de Accesos Públicos, Enlaces Legales e Identidad Visual

1. **Catálogo TUPA Público sin Bloqueo 403:**
   - Se habilitó la lectura pública no autenticada de procedimientos y servicios a través de `GET /api/v1/tramites/tupa?publico=true` en `tramites.controller.ts`, garantizando la exclusión estricta de `categoria === 'ACTUACION_INTERNA'`.
   - En frontend (`CatalogoTupaPage.tsx`), se eliminó la restricción artificial de pantalla completa (`!autorizado`), permitiendo a cualquier visitante anónimo consultar las fichas de trámites, requisitos, aranceles y plazos.
   - Se mantuvo la protección de la copia oficial escaneada en PDF (`TUPA_2026_OFICIAL.pdf`), cuya descarga formal requiere solicitud aprobada (`/solicitud-acceso-tupa`) o credenciales institucionales.
   - La funcionalidad de radicación documentaria e invocación de `TupaDynamicFormModal` se preservó intacta.

2. **Saneamiento de Enlaces Legales y Eliminación de Textos de Desarrollo:**
   - Se reorientó el enlace de pie de página "Normativa y Bases Legales" y la opción de navegación "Ayuda" desde `/flujo-validez-legal` hacia la ruta canónica `/transparencia/normativa`.
   - Se implementó la pestaña `normativa` en `TransparenciaLegalPage.tsx` con el marco jurídico institucional de la República del Perú (TUO Ley 27444, Ley 27269, D. Leg. 1412, D.S. 070-2013-PCM CVD, Ley 29733, RVM 177-2021-MINEDU).
   - Se sanitizó completamente `FlujoValidezLegalPage.tsx`, sustituyendo nombres personales de alumnos y textos provisionales ("Pendiente del integrante responsable") por las áreas orgánicas responsables institucionales ("Secretaría Académica", "Dirección General", "Oficina de Tecnologías de la Información", "Módulo en homologación institucional").

3. **Verificación Física y Responsive:**
   - Validado en navegador real a 1366×768 (Desktop) y 390×844 (Mobile) sin desbordes horizontales (`scrollWidth === innerWidth`).
   - Cero regresiones en HomePage, HeaderInstitucional y suites de TramiCore.

---

## 16. Fase UX/UI 4.1 — Saneamiento Integral del Formulario del Catálogo TUPA

1. **Resolución de Flujos Duplicados y Enrutamiento Funcional:**
   - **Procedimientos con CUT (`genera_expediente = true`):** Se enrutan a la página dedicada `/mesa-partes?procedimiento=[codigo]`, preseleccionando automáticamente el procedimiento TUPA en el Paso 2 con sus requisitos estructurados, sin exigir comprobante previo obligatorio (pago posterior o en caja).
   - **Servicios y Bienes Institucionales (`genera_expediente = false`):** Se atienden mediante el modal rediseñado de 3 pasos montado sobre `ModalBase` (`size="lg"`), eliminando fondos translúcidos difusos y delimitando la altura a `max-h-[90vh]` con scroll vertical interno.
   - **Exclusión de Actuaciones Internas:** Filtrado estricto de las 5 entradas internas (`ACTUACION_INTERNA`) para que nunca aparezcan expuestas al ciudadano.

2. **Saneamiento Financiero del Comprobante de Pago:**
   - Se convirtió `numeroComprobante` de obligatorio a opcional en las plantillas `ACADEMICO` y `DOCUMENTARIO` (`tupaFormulariosConfig.ts`), respetando que las órdenes de pago institucionales se liquidan en Tesorería posterior a la radicación.

3. **Verificación y Cobertura:**
   - Tests unitarios de frontend (`CatalogoTupaPage.test.tsx`, `HomePage.test.tsx`, `HeaderInstitucional.test.tsx`): 22/22 PASS.
   - Typechecks y Builds (Frontend y Backend): 0 errores (`tsc --noEmit`, `vite build`, `tsc -p tsconfig.build.json`).
   - Validado en navegador real a 1366×768 y 390×844 con capturas de evidencia física.

---

## 17. Fase UX/UI 4.1 — Corrección Focalizada de Desacoplamiento Funcional TUPA

1. **Desacoplamiento Estricto por Tipología de Procedimiento:**
   - **Procedimientos con CUT (`genera_expediente = true` - 18 registros):** Conservan el botón principal `"Iniciar Trámite con CUT"` que enlaza a `/mesa-partes?procedimiento=[codigo]` con preselección reactiva en el Paso 2 y requisitos estructurados.
   - **Conceptos No Radicables para Ciudadanos (`genera_expediente = false` no internos - 44 registros):** Se eliminó el botón de auto-solicitud digital (`"Iniciar Trámite de Solicitud"`), sustituyéndolo por la **Ficha Informativa de Atención** oficial (que detalla el área responsable y la modalidad/plazo de atención sin inventar datos).
   - **Uso Institucional Preservado:** Los roles institucionales (`MESA_PARTES`, `ADMINISTRADOR`, `DIRECTOR`, etc.) conservan la acción `"Registrar en Ventanilla"` que invoca `TupaDynamicFormModal` con los permisos requeridos por el backend.
   - **Procedimientos Pendientes (`genera_expediente = NULL` - 5 registros):** Muestran el bloque informativo `"Radicación Digital No Habilitada · Procedimiento en proceso de homologación técnica para radicación en SIGD"`, sin acción de apertura de expediente ni generación de CUT, respetando el bloqueo *fail-closed* del backend (`RADICACION_TUPA_NO_DETERMINADA`).
   - **Actuaciones Internas (`ACTUACION_INTERNA` - 5 registros):** Estrictamente filtradas de la vista de ciudadanos y visitantes externos.

---

## 18. Fase UX/UI 4.2 — Lenguaje Claro y Ayuda Contextual Institucional

1. **Componente Reutilizable `ContextualHelp` (`ContextualHelp.tsx`):**
   - **Diseño No Invasivo:** Ícono sutil `HelpCircle` discreto colocado al lado de términos clave o conceptos complejos.
   - **Comportamiento Accesible:**
     - En escritorio: Apertura por hover con delay de 180ms (anti-parpadeo) o por clic/tap toggle.
     - En móvil/táctil: Apertura por tap y cierre seguro al tocar fuera (outside-click/touch) o pulsar el botón `✕`.
     - Teclado y accesibilidad: Foco alcanzable por tabulador, cierre inmediato con tecla `Escape` devolviendo el foco al trigger, atributos `aria-expanded`, `aria-controls`, `aria-label`, y rol `region`.
     - Contención de Viewport: Estilo sólido `bg-slate-900 border-slate-700/80 text-white` con `max-w-[calc(100vw-2rem)]`, garantizando 0 desbordes laterales en pantallas de 390px (medición real: ancho 288px, margen libre 82.5px).
   - **Separación Semántica de Etiquetas:**
     - Integración con el componente `Input` mediante la prop `labelSuffix` colocada fuera del elemento `<label>`, evitando la anidación inválida de botones dentro de etiquetas HTML5 y permitiendo la correcta resolución por `getByLabelText`.

2. **Saneamiento en Lenguaje Claro:**
   - **Mesa de Partes Digital (`MesaPartesDigitalPage.tsx`):**
     - Paso 1: "Tipo de solicitante \*" (opciones limpias: "Persona natural", "Empresa o entidad (Persona jurídica)"), "Correo para avisos y constancias \*", "Número de teléfono celular \*", "Dirección o domicilio".
     - Paso 2: "Trámite solicitado y motivo" ("Elige tu trámite"), buscador en el catálogo de trámites, ocultamiento de códigos internos de fila (`p1-fila-XX`), "Asunto de la solicitud" con ayuda contextual.
     - Paso 3: "Documentos y requisitos" (explicación de PDF y qué es la foliación oficial según Ley N° 27444).
     - Paso 4 y Cierre: Sustitución de "Administrado:" por "Solicitante:", total de páginas foliadas, y eliminación de jerga técnica de pruebas ("canal Taypi / DEMO_QR" sustituido por "canales de pago autorizados").
   - **Catálogo TUPA (`CatalogoTupaPage.tsx`):**
     - Badges amigables al ciudadano: "Trámite Oficial", "Venta de Productos", "Alquiler y Servicios", "Trámites y Constancias".
     - Filtro por modalidad de atención: "Modalidad de atención:" con ayuda contextual sobre CUT y expedientes digitales.
     - Accordion "Detalle técnico" con código de catálogo restringido exclusivamente a operadores institucionales (`esInstitucional`).
   - **Consulta Pública (`ConsultaPublicaPage.tsx`):**
     - Ayuda contextual para "Código Único de Trámite (CUT)" y "Documento del Solicitante", explicando la protección de datos personales (Ley N° 29733) y el formato del cargo digital.
   - **Validador CVD (`ValidadorPublicoCvdPage.tsx`):**
     - Ayuda contextual explicando qué es el Código de Verificación Digital (CVD) y su función en la autenticidad de firmas digitales.

3. **Verificación y Pruebas:**
   - Tests Unitarios: 37/37 PASS (`ContextualHelp.test.tsx`, `CatalogoTupaPage.test.tsx`, `MesaPartesDigitalVinculacion.test.tsx`, `ValidadorCvdPage.test.tsx`, `registro-ciudadano-errors.test.tsx`).
   - Typechecks y Builds: 0 errores (`tsc --noEmit && vite build` completado exitosamente).
   - Verificación Visual en Vivo: Desktop (1366×768) y Móvil (390×844) verificados y documentados con capturas.
   - Git: `COMMIT = NO`, `PUSH = NO`. Backend: `BACKEND_MODIFICADO = NO`.

---

## 19. Fase UX/UI 4.3 — Validaciones de Identidad, Formularios y Cabecera Autenticada

1. **Módulo Canónico de Validación de Documentos (`documentValidation.ts`):**
   - **DNI Nacional (8 dígitos):** Validación estricta de exactamente 8 dígitos numéricos, `inputMode="numeric"`, `maxLength={8}`, bloqueo automático de letras y caracteres especiales, preservación estricta de ceros iniciales (e.g. `01234567`), indicador reactivo en tiempo real (`X / 8 dígitos`) y cálculo exacto de dígitos faltantes.
   - **RUC Empresarial (11 dígitos):** Validación de exactamente 11 dígitos numéricos, `inputMode="numeric"`, `maxLength={11}`, preservación de ceros iniciales, contador en vivo (`X / 11 dígitos`) y validación de tipos jurídicos.
   - **Carné de Extranjería (CE) y Pasaporte:** Preservación de longitudes reglamentarias (CE: 9 a 12 caracteres alfanuméricos en mayúsculas; Pasaporte: 6 a 15 caracteres) sin pérdida de formatos.
   - **Despliegue Transversal:** Integrado y probado en `MesaPartesDigitalPage.tsx`, `TupaDynamicFormModal.tsx`, `PersonaNaturalForm.tsx`, `PersonaJuridicaForm.tsx` y `ConsultaPublicaPage.tsx`.

2. **Login Institucional Compacto (`LoginPage.tsx`):**
   - **Ajuste Single-Screen:** Optimización de paddings, márgenes verticales y espaciados (`py-4 sm:py-6`, card `p-5 sm:p-7`, `space-y-3.5`) para caber en una sola pantalla sin scroll vertical en escritorios estándar (1366×768, 1024×768) y ventanas reducidas (900×650).
   - **Saneamiento de Etiquetas:** Etiqueta clara `"Usuario o correo institucional"`, placeholder institucional (`usuario@iestp-suiza.edu.pe o nombre de usuario`), texto de ayuda sin referencias a DNI y botón estándar `"Iniciar sesión"`.

3. **Cabecera Autenticada y Selector de Contexto (`HeaderInstitucional.tsx`):**
   - **Protección de Identidad Institucional:** Eliminación del colapso tipográfico mediante `shrink-0` y `whitespace-nowrap` en `"IESTP SUIZA"`, `"Instituto de Educación Superior"` y `"Tecnológico Público"`. Subtítulo largo delegado a pantallas amplias (`min-[1380px]:block`).
   - **Menú Accesible "Más" para Pantallas Intermedias (700px - 1279px):** Los ítems secundarios (índice >= 3) se agrupan ordenadamente dentro de un menú desplegable accesible con foco por teclado y cierre con tecla `Escape` o clic exterior, evitando cualquier salto de línea o desborde al abrir paneles laterales.
   - **Selector Contextual con Autorización Estricta:**
     - Si el usuario cuenta con un único contexto (`contextosDisponibles.length <= 1`), como un ciudadano regular, el selector NO se muestra.
     - Si cuenta con múltiples contextos (`contextosDisponibles.length > 1`), como personal institucional con acceso mixto, el selector se despliega con clara distinción visual del contexto activo y alternancia reactiva hacia las bandejas correspondientes.

4. **Coherencia del Catálogo TUPA (`TramitePage.tsx`):**
   - Eliminación de mensajes desalentadores o confusos ("se requiere solicitud aprobada para consultar las 72 entradas"), manteniendo la coherencia con el acceso directo al Catálogo Oficial TUPA público.

5. **Verificación y Cobertura:**
   - Tests Unitarios: 96/96 PASS en suites críticas (`documentValidation.test.ts`, `HeaderInstitucional.test.tsx`, `AppRouterGuards.test.tsx`, `CatalogoTupaPage.test.tsx`, `MisExpedientesPage.test.tsx`, `TramiteTupaCta.test.tsx`, `VentanillaTupa72.test.tsx`, `Fase5JCasilleroNotificaciones.test.tsx`, `HomePage.test.tsx`).
   - Typechecks y Builds: 0 errores (`tsc --noEmit && vite build` completado exitosamente en 3.88s; `npm run build` en backend exitoso).
   - Verificación Visual en Navegador Real: Desktop (1366×768, 1024×768, 900×650) y Móvil (390×844) documentados con 8 capturas físicas.
   - Directivas del Proyecto: `COMMIT = NO`, `PUSH = NO`, `BACKEND_MODIFICADO = NO`.

---

## 20. Fase UX/UI 4.4 — Consistencia Visual, Reducción de Espacio Vertical y Simplificación de Cabecera

1. **Reducción Integral de Espacio Vertical (Ajuste Desktop 1366×768):**
   - **Eliminación de `min-h-screen` Artificial:** Se retiró `min-h-screen` de los elementos `<main>` en `MesaPartesDigitalPage.tsx`, `CatalogoTupaPage.tsx` y `LoginPage.tsx`, permitiendo que el contenedor `flex-1` del `MainLayout` gestione armónicamente la altura sin empujar el footer hacia abajo ni forzar scrolls artificiales.
   - **Compactación de Contenedores y Secciones:**
     - `MesaPartesDigitalPage.tsx`: Padding vertical del contenedor reducido de `py-8` a `py-4 sm:py-6`; cabecera oficial reducida de `p-6 sm:p-8 space-y-5` a `p-4 sm:p-6 space-y-3.5`; tarjetas de pasos reducidas a `p-4 sm:p-6 space-y-4`.
     - `CatalogoTupaPage.tsx`: Padding vertical reducido a `py-4 sm:py-6`; cabecera a `p-4 sm:p-6 space-y-3`; espaciado de tarjetas y filtros optimizado para mostrar la primera fila completa de procedimientos en el primer pliegue de pantalla (first fold).
     - `TramitePage.tsx` & `TramiteWizard.tsx`: Ajuste a `max-w-5xl mx-auto py-4 sm:py-6 px-4 space-y-4`; cabecera oficial y cards de pasos reducidas a `p-4 sm:p-6`.
     - `LoginPage.tsx`: Reemplazo de `min-h-screen` por `flex flex-1 items-center justify-center py-6 sm:py-8`, garantizando contención completa en una sola pantalla sin scroll vertical en 1366×768, 1024×768 y 900×650.

2. **Cabecera Institucional Limpia (Eliminación del Selector Personal / Institucional):**
   - **Eliminación del Switch Ruidoso:** Se retiraron completamente los botones/tabs de conmutación "Personal / Institucional" del `HeaderInstitucional.tsx` (tanto en la barra desktop como en el menú desplegable móvil), eliminando cualquier sobrecarga visual, deformación o desborde en pantallas intermedias y estándar (1024×768).
   - **Presentación Sobria del Usuario:** Muestra el avatar con iniciales (`getIniciales`), nombre y credenciales oficiales (rol y área institucional) o acceso directo a "Mi cuenta" para ciudadanos, acompañado del botón estándar "Salir".
   - **Estabilidad Certificada:** 0 saltos de línea, 0 textos fragmentados y alineación horizontal perfecta.

3. **Estandarización Canónica de Carné de Extranjería (CE a 8 Dígitos Numéricos):**
   - **Regla Numérica Estricta:** CE normalizado a exactamente 8 dígitos numéricos (`inputMode="numeric"`, `maxLength={8}`, regex `/^[0-9]{8}$/`, preservación estricta de ceros iniciales como `00123456`, descarte automático de letras y símbolos).
   - **Textos de Ayuda Canónicos:**
     - DNI: *"Ingrese los 8 dígitos del DNI"* (placeholder: `45872315`).
     - RUC: *"Ingrese los 11 dígitos del RUC"* (placeholder: `20123456789`).
     - Carné de Extranjería: *"Ingrese los 8 dígitos del Carné de Extranjería"* (placeholder: `00123456`).
   - **Despliegue Transversal:** `documentValidation.ts`, `registroCiudadano.schema.ts` (`naturalSchema` y `juridicalDocumentSchema`), `PersonaNaturalForm.tsx` y `MesaPartesDigitalPage.tsx`.

4. **Saneamiento Inclusivo del Login:**
   - Etiqueta del identificador cambiada a `"Usuario o correo electrónico"`, placeholder `"usuario@iestp-suiza.edu.pe o tu correo"` y helper `"Ingresa tu usuario o correo registrado"`, eliminando sesgos restrictivos para la ciudadanía.

5. **Verificación y Cobertura:**
   - **Tests Unitarios:** 129/129 PASS (`documentValidation.test.ts`, `registroCiudadano.test.ts`, `HeaderInstitucional.test.tsx`, `LoginPage.redirect.test.tsx`, `CatalogoTupaPage.test.tsx`, `MesaPartesDigitalVinculacion.test.tsx`, `TramiteTupaCta.test.tsx`, `AppRouterGuards.test.tsx`).
   - **Build de Producción:** `tsc --noEmit && vite build` completado exitosamente en 4.16s con 0 errores de tipado o empaquetado.
   - **Inspección Física en Navegador Real:** Verificación completa en viewports 1366×768, 1440×900, 1024×768 y 390×844 con 9 capturas de pantalla físicas archivadas.
   - **Directivas del Proyecto:** `COMMIT = NO`, `PUSH = NO`, `BACKEND_MODIFICADO = NO`.

---

## 21. Corrección Focalizada: Anexos y Requisitos del Paso Documentos (Mesa de Partes Digital)

1. **Diagnóstico Canónico de Requisitos TUPA (`p1-fila-06` - Certificado de Inglés):**
   - **Requisitos Oficiales en Base de Datos (`sigd_doc.tupa_requisito_documental`):**
     - `REQ-01`: *"Pago en el Área de Tesorería"* (`tipo_requisito: 'FINANCIERO'`, `obligatorio: true`, `es_anexo_digital: false`, `id_anexo: null`).
     - `REQ-02`: *"Emisión de la B/V"* (`tipo_requisito: 'INTERNO'`, `obligatorio: true`, `es_anexo_digital: false`, `id_anexo: null`).
   - **Anexos Oficiales (`sigd_doc.tupa_anexo`):** 0 anexos asociados a `p1-fila-06`. Los únicos registros globales en el sistema (`FUT_OFICIAL_2026` y `DJ_REPRESENTACION_2026`) tienen `es_descargable: false` y `activo: false` (propuesta de diseño pendiente de homologación en MinIO).
   - **Causa Raíz del Selector Genérico:** `MesaPartesDigitalPage.tsx` consultaba una ruta inexistente `/api/v1/tramites/tupa/versiones/${proc.registroVersionId}/requisitos` (HTTP 404). Al fallar, `requisitosEstructurados` quedaba vacío y la vista caía en el fallback genérico de PDF único. Se corrigió invocando `obtenerRequisitosProcedimiento(proc.registroVersionId || proc.codigo)` que consulta `/api/v1/tramites/tupa/procedimientos/:id/requisitos`.

2. **Arquitectura y Clasificación Semántica en Paso 3 («Documentos»):**
   - **Documento Principal Obligatorio (Art. 113 TUO Ley N° 27444 — D.S. N.° 006-2026-JUS):**
     - Toda petición ante la administración exige los requisitos del escrito formal (Art. 113 TUO vigente, anteriormente Art. 124 del derogado D.S. 004-2019-JUS).
     - Constituye el **Documento Principal Obligatorio** (Folio 1 en adelante) con control de carga dedicado y badge `Obligatorio *`.
   - **Requisitos Documentales Específicos:**
     - Individualización de cada requisito documental con badges `Obligatorio *` u `Opcional`.
     - Vinculación estricta de cada archivo cargado a su correspondiente `idRequisito`.
     - Bloqueo preventivo de descargas falsas: solo se ofrece enlace/botón de descarga si `anexo.esDescargable === true && anexo.activo === true`.
     - Cuando el trámite no posee requisitos documentales adicionales (como `p1-fila-06`), se despliega una tarjeta explicativa oficial informando que solo se requiere la Solicitud Principal.
   - **Separación Estricta de Requisitos Financieros e Internos:**
     - Sección informativa dedicada a la **Orden de Pago Oficial** con la tarifa exacta del TUPA (S/. 100.00 para `p1-fila-06`).
     - Aclaración expresa de que la orden de pago se liquida tras radicar en Tesorería y que el pago previo no es barrera de radicación digital.
     - Sección de **Actuaciones Internas** detallando la emisión de boleta/voucher ("B/V" = Boleta de Venta) como labor interna de oficio.
   - **Foliación Secuencial y Prevención de BOLA/Contaminación:**
     - Foliación automática correlativa inmutable (`F. 1 a X`, `F. X+1 a Y`).
     - Limpieza de adjuntos al cambiar de procedimiento en el Paso 2 para evitar arrastre de requisitos ajenos (`REQUISITO_AJENO_PROCEDIMIENTO`).
     - Paso 4 (Confirmación): Vista previa estructurada de documentos adjuntos con sus folios asignados.

3. **Verificación, Cobertura y Gobernanza Normativa:**
   - **Cita Legal Rector:** Alineada al Art. 113 de la Ley N.º 27444 (D.S. N.º 006-2026-JUS). El Art. 124 rige deberes de recepción de Mesa de Partes.
   - **Mecanismo de Formalización:** Declaración Jurada Simple en Línea sujeta a presunción de veracidad y fiscalización posterior (Art. 34 LPAG). No equivale a firma digital de la Ley 27269 (requiere Directiva Institucional de la Mesa de Partes Digital para su formalización reglamentaria).
   - **Tests Unitarios:** `MesaPartesDocumentosRequisitos.test.tsx` (5/5 PASS), `MesaPartesDigitalVinculacion.test.tsx` (5/5 PASS). Suite completa frontend: 947 PASS | 1 SKIPPED.
   - **Typechecks y Builds:** `tsc --noEmit` frontend y backend sin errores; `vite build` completado exitosamente en 5.26s.
   - **Directivas del Proyecto:** `COMMIT = NO`, `PUSH = NO`.

---

## 22. Fase de Estabilización Final — Bloque 1 (Prioridad A: Radicación con CUT, Documento Principal y Requisitos)

1. **Procedimiento Focalizado:**
   - **Procedimiento:** Certificado de Inglés (`p1-fila-06`, `id_procedimiento: 3852e80f-1253-4c92-9eca-f2bf860261c1`).
   - **Versión Snapshot Aprobada:** `registro_version_id: 11720d13-da80-433c-8a24-d02cfd2cb5de`.
   - **Costos y Flujo Oficial:** Tasa arancelaria S/ 100.00 (`intervencion_financiera: 'REQUIERE_PAGO'`).
   - **Unidad Receptora:** Dirección General (`DIR`, UUID `a0000000-0000-0000-0000-000000000002`).
   - **Unidad Responsable:** Subdirección Académica (`SDA`, UUID `a0000000-0000-0000-0000-000000000001`).

2. **Diagnóstico y Corrección de Errores Reales en Radicación y Tránsito:**
   - **Defecto 1 (Disociación Orgánica en Radicación Digital):**
     - *Causa:* `mesaPartesDigital.service.ts` insertaba `area_destino_id = NULL` en `sigd_tra.expediente` y el string literal `'MESA_PARTES'` en `sigd_rut.estado_actual_expediente.area_actual_id`.
     - *Impacto:* `sigd_rut.estado_actual_expediente` no cruzaba con `sigd_org.area` (cuyo `area_id` es UUID), invisibilizando el expediente en las bandejas de entrada de Dirección General (`DIR`) y rompiendo el control de custodia para derivar.
     - *Corrección:* `validarElegibilidadRadicacion` ahora extrae `unidad_receptora_id` del procedimiento (`p.unidad_receptora_id`). `mesaPartesDigital.service.ts` asigna canónicamente `areaDestinoId = elegibilidad.unidadReceptoraId || 'a0000000-0000-0000-0000-000000000002'`, registrando tanto `sigd_tra.expediente.area_destino_id` como `sigd_rut.estado_actual_expediente.area_actual_id` con el UUID canónico de DIR.
   - **Defecto 2 (Bloqueo FSM Permanente en PENDIENTE_PAGO):**
     - *Causa:* Al radicarse un procedimiento con costo > 0 (`p1-fila-06`), el estado proyectado inicial es `PENDIENTE_PAGO`. Cuando Tesorería confirmaba el pago o pasarela conciliaba, actualizaba `sigd_tra.expediente SET estado = 'REGISTRADO'`, pero **no actualizaba** `sigd_rut.estado_actual_expediente`.
     - *Impacto:* `derivaciones.service.ts` consultaba `COALESCE(u.estado_nuevo, e.estado)` que seguía siendo `'PENDIENTE_PAGO'`, arrojando error `ESTADO_INVALIDO: El expediente en estado PENDIENTE_PAGO no puede ser derivado`.
     - *Corrección:* En `tesoreria.service.ts`, `confirmarPago`, `conciliarPagoPasarela` y `generarOrdenPago` sincronizan atómicamente `sigd_rut.estado_actual_expediente` con el nuevo estado (`REGISTRADO` o `PENDIENTE_PAGO`) y emiten el correspondiente movimiento en `sigd_rut.movimiento_tramite`.

3. **Garantías de Regresión e Integridad:**
   - `EXP-2026-000018` intacto sin modificaciones.
   - Base de datos preservada sin mock data arbitraria.
   - Cobertura de pruebas verificada:
     - TramiCore: 229 tests PASS.
     - RutaDoc: 237 tests PASS.
     - Tesorería: 87 tests PASS.
     - Frontend (Mesa de Partes): 10 tests PASS.
     - Typecheck backend y frontend: 0 errores.
     - `COMMIT = NO`, `PUSH = NO`.

---

## 23. Fase de Estabilización Final — Bloque 2 (DIR → Derivación SDA → Recepción → Asignación al Especialista → Inicio Atención)

1. **Circuito Focalizado:**
   - **Flujo:** `DIR → Derivación a SDA → Recepción → Asignación al especialista → Inicio de atención`.
   - **Expediente de Prueba:** Certificado de Inglés (`p1-fila-06`), radicado canónicamente en `DIR` (`a0000000-0000-0000-0000-000000000002`) con arancel S/ 100.
   - **Actores Institucionales Reales:**
     - `director_demo` (`48b38966-150f-4fe6-8be6-ca9405c379b6`, rol `DIRECTOR`, área `DIR`).
     - `secretario_demo` (`f62b07fa-6257-4d06-be7d-940b7305ae67`, rol `SECRETARIO`, área `SDA`).
     - `responsable_ingles_demo` (`b5ef5f9f-6963-4bcc-b2bc-621c1aa22702`, rol `ESPECIALISTA`, área `SDA`).
     - `especialista_demo` (`008feadd-98f6-4787-b655-a766623ac154`, rol `ESPECIALISTA`, área `SDA`).

2. **Invariantes Críticos de Base de Datos y Corrección de Errores Reales:**
   - **Invariante FSM Documental vs Estado Operativo:**
     - `sigd_rut.estado_actual_expediente.estado_nuevo` tiene FK estricta a `sigd_rut.estado_tramite(codigo)` (`REGISTRADO`, `RECEPCIONADO`, `EN_CALIFICACION`, `DERIVADO`, `EN_REVISION`, `OBSERVADO`, `SUBSANADO`, `EN_FIRMA`, `RESUELTO`, `ARCHIVADO`).
     - `PENDIENTE_PAGO` es un estado administrativo de `sigd_tra.expediente(estado)`, NO un estado de ruta documental. Cualquier intento de insertar o actualizar `sigd_rut.estado_actual_expediente.estado_nuevo = 'PENDIENTE_PAGO'` viola la restricción `estado_actual_expediente_estado_nuevo_fkey`.
     - El bloqueo financiero opera fail-closed en `sigd_tra.expediente(estado = 'PENDIENTE_PAGO')` y `sigd_tra.orden_pago(estado = 'CONFIRMADO')`.
   - **Inicialización de Secuencia en Radicación (`sigd_rut.movimiento_secuencia`):**
     - El trigger `sigd_rut.actualizar_estado_actual_expediente()` exige `secuencia < EXCLUDED.secuencia`. Al crearse la proyección inicial con secuencia 1 sin inicializar `movimiento_secuencia`, el primer movimiento generaba secuencia 1 y el trigger fallaba silenciosamente en actualizar `estado_actual_expediente`.
     - Se corrigió en `mesaPartesDigital.service.ts` inicializando atómicamente `sigd_rut.movimiento_secuencia (expediente_id, ultima_secuencia) VALUES ($1::uuid, 1) ON CONFLICT DO UPDATE`.
   - **Protección Fail-Closed en Derivación:**
     - En `derivaciones.service.ts`, `derivarExpediente` evalúa `CASE WHEN e.estado = 'PENDIENTE_PAGO' THEN 'PENDIENTE_PAGO' ELSE COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') END`. Si el expediente se encuentra en `PENDIENTE_PAGO`, la derivación es rechazada inmediatamente con `DomainError('ESTADO_INVALIDO' / 'PAGO_PENDIENTE')`.
   - **Recepción en SDA e Idempotencia:**
     - `recepcionarExpediente` transiciona el expediente a `EN_REVISION`, actualiza `sigd_tra.expediente.estado = 'EN_REVISION'`, y rechaza a operadores fuera del área destinataria con HTTP 403 (BOLA). Una segunda invocación es idempotente (no-op).
   - **Asignación y Restricción de Atención Técnica:**
     - `ExpedienteAsignacionService.asignarExpediente` valida pertenencia orgánica a `SDA`, persiste en `sigd_rut.expediente_asignacion` y actualiza la proyección `sigd_rut.estado_actual_expediente(usuario_asignado_id, persona_asignada_id)`.
     - Solo el especialista asignado (`responsable_ingles_demo`) puede registrar atención técnica (`atenderExpediente`). Un especialista no asignado es bloqueado de acuerdo a la matriz RBAC institucional.

3. **Garantías de Regresión y Verificación:**
   - **Expedientes Históricos:** `EXP-2026-000018` y `EXP-2026-000148` verificados intactos en estado `RESUELTO`.
   - **Pruebas de Integración Reales:** `backend/tests/integration/rutadoc/circuito-bloque2-completo.spec.ts` (12/12 PASS).
   - **Pruebas Unitarias Backend:** 1279 PASS | 0 FAIL | 9 SKIPPED (90 test files passed).
   - **Pruebas Frontend:** 950 PASS | 0 FAIL | 1 SKIPPED (102 test files passed).
   - **Compilación Backend (`tsc -p tsconfig.build.json`):** 0 errores (código 0).
   - **Typecheck Frontend (`tsc --noEmit`):** 0 errores (código 0).
   - **Directivas del Proyecto:** `COMMIT = NO`, `PUSH = NO`.

---

## 24. Cierre Funcional Prioritario — Radicación Pública (Mesa de Partes Digital)

1. **Incidencia Reportada en `/mesa-partes`:**
   - Al seleccionar Certificado de Inglés (`p1-fila-06`), adjuntar PDF, aceptar declaración jurada y presionar «Presentar trámite», la interfaz mostraba:
     `«Ocurrió un error al procesar la radicación digital. Verifique los datos ingresados»`.

2. **Diagnóstico Técnico y Causa Raíz:**
   - **Defecto Principal (HTTP 413 Payload Too Large):**
     - En `backend/src/app.ts`, `express.json()` operaba con el límite por defecto de body-parser (100 KB = 102,400 bytes).
     - El archivo PDF adjuntado en base64 totalizaba ~1.7 MB (1,717,520 bytes), siendo rechazado a nivel de middleware con `PayloadTooLargeError: request entity too large`.
   - **Enmascaramiento de Error:**
     - En `backend/src/errors/error-mapper.ts`, `PayloadTooLargeError` no estaba mapeado y caía en el fallback de error 500 (`INTERNAL_ERROR`), retornando `{ detail: "Ocurrió un error interno en el servidor." }`.
   - **Defecto Latente en Base de Datos (`chk_asiento_canal`):**
     - En `backend/src/domains/tramicore/mesaPartesDigital.service.ts`, el insert en `sigd_tra.asiento_registro` enviaba `canal_ingreso = 'MESA_PARTES_DIGITAL'`.
     - La restricción de tabla PostgreSQL `chk_asiento_canal` exige estrictamente: `CHECK (canal_ingreso = ANY (ARRAY['MESA_VIRTUAL', 'MESA_PRESENCIAL']))`. Superado el límite de tamaño, la radicación hubiera fallado con error de integridad de constraint.
   - **Visualización de Errores en Frontend:**
     - En `frontend/src/pages/tramite/MesaPartesDigitalPage.tsx`, el bloque `catch` solo leía `message` o `detail`, ignorando el arreglo `invalidParams` de las validaciones de esquema.

3. **Correcciones Aplicadas:**
   - `backend/src/app.ts`: Se configuró `limit: '50mb'` en `express.json()` y `express.urlencoded({ extended: true, limit: '50mb' })`.
   - `backend/src/errors/error-mapper.ts` y `backend/src/middleware/error-middleware.ts`: Se mapearon explícitamente `PayloadTooLargeError` y status 413 retornando código `PAYLOAD_TOO_LARGE` y HTTP 413.
   - `backend/src/domains/tramicore/mesaPartesDigital.service.ts`:
     - Se corrigió `canal_ingreso` canónico a `'MESA_VIRTUAL'` (alineado con la restricción `chk_asiento_canal`).
     - Se agregó soporte para `clienteParam?: PoolClient` en `radicarDigital` para permitir transacciones de prueba con rollback total.
   - `frontend/src/pages/tramite/MesaPartesDigitalPage.tsx`: Se mejoró el manejo de excepciones para desempaquetar `invalidParams` y mostrar causas específicas de validación.
   - `backend/tests/integration/tramicore/mesa-partes-digital-e2e.spec.ts`: Nueva suite de integración que verifica:
     1. Aceptación de payloads base64 >100 KB sin error 413.
     2. Radicación integral para `p1-fila-06`, generación de CUT `EXP-2026-XXXXXX`, foliación continua (1-2), almacenamiento en MinIO, generación de Cargo Digital PDF, asignación inicial a `DIR`, generación de orden de pago `PAG-2026-XXXXXX` por S/ 100 en `PENDIENTE`, y rollback transaccional total (0 registros residuales).

4. **Verificación Integral y Estado de Invariantes:**
   - **Expedientes Históricos:** `EXP-2026-000018` y `EXP-2026-000148` verificados inalterados en estado `RESUELTO` con último evento `FIRMA` (secuencia 6).
   - **Pruebas de Integración Radicación Digital:** 2/2 PASS (`mesa-partes-digital-e2e.spec.ts`).
   - **Pruebas de Integración Bloque 2:** 12/12 PASS (`circuito-bloque2-completo.spec.ts`).
   - **Pruebas Unitarias Backend:** 1279 PASS | 0 FAIL (90 suites).
   - **Pruebas Frontend:** 950 PASS | 0 FAIL (102 suites).
   - **Typecheck Backend y Frontend:** 0 errores.
   - **Compilación Backend (`tsc`):** Código 0.
   - **Directivas del Proyecto:** `COMMIT = NO`, `PUSH = NO`.

---

## 25. Cierre Definitivo de Mesa de Partes Digital

1. **UX/UI Catálogo Colapsado y Retención de Trámite:**
   - En `MesaPartesDigitalPage.tsx`, al seleccionar un procedimiento TUPA, el buscador y el catálogo general se ocultan de inmediato.
   - Se muestra únicamente una tarjeta destacada con el trámite elegido, su tarifa oficial (`S/ 100.00` o `Gratuito`), plazo legal y el botón de acción «Cambiar trámite».
   - Al pulsar «Cambiar trámite», se despliega el buscador y catálogo con la opción «Cancelar cambio y mantener trámite seleccionado».
   - La selección persiste íntegra al avanzar hacia los pasos 3 y 4 o retroceder hacia los pasos 1 y 2.

2. **Saneamiento de Textos y Eliminación de Caracteres Corruptos:**
   - **Migración DDL 51:** `51_sigd_limpieza_textos_tupa_requisitos.sql` (y rollback `51_sigd_limpieza_textos_tupa_requisitos_rollback.sql`) aplicada bajo advisory lock sin bloqueos de tabla exclusivos (`ACCESS EXCLUSIVE`).
   - Se sanearon los 171 registros con interrogaciones `?` en `sigd_doc.tupa_requisito_documental` heredados de codificaciones históricas.
   - Textos de requisitos internos simplificados a: `"Actuación o verificación interna institucional. No requiere trámite del administrado."`.
   - Textos financieros simplificados a: `"Tasa oficial liquidada mediante orden de pago en Tesorería."`.
   - Función auxiliar `limpiarTexto()` en frontend que previene y neutraliza cualquier residuo de interrogación o espaciado irregular.

3. **Gobernanza de Límites y Protección contra DoS:**
   - **Coherencia Matemática:** Límite técnico institucional por archivo de 25 MB binario (Directiva de Mesa de Partes Digital / MinIO Storage; los requisitos formales del escrito corresponden al Art. 113 LPAG — D.S. 006-2026-JUS). Expansión Base64 de 4/3 eleva un archivo de 25 MB a ~33.33 MB. Con metadatos JSON y headers, el payload asciende a ~35 MB.
   - **Segmentación en Express (`backend/src/app.ts`):** Límite extendido de 50 MB (`limit: '50mb'`) delimitado exclusivamente a rutas con ingesta documental (`/api/v1/tramites`, `/api/v1/storage`, `/api/v1/firma`).
   - Para el resto de rutas de la API, se aplica un límite estricto de 2 MB (`limit: '2mb'`), cerrando la exposición a ataques de denegación de servicio por agotamiento de memoria.
   - En el frontend, se incorporó un tope acumulado de 35 MB combinados (`MAX_TOTAL_SIZE_BYTES = 35 * 1024 * 1024`), alertando preventivamente antes de iniciar la transmisión.

4. **Verificación Automatizada y Códigos de Salida:**
   - **Servidor HTTP 201 y CUT:** `backend/tests/integration/tramicore/mesa-partes-digital-e2e.spec.ts` (3/3 PASS, exit code 0) validando respuesta HTTP 201 y CUT canónico `EXP-2026-XXXXXX` con PDF real, sin generar expedientes operativos residuales en BD.
   - **Backend Unit Tests:** 90 suites PASS | 1 skipped (1279 tests PASS, exit code 0).
   - **Frontend Unit Tests:** 102 suites PASS | 1 skipped (950 tests PASS, exit code 0).
   - **Backend Integración (RutaDoc + TramiCore):** 15/15 tests PASS (exit code 0).
   - **Typecheck Backend (`tsc --noEmit`):** 0 errores (exit code 0).
   - **Typecheck Frontend (`tsc --noEmit`):** 0 errores (exit code 0).
   - **Build Backend (`tsc -p tsconfig.build.json`):** Exit code 0.
   - **Build Frontend (`vite build`):** Exit code 0 (5.47s).
   - **Expedientes Históricos:** `EXP-2026-000018` y `EXP-2026-000148` 100% inalterados en estado `RESUELTO` (secuencia 6).
   - **Directivas:** `COMMIT = NO`, `PUSH = NO`.

---

## 26. Estabilización Final: Bloque 3 (Especialista SDA → Dictamen Técnico → Elevación a Dirección → Resolución Institucional → Firma)

1. **Circuito Estabilizado:**
   - **Especialista SDA (`USER_RESPONSABLE_INGLES`):**
     - Recibe expediente en `EN_REVISION` custodiado en `SDA`.
     - Consulta solicitud del ciudadano (`Solicitud_Ciudadano_Ingles.pdf`), requisitos y trazabilidad.
     - Emite evaluación técnica favorable: registra `ATENCION_TECNICA` en `sigd_rut.workflow_instancia` y adjunta dictamen técnico en `sigd_doc.documento_adjunto` con `id_requisito = null` y clave interna `dictamenes/`.
     - RBAC: Especialista sin facultades de despacho no puede elevar directamente a firma.
   - **Elevación a Dirección (`USER_SECRETARIO_SDA`):**
     - Secretaría de SDA ejecuta `enviarAFirmaExpediente`.
     - Remitente real: `SDA` (`AREA_SDA_ID`).
     - Destinatario real: `DIR` (`AREA_DIR_ID`).
     - Transición canónica FSM: `EN_REVISION` -> `ENVIAR_A_FIRMA` -> `EN_FIRMA`.
     - Actualización síncrona de custodia en `sigd_tra.expediente` (`area_destino_id = DIR`) y `sigd_rut.estado_actual_expediente` (`area_actual_id = DIR`).
     - Bandeja: el expediente desaparece de `EN_TRAMITE` de SDA y aparece en `POR_FIRMAR` de DIR.
   - **Generación del Acto Resolutivo Oficial:**
     - Control Fail-Closed estricto: Todo intento de firmar el PDF presentado por el ciudadano es rechazado con HTTP 422 (`DOCUMENTO_NO_ES_ACTO_RESOLUTIVO`).
     - Se genera la Resolución Directoral oficial en formato A4 institucional con estructura legal:
       - VISTO: Incorpora el petitorio y el dictamen técnico emitido por el especialista.
       - CONSIDERANDO: Fundamentación técnica y jurídica (TUPA y LPAG).
       - SE RESUELVE: Declara PROCEDENTE la solicitud ciudadana.
       - Código de Verificación Digital (CVD): Estampado y persistido en `sigd_doc.resolucion` y `sigd_doc.documento_adjunto`.
   - **Firma Digital DNIe y Transición Final:**
     - Director General (`USER_DIRECTOR_DIR`) prepara sesión DNIe (`prepararFirmaDnie`).
     - Firma criptográfica con certificado X.509 y clave privada del Director.
     - Verificación criptográfica (`verificarYRegistrarFirmaDnie`) y registro WORM en `sigd_doc.firma_digital_documento`.
     - `resolverExpedienteConFirma`: Valida evidencia de firma previa (fail-closed ante intentos sin firma con `EVIDENCIA_FIRMA_REQUERIDA`).
     - Transición FSM canónica: `EN_FIRMA` -> `FIRMA` -> `RESUELTO`.
     - Movimiento WORM registrado y custodia confirmada en `DIR` (pestaña `ATENDIDOS`).
     - Expediente no avanza a notificación ni archivo antes de tiempo.

2. **Garantía de Inalterabilidad y Aislamiento de Base de Datos:**
   - `EXP-2026-000018` y `EXP-2026-000148` verificados inalterados en estado `RESUELTO` con último evento `FIRMA` (secuencia 6).
   - Todas las pruebas de integración utilizan transacciones aisladas con `ROLLBACK` total, asegurando 0 registros operativos residuales.
   - Sin alteraciones de esquema DDL ni semillas no autorizadas.

3. **Verificación Automatizada Completa:**
   - **Suite de Integración Bloque 3:** `backend/tests/integration/rutadoc/circuito-bloque3-completo.spec.ts` (15/15 PASS, exit code 0).
   - **Suite de Integración Bloque 2:** `backend/tests/integration/rutadoc/circuito-bloque2-completo.spec.ts` (12/12 PASS, exit code 0).
   - **Suite de Integración TramiCore:** `backend/tests/integration/tramicore/mesa-partes-digital-e2e.spec.ts` (4/4 PASS, exit code 0).
   - **Backend Unit Tests:** 90 suites PASS | 1 skipped (1279 tests PASS, exit code 0).
   - **Frontend Unit Tests:** 102 suites PASS | 1 skipped (950 tests PASS, exit code 0).
   - **Builds:** Backend (`tsc -p tsconfig.build.json` exit 0), Frontend (`vite build` exit 0).
   - **Directivas:** `COMMIT = NO`, `PUSH = NO`.

---

## 27. Saneamiento de Radicación Real: Corrección de Columna Inexistente en `sigd_auth.persona`

1. **Defecto Real en Servidor (`42703`):**
   - **Error en Logs:** `[ERROR 5xx] correlation_id=b9d9911d-8667-4a69-968e-2b03485a948d method=POST path=/api/v1/tramites/mesa-partes-digital error: column "actualizado_en" of relation "persona" does not exist`.
   - **Causa Raíz:** En `backend/src/domains/tramicore/mesaPartesDigital.service.ts` (línea 125), al detectarse un administrado previamente registrado en `sigd_auth.persona` (como `ciudadano_demo` con DNI `99000001` u otros en el padrón), el servicio ejecutaba un `UPDATE` incluyendo `actualizado_en = now()`. La tabla `sigd_auth.persona` carece de esa columna (solo posee `id_persona`, `tipo`, `id_documento`, `creado_en`, `direccion`, `ubigeo_distrito`). En consecuencia, la transacción PostgreSQL abortaba y retornaba HTTP 500 al navegador.
   - **Inocuidad en Base de Datos:** La transacción transaccional ejecutó `ROLLBACK` total inmediato. Cero registros residuales (sin CUT, sin expediente, sin orden de pago ni documentos en MinIO).

2. **Corrección Aplicada:**
   - En `backend/src/domains/tramicore/mesaPartesDigital.service.ts`, se eliminó la asignación a la columna inexistente `actualizado_en`, conservando la actualización de `direccion` y `ubigeo_distrito`.
   - El proceso `tsx watch` del backend recargó automáticamente los cambios en tiempo de ejecución.

3. **Verificación Focalizada:**
   - Se añadió la prueba de integración aislada en `backend/tests/integration/tramicore/mesa-partes-digital-e2e.spec.ts` con el procedimiento `Certificado de Estudios Superiores (06 Semestres)` (`6fcb1ea2-e73e-4dd4-a8bb-b6c8774671e6`), verificando:
     - Generación de CUT válido (`EXP-2026-XXXXXX`).
     - Tasa oficial TUPA generada por S/ 124.00 en `sigd_tra.orden_pago` con código `PAG-2026-XXXXXX`.
     - Actualización exitosa de dirección y ubigeo en `sigd_auth.persona` sin error de columna.
     - Asiento de registro formal en canal `MESA_VIRTUAL`.
     - Rollback total al finalizar la prueba (cero contaminación en base de datos operativa).
   - Suite `mesa-partes-digital-e2e.spec.ts`: 4/4 PASS (exit code 0).
   - Suites de integración RutaDoc Bloque 2 (12/12) y Bloque 3 (15/15): 27/27 PASS (exit code 0).
   - Compilación backend (`tsc -p tsconfig.build.json`): Exit code 0.



---

## 28. Corrección Focalizada de Contextos e Identidad Institucional

1. **Gobernanza Ontológica de Contextos (`auth.router.ts`):**
   - **Contextos Legítimos:**
     - Usuarios con capacidad institucional (`tieneCapacidadInstitucional === true`): Se entregan contextos `INSTITUCIONAL` (gestión de cargo y despacho) y `PERSONAL` (trámites individuales del administrado), ordenados con `INSTITUCIONAL` como opción activa por defecto al iniciar sesión.
     - Usuarios exclusivamente ciudadanos (`tieneCapacidadInstitucional === false`): Únicamente disponen del contexto `PERSONAL`, con `contextosDisponibles.length === 1`.
   - **Conmutación Controlada (`POST /api/v1/auth/contexto`):**
     - Al conmutar a `INSTITUCIONAL`, revalida en base de datos la vigencia estricta de roles (`sigd_org.usuario_rol`) o perfiles operativos (`sigd_org.asignacion_perfil_operativo`), emitiendo token JWT con rol institucional específico (`roles: [rolInst]`). Cuentas no autorizadas son rechazadas con HTTP 403 `INSTITUTIONAL_CONTEXT_NOT_AVAILABLE`.
     - Al conmutar a `PERSONAL`, emite token scoped con rol `CIUDADANO`.
     - Trazabilidad: Se mantiene inmutable `id_usuario` y `id_persona` en auditoría WORM en ambos contextos.

2. **Saneamiento de Cachés Frontend (`authStore.ts`):**
   - Invocación incondicional de `queryClient.clear()` en `cambiarContexto`: previene fugas de datos en memoria y garantiza que expedientes institucionales no se filtren a la bandeja personal, ni viceversa.

3. **Presentación de Identidad e Interfaz Sobria (`HeaderInstitucional.tsx`):**
   - **Identidad Individual Verificable:** El nombre real completo del usuario (`usuario.nombreCompleto`) se exhibe invariablemente en el botón principal, eliminando cualquier reemplazo por `"Mi cuenta"`.
   - **Etiquetas Canónicas Estrictas:**
     - «Mis trámites personales» (subtexto: `"Gestión de mis solicitudes y casilla electrónica"`).
     - «Funciones de mi cargo» (subtexto: `[Rol] · [Unidad Orgánica]`).
   - **Scoping Visual Estricto:** Rol y unidad orgánica se visualizan ÚNICAMENTE cuando el contexto activo es `INSTITUCIONAL`. En contexto `PERSONAL`, el subtítulo muestra limpiamente «Mis trámites personales» sin exposición de cargos ni dependencias.
   - **Ocultamiento de Selector:** Si el usuario dispone de un solo contexto (`contextosDisponibles.length <= 1`), el menú de conmutación queda completamente oculto.

4. **Conflicto de Interés y Administración de Cuentas:**
   - **Regla `CONFLICTO_INTERES_EXPEDIENTE_PROPIO`:** Verificada y activa en `authorization.service.ts` para todas las fases de trámite (`EXPEDIENTE_RECIBIR`, `EXPEDIENTE_OBSERVAR`, `EXPEDIENTE_CALIFICAR`, `EXPEDIENTE_DERIVAR`, `EXPEDIENTE_ATENDER`, `EXPEDIENTE_RESOLVER`, `FIRMA_FIRMAR`, `DEVOLUCION_AUTORIZAR`), impidiendo a cualquier funcionario operar sobre expedientes donde coincida `solicitanteUsuarioId` o `solicitantePersonaId`.
   - **Cuentas Genéricas vs Individuales:** Se constata que `sigd_auth.cuenta_usuario` carece de discriminador canónico explícito (`tipo_cuenta`). No se implementaron heurísticas frágiles ni DDL no autorizados.
   - **Gestión de Usuarios:** `POST /api/v1/admin/usuarios` documentado en estado 503 `CONTRATO_INTERMODULAR_PENDIENTE` debido a la discrepancia de tipos de identificador (BIGINT en IdentiCore vs UUID en OrganiCore), preservando estabilidad sin crear subsistemas espurios.

5. **Verificación y Pruebas:**
   - Tests Unitarios Backend: 90 suites PASS | 1 skipped (1281 tests PASS, exit code 0).
   - Tests Unitarios Frontend: 102 suites PASS | 1 skipped (951 tests PASS, exit code 0).
   - Tests de Integración (RutaDoc + TramiCore): 31/31 tests PASS (exit code 0).
   - Typechecks y Builds (Backend y Frontend): 0 errores (exit code 0).
   - Directivas: `COMMIT = NO`, `PUSH = NO`.


---

## 29. Cierre Pre-Exposición en `B_GERIC`: Flujo Certificado de Inglés (`p1-fila-06`) e Incidencias Conocidas

1. **Endurecimiento del Circuito con Evaluación Técnica Obligatoria (`p1-fila-06` — Certificado de Inglés):**
   - Bloqueo en RutaDoc contra derivaciones ordinarias prematuras (`SDA -> DIR` sin asignación formal ni dictamen técnico válido) y exigencia de evidencia técnica para `enviar-a-firma` y `resolver` cuando `unidad_responsable_id !== unidad_resolutiva_id`.
   - Conservación de derivaciones correctivas/excepcionales únicamente para roles autorizados (`SECRETARIO`, `DIRECTOR`, `ADMINISTRADOR`, `SUPERADMINISTRADOR`) con justificación (`>= 10` caracteres) y evento outbox `DerivacionCorrectivaExcepcionalRegistrada`, sin marcar `ATENCION_TECNICA` como completada.
   - Coherencia de acciones y `siguienteAccion` real por etapa en `ExpedienteDetallePage.tsx`.
   - `EXP-2026-000149` conservado intacto en PostgreSQL (`EN_REVISION` en `DIR`) para demostración.

2. **Incidencia Conocida Documentada (Sin Modificación):**
   - **`EXP-2026-000150` (Resolución de laboratorio sin objeto PDF en MinIO):** Se deja documentado que la resolución registrada para `EXP-2026-000150` presenta hash SHA-256 de contenido vacío (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`) al no existir el archivo PDF físico en MinIO. No se modifica ni regenera el expediente/documento para no ocultar la incidencia.
