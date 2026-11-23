# CP-CIERRE-002 — Cierre funcional por dependencias

Fecha: 2026-10-19. Rama: `B_JACOBO`. HEAD: `bf30d8a0c85e266a86381fb10bf3740a8451c032`.

Esta ejecución implementó correcciones de autorización institucional, Administración y Reportes. Conservó los recorridos anteriores y ejecutó regresiones. **Los nueve módulos todavía no cumplen todos sus criterios E2E**: existen dependencias institucionales, de persistencia y de firma que no pueden sustituirse por datos simulados.

## 1. Estado de los nueve módulos

La evidencia E2E histórica procede de los recorridos confirmados por el usuario. En esta ejecución no se repitieron radicación, login válido, observación ni firma: producirían escrituras no autorizadas.

| Módulo | Frontend | Backend | PostgreSQL/servicios | Prueba real de esta ejecución | Estado final |
|---|---|---|---|---|---|
| Iniciar Sesión | Conservado; roles y facultades de la respuesta; renovación actualiza facultades | Cuenta activa y RBAC vigentes; rotación de refresh atómica | Sesiones existentes conservadas | Pantalla en Chrome; rechazos de JWT en API. No nuevo login | **VERIFICADO E2E previamente**; renovación corregida, probada con dobles |
| Mesa de Partes Virtual | Wizard original conservado | Radicación original conservada | Expediente/trámite/PDF existentes | Wizard en Chrome; catálogo TUPA HTTP 200; PDF recuperado | **VERIFICADO E2E previamente**; sin segunda radicación |
| Bandeja de Expedientes | Detalle, Trazabilidad y visor conservados | Propiedad y alcance global controlados | 5 expedientes y 5 trámites sin cambios | SQL y Storage reales; rechazo sin JWT en API y Chrome. No nueva navegación autenticada | **VERIFICADO E2E previamente** para lectura/PDF; recepción-calificación **BLOQUEADA** |
| Casilla Electrónica | Conexiones previas conservadas | Observación/Outbox/deduplicación con regresión aprobada | 4 notificaciones existentes; Outbox vacío | Rechazo sin JWT en API y Chrome; ningún evento procesado | **IMPLEMENTADO Y PROBADO parcialmente**; evento legítimo del expediente pendiente |
| Flujo y Firma Digital | Estados reales existentes conservados | Facultad persistida; un claim privilegiado no otorga firma ni eleva un rol de área a global | 0 registros de firma | Consulta SQL de facultad y estado negativo de pantalla/API | **IMPLEMENTADO Y PROBADO parcialmente**; firma real **BLOQUEADA** por proveedor/certificado/operador/autorización |
| Validador CVD | Error real mostrado en Chrome | API original y cotejo existente conservados | Ningún documento firmado verificable | HTTP 400 por formato y 404 por inexistencia; 404 visible en Chrome | **IMPLEMENTADO Y PROBADO**; caso negativo E2E comprobado, positivo **BLOQUEADO** |
| Panel de Administración | Directorio conservado; roles/permisos consultados y guardados mediante API | UUID, cuenta activa, `ADMIN_USUARIOS/GLOBAL` y asignación sin restricción de área | Directorio SQL real; 6 roles; 0 asignaciones vigentes; áreas/cargos vacíos | Lectura directa del servicio/repositorio; API sin JWT rechazada; redirección en Chrome | **IMPLEMENTADO Y PROBADO**; E2E autorizado y escrituras pendientes de identidad institucional |
| Registro Ciudadano | Validaciones y DTO anteriores conservados | Consultas corregidas anteriormente; bloqueo seguro 503 intacto | Modelo institucional insuficiente para todos los datos obligatorios; catálogo documental vacío según comparación previa | Formulario en Chrome; validación documental GET; regresiones sin crear cuentas | **BLOQUEADO** para alta completa; correcciones independientes implementadas y probadas |
| Reportes y Tableros | DTO MGD, filtros y series conectados; sin indicadores inventados | Proyecciones SELECT cuando faltan vistas; permiso `REPORTE_LEER/GLOBAL` | Cálculo real sobre tablas originales; sin DDL/refrescos | Resumen y series SQL reales; API sin JWT rechazada; error de autorización en Chrome | **IMPLEMENTADO Y PROBADO**; E2E de gráficas autorizado pendiente de RBAC |

## 2. Correcciones de esta ejecución

### Identidad, autorización y Administración

