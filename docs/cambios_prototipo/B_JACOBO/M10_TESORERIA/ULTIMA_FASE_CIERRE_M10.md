## Actualización tras autorización de migración13 — verificado el31/10/2026

La migración13 está APLICADA en sigd_jacobo_demo con el runner institucional, y el backend fue activado mediante el único reinicio autorizado. El flujo público ya está VERIFICADO EN NAVEGADOR REAL5178/3008, sin cuenta ni JWT, con pago explícito de ensayo, recibo, PDF, CUT, cargo y seguimiento seguro.

| Modalidad | CUT | Expediente | Recibo |
|---|---|---|---|
| Pública sin cuenta |EXP-2026-000041|99c15974-38a7-4a50-8aaf-811f168a64d1|DEMO-RC-3|
| Registrada |EXP-2026-000042|5d2cbfbe-0406-4b45-9907-a6337f1eac54|DEMO-RC-4|

Se comprobaron la devolución nueva, el cierre de caja sin diferencias, cinco PDF MinIO, dieciocho comprobaciones HTTP y dieciocho conjuntos históricos intactos. No se modificaron las18 tarifas ni SUZ26-068; no se asignaron roles a trabajadores. Todo efectivo es DEMOSTRACIÓN SIN DINERO REAL.

Pruebas de esta activación:112 backend focalizadas y19 frontend focalizadas, builds aprobados. El caso gratuito no tiene un procedimiento oficial acreditado en el catálogo actual; no se inventó una tarifa0 para afirmar un E2E institucional gratuito.

Detalle, seguridad, evidencias y límites: [ACTIVACION_13_Y_E2E_PUBLICO.md](./ACTIVACION_13_Y_E2E_PUBLICO.md). Los bloqueos de migración/activación del texto anterior están superados; se conserva ese texto como historial previo a la autorización.

---

# Última fase de M10 — resultado verificable

31/10/2026. Rama B_JACOBO. HEAD bf30d8a0c85e266a86381fb10bf3740a8451c032.

## Estado ejecutivo

El funcionamiento anterior de efectivo, caja, devoluciones y radicación autenticada se conserva. No se repitió su E2E ni se crearon operaciones financieras nuevas. No se ejecutó DDL, DML, migraciones ni reinicios. Las huellas de trece conjuntos de registros coinciden al inicio y al final de esta intervención.

La orden pública sin cuenta quedó implementada en fuente y comprobada mediante pruebas focalizadas con dobles de base de datos. **No está activada ni probada de extremo a extremo con PostgreSQL y MinIO reales.** Se requiere autorización para una ampliación aditiva del esquema y, posteriormente, para cargar el backend actualizado. No se declara terminado ese recorrido.

## SUZ26-068

Concepto: Acceso a la Información Pública. La importación SQL identifica como fuente la página 6 de TUPA_2026_IESTP_Suiza.pdf, SHA-256 377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622.

Evidencias coincidentes:

- backend/carga_tupa_suiza_2026.sql, fila SUZ26-068: S/ 10,50 y S/ 10,00 por cada hoja; 0,19 % UIT.
- frontend/src/data/tupaSuiza2026.ts, SUZ26-068: conserva los dos importes y advierte que no se conoce su correspondencia.
- PostgreSQL: descripción equivalente; no tiene una tarifa financiera validada.
- Condiciones transcritas: solicitud dirigida a Dirección en FUT y pago del derecho en Tesorería. No se deducen otras condiciones administrativas.

No se encontró el PDF original con nombre TUPA en la búsqueda de archivos de la carpeta SIGD ni en FOTOS. Se comprobó la importación documentada, no una nueva lectura del original. No se accedió a una base protegida para buscarlo.

Falta una página 6 legible y/o aclaración institucional que establezca: si 10,50 es un derecho fijo; si 10,00 corresponde a reproducción por hoja; si son conceptos alternativos o acumulables; y en qué supuesto se aplica cada uno. El porcentaje UIT no resuelve esa ambigüedad y no se utilizó para recalcular importes.

Resultado: PENDIENTE DE VALIDACIÓN, sin cobro habilitado. Las otras 18 tarifas coinciden exactamente con la evidencia del cierre anterior; no se actualizaron.

## Permisos reales

Auditoría PostgreSQL y HTTP de solo lectura:

