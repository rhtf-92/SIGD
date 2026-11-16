# Análisis del volumen sigd-validacion_pgdata_test

Fecha: 31 de octubre de 2026. Rama: **B_JACOBO**.  
Repositorio: `C:\Users\Liz\Desktop\SIGD\SIGD`.  
HEAD comprobado: `bf30d8a0c85e266a86381fb10bf3740a8451c032`.

## 1. Conclusión ejecutiva

El volumen **no está vacío ni contiene una sola base de pruebas**. La inspección física, realizada con PostgreSQL detenido, recuperó 16 nombres de bases del catálogo con directorios correspondientes: **13 relacionadas con SIGD y 3 de sistema**. Conserva versiones de esquemas, catálogos, cuentas, expedientes, documentos referenciados, movimientos y pruebas de distintos momentos del desarrollo.

Se identificó una antigua base llamada `sigd_jacobo_demo` dentro del volumen de 5434. **No es la instancia activa del mismo nombre en 5433.** La actual incorpora M10 y radicación pública y tiene más registros.

El respaldo de recuperación conocido de 5434 contiene 56 definiciones de tablas y 55 secciones de datos COPY. Su SHA-256 coincide exactamente con el documentado y con la copia archivada. En la comparación por clave primaria, **ninguna de las claves comparables de ese respaldo falta en la base activa**. Esto respalda la continuidad de aquella instantánea, pero no acredita igualdad de todas las columnas ni cobertura de las otras doce bases antiguas.

**Recomendación:** el volumen no es necesario para ejecutar la configuración actual de B_JACOBO, pero conviene conservarlo como archivo histórico hasta cerrar el inventario lógico y la cobertura de recuperación de las demás bases. **No puede certificarse todavía su eliminación sin pérdida de información importante.** Conservarlo archivado no exige mantener un segundo entorno en ejecución.

No se inició el contenedor, no se creó un entorno, no se restauraron datos, no se modificó el proyecto principal y no se eliminó ningún recurso.

## 2. Identificación inequívoca del proyecto y Compose

Evidencia obtenida de `docker inspect` y `docker compose ls -a`:

| Propiedad | Valor real |
|---|---|
| Contenedor | `sigd-validacion-postgres_test-1` |
| ID | `b36f168d9a46c719d34dc5c86c7c313b8bfa5f131c39ec0cb857eb3d91acbe43` |
| Etiqueta `com.docker.compose.project` | `sigd-validacion` |
| Etiqueta `com.docker.compose.service` | `postgres_test` |
| Etiqueta `com.docker.compose.project.config_files` | `C:\Users\Liz\Desktop\SIGD\SIGD\docker-compose.test.yml` |
| Etiqueta de directorio de trabajo | `C:\Users\Liz\Desktop\SIGD\SIGD` |
| Imagen | `postgres:18-alpine` |
| Estado | `exited` |
| Último inicio | `2026-10-29T14:07:22.984240363Z` |
| Última finalización | `2026-10-30T01:20:16.069118497Z` |
| Volumen | `sigd-validacion_pgdata_test`, montado en `/var/lib/postgresql` |
| PGDATA | `/var/lib/postgresql/18/docker` |
| Puerto configurado | 127.0.0.1:5434 → 5432 |
| Red | `sigd-validacion_default` |

Por tanto, el Compose que identifica la instancia actual es **docker-compose.test.yml**, no el principal. No se ejecutó `docker compose down` desde ningún archivo ni combinación de archivos.

El Compose principal `docker-compose.sigd.yml` también conserva un servicio opcional `postgres_test` bajo perfil `validacion` y una referencia externa al mismo volumen. Es una referencia histórica/inactiva; no cambia las etiquetas del contenedor actual. No se activó ese perfil ni se modificó el Compose.

## 3. Método de solo lectura y alcance de la evidencia

Se emplearon tres fuentes distintas:

1. **Volumen físico actual, detenido:** `docker cp <contenedor>:/var/lib/postgresql/18/docker/. -` produce un flujo tar leído directamente en memoria por Python. No se extrajo a disco ni se copió a PostgreSQL/B_JACOBO. Se inspeccionaron metadatos y catálogos físicos.
2. **Respaldos SQL existentes:** lectura de definiciones y secciones COPY; cálculo de hashes y conteos sin restauración ni impresión de filas.
3. **Base activa 5433:** conexión verificada exclusivamente a `sigd_jacobo_demo`; `BEGIN READ ONLY`, `transaction_read_only=on`, SELECT de estructura/conteos/claves y ROLLBACK. No se consultó `sigd_prueba`.

La lectura física se apoyó en las estructuras públicas de PostgreSQL 18: mapa de relaciones, catálogo de bases, catálogo de relaciones/esquemas, encabezados de páginas y tuplas. Solo se imprimieron nombres técnicos y agregados. Referencias primarias: [pg_database](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/include/catalog/pg_database.h), [pg_class](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/include/catalog/pg_class.h), [pg_namespace](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/include/catalog/pg_namespace.h), [relmapper](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/backend/utils/cache/relmapper.c), [páginas](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/include/storage/bufpage.h), [punteros de tuplas](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/include/storage/itemid.h) y [encabezados de tuplas](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/include/access/htup_details.h).

### Límite importante de la lectura física

**No equivale a un SELECT del PostgreSQL antiguo.** No se reprodujo WAL ni se resolvió la visibilidad transaccional MVCC. Los catálogos pueden conservar versiones antiguas y las páginas pueden incluir filas eliminadas, actualizadas o de transacciones abortadas.

