# Auditoría previa y contraste de cierre M10 — 31/10/2026

## Integridad del repositorio y entorno

Rama B_JACOBO, HEAD bf30d8a0c85e266a86381fb10bf3740a8451c032. Se identificaron 282 entradas de Git preexistentes antes de M10. Se conservaron las modificaciones locales de las fases anteriores, sin commits, pushes, cambios de rama ni reversiones masivas. Esta auditoría se realizó antes del código; se actualiza ahora con los resultados posteriores diferenciados.

Conexión efectiva inicial de solo lectura: base sigd_jacobo_demo, usuario sigd_jacobo_user, servidor 172.20.0.2:5432 mediante puerto local 5433. No se abrió una conexión a sigd_prueba. Backend 3008 y frontend 5178 existentes; PostgreSQL, Redis y MinIO no se reiniciaron. MIGRATE_ON_BOOT=false. El SIGD_SAFE_BOOT encontrado era false y se conservó; no se afirma haberlo cambiado a true.

## Arquitectura encontrada

Express por dominios, PostgreSQL con UUID para persona/cuenta/TUPA/expediente, autenticación JWT y permisos efectivos consultados en base, React con rutas públicas/protegidas. Los package.json reales usan React 19, Vite 6, TypeScript y Node; no se supuso React 18 por documentación histórica. Al comenzar no existía sigd_tes ni un catálogo financiero versionado NUMERIC.

Se inspeccionaron frontend/src/pages/HomePage.tsx, layouts/MainLayout.tsx, routes/AppRouter.tsx, stores/authStore.ts, servicios de trámite, WizardSteps, catálogo TypeScript; backend/src/app.ts, core/auth, core/storage, dominios identicore/tramicore/rutadoc/docucore, auditoría/despachador y migrador. Evidencia relacional inicial completa: scratch/evidencias-m10/auditoria.json (columnas, restricciones, roles, permisos y requisitos). No se modificó la configuración financiera del TUPA original.

HomePage distingue portada pública y tarjetas autenticadas. La tarjeta M10 se integra en la vista de cuenta; la fotografía, título, ondas, encabezado y las cuatro tarjetas públicas no fueron rediseñados.

## Estado de los nueve módulos

| Módulo | Estado observado y límite de evidencia |
|---|---|
| M1 | Registro/login/perfil existentes; login y JWT reales usados en integración M10. OTP/SMTP institucional sigue pendiente, no se configuró |
| M2 | RBAC y catálogo inspeccionados. Había seis roles; el CHECK requería una extensión aditiva para roles financieros. Las asignaciones de usuarios se preservan |
| M3 | Núcleo público/autenticado reutilizado. Radicación con orden, PDF, CUT, cargo e historial probada con SQL real y navegador dentro de transacción revertida; no es una nueva radicación persistente |
| M4 | Expedientes/seguimiento existentes; no se alteró su historia. El historial propio se consulta tras radicación de fixture |
| M5 | PDF y MinIO usados realmente, SHA-256 comprobado y documento de prueba persistido por API |
| M6 | Servicios de despacho existentes inspeccionados; no se emitió resolución de devolución institucional |
| M7 | Servicios de firma existentes; no se certificó firma institucional ni se inventó certificado |
| M8 | Outbox y Casilla reutilizados; despacho financiero real e idempotente probado en ROLLBACK, SSE sin datos financieros personales |
| M9 | Reportes preexistentes preservados; se añadió API de reporte M10 sin atribuir recaudación real a fixtures |

La suite global aprobada no demuestra todos los recorridos institucionales de los nueve módulos. No se ejecutaron indiscriminadamente suites DB antiguas que pudieran escribir sobre otro destino.

## Contraste TUPA

19 procedimientos vigentes y 3 inactivos heredados. El TypeScript contiene 72 conceptos informativos; no todos son procedimientos radicables. La descripción PostgreSQL y la carga SQL remiten al TUPA_2026_IESTP_Suiza.pdf, páginas 4–6. El PDF citado no se localizó en los directorios inspeccionados del repositorio/recursos: las cifras siguientes son declaraciones del catálogo, NO tarifas oficiales revalidadas en esta sesión.