- El JWT identifica la cuenta. El proveedor productivo obtiene roles/facultades desde las relaciones vigentes de PostgreSQL y rechaza cuentas ausentes/inactivas.
- Una asignación de área no se interpreta como permiso global. Se conserva la propiedad documental.
- Los roles declarados en el JWT dejan de otorgar facultad de firma. La facultad procede de los roles/asignaciones y mecanismos de despacho persistidos.
- Login y perfil devuelven `roles` y `permisos` como campos adicionales, compatibles con los consumidores del campo `rol`. Una cuenta sin asignación recibe `roles: []` y `rol: ""`; no se le atribuye el rol institucional ficticio `ESTUDIANTE`.
- La renovación revoca el refresh anterior e inserta el siguiente en una única sentencia con CTE. Si falla la inserción se revierte toda la sentencia; si otro proceso consumió el token no se emiten credenciales.
- React conserva los roles/facultades recibidos y actualiza las facultades tras renovar. Ya no genera una matriz privilegiada de permisos en localStorage.
- La página original de Roles y Permisos consulta roles, conteos y catálogo reales. El guardado utiliza el contrato `PUT /api/v1/roles/:id/permisos`, previsto por el frontend original pero sin persistencia anterior. Se implementó dentro de OrganiCore y la composición existente en `app.ts`, con UUID, validación de catálogo y transacción. No se ejecutó este PUT contra PostgreSQL real.
- Se protegieron escrituras de organigrama/calendario y lectura de auditoría con la guardia persistida del Panel. Los catálogos de lectura permanecen disponibles para sus consumidores originales.
- Las mutaciones existentes de RutaDoc comprueban facultad y ámbito antes de abrir una transacción. No se añadieron transiciones ni una correspondencia artificial de operadores.

### Reportes

- React consumía una forma distinta del DTO MGD y enviaba parámetros que la API estricta rechazaba. Se alinearon las tres consultas originales: resumen, tendencias y cuellos de botella.
- Se añadieron filtros opcionales y compatibles de fechas/área. Los rangos que abarcan varios años consultan las series originales de cada año; no se mezclan las claves de caché de filtros distintos.
- Las vistas mensuales siguen utilizándose cuando existen y el filtro lo permite. Si faltan, o se requieren fechas diarias, el repositorio ejecuta la proyección SELECT de las definiciones locales existentes del script 07, contrastada con sus fórmulas MGD. **No se ejecutó ni editó ese script**.
- La clasificación `EN_TRAMITE` utiliza los mismos estados del script 06, sin exigir permisos de ejecución sobre su función auxiliar.
- Se corrigió la pérdida de áreas al construir una tendencia mensual: ahora se suman sus contadores.
- Nombres de áreas obtenidos de `sigd_org.area`; no se consulta una tabla `unidad_organica` inexistente.
- Un denominador inexistente se representa como «Sin datos suficientes», sin comparación intermensual ficticia. Una respuesta desconocida o un valor numérico corrupto no se convierte en estadísticas con ceros.
- No se muestran conformidad global, salud operativa o distribución de estados si la fuente no las proporciona. La leyenda de la serie refleja «atendidos», según el contrato backend. Exportar un indicador indisponible no exporta un cero como resultado válido.

## 3. Archivos modificados

