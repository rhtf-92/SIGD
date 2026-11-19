# Activación controlada M10 — 31/10/2026

## Resultado ejecutivo

**ACTIVADO Y VERIFICADO EN EL BACKEND REAL 3008**, con pruebas de lectura y seguridad. Se reinició exclusivamente su instancia existente mediante el mismo lanzador y configuración demo. No se ejecutaron migraciones, no se alteraron cuentas ni roles, no se crearon sesiones, pagos, devoluciones, documentos o expedientes en esta intervención.

La activación no convierte el módulo en un sistema financiero institucional completamente validado. Tarifas oficiales, responsables y ciclo de pago/devolución persistente siguen pendientes de sus dependencias originales.

## Repositorio y alcance

- Rama B_JACOBO, HEAD `bf30d8a0c85e266a86381fb10bf3740a8451c032`.
- 292 entradas locales de Git al inicio, preservadas. No hubo commits, pushes, cambio de rama ni reversiones.
- No se modificó código de frontend/backend, el lanzador, Docker Compose ni el archivo privado de configuración durante la activación.
- Archivos nuevos: scripts de comprobación/reinicio en scratch, evidencias y este informe. Se actualiza RESULTADOS_PRUEBAS_M10.md para diferenciar el estado anterior del activado.

## Reinicio realizado

| Elemento | Antes | Después |
|---|---|---|
| Listener backend | 127.0.0.1:3008, PID 12908 | 127.0.0.1:3008, PID 18376 |
| Proceso lanzador | PID 3444 | PID 13756 |
| Lanzador | `node scratch/run_backend.cjs` | Mismo archivo, misma huella SHA-256 |
| Ejecución backend | Node con loader tsx, `src/server.ts` | Mismo mecanismo y directorio backend |
| Frontend | 127.0.0.1:5178, PID 21664 | Mismo proceso y listener |

Se verificó la identidad de los procesos y parentesco antes de detener únicamente PID 12908. Su lanzador terminó al finalizar el hijo. Se esperó a que desaparecieran ambos y quedara libre 3008 antes de iniciar el mismo lanzador una sola vez, en segundo plano oculto. Se comprobó que el nuevo listener pertenece al hijo de ese lanzador. No se abrió un servidor de pruebas adicional.

Compilación previa: `npm.cmd run build` del backend, salida 0. No se recompiló ni reinició el frontend durante esta activación.

## Configuración preservada y comprobada

- `SIGD_DEMO_OMITIR_PAGO=true`: heredado explícitamente por el lanzador, sin una sobrescritura falsa en el archivo privado. Se comprobó además su efecto real: los 19 procedimientos públicos devuelven `omisionPagoDemo=true` y habilitado=true desde el nuevo backend.
- `MIGRATE_ON_BOOT=false`, `VITE_AUTOSTART=false`: se verificaron antes del reinicio; el backend no llama al migrador ni inicia otro Vite.
- `SIGD_SAFE_BOOT=false`: era el valor existente y no se cambió en esta activación.
- SHA-256 del archivo privado de configuración y del lanzador iguales antes/después; no se publican contraseñas, claves ni tokens.
- Conexión efectiva: `current_database()=sigd_jacobo_demo`, `current_user=sigd_jacobo_user`, servidor `172.20.0.2:5432`, acceso local 5433. No se conectó a sigd_prueba.

PostgreSQL, Redis y MinIO continuaron saludables, con aproximadamente cinco horas de actividad ininterrumpida al verificarlos. Solo se ejecutó `docker ps` para consultar su estado, sin órdenes de reinicio/reconstrucción ni cambios en volúmenes.

## Autenticación: evidencia y límite explícito

El login positivo de este sistema inserta una fila en `sigd_auth.sesion_usuario`. Para cumplir la condición de no modificar datos, **no se ejecutó POST de login positivo, refresh ni logout**.

Se verificó la contraseña conocida de la cuenta DEMO autorizada contra su Argon2id real en memoria, sin imprimir ni cambiar contraseña/hash. Se emitió un JWT efímero de prueba mediante la función existente del proyecto, para esa misma cuenta, y se comprobó su aceptación por el backend real en `/api/v1/auth/me` y M10. Ese token y el estado del navegador solo existieron en memoria/contexto de prueba; no se guardaron tokens en evidencias.

Esto acredita validación criptográfica/JWT, consulta real de identidad y RBAC, **no un login positivo completo por navegador**. También se verificaron 401 sin token, con token vencido, con firma distinta y con credenciales de una cuenta inexistente. Esta última petición no crea una sesión.