| Código | Procedimiento | Importe declarado | % UIT declarado | ¿Gratuito? | Estado | Requisitos configurados | Unidad registrada | Fuente declarada | Verificación |
|---|---|---|---|---|---|---|---|---|---|
| SUZ26-031 | Constancia de No Adeudar — para fines de titulación | S/ 16.50 (0.30 % UIT vigente) | 0.30 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 4; no localizado | Pendiente de validación documental |
| SUZ26-034 | Expedición de Título | S/ 105.00 (1.90 % UIT vigente) | 1.90 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 4; no localizado | Pendiente de validación documental |
| SUZ26-035 | Certificado de Estudios Superiores (6 semestres) | S/ 124.00 (2.24 % UIT vigente) | 2.24 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 4; no localizado | Pendiente de validación documental |
| SUZ26-036 | Visación de Certificado de Estudios Superiores | S/ 16.00 (0.29 % UIT vigente) | 0.29 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 4; no localizado | Pendiente de validación documental |
| SUZ26-044 | Modificación de Datos del Título | S/ 269.00 (4.88 % UIT vigente) | 4.88 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 4; no localizado | Pendiente de validación documental |
| SUZ26-045 | Derecho de duplicado de Título | S/ 309.00 (5.61 % UIT vigente) | 5.61 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 4; no localizado | Pendiente de validación documental |
| SUZ26-050 | Derecho de Reincorporación (Reingreso) | S/ 300.00 | No precisado | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 5; no localizado | Pendiente de validación documental |
| SUZ26-051 | Constancia de Egresado | S/ 31.00 | No precisado | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 5; no localizado | Pendiente de validación documental |
| SUZ26-052 | Certificado de Bachillerato | S/ 42.00 (0.75 % UIT vigente) | 0.75 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 5; no localizado | Pendiente de validación documental |
| SUZ26-053 | Constancias — de título, estudios o matrícula | S/ 23.00 (0.41 % UIT vigente) | 0.41 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 5; no localizado | Pendiente de validación documental |
| SUZ26-054 | Convalidación entre Planes de Estudios | S/ 46.50 (0.84 % UIT vigente) | 0.84 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 5; no localizado | Pendiente de validación documental |
| SUZ26-055 | Convalidación por Unidades de Competencia | S/ 46.50 (0.84 % UIT vigente) | 0.84 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 5; no localizado | Pendiente de validación documental |
| SUZ26-056 | Devolución de Expediente | S/ 21.00 (0.37 % UIT vigente) | 0.37 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 5; no localizado | Pendiente de validación documental |
| SUZ26-063 | Reserva de Matrícula — ingresantes | S/ 66.00 (1.20 % UIT vigente) | 1.20 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 5; no localizado | Pendiente de validación documental |
| SUZ26-064 | Licencia de Estudios — estudiantes antiguos | S/ 66.00 (1.20 % UIT vigente) | 1.20 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 5; no localizado | Pendiente de validación documental |
| SUZ26-065 | Traslado Interno | S/ 309.00 (5.61 % UIT vigente) | 5.61 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 5; no localizado | Pendiente de validación documental |
| SUZ26-066 | Traslado Externo | S/ 412.00 (7.48 % UIT vigente) | 7.48 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional; FUT: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 5; no localizado | Pendiente de validación documental |
| SUZ26-068 | Acceso a la Información Pública | El cuadro muestra S/ 10.50 y también S/ 10.00 por cada hoja; consigna 0.19 % UIT vigente. | No precisado | No acreditada gratuidad | Vigente | FUT: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 6; no localizado | Pendiente de validación documental |
| SUZ26-072 | Titulación de Otros Institutos Tecnológicos | S/ 515.00 (9.35 % UIT vigente) | 9.35 | No acreditada gratuidad | Vigente | COMPROBANTE_PAGO: opcional | DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL | PDF citado, p. 6; no localizado | Pendiente de validación documental |

Resultado: 18 procedimientos tienen un importe declarado único y SUZ26-068 presenta ambigüedad de importe/unidad de cobro. Ninguno tiene gratuidad documentalmente acreditada en la evidencia disponible. No se sostiene la afirmación histórica «16 con costo y 3 gratuitos»; tampoco se declara verificado un importe por el solo texto «fuente verificada» dentro de una descripción.

Los requisitos configurados son mayoritariamente menciones opcionales de comprobante y, en algunos casos, FUT. No equivalen a una validación completa de condiciones académicas. No se fabricaron requisitos, plazos o fuentes. La unidad registrada es una cabecera general, no prueba suficiente de competencia administrativa específica para cada procedimiento.

## Pagos y deficiencias encontradas

El flujo previo conserva SIGD_DEMO_OMITIR_PAGO condicionado a base efectiva demo, con identificación y retención económica de la radicación. No existían orden financiera, verificación de abono ni devolución real. Un PDF adjunto no probaba pago. El despachador documental esperaba CUT; una orden anterior al expediente necesitaba contrato financiero específico. El SSE existente difundía eventos por canal: para M10 se restringió a invalidación sin datos personales.

La primera consulta de requisitos usó una columna descripcion inexistente y falló 42703; se corrigió a las columnas reales y se cerraron conexiones. No se interpretó el error como corrupción de datos. La ausencia inicial del registro de migraciones se resolvió con la definición canónica del migrador, sin ejecutar scripts históricos ni fingir que ya se aplicaron.

## Propuesta y ejecución

Se implementó sigd_tes con ocho tablas, permisos separados, tarifas documentadas con doble validación, órdenes previas al CUT, registro manual, revisión, aplicación transaccional M3, devolución segregada, auditoría y Outbox. La propuesta inicial era no ampliar roles antes de estudiar el CHECK; después de inspección se creó la migración 11 que conserva los seis códigos anteriores y agrega cuatro roles financieros. Ninguna cuenta existente recibió esos roles.

Las migraciones 10 y 11 se validaron primero en ROLLBACK y luego se aplicaron explícitamente solo a la demo. No se sembraron tarifas aprobadas ni transacciones financieras. Las reversiones versionadas se niegan a borrar datos o asignaciones. El backend permanente no se reinició automáticamente.

## Riesgos y plan de continuación

1. Activar código backend mediante reinicio controlado expresamente autorizado; conservar banderas y un solo proceso 3008.
2. Dirección/Tesorería deben aportar la fuente tarifaria y asignar responsables reales con segregación.
3. Validar versiones de tarifas; no inferir gratuidad por ausencia de datos.
4. Ejecutar un ciclo financiero persistente con pago real autorizado y eventual devolución procedente; no usar fixtures como evidencia bancaria.
5. Completar subsanación documental versionada, cierre/arqueo y pruebas de carga/carreras con conexiones independientes antes de producción.
6. Separar propietario DDL de usuario operativo PostgreSQL: los triggers protegen las operaciones ordinarias, no a un dueño con facultad de deshabilitarlos.
7. Diseñar acceso económico público previo al registro con identidad verificable, sin cuenta genérica, si se habilita fuera de la excepción demo.

Ver MODELO_DATOS_M10.md, ARQUITECTURA_M10.md, API_M10.md, MATRIZ_ROLES_PERMISOS_M10.md y RESULTADOS_PRUEBAS_M10.md. No se declara M10 terminado para producción: existe implementación probada internamente, con activación e integración financiera real pendientes.