| Archivo | Finalidad |
|---|---|
| `backend/src/app.ts` | Proveedor RBAC persistido, catálogo de roles, composición del guardado y protección administrativa |
| `backend/src/core/auth/auth.guard.ts` | Resolver facultades vigentes y alcance real de firma |
| `backend/src/core/storage/storage.router.ts` | Conservar la restricción de área al comprobar acceso global |
| `backend/src/domains/identicore/auth.router.ts` | Roles/facultades en login/perfil/refresh y rotación atómica |
| `backend/src/domains/organicore/usuariosAdmin.routes.ts` | Alcance global y contexto del actor autorizado |
| `backend/src/domains/organicore/usuariosAdmin.service.ts` | Edición transaccional de permisos existentes del rol |
| `backend/src/domains/organicore/adminMaestras.routes.ts` | Protección de la escritura de feriado excepcional |
| `backend/src/domains/rutadoc/rutadoc.router.ts` | Control de permiso/ámbito antes de mutar |
| `backend/src/domains/rutadoc/rutadoc.types.ts` | Facultades opcionales en el actor interno |
| `backend/src/domains/corelink/mgdAnalytics.repository.ts` | Lecturas operativas, fechas y catálogo de áreas |
| `backend/src/domains/corelink/mgdAnalytics.service.ts` | Filtros/caché y suma mensual de áreas |
| `backend/src/domains/corelink/reportes.controller.ts` | Autorización persistida y disponibilidad de indicadores |
| `backend/src/domains/corelink/reportes.schemas.ts` | Filtros opcionales validados |
| `frontend/src/api/client.ts` | Renovar facultades junto con tokens |
| `frontend/src/stores/authStore.ts` | Usar facultades devueltas por IdentiCore |
| `frontend/src/routes/ProtectedRoute.tsx` | Guardias coherentes con las facultades recibidas |
| `frontend/src/routes/AdminRoutes.tsx` | Acceso al directorio por facultad institucional |
| `frontend/src/pages/LoginPage.tsx` | Destinos de los códigos reales de rol |
| `frontend/src/hooks/useRbacConfig.ts` | Consulta/guardado real, errores y prevención de duplicados |
| `frontend/src/pages/administracion/RolesPermisosPage.tsx` | Mostrar el catálogo RBAC persistido |
| `frontend/src/hooks/useDashboardMetrics.ts` | Consumir los DTO y filtros reales de Reportes |
| `frontend/src/pages/reportes/DashboardEjecutivoPage.tsx` | Estados auténticos, reintento y exportación sin ceros ficticios |
| `frontend/src/components/reportes/ExecutiveKpiCard.tsx` | Presentar indicadores indisponibles sin falsos resultados |
| `frontend/src/types/dashboardEjecutivo.ts` | Disponibilidad opcional y compatible |

Pruebas añadidas/actualizadas: `backend/tests/unit/auth-rbac-persistido.spec.ts`, `backend/tests/unit/domains/corelink/reportes-operativos.spec.ts`, `backend/tests/unit/app-routes.spec.ts`, `backend/tests/unit/domains/identicore/auth.router.spec.ts`, `backend/tests/unit/domains/organicore/usuariosAdmin.routes.spec.ts`, `backend/tests/unit/domains/rutadoc/bandeja-authorization-http.spec.ts`, `frontend/tests/unit/api/authentication401.test.ts`, `frontend/tests/unit/hooks/rbacRolesCanonicos.test.ts`, `frontend/tests/unit/pages/DashboardEjecutivoPage.test.tsx`, `frontend/tests/unit/pages/LoginPage.test.tsx`, `frontend/tests/unit/routes/usuariosAdminRoutes.test.tsx`.

## 4. Evidencia técnica

- Backend: `npm.cmd run typecheck`, aprobado.
- Frontend: `npm.cmd run typecheck`, aprobado.
- Regresión backend seleccionada con `npm.cmd run test:unit -- --silent=true ...`: **673 aprobadas, 8 omitidas, 0 fallidas**. Incluye autenticación, RBAC, Administración, FSM, Casilla/Outbox, Firma/CVD, lecturas documentales, Registro y radicación. Tras retirar el rol supuesto de cuentas sin asignación, la repetición focalizada de `auth-rbac-persistido.spec.ts` y `auth.router.spec.ts` aprobó **150 pruebas**, incluida una regresión nueva: **674 pruebas distintas aprobadas** entre ambas ejecuciones. Los casos de escritura se ejecutaron con dobles; no prueban persistencia real de esas operaciones. Las omisiones preexistentes corresponden a pruebas Outbox con PostgreSQL y una de catálogos.
- Regresión frontend seleccionada con `npx.cmd vitest run --config ./vitest.config.ts ...`: **281 aprobadas, 1 omitida, 0 fallidas**, en 17 archivos. La repetición focalizada de Login, renovación y guardias aprobó **55 pruebas**, incluida una regresión nueva: **282 pruebas distintas aprobadas**, sin sumar dos veces las repetidas.
- `git diff --check`: sin errores de whitespace. Avisos habituales de conversión LF/CRLF no implican errores del diff.

### PostgreSQL y Storage reales

Conexión exclusiva `127.0.0.1:5434/sigd_suiza_repro_2026101801`, usuario `sigd_seguridad_20261018_ro`, `transaction_read_only=on`, sin superusuario ni bypass RLS. No se utilizó la credencial administrativa como conexión del backend.