Los nombres de base se correlacionaron con sus directorios OID. Las tablas y conteos físicos se presentan como evidencia de contenido recuperable, **no como un inventario lógico certificado tras recuperación**. No se deduce corrupción de una diferencia de conteos.

El contador físico cuenta versiones encontradas en páginas heap del archivo principal inspeccionado; no incluye relaciones TOAST como filas de negocio, ni certifica segmentos adicionales, visibilidad, checksums o restaurabilidad. Las tablas particionadas se distinguen de sus particiones.

Arrancar el PostgreSQL original podría escribir WAL, archivos de control o recuperación; no se hizo bajo la instrucción estricta de solo lectura. Tampoco se creó un contenedor auxiliar, clon persistente ni servidor adicional.

## 4. Contenido físico confirmado

- `PG_VERSION`: **18**.
- `global/pg_control`: presente.
- Archivos regulares observados: **8.564**.
- Suma de tamaños de archivos: **215.671.465 bytes**, aproximadamente 215,7 MB decimales.
- Directorios de base: **16**.
- Enlaces de tablespaces observados en `pg_tblspc`: **0**.

### Bases identificadas mediante catálogo físico y directorio

| OID físico | Nombre recuperado | Tablas sigd_* identificadas físicamente |
|---:|---|---:|
| 1 | `template1` | 0 |
| 4 | `template0` | 0 |
| 5 | `postgres` | 0 |
| 16384 | `sigd_migraciones_test` | 41 |
| 19452 | `sigd_baseline_v2_test` | 55 |
| 21813 | `sigd_runner_v2_test` | 55 |
| 24188 | `sigd_backend_v2_test` | 55 |
| 30005 | `sigd_suiza_repro_1792268803773` | 55 |
| 32367 | `sigd_suiza_repro_1792272307979` | 55 |
| 35057 | `sigd_suiza_repro_1792272593577` | 55 |
| 37556 | `sigd_suiza_repro_1792273661064` | 56 |
| 39968 | `sigd_copia_validacion07_1792274735535` | 56 |
| 42342 | `sigd_clasificacion_1792275959981` | 55 |
| 44704 | `sigd_suiza_repro_1792276646663` | 55 |
| 54581 | `sigd_suiza_repro_2026101801` | 56 |
| 70981 | `sigd_jacobo_demo` | 56 |

Las tres primeras son bases de sistema. Las trece restantes son variantes del proyecto. No se ha demostrado que todas permitan conexión ni que todas sus filas sigan siendo visibles después de una recuperación.

### Esquemas y variantes

- `sigd_migraciones_test`: tablas en `sigd_audit`, `sigd_auth`, `sigd_doc`, `sigd_org`, `sigd_tra`; sin las catorce tablas RutaDoc de la referencia posterior y sin `operador_identidad`.
- Las otras doce bases de proyecto incorporan también `sigd_rut`.
- No se encontró `sigd_tes` entre las tablas de aplicación recuperadas de estas bases antiguas.
- `sigd_suiza_repro_2026101801` y la antigua `sigd_jacobo_demo` tienen las 56 tablas de la referencia.
- Las variantes de 55 tablas carecen de `sigd_auth.operador_identidad` respecto de esa referencia.
- Dos catálogos físicos presentan además `sigd_tra.pg_temp_39924` y `sigd_tra.pg_temp_42330`. Se registran como artefactos físicos encontrados, no como tablas institucionales vigentes.
- El inventario de tablas de aplicación se restringió a esquemas `sigd_*`; no pretende enumerar todos los objetos del sistema, extensiones o esquema public.

## 5. Qué información conserva y para qué se utilizó

| Grupo | Evidencia | Utilidad atribuible con respaldo |
|---|---|---|
| Migraciones/baseline/runner/backend V2 | Nombres de bases, estructura y README | Validación de instalación, compatibilidad y ejecución de migraciones/pruebas. |
| Reproducciones TUPA | Bases `sigd_suiza_repro_*`, catálogos y referencias en README | Pruebas de carga del TUPA, idempotencia, requisitos y compatibilidad. |
| Copia de validación/clasificación | Bases nombradas y registros físicos en expedientes/asientos | Evidencia de escenarios documentarios de prueba; no se certifica su carácter institucional real. |
| `sigd_suiza_repro_2026101801` | Guía de entrega y CP-CIERRE-002; tablas de cuentas, sesiones y expedientes | Entorno histórico utilizado por demostraciones M1/M3/Casilla y comprobaciones de permisos. |
| Antigua `sigd_jacobo_demo` de 5434 | Catálogo físico y respaldo identificado por hash | Instantánea de recuperación antecesora de la demostración actual. |

No es solamente un catálogo vacío: hay contenido físico en tablas de personas, usuarios, sesiones, expedientes, asientos, trámites, documentos, notificaciones y movimientos, además de estados/roles/TUPA.

La documentación describe datos sintéticos y operaciones de demostración, pero **no acredita que todas las filas de las trece bases sean ficticias**. Los esquemas pueden contener información personal, hashes de contraseña y datos de sesión. Deben tratarse como material restringido; no se muestran valores de esas columnas.

Las referencias a documentos en PostgreSQL no garantizan que los PDF correspondientes estén dentro de este volumen. El almacenamiento documental es MinIO/S3; un respaldo SQL puede conservar metadatos y rutas, sin contener todos los objetos externos.

## 6. Relación con la recuperación documentada

La guía `docs/cambios_prototipo/B_JACOBO/GUIA-ENTREGA-SIGD.md:72–74` identifica el respaldo y advierte que postgres_test conserva otras bases y fue origen de recuperación.