| Rol | Vigente | Asignaciones | Efecto administrativo M10 |
|---|---|---:|---|
| TESORERO | Sí | 1, identidad QA | Nueve permisos financieros |
| CAJERO | No | 0 | Ninguno |
| SUPERVISOR_TESORERIA | No | 0 | Ninguno |
| APROBADOR_DEVOLUCIONES | No | 0 | Ninguno |

Los enlaces históricos rol-permiso se conservan. La autorización combina rol TESORERO obtenido del RBAC vigente y permisos globales reales. No basta un rol declarado en el JWT. Una prueba HTTP con JWT de ciudadano que declara TESORERO/ADMINISTRADOR recibió 403. La identidad QA continúa rotulada DEMO QA Efectivo M10, correo @sandbox.invalid. No se asignaron roles a trabajadores ni a cuentas preexistentes durante esta fase.

| Permiso | TESORERO | CIUDADANO / acceso público |
|---|---|---|
| TESORERIA_LEER | Consulta administrativa | Sin permiso global; solo operaciones propias/capacidad del formulario |
| TESORERIA_TARIFA_PROPONER | Sí | No |
| TESORERIA_TARIFA_VALIDAR | Sí | No |
| TESORERIA_PAGO_REGISTRAR | Sí, efectivo y caja | No puede confirmar dinero recibido |
| TESORERIA_PAGO_VERIFICAR | Sí | No |
| TESORERIA_DEVOLUCION_EVALUAR | Sí | No |
| TESORERIA_DEVOLUCION_APROBAR | Sí | No |
| TESORERIA_DEVOLUCION_EJECUTAR | Sí | No |
| TESORERIA_REPORTES | Sí | No |

El ciudadano autenticado conserva consulta y solicitud de devolución por titularidad. No se concede esa autorización por coincidencia de un DNI. La nueva capacidad pública solo autoriza la orden del formulario y su recibo; no concede acceso a la administración ni a operaciones de otras personas.

## Orden pública implementada, no activada

La columna actual sigd_tes.orden_pago.ciudadano_id es NOT NULL y referencia cuenta_usuario. El esquema no tiene sesion_publica_hash. Por eso no es posible registrar correctamente una orden sin cuenta utilizando la estructura activa. No se creó una cuenta genérica ni se utilizó ciudadano.demo para evitar esa restricción.

Se preparó backend/migraciones/pendientes/13_sigd_tes_orden_publica.sql. No se ejecutó y no está en el conjunto de scripts activos. Contiene guardas de base/usuario demo, transacción, timeout, ampliación compatible de titularidad, hash de capacidad pública y datos declarados, e índice único para reintentos. Las órdenes históricas con cuenta conservan sus campos. La reversión física se prohíbe si existen hechos públicos; no debe borrar operaciones para permitirla.

Código preparado:

- POST /api/v1/tramites/publico/ordenes: requiere sesión pública, reto previo, consentimiento, declaración y límites antiabuso. El importe procede de una única tarifa vigente del backend. Un procedimiento gratuito no genera orden.
- GET /api/v1/tramites/publico/ordenes/:id: exige capacidad del formulario; no hay búsqueda pública por DNI ni listado de órdenes.
- GET /api/v1/tramites/publico/ordenes/:id/recibo: capacidad comprobada y recibo de pago verificado; URL MinIO de 60 segundos.
- Resolución de persona reutilizada desde M3, sin duplicar ni sobrescribir identidades existentes. No equivale a validación oficial de identidad.
- M3 exige coincidencia de persona, procedimiento y hash de sesión para aplicar la orden pública. Usuario nulo por sí mismo no constituye titularidad. La transacción conserva la aplicación única al expediente.
- El pago público explícitamente vinculado no se etiqueta como omisión de pago en el registro declarativo; un pago no verificado sigue rechazado incluso dentro del entorno demo.
- TESORERO reutiliza la búsqueda, caja y cobro existentes. La nueva orden no necesita un usuario institucional ficticio.
- Para una orden sin cuenta, se registra auditoría, pero no se publica una notificación de casilla a un destinatario nulo. Su confirmación es la consulta por capacidad. No se configura SMTP.
- OrdenPagoPublica se integra en el paso documental y solo aparece si el backend anuncia instalación. El backend actual no la anuncia; el flujo de demostración existente conserva su interfaz.

