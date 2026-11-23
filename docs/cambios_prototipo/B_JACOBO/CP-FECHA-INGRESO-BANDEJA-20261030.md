# Corrección de FECHA INGRESO en la bandeja

## Resultado

Corregida la columna sin alterar el diseño, los expedientes, los CUT ni las fechas almacenadas. Se comprobó la bandeja real mediante login normal con una cuenta MESA_PARTES de demostración y se contrastaron **19 expedientes** con PostgreSQL. El resultado visual se inspeccionó en la captura final.

## Causa demostrada

La bandeja mostraba `fechaRadicacion`, proveniente de `sigd_tra.expediente.fecha_radicacion`. Para solicitudes virtuales recibidas después del cierre, ese campo contiene el inicio legal proyectado de los plazos, no el instante real de recepción. Por ejemplo:

| CUT | Recepción real en Perú | Fecha legal guardada |
|---|---|---|
| EXP-2026-000033 | 30/10/2026 18:14:52 | 02/11/2026 08:00 |
| EXP-2026-000034 | 30/10/2026 18:31:43 | 02/11/2026 08:00 |
| EXP-2026-000035 | 30/10/2026 18:37:31 | 02/11/2026 08:00 |
| EXP-2026-000036 | 30/10/2026 18:40:07 | 02/11/2026 08:00 |

Además, `Intl.DateTimeFormat` no especificaba zona horaria y dependía de la configuración del navegador.

## Corrección implementada

- `backend/src/domains/rutadoc/rutadoc.repository.ts`: proyecta `fecha_ingreso` desde el primer asiento válido (`sigd_tra.asiento_registro.fecha_ingreso`), o desde `sigd_doc.expediente.fecha_registro` cuando falta ese asiento. El registro documental se vincula por UUID y CUT coincidentes. No usa `now()`, una fecha ficticia ni la fecha legal como reemplazo de una recepción desconocida. Los filtros diarios y sus contadores utilizan la misma fecha real y límites del día en `America/Lima`.
- `backend/src/domains/rutadoc/rutadoc.types.ts`: agrega `fechaIngreso` a la lectura. Conserva `fechaRadicacion` con su significado previo; no altera la máquina de estados, SLA, CUT ni cursores.
- `frontend/src/types/expediente.ts`: recibe el campo aditivo `fechaIngreso`.
- `frontend/src/components/expedientes/ExpedienteTable.tsx`: la columna utiliza `fechaIngreso`, con `Intl.DateTimeFormat('es-PE', {timeZone:'America/Lima', ...})`. Datos ausentes o inválidos muestran «—»; no se sustituyen por la fecha actual ni por la legal. No se cambiaron clases, dimensiones, encabezados ni estructura de la tabla.

Pruebas nuevas:

- `backend/tests/unit/domains/rutadoc/fecha-ingreso.spec.ts`.
- `frontend/tests/unit/components/ExpedienteTableFechas.test.tsx`.

Scripts de diagnóstico y comprobación en `scratch/`:

- `auditar-fechas-ingreso.cjs`: consultas de solo lectura con conexión efectiva comprobada, límites de tiempo y cierre en finally.
- `recargar-fechas-bandeja.cjs`: recarga controlada del backend identificado, sin migraciones.
- `verificar-fechas-bandeja-browser.cjs`: login real, comparación DOM/API/PostgreSQL y capturas. No muestra ni guarda contraseñas, hashes o tokens en las evidencias.

## Verificación real

La conexión comprobada corresponde a `sigd_jacobo_demo`, usuario `sigd_jacobo_user`, destino local `127.0.0.1:5433`, servidor efectivo `172.20.0.2:5432`. No se consultó `sigd_prueba`.

La API real devuelve por separado, por ejemplo para EXP-2026-000034:

```json
{
  "fechaIngreso": "2026-10-30T23:31:43.406Z",
  "fechaRadicacion": "2026-11-02T13:00:00.000Z"
}
```