Se verificó:

| Archivo existente | Tamaño | SHA-256 / resultado |
|---|---:|---|
| `scratch/backups/backup_jacobo_demo_5434.sql` | 286.522 bytes | `68363c04452fc21d07446f78415f126daefe60c150a2e0b33164d75dc68a27f8` |
| Copia en `LOCALAPPDATA/SIGD/backups/recuperacion-20261026-130536-ccfb7ecd/backup_jacobo_demo_5434.sql` | 286.522 bytes | Mismo SHA-256; coincide con la guía |
| `scratch/backups/backup_clean.sql` | 214.565 bytes | `e81bea781ac3d441e1eb50a9e66e313064a051a9b7fd259df07c2f867d32441b` |
| `scratch/backups/backup_sigd_sandbox_e2e.sql` | 438.716 bytes | `cb0a9484bcd9185a125f62dc86153d40e27f380d3f3c120f81ada16f944daba1` |

Los tres SQL contienen 56 sentencias CREATE TABLE y 55 COPY; el último está codificado UTF-16LE. No se ejecutó ninguno.

`backup_clean.sql` contiene una instantánea anterior: por ejemplo, dos expedientes doc frente a tres en el respaldo de recuperación y una resolución frente a dos. **No son archivos intercambiables por su nombre.** El respaldo sandbox tiene otra procedencia; no se considera copia completa del volumen de validación.

El hash coincidente prueba identidad binaria de las dos copias de recuperación y su coincidencia documental. No prueba restaurabilidad ni cobertura de las trece bases. El volumen actual contiene más estados/versiones físicos que la instantánea; por ejemplo, en la antigua base demo aparecen cinco versiones físicas de expediente frente a tres filas del dump. Esto no demuestra dos expedientes vigentes adicionales: pueden ser versiones MVCC.

## 7. Comparación con sigd_jacobo_demo activa, puerto 5433

### 7.1 Estructura

La base activa fue identificada por su conexión real: `127.0.0.1:5433/sigd_jacobo_demo`. No se consultó la base protegida.

- Respaldo de recuperación: **56 tablas sigd_***.
- Base activa: **67 tablas sigd_***, incluyendo padre particionado y particiones.
- Ninguna tabla del respaldo está ausente por nombre en la base activa.
- Once tablas actuales adicionales: las diez de Tesorería y `sigd_tra.radicacion_publica`.
- Las tablas de M10 son `aplicacion_pago`, `caja`, `devolucion`, `documento`, `ejecucion_devolucion`, `historial`, `movimiento_caja`, `orden_pago`, `pago` y `tarifa`.

Se cotejaron nombres de columnas de las secciones COPY. Las columnas `anio` y `es_feriado` de calendario aparecen fuera de COPY porque son generadas: **ya existen en el CREATE TABLE del respaldo**, por lo que no se reportan como columnas nuevas. No se realizó un diff exhaustivo de todas las funciones, índices, privilegios, políticas, extensiones, triggers y restricciones.

### 7.2 Conteos exactos del respaldo y SELECT actuales

La columna histórica cuenta filas de COPY del SQL, no versiones físicas del volumen actual. La columna actual usa SELECT COUNT(*) sobre la base demo de 5433. No se suman padre y particiones como registros distintos.

| Tabla | Respaldo recuperación | Demo actual |
|---|---:|---:|
| `sigd_audit.bitacora_auditoria` | 2 | 60 |
| `sigd_audit.evento_outbox` | 2 | 67 |
| `sigd_auth.auditoria_usuarios` | 1 | 9 |
| `sigd_auth.consentimiento_datos` | 2 | 10 |
| `sigd_auth.cuenta_usuario` | 7 | 15 |
| `sigd_auth.notificacion_casilla` | 2 | 34 |
| `sigd_auth.operador_identidad` | 5 | 6 |
| `sigd_auth.perfil_usuario` | 5 | 13 |
| `sigd_auth.persona` | 7 | 26 |
| `sigd_auth.persona_documento_historial` | 1 | 8 |
| `sigd_auth.persona_juridica` | 0 | 0 |
| `sigd_auth.persona_natural` | 7 | 26 |
| `sigd_auth.representacion_legal` | 0 | 0 |
| `sigd_auth.sesion_usuario` | 57 | 677 |
| `sigd_auth.tipos_documento` | 4 | 4 |
| `sigd_doc.documento_adjunto` | 3 | 34 |
| `sigd_doc.expediente` | 3 | 34 |
| `sigd_doc.expediente_formulario_respuesta` | 0 | 0 |
| `sigd_doc.expediente_requisito` | 0 | 0 |
| `sigd_doc.firma_digital_documento` | 1 | 3 |
| `sigd_doc.formulario_version` | 0 | 0 |
| `sigd_doc.requisito` | 3 | 23 |
| `sigd_doc.resolucion` | 2 | 8 |
| `sigd_doc.tipo_documento` | 2 | 2 |
| `sigd_doc.tipo_documento_requisito` | 3 | 23 |
| `sigd_doc.tipo_tramite_tupa` | 3 | 22 |
| `sigd_org.area` | 3 | 3 |
| `sigd_org.asignacion_personal` | 0 | 0 |
| `sigd_org.calendario_laboral` | 2 | 2 |
| `sigd_org.cargo` | 3 | 3 |
| `sigd_org.encargatura_despacho` | 0 | 0 |
| `sigd_org.facultad_despacho` | 3 | 3 |
| `sigd_org.permiso_sistema` | 6 | 15 |
| `sigd_org.rol_permiso` | 19 | 37 |
| `sigd_org.rol_sistema` | 6 | 10 |
| `sigd_org.usuario_rol` | 12 | 20 |
| `sigd_rut.accion_compensatoria` | 1 | 1 |
| `sigd_rut.accion_tramite` | 9 | 9 |
| `sigd_rut.contador_pestana_local` | 6 | 6 |
| `sigd_rut.estado_actual_expediente` | 3 | 18 |
| `sigd_rut.estado_tramite` | 10 | 10 |
| `sigd_rut.movimiento_compensatorio` | 0 | 0 |
| `sigd_rut.movimiento_identidad` | 2 | 40 |
| `sigd_rut.movimiento_secuencia` | 3 | 18 |
| `sigd_rut.movimiento_tramite_2026` | 2 | 40 |
| `sigd_rut.movimiento_tramite_2027` | 0 | 0 |
| `sigd_rut.movimiento_tramite_default` | 0 | 0 |
| `sigd_rut.solicitud_compensacion_folios` | 0 | 0 |
| `sigd_rut.transicion_estado_tramite` | 13 | 13 |
| `sigd_tra.asiento_registro` | 2 | 41 |
| `sigd_tra.expediente` | 3 | 42 |
| `sigd_tra.expediente_acumulacion` | 0 | 0 |
| `sigd_tra.expediente_documento_folio` | 2 | 29 |
| `sigd_tra.secuencia_anual_cut` | 1 | 1 |
| `sigd_tra.tramite` | 2 | 30 |