No se asignó ningún rol financiero. Se comprobó que incluir nombres de roles privilegiados en un JWT de prueba del ciudadano no concede permisos financieros: el servidor consulta el RBAC real y devuelve 403.

## Resultados HTTP reales

27 comprobaciones conformes al contrato en `scratch/evidencias-m10/activacion-http.json`:

| Endpoint/condición | Resultado |
|---|---|
| /health | 200 |
| /ready | 200 |
| /auth/me sin JWT | 401 |
| /auth/login con cuenta inexistente | 401 |
| /auth/me con JWT DEMO efímero | 200, identidad real y CIUDADANO |
| /tesoreria/capacidades sin JWT | 401 |
| /tesoreria/capacidades ciudadano | 200, ciudadano=true, permisos financieros=[] |
| /tesoreria/catalogo | 200, 19 procedimientos, ninguna tarifa financiera aprobada |
| /tesoreria/ordenes | 200, listado propio vacío real |
| /tesoreria/movimientos | 200 |
| /tesoreria/ordenes/UUID inexistente | 404 |
| /tesoreria/tarifas ciudadano | 403 |
| /tesoreria/reportes ciudadano | 403 |
| /tesoreria/reportes con roles privilegiados declarados en JWT pero sin permiso real | 403 |
| /tesoreria/capacidades con JWT vencido | 401 |
| /tesoreria/capacidades con firma distinta | 401 |
| /tesoreria/documentos/ID DEMO existente | 200, descarga MinIO real e integridad SHA-256 comprobada |
| /tramites/publico/procedimientos | 200, omisión demo comprobada en los 19 |
| /tramites/tipos | 200, mismo ID de SUZ26-035 que M10 |
| /admin/usuarios ciudadano | 403 |
| /expedientes sin JWT | 401 |
| /validador/cvd/CVD-ACTIVACION-M10-0000 | 404 esperado, no se declaró auténtico un documento inexistente |
| /resoluciones/proyectos/UUID sin JWT | 401 |
| /firmas/pendientes ciudadano | 403 USER_CANNOT_SIGN |
| /casilla/estadisticas ciudadano | 200 |
| /casilla/notificaciones ciudadano | 200 |
| /reportes/dashboard/resumen ciudadano | 403 |

Los cuatro roles financieros y sus permisos están presentes en PostgreSQL; tienen cero asignaciones de usuario. Por ello no se certifica un acceso administrativo positivo con cuentas reales: asignar permisos para probarlo estaba expresamente prohibido.

## Navegador y relación M10–Mesa de Partes

Edge/Playwright abrió el frontend existente 5178 con llamadas al **backend permanente 3008 actualizado**, sin servidor efímero ni respuestas simuladas. El contexto usó el JWT DEMO efímero explicado arriba; no fingió un envío de credenciales al login.

Se comprobó:

1. Panel «Mis pagos y devoluciones», pestañas y listado vacío real.
2. Los 19 procedimientos sin tarifa validada no pueden seleccionarse para generar una orden; el formulario requerido impide enviar una selección vacía. No se creó una orden.
3. Mesa de Partes consulta `/auth/me`, autocompleta la identidad y bloquea su edición.
4. Se pudo avanzar al paso documental, seleccionar SUZ26-035 y consultar órdenes propias desde M10.
5. Se muestra el aviso «RADICACIÓN DEMOSTRATIVA SIN VERIFICACIÓN DE PAGO», con estado económico NO VERIFICADO y retención institucional.
6. No se adjuntó un archivo nuevo ni se pulsó Radicar. El contexto bloqueaba métodos de escritura como defensa adicional; ninguna escritura fue intentada ni bloqueada efectivamente.
7. Cero errores JavaScript y cero respuestas HTTP fallidas en las pantallas visitadas. Los 4xx esperados de seguridad se probaron fuera del navegador y constan por separado.

Capturas reales, inspeccionadas:

- `scratch/evidencias-m10/m10-activado-3008.png`.
- `scratch/evidencias-m10/m10-m3-activado-sin-radicar.png`.

## Alcance real de la comprobación de los nueve módulos