- Directorio del servicio original: filtro sintético devuelve 3 cuentas, todas con UUID; 6 roles, 0 áreas, 0 cargos. Esta ejecución SQL no constituye una sesión HTTP administrativa.
- RBAC: 0 asignaciones de usuario vigentes y 0 relaciones rol-permiso; la cuenta titular no tiene facultad institucional de firma. No se otorgaron privilegios.
- Reportes: 5 radicados, 0 atendidos/archivados/resueltos, 1 en trámite, 0 observados; serie de 12 meses y un grupo sin área asignada. La ausencia de resoluciones no acredita TPR/TRO.
- PDF existente del expediente `9ba0ece5-2c71-4508-aed8-939ca1a5785c`: GET 200 desde `sigd-seguridad-aislada`, 998 bytes, cabecera PDF y SHA-256 coincidente con la referencia persistida. No se subió/reemplazó ningún objeto.
- Antes/después se compararon cantidad y huella de cuentas, sesiones, personas, asignaciones, permisos de rol, adjuntos, firmas, expedientes, trámites, movimientos, contadores, Outbox y Casilla: **sin cambios**. Conteos relevantes: 3 cuentas, 4 sesiones, 5 expedientes, 5 trámites, 6 movimientos, 0 firmas y 0 eventos Outbox.

### HTTP y Chrome reales

Backend temporal con `construirApp`, pool de lectura y métodos restringidos a GET/OPTIONS; React local mediante Vite. Puertos `3002/5174`. Sin workers, migraciones, firmas, login válido, tokens fabricados ni JWT inyectado en Chrome.

18 comprobaciones HTTP: 401 sin JWT y con JWT inválido en Directorio, Roles, Reportes, estado de firma, Storage, Expedientes y Casilla; CVD 400 y 404; validación de DNI responde 200 con `valido=false` conforme a su contrato; TUPA 200. Los 403 de identidades activas sin facultad se verificaron con contratos unitarios, no con nuevas sesiones reales.

Chrome ejecutó nueve comprobaciones: Login, redirección administrativa sin sesión, Firma sin sesión, Reportes sin sesión, Registro, Wizard, Casilla sin sesión, Bandeja sin sesión y CVD inexistente. Se esperó a que desapareciera SplashScreen. CVD mostró el 404 real, Firma no mostró una firma completada, Casilla/Bandeja mostraron errores sin revelar registros y Reportes no mostró estadísticas ante 401. Las peticiones observadas apuntaron a `3002`, sin excepciones de ejecución. Esto no valida positivamente pantallas que exigen una cuenta privilegiada.

Evidencia local sin credenciales: `%TEMP%\sigd-cierre-evidencia-20261019\evidence.json` y capturas PNG. Los procesos temporales propios se cerraron; se comprobaron libres `3002`, `5174` y `9223`.

## 5. SUPERADMIN y decisiones indispensables

El catálogo institucional define `ADMINISTRADOR` con descripción de administración técnica total. Su restricción original no contempla el código `SUPER_ADMIN`; este último procede de consumidores heredados. No se creó un alias privilegiado ni se otorgaron facultades por el nombre del rol.

El alcance administrativo se comprueba mediante `ADMIN_USUARIOS/GLOBAL` y asignación vigente sin restricción de área. Reportes exige `REPORTE_LEER/GLOBAL`. La firma conserva sus requisitos específicos. Editar permisos está implementado, pero no se ejecutó una modificación de RBAC real.

Decisiones agrupadas para la siguiente ejecución; **ninguna fue aplicada**:

1. **RBAC y pruebas autenticadas:** confirmar institucionalmente si `ADMINISTRADOR` representa al SUPERADMIN solicitado; aportar/designar una identidad institucional legítima y sus asignaciones aprobadas para el entorno aislado. No promover automáticamente cuentas ciudadanas. Una vez concretada esa identidad, aprobar los inicios de sesión necesarios —que insertan sesiones— y, separadamente, cualquier escritura administrativa de prueba. La consulta autenticada de Directorio/Roles/Reportes podrá entonces cerrarse E2E.
2. **RutaDoc/Casilla:** definir la fuente institucional del identificador de operador BIGINT y su correspondencia autorizada con la identidad UUID. La FSM mantiene `REGISTRADO → RECEPCIONADO → EN_CALIFICACION → OBSERVADO`, mediante los eventos originales `RECEPCION`, `INICIAR_CALIFICACION` y `OBSERVACION`; no implica que todas sus operaciones estén disponibles por HTTP. Faltan la conexión de recepción/calificación y un operador legítimo. Después se preparará la secuencia transaccional concreta para aprobación, limitada al expediente existente y su evento Outbox. No habrá actualización directa de estados ni generación de notificaciones al radicar.
3. **Registro Ciudadano:** aprobar o rechazar la evolución mínima aislada descrita abajo. Bajo el esquema actual el alta completa es imposible sin perder datos obligatorios; se conserva `REGISTRO_MODELO_NO_COMPATIBLE`.
4. **Firma/CVD positivo:** disponer del proveedor y certificado legítimos, operador facultado y autorización específica para el envío/firma de un documento. Un hash coincidente y un callback HMAC no sustituyen la validación criptográfica ni acreditan por sí solos vigencia del certificado. No se insertarán firmas/CVD manualmente.