El padre `sigd_rut.movimiento_tramite` no tiene COPY propio en el respaldo; sus particiones contienen dos filas. El COUNT actual del padre es 40, las mismas que su partición 2026, no 80 movimientos.

Tablas nuevas: aplicaciones de pago 3, caja 3, devoluciones 3, documentos M10 8, ejecuciones 3, historial 27, movimientos de caja 7, órdenes 5, pagos 4, tarifas 18 y radicaciones públicas 7. Son conteos observados; no prueba de movimientos de dinero real.

### 7.3 Información exclusiva: qué se comprobó y qué no

Para las 55 tablas con COPY se compararon las claves primarias disponibles en el respaldo contra las claves de la tabla equivalente actual, incluidas claves compuestas. **Resultado: cero claves antiguas ausentes en cada tabla comparada.** Se hicieron las comparaciones en memoria y solo se mostraron agregados.

Esto permite afirmar que no se detectó una fila identificable exclusivamente en **ese respaldo de recuperación** respecto de la base actual, por su clave primaria.

No permite afirmar que:

- Los contenidos de todas las columnas sean idénticos: estados, contactos, sesiones, permisos y otros campos pueden haber cambiado.
- Las otras doce bases estén incluidas en el respaldo.
- Todas las versiones y registros del volumen actual estén reflejados en ese SQL.
- Los PDF y objetos externos estén íntegramente respaldados.
- No haya datos históricos útiles o únicos en las demás bases.

Las bases antiguas contienen variantes y artefactos de prueba que no forman parte del inventario normal de la base actual. Su **existencia estructural** se demuestra, pero su valor institucional y exclusividad de contenido no quedan resueltos por comparar una sola instantánea.

## 8. Recomendación y respuestas A–F

**A. ¿Qué contiene?** Un clúster físico PostgreSQL 18 de aproximadamente 215,7 MB, con 16 nombres/directorios de bases identificados: 13 de SIGD y 3 de sistema. Conserva esquemas de seis áreas documentarias previas a M10, catálogos y datos de identidad/tramitación/pruebas.

**B. ¿Para qué se utilizó?** Pruebas de migraciones, baseline/backend V2, reproducción del TUPA, validación documentaria y demostraciones. Una de sus bases sirvió como origen de recuperación documentado.

**C. ¿Qué información conserva?** Estados históricos de tablas, catálogos, cuentas/sesiones, personas, expedientes, asientos, documentos referenciados, resoluciones, notificaciones y movimientos. Los anexos distinguen filas de respaldo de versiones físicas.

**D. ¿Qué aporta a B_JACOBO?** No se identificó dependencia de ejecución del entorno actual: usa 5433 y sus volúmenes propios. Aporta evidencia histórica y posibilidad de recuperación/comparación de versiones. La instantánea conocida ya está representada por claves en la demo activa y existe como SQL archivado; no se demostró un dato operativo que deba importarse. No se copió nada.

**E. ¿Es necesario conservarlo?** No necesita estar encendido ni funcionar como segundo entorno. Recomiendo conservar temporalmente el volumen como archivo restringido mientras se decide la retención de las otras bases y se verifica cobertura de respaldo. No se recomienda conservación indefinida sin una política de retención.

**F. ¿Puede eliminarse sin perder información importante?** **Todavía no puede garantizarse.** La conclusión de cero claves faltantes se limita al respaldo identificado; no cubre el clúster completo ni sus objetos externos. La falta de clasificación de las otras bases y la ausencia de una comprobación de restaurabilidad impiden certificar la eliminación del volumen.

Antes de una eliminación futura debe existir una decisión explícita sobre cuáles de las trece bases son descartables y un respaldo recuperable de las que deban conservarse, incluidos documentos externos necesarios. Cualquier validación que requiera arrancar PostgreSQL, aplicar recuperación o restaurar un respaldo necesitará un alcance distinto al actual de solo lectura. No se propone crear un segundo entorno permanente.

La retirada del contenedor/red conservando el volumen es una decisión distinta de destruir el volumen. No se ejecutó ninguna en esta intervención.