| Módulo | Evidencia de esta activación | Lo que no acredita |
|---|---|---|
| M1 | Argon2id, JWT, perfil, autocompletado y rechazos de autenticación | Nuevo registro o login positivo con sesión persistida |
| M2 | RBAC real, ciudadano rechazado para administración; roles financieros sin asignación | Operación administrativa positiva de un tesorero habilitado |
| M3 | Catálogo, acceso al wizard, identidad, selección y consulta de órdenes, omisión demo | Nueva radicación/cargo persistente después del reinicio |
| M4 | Ruta protegida conserva 401 sin sesión; expedientes/asientos íntegros | Derivación, archivado o ciclo completo nuevo |
| M5 | CVD inexistente rechazado; PDF existente descargado de MinIO y SHA-256 verificado | Nueva carga o firma auténtica de un documento institucional |
| M6 | Resoluciones protegidas conservan 401 | Nueva resolución o devolución administrativa |
| M7 | Ciudadano no puede firmar: 403 | Firma digital institucional real |
| M8 | Bandeja/estadísticas propias 200; bridge arranca sin errores | Depósito nuevo de notificación financiera persistente |
| M9 | Reporte institucional rechazado al ciudadano: 403 | Reporte administrativo positivo con permiso habilitado |

No se detectó regresión en estas comprobaciones acotadas. No se afirma que se hayan vuelto a probar de extremo a extremo los nueve módulos: hacerlo requeriría operaciones expresamente excluidas en esta activación. Las suites unitarias anteriores (1455 backend, 927 frontend) pertenecen al cierre de implementación, no se presentan como nuevas ejecuciones aquí.

## Conservación de datos

Comparación antes/después con SELECT en transacción READ ONLY sobre 17 tablas:

- 31 expedientes sigd_doc, 39 expedientes sigd_tra y 38 asientos: mismos registros y huellas.
- 12 cuentas, 21 personas, **660 sesiones**: sin nuevas sesiones ni cambios.
- 17 asignaciones usuario/rol y 32 relaciones rol/permiso: mismas huellas.
- Registro de migraciones: las mismas dos filas/versiones/checksums; no se ejecutó ninguna migración.
- M10: el mismo documento DEMO previo; cero tarifas, órdenes, pagos, aplicaciones, devoluciones, ejecuciones e historial financiero persistentes.

Las huellas de la configuración y el lanzador también coinciden. Evidencias: `activacion-antes.json` y `activacion-despues.json`, con `sinCambiosDeDatos=true`.

No se ejecutaron INSERT/UPDATE/DELETE/DDL de pruebas, no se alteraron expedientes previos ni se consumieron CUT. Se evitó también «Mis trámites» durante esta activación porque su GET registra auditoría de consulta; la lectura de historial integral ya fue probada en la fase anterior con fixtures revertidas.

## Logs e incidencias de comprobación

Arranque correcto y bridge escuchando como instancia-18376. Archivo stderr de backend de cero bytes al cierre de la comprobación. Frontend: sin errores JavaScript/HTTP en las pantallas recorridas. No se reinició para obtener este resultado.

Dos intentos iniciales del script de verificación fallaron por expectativas incorrectas del propio script: usaba tipo_tramite_id en lugar del alias real id y esperaba un botón disabled cuando la implementación deshabilita las opciones tarifarias y usa required nativo. Se corrigió exclusivamente el script, no código ni contratos. Se conservaron `activacion-http-primer-intento.json` y `activacion-http-segundo-intento.json`; el tercer intento completo terminó con salida 0.

Scripts: `scratch/m10-activacion-preflight.cjs` (lectura), `scratch/m10-reiniciar-backend.ps1` (reinicio autorizado, no volver a ejecutar como diagnóstico), `scratch/m10-validar-activacion.ts` (HTTP/navegador sin escrituras).

Logs de arranque: `activacion-backend-20261031-014335.stdout.log` y `.stderr.log`. Proceso: `activacion-proceso.json`. HTTP/UI: `activacion-http.json`. Todo dentro de `scratch/evidencias-m10/`.

## Diferencias y pendientes

**Implementado:** dominio financiero, esquema, roles, UI, reglas, M3/M8, archivos y auditoría descritos en el cierre anterior.

**Activado ahora:** código vigente en la instancia permanente 3008; acceso ciudadano, comprobaciones de autorización, lectura documental y conexión real M10–Mesa de Partes verificados sin alterar datos.

**Pendiente:** fuente tarifaria oficial y validación segregada; autorización/asignación de responsables por la institución; ciclo persistente con pago real autorizado y eventual devolución procedente; login positivo/registro si se autoriza la escritura técnica de sesiones/cuentas. También permanecen las limitaciones funcionales e institucionales anteriores: no hay SUNAT, pasarela, SMTP, cierre contable certificado ni reembolso bancario automático.

**No se declara completado el criterio financiero integral de M10.** La activación técnica sí concluyó conforme a las condiciones indicadas.