Conservación del acceso futuro: no se modificaron M1, OTP ni la reclamación de expedientes. La coincidencia de documento no convierte la orden pública en propiedad de una cuenta ni habilita una vinculación automática. Las vinculaciones futuras deben conservar la verificación institucional existente.

Riesgo pendiente: la sesión pública vigente dura 24 horas. Se debe probar el caso de pago seguido de vencimiento/pérdida de la sesión y definir recuperación segura; no se implementó una recuperación por DNI o correo libremente introducido. Tampoco se implementa en esta fase devolución anónima por mera posesión del DNI.

## Pruebas de esta fase

| Comprobación | Resultado y alcance |
|---|---|
| Lectura de roles, tarifas y esquema real | Aprobada, PostgreSQL demo y HTTP real |
| Conservación de operaciones | Aprobada: trece huellas idénticas |
| JWT con roles privilegiados inventados | Rechazado con 403 por backend real |
| Pruebas focalizadas iniciales M3/M10 | 104 aprobadas; incluyen reglas y HTTP con dobles, no persistencia nueva |
| Última repetición de pruebas públicas | 44 aprobadas; incluyen cuatro pruebas HTTP y cuatro pruebas de creación, reintento y gratuidad añadidas. Es un subconjunto actualizado, no sumar ambos conteos |
| Frontend orden pública y autenticada | 6 aprobadas con dobles de servicios |
| TypeScript backend/frontend | Aprobado |
| Build backend/frontend | Aprobado; frontend conserva advertencias de bundle/importaciones |
| ESLint de OrdenPagoPublica y servicio público | Aprobado |
| ESLint incluyendo StepDocumentos | No aprobado: error preexistente set-state-in-effect y dos advertencias de dependencias. Consta ya en consolidacion-lint-global.log anterior a esta intervención |
| git diff --check de archivos del alcance | Aprobado; advertencias de finales CRLF no son errores de whitespace |
| Nuevo E2E público con pago y persistencia | BLOQUEADO, no se ejecutó la ampliación del esquema ni activación |
| Nuevos cobros/devoluciones o CUT | No generados |

Las 1.486 pruebas backend, 941 frontend y E2E autenticado del cierre anterior son evidencia histórica conservada; no se presentan como suites ejecutadas otra vez en esta fase. Los casos de pago exacto/vuelto, caja, devoluciones y cargo conservan sus evidencias previas sin repetir ni alterar las operaciones. No existe un procedimiento gratuito institucional acreditado en el catálogo actual; sus reglas se prueban con fixtures, sin inventar una gratuidad oficial.

## Archivos de esta fase

- Nuevos: tesoreria.publica.ts; propuesta de migración 13; OrdenPagoPublica.tsx; pruebas publica.spec.ts y OrdenPagoPublica.test.tsx; lector QA de solo lectura.
- Modificados: radicacionPublica.router.ts, radicacionVirtual.service.ts, tesoreria.radicacion.ts, tesoreria.repository.ts, TramiteWizard.tsx, StepDocumentos.tsx, radicacionPublicaService.ts y pruebas públicas existentes.
- Documentación: este informe, formato de recibo, actualización de cierre, permisos y estado funcional.

Evidencias nuevas: scratch/evidencias-m10/ultima-fase/lectura-inicial.json y lectura-final.json. No contienen contraseñas ni tokens. Incluyen tarifas, roles, huellas y texto extraído del PDF real de ensayo.

## Operaciones pendientes de autorización y veredicto

1. Revisar y autorizar la propuesta 13 únicamente para sigd_jacobo_demo, con snapshot, registro de versión y comprobación de compatibilidad.
2. Autorizar posteriormente la carga controlada del backend actualizado. Esta tarea prohíbe reinicios; no se realizó ninguno.
3. Ejecutar el recorrido público con pago explícito, sin depender de la omisión demo, con documentación de ensayo y nuevos identificadores, conservando los registros anteriores.
4. Comprobar concurrencia, persistencia, PDF, cargo, seguimiento por capacidad y recuperación de sesión en ese recorrido.
5. Aclarar SUZ26-068, aprobar formato de recibo y designar TESORERO institucional.

Veredicto: M10 autenticado conserva su funcionamiento demostrado. La ampliación pública está IMPLEMENTADA SIN PRUEBA INTEGRAL y BLOQUEADA PARA ACTIVACIÓN por las restricciones actuales. No se declara preparación institucional completa hasta superar esos controles.