## 9. Incidencias, límites y protección final

- Se inspeccionó `scratch/compare_databases.mjs`, pero **no se ejecutó**: referencia otros entornos y `sigd_prueba`, fuera del alcance.
- Una primera comparación de claves se interrumpió por la interpretación de un array de metadatos PostgreSQL. Se corrigió la serialización a JSON y se completó. No produjo escrituras.
- El respaldo sandbox inicialmente no se reconoció como SQL UTF-8; se detectó BOM UTF-16LE y se verificaron sus 56 definiciones/55 COPY. No se lo declaró vacío.
- La lectura física no interpreta MVCC completo, no restaura WAL y no certifica integridad del clúster. Es evidencia complementaria, no sustituto de una validación de recuperación.
- Los nombres de bases y tablas no prueban por sí solos que todas las filas sean sintéticas.
- No se imprimieron registros personales, contraseñas, hashes de autenticación ni tokens como resultado del análisis.
- El contenedor objetivo siguió `exited`, con las mismas horas de inicio/finalización. Su campo de salud histórico no se interpreta como un servidor activo.
- PostgreSQL principal `f057f2bf4352`, Redis `9da1bb32864b` y MinIO `54d72bc68ce7` siguieron saludables, con los mismos volúmenes y horas de inicio.
- Compose continúa mostrando `sigd running(3)` y `sigd-validacion exited(1)`. No hubo acciones down/up/start/restart/rm ni migraciones.
- Rama B_JACOBO y cambios locales preservados. Solo se crea este informe; no se modifica el informe previo ni se hacen commits/pushes.

## Anexo A. Tablas por base: referencia y diferencias

La referencia es el catálogo físico de la antigua `sigd_jacobo_demo`, con 56 tablas. Se enumeran por esquema; la tabla posterior expresa las diferencias de cada base.

### sigd_audit

- `sigd_audit.bitacora_auditoria`
- `sigd_audit.evento_outbox`

### sigd_auth

- `sigd_auth.auditoria_usuarios`
- `sigd_auth.consentimiento_datos`
- `sigd_auth.cuenta_usuario`
- `sigd_auth.notificacion_casilla`
- `sigd_auth.operador_identidad`
- `sigd_auth.perfil_usuario`
- `sigd_auth.persona`
- `sigd_auth.persona_documento_historial`
- `sigd_auth.persona_juridica`
- `sigd_auth.persona_natural`
- `sigd_auth.representacion_legal`
- `sigd_auth.sesion_usuario`
- `sigd_auth.tipos_documento`

### sigd_doc

- `sigd_doc.documento_adjunto`
- `sigd_doc.expediente`
- `sigd_doc.expediente_formulario_respuesta`
- `sigd_doc.expediente_requisito`
- `sigd_doc.firma_digital_documento`
- `sigd_doc.formulario_version`
- `sigd_doc.requisito`
- `sigd_doc.resolucion`
- `sigd_doc.tipo_documento`
- `sigd_doc.tipo_documento_requisito`
- `sigd_doc.tipo_tramite_tupa`

### sigd_org

- `sigd_org.area`
- `sigd_org.asignacion_personal`
- `sigd_org.calendario_laboral`
- `sigd_org.cargo`
- `sigd_org.encargatura_despacho`
- `sigd_org.facultad_despacho`
- `sigd_org.permiso_sistema`
- `sigd_org.rol_permiso`
- `sigd_org.rol_sistema`
- `sigd_org.usuario_rol`

### sigd_rut

- `sigd_rut.accion_compensatoria`
- `sigd_rut.accion_tramite`
- `sigd_rut.contador_pestana_local`
- `sigd_rut.estado_actual_expediente`
- `sigd_rut.estado_tramite`
- `sigd_rut.movimiento_compensatorio`
- `sigd_rut.movimiento_identidad`
- `sigd_rut.movimiento_secuencia`
- `sigd_rut.movimiento_tramite`
- `sigd_rut.movimiento_tramite_2026`
- `sigd_rut.movimiento_tramite_2027`
- `sigd_rut.movimiento_tramite_default`
- `sigd_rut.solicitud_compensacion_folios`
- `sigd_rut.transicion_estado_tramite`

### sigd_tra

- `sigd_tra.asiento_registro`
- `sigd_tra.expediente`
- `sigd_tra.expediente_acumulacion`
- `sigd_tra.expediente_documento_folio`
- `sigd_tra.secuencia_anual_cut`
- `sigd_tra.tramite`

| Base | Ausentes respecto de la referencia física | Adicionales |
|---|---|---|
| `sigd_migraciones_test` | Las 14 de sigd_rut y sigd_auth.operador_identidad | Ninguna |
| `sigd_baseline_v2_test` | sigd_auth.operador_identidad | Ninguna |
| `sigd_runner_v2_test` | sigd_auth.operador_identidad | Ninguna |
| `sigd_backend_v2_test` | sigd_auth.operador_identidad | Ninguna |
| `sigd_suiza_repro_1792268803773` | sigd_auth.operador_identidad | Ninguna |
| `sigd_suiza_repro_1792272307979` | sigd_auth.operador_identidad | Ninguna |
| `sigd_suiza_repro_1792272593577` | sigd_auth.operador_identidad | Ninguna |
| `sigd_suiza_repro_1792273661064` | sigd_auth.operador_identidad | sigd_tra.pg_temp_39924 |
| `sigd_copia_validacion07_1792274735535` | sigd_auth.operador_identidad | sigd_tra.pg_temp_42330 |
| `sigd_clasificacion_1792275959981` | sigd_auth.operador_identidad | Ninguna |
| `sigd_suiza_repro_1792276646663` | sigd_auth.operador_identidad | Ninguna |
| `sigd_suiza_repro_2026101801` | Ninguna | Ninguna |
| `sigd_jacobo_demo` | Ninguna | Ninguna |