La tabla muestra **30/10/2026**. Otros ejemplos comprobados: 000031–000037 muestran 30/10; 000019–000027 verificados muestran 29/10; 000012 y 000014 muestran 27/10 aunque sus timestamps UTC están en 28/10. El mismo resultado se obtuvo con el navegador en `America/Lima` y `Pacific/Auckland`.

Capturas reales 1448×1086:

- `scratch/evidencias-fechas-ingreso/bandeja-fechas-peru-1448x1086.png`.
- `scratch/evidencias-fechas-ingreso/bandeja-fechas-otro-huso-1448x1086.png`.
- `scratch/evidencias-fechas-ingreso/browser.json`: las 19 comparaciones, fechas de la API y resultado de independencia de zona horaria.
- `scratch/evidencias-fechas-ingreso/postgres-inicial.json` y `postgres-final.json`: fechas leídas de PostgreSQL.

La primera captura coincidió con el splash de carga aunque la tabla ya estaba en el DOM. Se corrigió la espera, se volvió a capturar y se inspeccionó la captura final de la bandeja.

## Pruebas ejecutadas

| Verificación | Resultado |
|---|---|
| Backend: fecha-ingreso, query, autorización de bandeja, autorización HTTP y área efectiva | 34 aprobadas |
| Frontend: fechas de ExpedienteTable y BandejaExpedientesPage | 41 aprobadas |
| Typecheck backend | Aprobado |
| Typecheck frontend | Aprobado |
| Build producción frontend | Aprobado; advertencias habituales de chunk grande/importación mixta y comentarios de Zod |
| Navegador real y API autenticada | Aprobado; 19 expedientes contrastados, sin fechas alteradas al cambiar el huso del navegador |
| Diff-check de archivos productivos intervenidos | Aprobado |

Las pruebas unitarias incluyen recepción de viernes frente al inicio legal del lunes, instantes UTC que corresponden al día anterior en Perú, cambio de año y ausencia de datos sin inventar reemplazos. No se ejecutó la suite global completa.

## Entorno e integridad

Rama conservada: `B_JACOBO`. HEAD: `bf30d8a0c85e266a86381fb10bf3740a8451c032`. Status inicial: 268 entradas; después de agregar los dos archivos de pruebas: 270 entradas. Las carpetas sin seguimiento ya existentes agrupan scripts y documentación. No hubo commits, pushes, cambios de rama, restauraciones ni eliminación de cambios previos.

Durante la verificación se observó uso concurrente del sistema: aparecieron nuevos expedientes 000037 y 000038, que **no fueron creados por estos scripts ni por esta intervención**. Por ello el conteo y la huella global de registros cambian entre instantáneas; no se presentan como prueba de inmutabilidad de toda la base. Las operaciones de diagnóstico fueron SELECT, sin UPDATE/DELETE/DDL y sin generación de CUT. Los logins de prueba exitosos utilizan el mecanismo normal de sesiones del sistema, que registra nuevas sesiones; no se alteraron datos de negocio históricos ni credenciales.

Dos credenciales demo guardadas fueron rechazadas. Se utilizó después la cuenta MESA_PARTES del archivo local existente, comprobando por lectura que su contraseña guardada correspondía al hash vigente antes de efectuar el login. No se cambiaron contraseñas, roles ni permisos.

Los tres contenedores y los procesos de la aplicación se detuvieron durante la comprobación. Se observó salida normal de los contenedores. Con autorización de ejecución se iniciaron **los mismos contenedores existentes**, sin reconstruirlos ni modificar configuración, y se utilizó el arranque demo establecido con `MIGRATE_ON_BOOT=false`. Backend final PID 4332, frontend final PID 20920. La omisión temporal de pago sigue activa y condicionada a la base demo.

No se ejecutaron migraciones, escrituras manuales de expedientes ni cambios históricos para corregir fechas. La solución es de lectura y presentación, preservando la fecha legal y el diseño existente.