### Única alternativa mínima de persistencia para Registro

Propuesta **solo para `5434/sigd_suiza_repro_2026101801`**, no aplicada ni incorporada a las migraciones institucionales:

| Objeto existente | Ampliación propuesta | Restricción/compatibilidad |
|---|---|---|
| `sigd_auth.persona_natural` | `direccion VARCHAR(250)`, `ubigeo_distrito CHAR(6)`, `declaracion_jurada_aceptada BOOLEAN` | Campos nuevos anulables para preservar identidades anteriores; nuevas altas exigirán dirección completa, distrito institucional de Ucayali y declaración `true` |
| `sigd_auth.persona_juridica` | `ubigeo_distrito CHAR(6)`, `declaracion_jurada_aceptada BOOLEAN`, `partida_registral VARCHAR(18)` | Se reutiliza `direccion` existente; partida opcional de 1–18 dígitos; no se sustituye representación legal |
| `sigd_auth.cuenta_usuario` | `acepta_notificaciones BOOLEAN` | Anulable para cuentas anteriores; en nuevas altas persistir explícitamente tanto aceptación como rechazo, sin confundirlo con tratamiento de datos |
| `sigd_auth.tipos_documento` | Configuración de los códigos originales requeridos DNI/CE/RUC | IDs SMALLINT generados por su identidad original. Aprobar valores institucionales antes de cargar; no copiar identidades ni inventar cuentas |

El distrito debe satisfacer el formato existente `^25[0-9]{4}$` y la validación del catálogo institucional ya utilizado por el módulo. El consentimiento de tratamiento conserva su relación original `sigd_auth.consentimiento_datos`, con finalidad, versión, fecha e IP; no se usa como un campo domiciliario. Fecha de nacimiento conserva `persona_natural.fecha_nacimiento`.

Procedimiento posterior si se autoriza: verificar destino exacto y estado del esquema; respaldo consistente privado de la base aislada; ampliación transaccional separada y revisada, sin tocar scripts originales; ajustar el repositorio para persistir todos los valores/consentimientos; aprobar una única alta sintética por el endpoint original; cotejar identidad, cuenta, historial y consentimiento. Ante fallo de la preparación, rollback. Si ya se almacenaron datos nuevos, volver a bloquear el alta y conservarlos; no eliminar columnas ni restaurar sobre otros avances automáticamente. Nunca aplicar esta propuesta en `5433`.

## 6. Integridad y punto de continuación

- PostgreSQL original `5433/sigd_prueba`: no se abrió ninguna conexión ni se ejecutó ninguna operación en esta ejecución.
- No hubo DDL, DML de escritura, migraciones, seeds, cambios de rol/credencial, eventos procesados ni modificaciones de objetos MinIO.
- Docker solo se inspeccionó. Contenedores compartidos `5173/3000`, bases, Redis, MinIO, volúmenes y redes no se modificaron.
- Las correcciones permanecen en el código local de `B_JACOBO`; no fueron desplegadas en `5173/3000`.
- No se modificaron esquemas, organización de módulos, tecnologías, Compose, Dockerfiles ni `.env`. Se reutilizaron IdentiCore, OrganiCore, RutaDoc y CoreLink.
- Las migraciones 02/06/07 y configuraciones Docker ya tenían cambios al comenzar. Se compararon sus huellas y las de los demás avances no intervenidos: permanecen idénticos al inicio. Este informe no certifica ni aplica aquellas diferencias anteriores.
- Git: 124 entradas al inicio, 147 al cierre con el formato habitual de `git status --short`; los archivos agrupados en directorios sin seguimiento se preservaron. Staging vacío. Rama y HEAD conservados. Sin commit, push, merge ni limpiezas.

Siguiente tarea concreta: resolver la identidad/asignación institucional de pruebas y la equivalencia SUPERADMIN/ADMINISTRADOR para cerrar **lecturas autorizadas de Administración y Reportes en React**, antes de aprobar escrituras administrativas. No hace falta crear vistas para validar las métricas implementadas.