## Anexo B. Versiones físicas por tabla y base

**No son COUNT(*) ni registros lógicamente vigentes.** Se muestran únicamente tablas con versiones físicas mayores que cero. Para el resto de tablas del inventario del anexo A, la inspección obtuvo cero versiones o, para el padre particionado, no aplica conteo físico propio. No deben sumarse ni interpretarse como nuevas radicaciones.

### sigd_migraciones_test (OID 16384)

| Tabla | Versiones físicas observadas |
|---|---:|
| `sigd_doc.tipo_tramite_tupa` | 3 |
| `sigd_org.calendario_laboral` | 2 |
| `sigd_org.permiso_sistema` | 6 |
| `sigd_org.rol_sistema` | 6 |

### sigd_baseline_v2_test (OID 19452)

| Tabla | Versiones físicas observadas |
|---|---:|
| `sigd_doc.tipo_tramite_tupa` | 3 |
| `sigd_org.calendario_laboral` | 2 |
| `sigd_org.permiso_sistema` | 6 |
| `sigd_org.rol_sistema` | 6 |
| `sigd_rut.accion_compensatoria` | 1 |
| `sigd_rut.accion_tramite` | 9 |
| `sigd_rut.contador_pestana_local` | 12 |
| `sigd_rut.estado_tramite` | 10 |
| `sigd_rut.transicion_estado_tramite` | 13 |

### sigd_runner_v2_test (OID 21813)

| Tabla | Versiones físicas observadas |
|---|---:|
| `sigd_doc.tipo_tramite_tupa` | 3 |
| `sigd_org.calendario_laboral` | 2 |
| `sigd_org.permiso_sistema` | 6 |
| `sigd_org.rol_sistema` | 6 |
| `sigd_rut.accion_compensatoria` | 1 |
| `sigd_rut.accion_tramite` | 9 |
| `sigd_rut.contador_pestana_local` | 12 |
| `sigd_rut.estado_tramite` | 10 |
| `sigd_rut.transicion_estado_tramite` | 13 |

### sigd_backend_v2_test (OID 24188)

| Tabla | Versiones físicas observadas |
|---|---:|
| `sigd_doc.tipo_tramite_tupa` | 3 |
| `sigd_org.calendario_laboral` | 2 |
| `sigd_org.permiso_sistema` | 6 |
| `sigd_org.rol_sistema` | 6 |
| `sigd_rut.accion_compensatoria` | 1 |
| `sigd_rut.accion_tramite` | 9 |
| `sigd_rut.contador_pestana_local` | 12 |
| `sigd_rut.estado_tramite` | 10 |
| `sigd_rut.transicion_estado_tramite` | 13 |

### sigd_suiza_repro_1792268803773 (OID 30005)

| Tabla | Versiones físicas observadas |
|---|---:|
| `sigd_auth.notificacion_casilla` | 1 |
| `sigd_doc.requisito` | 34 |
| `sigd_doc.tipo_documento` | 4 |
| `sigd_doc.tipo_documento_requisito` | 18 |
| `sigd_doc.tipo_tramite_tupa` | 34 |
| `sigd_org.calendario_laboral` | 2 |
| `sigd_org.permiso_sistema` | 6 |
| `sigd_org.rol_sistema` | 6 |
| `sigd_rut.accion_compensatoria` | 1 |
| `sigd_rut.accion_tramite` | 9 |
| `sigd_rut.contador_pestana_local` | 12 |
| `sigd_rut.estado_tramite` | 10 |
| `sigd_rut.transicion_estado_tramite` | 13 |

### sigd_suiza_repro_1792272307979 (OID 32367)

| Tabla | Versiones físicas observadas |
|---|---:|
| `sigd_auth.notificacion_casilla` | 1 |
| `sigd_auth.persona` | 4 |
| `sigd_doc.requisito` | 17 |
| `sigd_doc.tipo_documento` | 2 |
| `sigd_doc.tipo_documento_requisito` | 17 |
| `sigd_doc.tipo_tramite_tupa` | 22 |
| `sigd_org.area` | 4 |
| `sigd_org.calendario_laboral` | 2 |
| `sigd_org.permiso_sistema` | 6 |
| `sigd_org.rol_sistema` | 6 |
| `sigd_rut.accion_compensatoria` | 1 |
| `sigd_rut.accion_tramite` | 9 |
| `sigd_rut.contador_pestana_local` | 6 |
| `sigd_rut.estado_actual_expediente` | 26 |
| `sigd_rut.estado_tramite` | 10 |
| `sigd_rut.movimiento_compensatorio` | 4 |
| `sigd_rut.movimiento_identidad` | 25 |
| `sigd_rut.movimiento_secuencia` | 25 |
| `sigd_rut.movimiento_tramite_2026` | 24 |
| `sigd_rut.transicion_estado_tramite` | 13 |
| `sigd_tra.asiento_registro` | 8 |
| `sigd_tra.expediente` | 24 |
| `sigd_tra.secuencia_anual_cut` | 28 |

### sigd_suiza_repro_1792272593577 (OID 35057)

| Tabla | Versiones físicas observadas |
|---|---:|
| `sigd_auth.notificacion_casilla` | 1 |
| `sigd_auth.persona` | 1 |
| `sigd_doc.requisito` | 17 |
| `sigd_doc.tipo_documento` | 2 |
| `sigd_doc.tipo_documento_requisito` | 17 |
| `sigd_doc.tipo_tramite_tupa` | 22 |
| `sigd_org.area` | 1 |
| `sigd_org.calendario_laboral` | 2 |
| `sigd_org.permiso_sistema` | 6 |
| `sigd_org.rol_sistema` | 6 |
| `sigd_rut.accion_compensatoria` | 1 |
| `sigd_rut.accion_tramite` | 9 |
| `sigd_rut.contador_pestana_local` | 50 |
| `sigd_rut.estado_actual_expediente` | 26 |
| `sigd_rut.estado_tramite` | 10 |
| `sigd_rut.movimiento_compensatorio` | 1 |
| `sigd_rut.movimiento_identidad` | 25 |
| `sigd_rut.movimiento_secuencia` | 25 |
| `sigd_rut.movimiento_tramite_2026` | 24 |
| `sigd_rut.transicion_estado_tramite` | 13 |
| `sigd_tra.asiento_registro` | 2 |
| `sigd_tra.expediente` | 6 |
| `sigd_tra.secuencia_anual_cut` | 7 |

### sigd_suiza_repro_1792273661064 (OID 37556)

| Tabla | Versiones físicas observadas |
|---|---:|
| `sigd_auth.notificacion_casilla` | 1 |
| `sigd_doc.requisito` | 17 |
| `sigd_doc.tipo_documento` | 2 |
| `sigd_doc.tipo_documento_requisito` | 17 |
| `sigd_doc.tipo_tramite_tupa` | 22 |
| `sigd_org.calendario_laboral` | 2 |
| `sigd_org.permiso_sistema` | 6 |
| `sigd_org.rol_sistema` | 6 |
| `sigd_rut.accion_compensatoria` | 1 |
| `sigd_rut.accion_tramite` | 9 |
| `sigd_rut.contador_pestana_local` | 12 |
| `sigd_rut.estado_tramite` | 10 |
| `sigd_rut.transicion_estado_tramite` | 13 |

### sigd_copia_validacion07_1792274735535 (OID 39968)

| Tabla | Versiones físicas observadas |
|---|---:|
| `sigd_auth.cuenta_usuario` | 1 |
| `sigd_auth.notificacion_casilla` | 1 |
| `sigd_auth.persona` | 1 |
| `sigd_auth.persona_natural` | 1 |
| `sigd_auth.sesion_usuario` | 8 |
| `sigd_doc.documento_adjunto` | 2 |
| `sigd_doc.expediente` | 2 |
| `sigd_doc.requisito` | 17 |
| `sigd_doc.tipo_documento` | 2 |
| `sigd_doc.tipo_documento_requisito` | 17 |
| `sigd_doc.tipo_tramite_tupa` | 22 |
| `sigd_org.calendario_laboral` | 2 |
| `sigd_org.permiso_sistema` | 6 |
| `sigd_org.rol_sistema` | 6 |
| `sigd_rut.accion_compensatoria` | 1 |
| `sigd_rut.accion_tramite` | 9 |
| `sigd_rut.contador_pestana_local` | 6 |
| `sigd_rut.estado_tramite` | 10 |
| `sigd_rut.transicion_estado_tramite` | 13 |
| `sigd_tra.asiento_registro` | 2 |
| `sigd_tra.expediente` | 2 |
| `sigd_tra.expediente_documento_folio` | 2 |
| `sigd_tra.secuencia_anual_cut` | 1 |
| `sigd_tra.tramite` | 2 |

### sigd_clasificacion_1792275959981 (OID 42342)

| Tabla | Versiones físicas observadas |
|---|---:|
| `sigd_auth.cuenta_usuario` | 1 |
| `sigd_auth.notificacion_casilla` | 1 |
| `sigd_auth.persona` | 1 |
| `sigd_auth.persona_natural` | 1 |
| `sigd_auth.sesion_usuario` | 8 |
| `sigd_doc.documento_adjunto` | 2 |
| `sigd_doc.expediente` | 2 |
| `sigd_doc.requisito` | 17 |
| `sigd_doc.tipo_documento` | 2 |
| `sigd_doc.tipo_documento_requisito` | 17 |
| `sigd_doc.tipo_tramite_tupa` | 22 |
| `sigd_org.calendario_laboral` | 2 |
| `sigd_org.permiso_sistema` | 6 |
| `sigd_org.rol_sistema` | 6 |
| `sigd_rut.accion_compensatoria` | 1 |
| `sigd_rut.accion_tramite` | 9 |
| `sigd_rut.contador_pestana_local` | 6 |
| `sigd_rut.estado_tramite` | 10 |
| `sigd_rut.transicion_estado_tramite` | 13 |
| `sigd_tra.asiento_registro` | 2 |
| `sigd_tra.expediente` | 2 |
| `sigd_tra.expediente_documento_folio` | 2 |
| `sigd_tra.secuencia_anual_cut` | 1 |
| `sigd_tra.tramite` | 2 |

### sigd_suiza_repro_1792276646663 (OID 44704)

| Tabla | Versiones físicas observadas |
|---|---:|
| `sigd_auth.cuenta_usuario` | 1 |
| `sigd_auth.notificacion_casilla` | 1 |
| `sigd_auth.persona` | 1 |
| `sigd_auth.persona_natural` | 1 |
| `sigd_auth.sesion_usuario` | 8 |
| `sigd_doc.documento_adjunto` | 2 |
| `sigd_doc.expediente` | 2 |
| `sigd_doc.requisito` | 17 |
| `sigd_doc.tipo_documento` | 2 |
| `sigd_doc.tipo_documento_requisito` | 17 |
| `sigd_doc.tipo_tramite_tupa` | 22 |
| `sigd_org.calendario_laboral` | 2 |
| `sigd_org.permiso_sistema` | 6 |
| `sigd_org.rol_sistema` | 6 |
| `sigd_rut.accion_compensatoria` | 1 |
| `sigd_rut.accion_tramite` | 9 |
| `sigd_rut.contador_pestana_local` | 6 |
| `sigd_rut.estado_tramite` | 10 |
| `sigd_rut.transicion_estado_tramite` | 13 |
| `sigd_tra.asiento_registro` | 2 |
| `sigd_tra.expediente` | 2 |
| `sigd_tra.expediente_documento_folio` | 2 |
| `sigd_tra.secuencia_anual_cut` | 1 |
| `sigd_tra.tramite` | 2 |

### sigd_suiza_repro_2026101801 (OID 54581)

| Tabla | Versiones físicas observadas |
|---|---:|
| `sigd_auth.cuenta_usuario` | 7 |
| `sigd_auth.notificacion_casilla` | 4 |
| `sigd_auth.persona` | 7 |
| `sigd_auth.persona_documento_historial` | 2 |
| `sigd_auth.persona_natural` | 6 |
| `sigd_auth.sesion_usuario` | 54 |
| `sigd_doc.documento_adjunto` | 3 |
| `sigd_doc.expediente` | 4 |
| `sigd_doc.requisito` | 17 |
| `sigd_doc.tipo_documento` | 2 |
| `sigd_doc.tipo_documento_requisito` | 17 |
| `sigd_doc.tipo_tramite_tupa` | 22 |
| `sigd_org.area` | 6 |
| `sigd_org.calendario_laboral` | 2 |
| `sigd_org.permiso_sistema` | 6 |
| `sigd_org.rol_permiso` | 6 |
| `sigd_org.rol_sistema` | 6 |
| `sigd_org.usuario_rol` | 3 |
| `sigd_rut.accion_compensatoria` | 1 |
| `sigd_rut.accion_tramite` | 9 |
| `sigd_rut.contador_pestana_local` | 22 |
| `sigd_rut.estado_actual_expediente` | 6 |
| `sigd_rut.estado_tramite` | 10 |
| `sigd_rut.movimiento_identidad` | 6 |
| `sigd_rut.movimiento_secuencia` | 6 |
| `sigd_rut.movimiento_tramite_2026` | 6 |
| `sigd_rut.transicion_estado_tramite` | 13 |
| `sigd_tra.asiento_registro` | 2 |
| `sigd_tra.expediente` | 7 |
| `sigd_tra.expediente_documento_folio` | 1 |
| `sigd_tra.secuencia_anual_cut` | 7 |
| `sigd_tra.tramite` | 5 |

### sigd_jacobo_demo (OID 70981)

| Tabla | Versiones físicas observadas |
|---|---:|
| `sigd_audit.bitacora_auditoria` | 2 |
| `sigd_audit.evento_outbox` | 3 |
| `sigd_auth.auditoria_usuarios` | 1 |
| `sigd_auth.consentimiento_datos` | 2 |
| `sigd_auth.cuenta_usuario` | 7 |
| `sigd_auth.notificacion_casilla` | 4 |
| `sigd_auth.operador_identidad` | 5 |
| `sigd_auth.perfil_usuario` | 5 |
| `sigd_auth.persona` | 7 |
| `sigd_auth.persona_documento_historial` | 1 |
| `sigd_auth.persona_natural` | 7 |
| `sigd_auth.sesion_usuario` | 57 |
| `sigd_auth.tipos_documento` | 4 |
| `sigd_doc.documento_adjunto` | 5 |
| `sigd_doc.expediente` | 5 |
| `sigd_doc.firma_digital_documento` | 1 |
| `sigd_doc.requisito` | 3 |
| `sigd_doc.resolucion` | 2 |
| `sigd_doc.tipo_documento` | 2 |
| `sigd_doc.tipo_documento_requisito` | 3 |
| `sigd_doc.tipo_tramite_tupa` | 3 |
| `sigd_org.area` | 3 |
| `sigd_org.calendario_laboral` | 2 |
| `sigd_org.cargo` | 3 |
| `sigd_org.facultad_despacho` | 3 |
| `sigd_org.permiso_sistema` | 6 |
| `sigd_org.rol_permiso` | 19 |
| `sigd_org.rol_sistema` | 6 |
| `sigd_org.usuario_rol` | 12 |
| `sigd_rut.accion_compensatoria` | 1 |
| `sigd_rut.accion_tramite` | 9 |
| `sigd_rut.contador_pestana_local` | 11 |
| `sigd_rut.estado_actual_expediente` | 6 |
| `sigd_rut.estado_tramite` | 10 |
| `sigd_rut.movimiento_identidad` | 2 |
| `sigd_rut.movimiento_secuencia` | 6 |
| `sigd_rut.movimiento_tramite_2026` | 2 |
| `sigd_rut.transicion_estado_tramite` | 13 |
| `sigd_tra.asiento_registro` | 2 |
| `sigd_tra.expediente` | 5 |
| `sigd_tra.expediente_documento_folio` | 2 |
| `sigd_tra.secuencia_anual_cut` | 5 |
| `sigd_tra.tramite` | 4 |


