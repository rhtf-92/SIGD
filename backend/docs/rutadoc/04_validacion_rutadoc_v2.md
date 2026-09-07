# H4 — Validación incremental de RutaDoc v2

| Metadato | Valor |
| --- | --- |
| Proyecto | SIGD — Sistema Integral de Gestión Documentaria |
| Grupo | Grupo 1 — RutaDoc |
| Responsable | Jhasy |
| Rama | `B_JHASY` |
| Fase | 2 |
| Entregable | H4 |
| Versión documental | Borrador incremental v0.1 |
| Estado | **Borrador de validación, no aprobado** |
| PostgreSQL | 18.6 |
| Commit base | `8fb09da2f1300f5ae75f206938502bcb1e0b06f9` |
| Estado del DDL | H3 v0.1 experimental; todavía untracked y sin commit |
| Fecha real de ejecución | 5 de septiembre de 2026 (2026-09-05); fuente: confirmación de Jhasy |
| Datos utilizados | Exclusivamente **EJEMPLO NO CONTRACTUAL**, sin catálogo institucional ni datos personales reales |
| Procedencia de resultados | Ejecución manual reportada por Jhasy; revisión documental del DDL y del archivo temporal, sin nueva ejecución PostgreSQL |

## 1. Objetivo y alcance

Registrar evidencia incremental de instalación, catálogo físico y comportamiento mínimo del prototipo H3 v0.1 en PostgreSQL 18.6. El alcance incluye instalación transaccional, rechazo de reinstalación, enrutamiento anual, una FK local negativa, secuencia positiva, protección append-only, mutabilidad experimental y eliminación de datos de prueba mediante rollback.

La conformidad de esta fase se limita a los casos documentados. No acredita la integridad funcional completa, el cumplimiento institucional, la terminación de H3/H4 ni la preparación para producción.

La evidencia de ejecución es el reporte consolidado de Jhasy. No se dispone aquí de un log íntegro adjunto; se conservan resultados, líneas, códigos y hashes expresamente comunicados. La inspección de los scripts explica el alcance de las pruebas, pero no agrega ejecuciones ni resultados.

## 2. Fuentes utilizadas

| ID | Fuente | Uso |
| --- | --- | --- |
| F1 | [H1: análisis de dominio y transiciones](01_analisis_dominio_transiciones_rutadoc.md) | Catálogo pendiente, límites de dominio, escenarios conceptuales, dependencias y eventos no contractuales. |
| F2 | [H2: modelo de datos](02_modelo_datos_rutadoc_v2.md) | Doce entidades propuestas, historial, proyección, claves y particiones. |
| F3 | [H2: diccionario de datos](02_diccionario_datos_rutadoc_v2.md) | Columnas, tipos propuestos, nulabilidad e invariantes pendientes. |
| F4 | [H2: decisiones del levantamiento](05_decisiones_levantamiento_rutadoc.md) | RUT-DEC-004, 006B, 007, 008/008B, 009, 011–015 y traspaso experimental a H3. |
| F5 | [DDL H3 v0.1](03_esquema_sigd_rut_particionado.sql) | Artefacto instalado; declaraciones físicas, límites UTC y advertencias del prototipo. |
| F6 | [Plan específico de RutaDoc, Fase 2](../levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md) | Alcance, H3/H4, responsabilidades, concurrencia, Outbox y criterios todavía abiertos. |
| F7 | Referencia histórica: plan rector `Plan_de_mejora_nivel_backend_SIGD.md`; el documento fuente no está versionado actualmente. | Arquitectura objetivo; secciones históricamente citadas 2.1, 3, 5.2, 5.4 y 5.8. Las metas no se convierten en resultados medidos. |
| F8 | `C:\Users\Jhass\AppData\Local\Temp\rutadoc_h3_pruebas_minimas.sql` | Artefacto temporal local de la ejecución original; no forma parte del repositorio. Su contenido reproducible se conserva íntegro en el Anexo A.E. |
| E1 | Reporte de Jhasy: instalación inicial fallida y rollback | WIN1252, línea 217 y ausencia posterior de `sigd_rut`. |
| E2 | Reporte de Jhasy: instalación UTF-8 e inventario | Instalación con COMMIT; conteos físicos y aclaraciones sobre particiones/FK. |
| E3 | Reporte de Jhasy: segunda instalación | Línea 49, esquema existente, exit code 3 e inventario básico conservado. |
| E4 | Reporte de Jhasy: pruebas mínimas | Resultados conformes, SQLSTATE, rollback, doce tablas vacías y exit code 0. |

Identificación de los artefactos examinados:

| Artefacto | SHA-256 |
| --- | --- |
| F5 — DDL | `7ce831d18abd079ef398abcc3aa59de6144bd7220545288511e0fb99456eec4f` |
| F8 — pruebas temporales | `e0a0f810fb030c6b7dbeed955b3a43352c9075b26b54689838f78dacd5d6510c` |

Los hashes identifican los bytes de los scripts; no reemplazan la evidencia de ejecución. El hash F8 identifica el artefacto utilizado en la ejecución original. No se asume que su ruta privada de Windows esté disponible para Geric o el profesor: toda reproducción futura debe utilizar el Anexo A incorporado a este documento para versionado, sin depender del temporal. No se sobrescriben H1, H2 ni los artefactos v1.

## 3. Entorno real

| Elemento | Valor reportado |
| --- | --- |
| Servidor | PostgreSQL 18.6 |
| Host y puerto | `localhost:5432` |
| Usuario de laboratorio | `postgres` |
| Base exclusiva | `sigd_rut_h3_jhasy_test` |
| Conexión administrativa inicial | `template1`, realizada manualmente |
| Encoding de la base | `UTF8` |
| Collation / CType | `Spanish_Peru.1252` / `Spanish_Peru.1252` |
| TimeZone reportada | `America/Bogota` |
| Cliente | psql de PostgreSQL 18 desde PowerShell externa |
| Control de errores | `ON_ERROR_STOP=1` |
| Codificación del cliente para la instalación válida y pruebas | `PGCLIENTENCODING=UTF8`, configurado temporalmente |
| Conservación | Base de laboratorio conservada; no se ejecutó desmontaje |

Jhasy informó que la base no existía antes de crearla. No se ejecutó el DDL sobre `postgres` ni una base existente del proyecto. No se registran contraseñas, cambios de usuarios ni modificaciones de configuración del servidor.

Las ejecuciones de instalación y pruebas se realizaron el 5 de septiembre de 2026, según confirmación de Jhasy. No se aportaron horas, duraciones ni una marca temporal de creación de la base. Tampoco se atribuye creación de una segunda base de rollback: no forma parte de la evidencia recibida.

## 4. Control de codificación

El DDL es un archivo UTF-8. El primer intento utilizó `client_encoding WIN1252` y falló; la ejecución válida se realizó después de configurar temporalmente `PGCLIENTENCODING=UTF8`, sin modificar el DDL.

El archivo temporal F8 fue preparado en UTF-8 sin BOM, con saltos de línea, y conserva el hash indicado. No contiene COMMIT ni instrucciones para crear objetos.

El mojibake observado se registra como **incidencia de presentación de consola entre UTF-8 y Windows**. No existe evidencia aportada que demuestre corrupción del archivo. Collation/CType, codificación del cliente y representación de consola son datos distintos; la incidencia no justifica modificar el DDL.

## 5. Instalación inicial fallida por client_encoding

| Prueba | Evidencia | Clasificación |
| --- | --- | --- |
| I01 — Instalación con cliente WIN1252 | Falló en la línea 217 por incompatibilidad con el archivo UTF-8; no alcanzó instalación válida. | EJECUTADA — NO CONFORME |

La no conformidad corresponde al intento de instalación bajo esa configuración del cliente. No se clasifica como defecto de sintaxis del DDL: el mismo archivo se instaló posteriormente con UTF-8. No se recibió el texto completo del primer error, su SQLSTATE ni su exit code; no se reconstruyen por inferencia.

## 6. Evidencia del rollback de esa instalación

| Prueba | Evidencia | Clasificación |
| --- | --- | --- |
| I02 — Reversión del intento fallido | Jhasy confirmó rollback completo y que `sigd_rut` no existía antes de repetir. | EJECUTADA — CONFORME |

F5 delimita la instalación con BEGIN y COMMIT. E1 aporta evidencia de reversión en un fallo real posterior al inicio del script. Esta evidencia respalda atomicidad para ese intento; no se presenta como una campaña exhaustiva de fallos, recuperación o atomicidad del futuro caso de uso.

## 7. Instalación válida con UTF-8

| Prueba | Evidencia | Clasificación |
| --- | --- | --- |
| I03 — Instalación con cliente UTF-8 | Terminó con COMMIT, sin error SQL, y creó `sigd_rut`. | EJECUTADA — CONFORME |

La instalación válida acredita que el DDL pudo ejecutarse completo en el entorno reportado. Su exit code numérico no fue aportado; el exit code 0 documentado en E4 corresponde al archivo de pruebas mínimas y no se atribuye retrospectivamente a esta instalación.

No se aportó un inventario exhaustivo de advertencias de instalación. Se registra ausencia reportada de error SQL, sin inventar un conteo de advertencias.

## 8. Inventario real de objetos

| Elemento | Resultado reportado | Clasificación / alcance |
| --- | --- | --- |
| Esquema `sigd_rut` | Existe | EJECUTADA — CONFORME |
| Tablas funcionales | 12 | EJECUTADA — CONFORME |
| Particiones de tabla | 2 | EJECUTADA — CONFORME |
| PK raíz | 11 | EJECUTADA — CONFORME |
| UNIQUE raíz | 3 | EJECUTADA — CONFORME |
| FK raíz | 18 | EJECUTADA — CONFORME |
| FK dependientes | 24 | EJECUTADA — CONFORME; generadas por PostgreSQL |
| FK totales, incluyendo particiones | 42 | EJECUTADA — CONFORME; 18 raíz + 24 dependientes |
| CHECK en tablas funcionales | 7 | EJECUTADA — CONFORME; no se presenta como conteo global de copias heredadas |
| FK externas | 0 | EJECUTADA — CONFORME |
| Triggers raíz habilitados | 7 | EJECUTADA — CONFORME; `tgenabled='O'` |
| Índices catalogados | 16 | EJECUTADA — CONFORME; incluye índice particionado y sus hijos |

Listado de tablas funcionales, contrastado con F2/F3/F5:

| Catálogos administrables | Históricos append-only | Proyección mutable |
| --- | --- | --- |
| `accion_tramite` | `movimiento_tramite` | `estado_actual_tramite` |
| `estado_tramite` | `derivacion_tramite` | — |
| `transicion_estado_tramite` | `recepcion_tramite` | — |
| `tipo_relacion_movimiento` | `observacion_tramite` | — |
| — | `atencion_tramite` | — |
| — | `relacion_movimiento` | — |
| — | `movimiento_documento` | — |

Las dos particiones físicas son `movimiento_tramite_2026` y `movimiento_tramite_2027`; no son entidades funcionales adicionales. El conteo genérico de cuatro relaciones con `relispartition` incluía también `movimiento_tramite_2026_pkey` y `movimiento_tramite_2027_pkey`. Filtrar `relkind IN ('r','p')` resolvió la distinción.

La consulta inicial de FK produjo 34 al excluir las tablas que son particiones, pero conservó restricciones dependientes asociadas a otras tablas funcionales. La consulta completa produjo 42. Para contar las declaraciones raíz se utilizó `conparentid=0`; las dependientes se separaron con `conparentid<>0`. No se interpretan 34 ni 42 como declaraciones independientes del DDL.

**Interpretación estática:** la ausencia de PK en `movimiento_documento` explica las 11 PK para 12 tablas; su clave permanece pendiente. Los 16 índices son compatibles con los automáticos de PK/UNIQUE y los hijos del índice particionado; no acreditan optimización B-Tree/BRIN adicional.

F5 declara una función `fn_rechazar_mutacion_historica` compartida por los siete triggers. No declara tablas externas, Outbox ni instalación de extensiones. Esa inspección estática no se convierte en un nuevo conteo de catálogo no aportado en E2.

## 9. Prueba de segunda instalación y fallo controlado

| Prueba | Evidencia | Clasificación |
| --- | --- | --- |
| I04 — Reinstalación del mismo DDL | BEGIN, DO y SET ejecutados; detención en línea 49: `ERROR: ya existe el esquema «sigd_rut»`; exit code 3. | EJECUTADA — CONFORME |
| I05 — Inventario básico posterior | Esquema presente, 12 tablas funcionales y 2 particiones de tabla. | EJECUTADA — CONFORME |

El exit code 3 es el fallo esperado de psql ante el error del script con `ON_ERROR_STOP=1`. El instalador exige que el esquema esté ausente; no es una migración idempotente. El fallo no se interpreta como defecto y no se corrigió ni repitió automáticamente.

La evidencia posterior acredita conservación del inventario básico indicado. No equivale a una comparación exhaustiva antes/después de columnas, comentarios, restricciones, funciones e índices. No se recibió SQLSTATE de esta reinstalación.

## 10. Matriz de pruebas mínimas

Las referencias a F8 identifican el bloque numerado o la operación revisada, conservados íntegramente en el Anexo A.E; no identifican un log de ejecución adjunto. Todos los resultados proceden de E4. La incorporación documental del anexo no agrega ejecuciones.

| ID | Caso y referencia F8 | Resultado real resumido | Clasificación |
| --- | --- | --- | --- |
| M01 | Catálogos experimentales, bloque 1 | INSERT permitido en los cuatro catálogos. | EJECUTADA — CONFORME |
| M02 | Movimiento 2026, bloques 2–3 | INSERT y enrutamiento a `movimiento_tramite_2026`. | EJECUTADA — CONFORME |
| M03 | Movimiento 2027, bloques 2–3 | INSERT y enrutamiento a `movimiento_tramite_2027`. | EJECUTADA — CONFORME |
| M04 | Fecha fuera de cobertura, bloques 4–6 | Fecha 2028 rechazada con 23514. | EJECUTADA — CONFORME |
| M05 | FK local huérfana, bloques 4–6 | Rechazo 23503 en `fk_transicion_accion`. | EJECUTADA — CONFORME |
| M06 | Secuencia 0, bloques 4–6 | Rechazo 23514 en `ck_movimiento_secuencia`. | EJECUTADA — CONFORME |
| M07 | Secuencia −1, bloques 4–6 | Rechazo 23514 en `ck_movimiento_secuencia`. | EJECUTADA — CONFORME |
| M08 | INSERT de históricos, bloques 2–3 y 7–10 | Permitido en los siete históricos. | EJECUTADA — CONFORME |
| M09 | UPDATE de históricos, bloques 7–10 | Rechazado con 23001 en cada uno de los siete históricos. | EJECUTADA — CONFORME |
| M10 | DELETE de históricos, bloques 7–10 | Rechazado con 23001 en cada uno de los siete históricos. | EJECUTADA — CONFORME |
| M11 | Acceso directo a ambas particiones, bloques 7–10 | UPDATE y DELETE rechazados con 23001. | EJECUTADA — CONFORME |
| M12 | Mutabilidad de cuatro catálogos, bloque 11 | INSERT/UPDATE/DELETE permitidos sobre filas auxiliares experimentales. | EJECUTADA — CONFORME |
| M13 | Mutabilidad de proyección, bloque 11 | INSERT/UPDATE/DELETE permitidos en `estado_actual_tramite`. | EJECUTADA — CONFORME |
| M14 | Reversión final, bloque 12 | ROLLBACK ejecutado. | EJECUTADA — CONFORME |
| M15 | Verificación posterior, `$verificacion$` | 12 tablas funcionales vacías; ausencia de residuos de datos experimentales. | EJECUTADA — CONFORME |
| M16 | Resultado global de F8 | `RESULTADO: pruebas mínimas OK`, sin FALLO/ERROR reportados y exit code final 0. | EJECUTADA — CONFORME |

F8 captura errores esperados mediante bloques con EXCEPTION y comprueba SQLSTATE y, cuando corresponde, nombre de restricción. Si un intento prohibido fuera aceptado, genera una excepción de control para revertir ese intento y reportar FALLO. El manejador exterior reporta PRUEBA INCOMPLETA ante un error inesperado.

Por ello, el exit code 0 por sí solo no demuestra conformidad: un WARNING del bloque puede no cambiar ese código. En esta ejecución se acompaña del resultado mínimo OK, la ausencia reportada de FALLO/ERROR, el ROLLBACK y la comprobación de tablas vacías. No se extrapola este resultado a pruebas fuera de F8.

## 11. SQLSTATE obtenidos

| Caso | SQLSTATE realmente reportado | Restricción / origen | Interpretación |
| --- | --- | --- | --- |
| Fecha 2028 | `23514` | Enrutamiento sin partición que admita la fecha | Rechazo esperado; no se atribuye a `ck_movimiento_secuencia`. |
| FK huérfana | `23503` | `fk_transicion_accion` | Violación de FK local esperada. |
| Secuencia 0 y −1 | `23514` | `ck_movimiento_secuencia` | Violación de CHECK esperada. |
| UPDATE/DELETE histórico | `23001` | `fn_rechazar_mutacion_historica` | Rechazo append-only esperado. |

El código `ZX001` aparece en F8 como alarma de operación inesperadamente aceptada; no se reporta como SQLSTATE obtenido conforme. Los SQLSTATE del fallo inicial de codificación y de la reinstalación no fueron aportados. Exit codes de psql y SQLSTATE no son intercambiables.

## 12. Enrutamiento 2026–2027

F5 usa `PARTITION BY RANGE (fecha_hora)` y límites UTC semiabiertos:

| Partición | Desde, incluido (UTC) | Hasta, excluido (UTC) |
| --- | --- | --- |
| `movimiento_tramite_2026` | `2026-01-01 00:00:00+00` | `2027-01-01 00:00:00+00` |
| `movimiento_tramite_2027` | `2027-01-01 00:00:00+00` | `2028-01-01 00:00:00+00` |

La presentación reportada en UTC−5 fue desde `2025-12-31 19:00:00-05` hasta `2026-12-31 19:00:00-05`, y desde ese instante hasta `2027-12-31 19:00:00-05`. Representa los mismos límites UTC.

F8 inserta instantes sintéticos `2026-06-01 12:00:00+00` y `2027-06-01 12:00:00+00`, y comprueba la relación física mediante `tableoid`. Rechaza `2028-01-01 00:00:00+00`. Esas fechas son datos de prueba, no fechas reales de ejecución.

El mismo identificador experimental de expediente cruza ambos años con secuencias 1 y 2. Esto acredita enrutamiento, no unicidad, continuidad ni monotonía global. F8 también contiene vínculos sintéticos entre ambos años; su aceptación no aprueba rutas, recepción o relaciones institucionales.

No se ejecutó una batería completa de bordes de 2026/2027, pruning, creación de particiones futuras o restauración. El año calendario UTC del prototipo no constituye una definición aprobada de año fiscal institucional.

## 13. Pruebas append-only

Cada fila resume INSERT permitido y dos pruebas independientes de rechazo (UPDATE y DELETE) reportadas en E4:

| Tabla histórica | Trigger raíz declarado en F5 | Resultado | Clasificación |
| --- | --- | --- | --- |
| `movimiento_tramite` | `tr_movimiento_append_only` | INSERT permitido; UPDATE/DELETE: 23001 | EJECUTADA — CONFORME |
| `derivacion_tramite` | `tr_derivacion_append_only` | INSERT permitido; UPDATE/DELETE: 23001 | EJECUTADA — CONFORME |
| `recepcion_tramite` | `tr_recepcion_append_only` | INSERT permitido; UPDATE/DELETE: 23001 | EJECUTADA — CONFORME |
| `observacion_tramite` | `tr_observacion_append_only` | INSERT permitido; UPDATE/DELETE: 23001 | EJECUTADA — CONFORME |
| `atencion_tramite` | `tr_atencion_append_only` | INSERT permitido; UPDATE/DELETE: 23001 | EJECUTADA — CONFORME |
| `relacion_movimiento` | `tr_relacion_append_only` | INSERT permitido; UPDATE/DELETE: 23001 | EJECUTADA — CONFORME |
| `movimiento_documento` | `tr_documento_append_only` | INSERT permitido; UPDATE/DELETE: 23001 | EJECUTADA — CONFORME |

El acceso directo a cada partición también rechazó UPDATE/DELETE. F8 contrasta el SQLSTATE, el mensaje RutaDoc y el contexto de la función; las operaciones se dirigen a filas existentes y no modifican las claves en el intento de UPDATE.

Esta defensa no constituye protección frente a un administrador capaz de deshabilitar triggers, ejecutar DDL o TRUNCATE. Tampoco valida permisos de un rol de aplicación: se utilizó `postgres`. Esos controles quedan pendientes.

## 14. Mutabilidad de catálogos y proyección

| Tabla | Operaciones experimentales reportadas | Clasificación |
| --- | --- | --- |
| `accion_tramite` | INSERT, UPDATE y DELETE | EJECUTADA — CONFORME |
| `estado_tramite` | INSERT, UPDATE y DELETE | EJECUTADA — CONFORME |
| `transicion_estado_tramite` | INSERT, UPDATE y DELETE | EJECUTADA — CONFORME |
| `tipo_relacion_movimiento` | INSERT, UPDATE y DELETE | EJECUTADA — CONFORME |
| `estado_actual_tramite` | INSERT, UPDATE y DELETE | EJECUTADA — CONFORME |

Los DELETE de catálogo actúan sobre filas auxiliares sin referencias entrantes. No prueban borrado de catálogos referenciados ni autorizan reescribir su significado histórico. El versionado semántico permanece pendiente.

La proyección se escribió manualmente dentro del laboratorio. El cambio sintético de movimiento 2026 a 2027 demuestra mutabilidad, no un escritor único, reconstrucción, incremento automático de versión o coherencia automática expediente–movimiento–estado–secuencia.

## 15. Rollback final y ausencia de residuos

E4 reporta ejecución de ROLLBACK y el mensaje de verificación posterior: 12 tablas funcionales vacías. F8 comprueba también la ausencia inicial de datos y no contiene COMMIT. Los errores negativos se aíslan en subtransacciones; la transacción exterior revierte las inserciones experimentales restantes.

**Evidencia obtenida:** ausencia final de filas en las doce tablas funcionales, incluyendo el historial consultado por su padre particionado. **Interpretación:** los datos de esta ejecución no quedaron persistidos. No se eliminó el esquema ni sus particiones, ni se probó el desmontaje.

Se conserva `sigd_rut_h3_jhasy_test`. F8 fue un artefacto temporal local, ajeno al repositorio; su eventual conservación local no es requisito de revisión o reproducción. El procedimiento completo está en el Anexo A. No se demuestra aquí recuperación ante caída del servidor o pérdida de conexión.

## 16. Limitaciones conocidas del prototipo

| Pendiente | Alcance que permanece abierto | Fuente |
| --- | --- | --- |
| Catálogo institucional | Reconciliar 10 estados/13 transiciones textuales frente a inferencia no contractual 13 estados/16 aristas; 19 flechas incluyen inicio y terminales. No convertir ejemplos en seeds. | F1; F4 RUT-DEC-004 |
| Identidad global del movimiento | La PK `(fecha_hora, movimiento_id)` no garantiza UUID único en instantes distintos. | F2/F3; F5 |
| Secuencia por expediente entre años | CHECK positivo no garantiza unicidad, generación, continuidad ni monotonía global. | F2/F3; F5 |
| Alcance y garantía de idempotencia | `clave_idempotencia VARCHAR(128)` experimental, nullable y sin UNIQUE; correlación no equivale a deduplicación. | F4 RUT-DEC-015; F5 |
| Concurrencia y rutas paralelas | Política de rutas, serialización, alternativa de bloqueo y reintentos sin resolver. No se bloqueó expediente externo. | F1; F4 RUT-DEC-009; F5 |
| Escritor único de proyección | Requisito transaccional definido; mecanismo físico y prueba de atomicidad del caso de uso pendientes. | F4 RUT-DEC-008/008B; F5 |
| Coherencia de proyección | Las FK de existencia no comprueban coincidencia de expediente, movimiento, estado y secuencia ni evitan retroceso. | F3; F5 |
| Clave de `movimiento_documento` | Sin PK/UNIQUE documental; duplicados y semántica de versión nula pendientes de G5. | F3; F5 |
| Versionado semántico de catálogos | Mutabilidad y UNIQUE de código no preservan por sí solos significado histórico ni evitan solapamiento de vigencias. | F2/F3; F5 |
| Compatibilidad de detalles y transiciones | FK de existencia no valida acción/estados/vigencia; exclusividad y obligatoriedad de detalle, recepción y rectificación pendientes. | F1/F3; F5 |
| Índices adicionales | B-Tree/BRIN candidatos sin medición; los índices catalogados no acreditan rendimiento. | F4 RUT-DEC-011; F5 |
| Referencias externas | VARCHAR(64) es ejemplo técnico autorizado para v0.1; no sustituye UUID esperados ni contratos de H2. `id_expediente` no se declara equivalente al CUT. | F3; F5 |
| Outbox | Sin tabla ni integración implementada; propiedad, payload y unidad transaccional sujetos a G6. | F1; F4 RUT-DEC-012; F5 |
| Administración y operación | Permisos, retención, privacidad, particiones futuras, mantenimiento y protección administrativa pendientes. | F2/F3; F5 |

La revisión de F4 impide interpretar el advisory lock v1 como un bloqueo global único demostrado: su evaluación y contención real siguen pendientes. Tampoco se convierten las metas de rendimiento del plan rector en mejoras medidas.

## 17. Pruebas todavía NO EJECUTADAS

| ID | Prueba pendiente | Clasificación | Condición o límite |
| --- | --- | --- | --- |
| P01 | Concurrencia real multisesión y derivaciones simultáneas | NO EJECUTADA | Definir política de rutas y alternativa de control; después usar sesiones reales. |
| P02 | Idempotencia global, reintentos y duplicados entre años | NO EJECUTADA | Definir clave, alcance y mecanismo; no está garantizada en v0.1. |
| P03 | Secuencia global por expediente entre particiones | NO EJECUTADA | Dos secuencias positivas diferentes no prueban exclusividad ni monotonía. |
| P04 | Repetición de UUID en instantes distintos e identidad global | NO EJECUTADA | Limitación estática conocida; no se ejecutó el caso demostrativo. |
| P05 | Escritor único y fallo atómico de movimiento/detalle/proyección | NO EJECUTADA | No existe escritor implementado en este DDL. |
| P06 | Reconstrucción de proyección y coherencia expediente–movimiento–estado | NO EJECUTADA | Definir orden, mecanismo y comparación; no confundir con mutabilidad. |
| P07 | Rendimiento B-Tree/BRIN e índices adicionales | NO EJECUTADA | Requiere consultas y volumen representativos. |
| P08 | EXPLAIN ANALYZE / EXPLAIN (ANALYZE, BUFFERS) | NO EJECUTADA | No hay planes ni métricas obtenidos. |
| P09 | Outbox: escritura atómica, publicación y reintentos | NO EJECUTADA | Contrato G6 e implementación pendientes. |
| P10 | Integraciones con grupos 2–6 | NO EJECUTADA | Sin contratos físicos confirmados ni pruebas intermodulares. |
| P11 | Catálogo institucional definitivo y transiciones de dominio | NO EJECUTADA | Reconciliar 10/13 frente a inferencia 13/16; incluye las 10 transiciones válidas exigidas por el plan. |
| P12 | Pruebas de carga | NO EJECUTADA | Sin volumen, duración ni capacidad medidas. |
| P13 | Deadlock, recuperación y reintento transaccional | NO EJECUTADA | No se obtuvieron resultados 40P01/40001 ni estrategias probadas. |
| P14 | Matriz completa PK/UNIQUE/FK/CHECK y NOT NULL | NO EJECUTADA | Solo una FK negativa y CHECK de secuencia de movimiento cubiertos; inventario no equivale a batería completa. |
| P15 | MATCH FULL parcial/nulo, vigencias inválidas, autorrelación y CHECK de proyección | NO EJECUTADA | Los casos negativos específicos no están en F8. |
| P16 | Bordes completos 2026/2027, pruning y particiones futuras | NO EJECUTADA | Cubiertos dos instantes interiores y rechazo del inicio de 2028. |
| P17 | Permisos de aplicación y políticas de administración | NO EJECUTADA | Pruebas efectuadas con usuario postgres. |
| P18 | Retención, restauración, caída de servidor y desmontaje | NO EJECUTADA | La base y los objetos se conservaron. |
| P19 | Fallo inducido adicional de instalación en otra base | NO EJECUTADA | Se cuenta con rollback del fallo real de codificación, no con una segunda base probada. |
| P20 | Comparación exhaustiva de todos los objetos antes/después de reinstalar | NO EJECUTADA | Solo se aportó inventario básico posterior. |

Ninguna prueba anterior se considera superada por la existencia de documentación, por inspección estática o por el exit code 0 de F8.

## 18. Contratos externos pendientes

| Grupo | Contrato pendiente | Límite de este borrador |
| --- | --- | --- |
| G2 — TramiCore | Expediente, identificador, tipo UUID esperado, existencia/vigencia y tratamiento del CUT. | No crea expediente ni FK externa; referencias VARCHAR(64) experimentales. |
| G3 — OrganiCore | Identidad y vigencia de áreas, jerarquía, pertenencia y validación de origen/destino. | No crea áreas ni prueba autorización o disponibilidad histórica. |
| G4 — IdentiCore | Identidad del actor/usuario, vigencia, permisos y eventos de sistema. | No crea cuentas ni prueba autenticación/autorización de negocio. |
| G5 — DocuCore | Permanencia del vínculo en Fase 2, documento, versión, adjuntos, clave documental y versión nula. | No fija contratos de documento/versión ni resuelve PK/UNIQUE documental. |
| G6 — CoreLink | Propiedad de Outbox, payload, versionado, correlación, idempotencia, permisos, escritura atómica y despacho. | No crea Outbox, workers ni integración; no aprueba campos contractuales. |

Geric conserva la responsabilidad de consolidar y revisar decisiones; los grupos propietarios deben confirmar sus contratos. H1 integrado no equivale a aprobación de esos contratos ni del catálogo institucional. Las decisiones y evidencias pendientes no se resuelven mediante suposiciones en H4.

## 19. Criterio de avance

La evidencia permite presentar un **borrador H4 incremental para revisión** de instalación y comportamiento mínimo del prototipo. Se mantiene trazabilidad a los hashes, al commit base y a las pruebas concretas.

Antes de ampliar el alcance o plantear aprobación deben completarse la revisión de Geric, las decisiones funcionales/físicas y las pruebas pendientes que correspondan. La fecha real de ejecución, 5 de septiembre de 2026, fue confirmada por Jhasy. El Anexo A permite reproducir las pruebas mínimas sin el artefacto temporal local. La falta de logs completos y de algunos códigos de instalación se registra como límite documental, sin inventar resultados.

H3 permanece untracked y sin commit; este H4 se prepara también sin versionar. Los requisitos de publicación y revisión del plan no están satisfechos por la mera creación de estos archivos. Este criterio no autoriza add, commit, push, integración ni despliegue.

## 20. Conclusión provisional

La instalación estructural y las pruebas mínimas reportadas son conformes en PostgreSQL 18.6: el DDL se instaló con UTF-8, la reinstalación fue rechazada de forma esperada y las pruebas de comportamiento terminaron con rollback y doce tablas vacías.

Se conserva como incidencia el intento inicial no conforme por client_encoding, cuya reversión fue confirmada. Las restricciones dependientes y las particiones de índice explican las diferencias de conteo; no constituyen por sí mismas defectos del esquema.

**BORRADOR H4 CON EVIDENCIA REAL LISTO PARA REVISIÓN, NO APROBADO.**

Las ejecuciones documentadas corresponden al 5 de septiembre de 2026, según confirmación de Jhasy. La revisión debe atender los límites y pendientes explícitos de este documento y el procedimiento reproducible del Anexo A. H3 y H4 no se declaran terminados; las pruebas estructurales no constituyen aprobación institucional.

## Anexo A — Procedimiento reproducible de validación mínima

Este anexo conserva el procedimiento y la suite dentro de H4 para su futura revisión/versionado. Solo requiere este documento, el DDL H3 del repositorio y PostgreSQL 18; no requiere F8 ni acceso a una ruta privada de Windows. Incorporar el procedimiento no constituye una nueva ejecución: los resultados históricos siguen siendo los de las secciones 5–15.

### A. Precondiciones y alcance seguro

1. Usar exclusivamente un entorno de laboratorio, nunca producción ni una base existente del proyecto.
2. Disponer de una base desechable recién preparada, vacía de objetos y datos de aplicación, con encoding UTF8. Su creación por el operador queda fuera de estos bloques; no reutilizar ni limpiar automáticamente una base preexistente.
3. Comprobar PostgreSQL 18.x, la base seleccionada y ausencia de sigd_rut antes de instalar. Si el esquema ya existe, detener la instalación: no eliminarlo ni ejecutar el desmontaje.
4. Ejecutar PowerShell desde la raíz del repositorio. Ajustar únicamente la ruta de psql si PostgreSQL 18 está instalado en otra ubicación.
5. El usuario de laboratorio es reemplazable y debe tener permisos suficientes para instalar y probar objetos propios. No incluir contraseñas en comandos, variables, archivos ni documentación; -W permite introducirlas en el prompt interactivo de psql.
6. Los valores de la suite son **EJEMPLO NO CONTRACTUAL**. No se crean catálogos institucionales, FK externas ni Outbox. No se prueban concurrencia, idempotencia global ni reglas institucionales.
7. La suite exige doce tablas funcionales vacías antes de insertar. Para reproducirla usar una sesión psql nueva, sin transacción previa y sin otras sesiones escribiendo datos en ese laboratorio.
8. Conservar la base después de las pruebas. La suite revierte datos; no elimina objetos.

El nombre predeterminado es sigd_rut_h3_jhasy_test. Si esa base ya existe, elegir otra base desechable nueva o un servidor de laboratorio separado; no borrar ni reutilizar automáticamente la existente para instalar. Si se elige otro nombre, cambiar $rutLabBase y reemplazar las **dos comparaciones literales de nombre de base** de la suite A.E por ese mismo nombre exacto. No eliminar las comprobaciones. Esa adaptación no cambia los casos, pero ya no es una copia textual idéntica de F8.

### B. Configuración de codificación en PowerShell

Ejecutar manualmente en la PowerShell externa desde la que se utilizará psql:

~~~powershell
chcp 65001
$env:PGCLIENTENCODING = "UTF8"

$rutPsql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$rutLabUser = "postgres"  # Reemplazable por el usuario autorizado del laboratorio.
$rutLabBase = "sigd_rut_h3_jhasy_test"  # Reemplazable según A.
~~~

Estos ajustes de codificación corresponden a esa sesión; no requieren modificar pg_hba.conf, usuarios, contraseñas o configuración del servidor.

### C. Preverificación e instalación del DDL

Abrir una conexión de inspección a la base vacía preparada por el operador:

~~~powershell
& $rutPsql -X -W -h localhost -p 5432 -U $rutLabUser -d $rutLabBase -v ON_ERROR_STOP=1
~~~

Pegar dentro de psql:

~~~sql
\pset pager off
SELECT current_database() AS base,
       current_user AS usuario,
       current_setting('server_version') AS version,
       current_setting('server_version_num')::integer / 10000 = 18 AS es_pg18,
       current_setting('client_encoding') AS client_encoding,
       current_setting('TimeZone') AS zona_horaria;

SELECT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'sigd_rut'
) AS esquema_ya_existe;

SELECT n.nspname AS esquema, c.relname AS objeto, c.relkind AS tipo
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname <> 'information_schema'
  AND n.nspname !~ '^pg_'
ORDER BY n.nspname, c.relname;
\q
~~~

Continuar solo si la base es la elegida, es_pg18 es verdadero, client_encoding es UTF8, esquema_ya_existe es falso y no hay objetos de aplicación. Estas consultas complementan la precondición de base recién preparada; no certifican por sí solas ausencia de cualquier clase de objeto de extensiones.

Desde PowerShell, en la raíz del repositorio:

~~~powershell
& $rutPsql -X -W -h localhost -p 5432 -U $rutLabUser -d $rutLabBase -v ON_ERROR_STOP=1 -f "backend/docs/rutadoc/03_esquema_sigd_rut_particionado.sql"
$LASTEXITCODE
~~~

Resultado esperado para esta reproducción: instalación hasta COMMIT, sin error SQL y exit code 0. Es un criterio de una ejecución futura, no un exit code agregado retrospectivamente a la instalación original. Si falla, detenerse y conservar el primer error; no corregir ni reinstalar automáticamente.

### D. Inventario compacto posterior

Solo después de una instalación válida, abrir una nueva sesión con el comando de conexión de C. Pegar estas consultas. Todos los indicadores deben mostrar conforme = t; los conteos esperados proceden del inventario real registrado, no de una nueva ejecución del anexo.

~~~sql
\pset pager off
\set ON_ERROR_STOP on

WITH relaciones AS (
    SELECT c.*
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'sigd_rut'
),
restricciones AS (
    SELECT k.*, c.relispartition
    FROM pg_constraint k
    JOIN relaciones c ON c.oid = k.conrelid
    WHERE c.relkind IN ('r', 'p')
),
disparadores AS (
    SELECT t.*
    FROM pg_trigger t
    JOIN relaciones c ON c.oid = t.tgrelid
    WHERE NOT t.tgisinternal
),
metricas AS (
    SELECT 1 AS orden, 'tablas funcionales' AS indicador,
           (SELECT count(*) FROM relaciones
            WHERE relkind IN ('r','p') AND NOT relispartition) AS obtenido,
           12::bigint AS esperado
    UNION ALL SELECT 2, 'particiones de tabla',
           (SELECT count(*) FROM relaciones
            WHERE relkind IN ('r','p') AND relispartition), 2
    UNION ALL SELECT 3, 'PK raiz',
           (SELECT count(*) FROM restricciones
            WHERE contype = 'p' AND conparentid = 0
              AND NOT relispartition), 11
    UNION ALL SELECT 4, 'UNIQUE raiz',
           (SELECT count(*) FROM restricciones
            WHERE contype = 'u' AND conparentid = 0
              AND NOT relispartition), 3
    UNION ALL SELECT 5, 'FK raiz',
           (SELECT count(*) FROM restricciones
            WHERE contype = 'f' AND conparentid = 0), 18
    UNION ALL SELECT 6, 'FK dependientes',
           (SELECT count(*) FROM restricciones
            WHERE contype = 'f' AND conparentid <> 0), 24
    UNION ALL SELECT 7, 'CHECK funcionales',
           (SELECT count(*) FROM restricciones
            WHERE contype = 'c' AND conparentid = 0
              AND NOT relispartition), 7
    UNION ALL SELECT 8, 'FK externas',
           (SELECT count(*)
            FROM restricciones k
            JOIN pg_class destino ON destino.oid = k.confrelid
            JOIN pg_namespace n ON n.oid = destino.relnamespace
            WHERE k.contype = 'f' AND n.nspname <> 'sigd_rut'), 0
    UNION ALL SELECT 9, 'triggers raiz',
           (SELECT count(*) FROM disparadores WHERE tgparentid = 0), 7
    UNION ALL SELECT 10, 'triggers raiz habilitados O',
           (SELECT count(*) FROM disparadores
            WHERE tgparentid = 0 AND tgenabled = 'O'), 7
    UNION ALL SELECT 11, 'indices catalogados',
           (SELECT count(*) FROM relaciones WHERE relkind IN ('i','I')), 16
)
SELECT indicador, obtenido, esperado, obtenido = esperado AS conforme
FROM metricas
ORDER BY orden;

SELECT string_agg(c.relname, ', ' ORDER BY c.relname) AS tablas_funcionales
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'sigd_rut'
  AND c.relkind IN ('r','p')
  AND NOT c.relispartition;

SELECT parent.relname AS padre,
       pg_get_partkeydef(parent.oid) AS clave_particion,
       child.relname AS particion,
       pg_get_expr(child.relpartbound, child.oid, false) AS limites
FROM pg_inherits i
JOIN pg_class parent ON parent.oid = i.inhparent
JOIN pg_class child ON child.oid = i.inhrelid
JOIN pg_namespace n ON n.oid = parent.relnamespace
WHERE n.nspname = 'sigd_rut'
  AND parent.relkind = 'p'
  AND child.relkind IN ('r','p')
  AND child.relispartition
ORDER BY child.relname;
\q
~~~

Las FK dependientes se cuentan en todo el esquema, incluidas las particiones. Los CHECK de esta comparación son los de tablas funcionales: no se suman copias heredadas en particiones. Los índices incluyen el índice particionado y sus hijos. Comparar además los nombres y límites con las secciones 8 y 12; no aprobar un inventario solo por sus conteos.

### E. Suite mínima completa

Abrir otra sesión psql con el comando de C y pegar el bloque completo siguiente, desde \pset hasta \q. No pegarlo en PowerShell. Al regresar a PowerShell, consultar inmediatamente $LASTEXITCODE.

El contenido se reproduce fielmente de F8, sin compactar, cambiar casos ni añadir resultados. Los bloques $pruebas$ y $verificacion$ son bloques anónimos: no crean funciones ni objetos persistentes. La suite no contiene COMMIT, CREATE, ALTER, DROP o TRUNCATE. El DDL de instalación de C tiene su propio control transaccional y no debe ejecutarse dentro de esta suite.

~~~sql
\pset pager off
\set ON_ERROR_STOP on

BEGIN;

DO $pruebas$
DECLARE
    marca CONSTANT text := 'EJEMPLO NO CONTRACTUAL';
    base_id CONSTANT uuid := 'eeeeeeee-0000-4000-8000-000000000001';
    spare_id CONSTANT uuid := 'eeeeeeee-0000-4000-8000-000000000002';
    m26 CONSTANT uuid := 'eeeeeeee-0000-4000-8000-000000000026';
    m27 CONSTANT uuid := 'eeeeeeee-0000-4000-8000-000000000027';
    h26 CONSTANT timestamptz := '2026-06-01 12:00:00+00';
    h27 CONSTANT timestamptz := '2027-06-01 12:00:00+00';
    r record;
    operacion text;
    consulta text;
    estado_error text;
    mensaje_error text;
    restriccion_error text;
    contexto_error text;
    destino text;
    filas bigint;
    fallos integer := 0;
BEGIN
    -- Este bloque exterior revierte todos sus cambios si ocurre
    -- un error inesperado de preparación o de una prueba positiva.
    IF current_database() <> 'sigd_rut_h3_jhasy_test'
       OR current_setting('server_version_num')::integer / 10000 <> 18
    THEN
        RAISE EXCEPTION 'Base o versión no autorizada';
    END IF;

    SELECT count(*) INTO filas
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'sigd_rut'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relispartition;

    IF filas <> 12 THEN
        RAISE EXCEPTION 'Se esperaban 12 tablas funcionales; hay %', filas;
    END IF;

    FOR r IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'sigd_rut'
          AND c.relkind IN ('r', 'p')
          AND NOT c.relispartition
    LOOP
        EXECUTE format('SELECT count(*) FROM sigd_rut.%I', r.relname)
        INTO filas;
        IF filas <> 0 THEN
            RAISE EXCEPTION 'Precondición incumplida: % contiene datos',
                            r.relname;
        END IF;
    END LOOP;

    -- 1. Catálogos puramente experimentales.
    INSERT INTO sigd_rut.accion_tramite
        (accion_tramite_id, codigo, nombre, descripcion)
    VALUES (base_id, marca, marca, marca);

    INSERT INTO sigd_rut.estado_tramite
        (estado_tramite_id, codigo, nombre, descripcion)
    VALUES (base_id, marca, marca, marca);

    INSERT INTO sigd_rut.transicion_estado_tramite
        (transicion_estado_tramite_id, estado_anterior_id,
         accion_tramite_id, estado_resultante_id, condicion_descriptiva)
    VALUES (base_id, base_id, base_id, base_id, marca);

    INSERT INTO sigd_rut.tipo_relacion_movimiento
        (tipo_relacion_movimiento_id, codigo, nombre, descripcion)
    VALUES (base_id, marca, marca, marca);

    RAISE NOTICE 'OK: INSERT en los cuatro catálogos experimentales';

    -- 2 y 3. Dos hechos sintéticos, sin significado institucional.
    INSERT INTO sigd_rut.movimiento_tramite
        (movimiento_id, fecha_hora, id_expediente, secuencia,
         accion_tramite_id, transicion_estado_tramite_id,
         estado_anterior_id, estado_resultante_id, observacion)
    VALUES
        (m26, h26, marca, 1, base_id, base_id, base_id, base_id, marca),
        (m27, h27, marca, 2, base_id, base_id, base_id, base_id, marca);

    FOR r IN
        SELECT *
        FROM (VALUES
            (m26, h26, 'movimiento_tramite_2026'),
            (m27, h27, 'movimiento_tramite_2027')
        ) AS v(id, instante, esperado)
    LOOP
        SELECT c.relname INTO destino
        FROM sigd_rut.movimiento_tramite m
        JOIN pg_class c ON c.oid = m.tableoid
        WHERE m.movimiento_id = r.id AND m.fecha_hora = r.instante;

        IF destino IS DISTINCT FROM r.esperado THEN
            RAISE EXCEPTION 'Enrutamiento incorrecto: esperado %, obtenido %',
                            r.esperado, destino;
        END IF;
        RAISE NOTICE 'OK: enrutamiento a %', destino;
    END LOOP;

    -- 4 a 6. Cada intento se revierte, incluso si resulta aceptado.
    FOR r IN
        SELECT *
        FROM (VALUES
            (
                'fecha fuera de cobertura',
                format(
                    'INSERT INTO sigd_rut.movimiento_tramite
                     (movimiento_id, fecha_hora, id_expediente, secuencia,
                      accion_tramite_id, estado_resultante_id, observacion)
                     VALUES (%L, %L, %L, 1, %L, %L, %L)',
                    spare_id, '2028-01-01 00:00:00+00',
                    marca, base_id, base_id, marca
                ),
                '23514', ''
            ),
            (
                'FK local huérfana',
                format(
                    'INSERT INTO sigd_rut.transicion_estado_tramite
                     (transicion_estado_tramite_id, accion_tramite_id,
                      estado_resultante_id, condicion_descriptiva)
                     VALUES (%L, %L, %L, %L)',
                    spare_id, spare_id, base_id, marca
                ),
                '23503', 'fk_transicion_accion'
            ),
            (
                'secuencia cero',
                format(
                    'INSERT INTO sigd_rut.movimiento_tramite
                     (movimiento_id, fecha_hora, id_expediente, secuencia,
                      accion_tramite_id, estado_resultante_id, observacion)
                     VALUES (%L, %L, %L, 0, %L, %L, %L)',
                    spare_id, h26, marca, base_id, base_id, marca
                ),
                '23514', 'ck_movimiento_secuencia'
            ),
            (
                'secuencia negativa',
                format(
                    'INSERT INTO sigd_rut.movimiento_tramite
                     (movimiento_id, fecha_hora, id_expediente, secuencia,
                      accion_tramite_id, estado_resultante_id, observacion)
                     VALUES (%L, %L, %L, -1, %L, %L, %L)',
                    spare_id, h26, marca, base_id, base_id, marca
                ),
                '23514', 'ck_movimiento_secuencia'
            )
        ) AS v(prueba, sql_prueba, sqlstate_esperado, constraint_esperado)
    LOOP
        BEGIN
            EXECUTE r.sql_prueba;
            RAISE EXCEPTION USING
                ERRCODE = 'ZX001',
                MESSAGE = 'Operación aceptada inesperadamente';
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS
                estado_error = RETURNED_SQLSTATE,
                mensaje_error = MESSAGE_TEXT,
                restriccion_error = CONSTRAINT_NAME;

            IF estado_error = r.sqlstate_esperado
               AND coalesce(restriccion_error, '') = r.constraint_esperado
            THEN
                RAISE NOTICE 'OK: %; SQLSTATE=%; restricción=%; mensaje=%',
                    r.prueba, estado_error, restriccion_error, mensaje_error;
            ELSE
                fallos := fallos + 1;
                RAISE WARNING 'FALLO: %; SQLSTATE=%; restricción=%; mensaje=%',
                    r.prueba, estado_error, restriccion_error, mensaje_error;
            END IF;
        END;
    END LOOP;

    -- 7 a 10. INSERT en los otros seis históricos.
    -- Estas filas prueban estructura; no modelan un flujo válido de negocio.
    INSERT INTO sigd_rut.derivacion_tramite
        (movimiento_fecha_hora, movimiento_id,
         id_area_origen, id_area_destino, motivo)
    VALUES (h26, m26, marca || ' A', marca || ' B', marca);

    INSERT INTO sigd_rut.recepcion_tramite
        (movimiento_fecha_hora, movimiento_id,
         derivacion_fecha_hora, derivacion_movimiento_id,
         id_area_receptora, observacion_recepcion)
    VALUES (h27, m27, h26, m26, marca || ' B', marca);

    INSERT INTO sigd_rut.observacion_tramite
        (movimiento_fecha_hora, movimiento_id, motivo, detalle)
    VALUES (h26, m26, marca, marca);

    INSERT INTO sigd_rut.atencion_tramite
        (movimiento_fecha_hora, movimiento_id, resultado_resumen)
    VALUES (h27, m27, marca);

    INSERT INTO sigd_rut.relacion_movimiento
        (relacion_movimiento_id, origen_fecha_hora, movimiento_origen_id,
         destino_fecha_hora, movimiento_destino_id,
         tipo_relacion_movimiento_id, motivo, registrado_en)
    VALUES (base_id, h26, m26, h27, m27, base_id, marca, h27);

    INSERT INTO sigd_rut.movimiento_documento
        (movimiento_fecha_hora, movimiento_id,
         documento_id, version_documento_id, finalidad)
    VALUES (h26, m26, marca, marca, marca);

    -- UPDATE y DELETE sobre filas existentes, sin modificar claves.
    -- Incluye acceso directo a las dos particiones.
    FOR r IN
        SELECT *
        FROM (VALUES
            ('movimiento_tramite',      'observacion',           2),
            ('movimiento_tramite_2026', 'observacion',           1),
            ('movimiento_tramite_2027', 'observacion',           1),
            ('derivacion_tramite',      'motivo',                1),
            ('recepcion_tramite',       'observacion_recepcion', 1),
            ('observacion_tramite',     'detalle',               1),
            ('atencion_tramite',        'resultado_resumen',     1),
            ('relacion_movimiento',     'motivo',                1),
            ('movimiento_documento',    'finalidad',             1)
        ) AS v(tabla, columna, esperado)
    LOOP
        EXECUTE format('SELECT count(*) FROM sigd_rut.%I', r.tabla)
        INTO filas;
        IF filas <> r.esperado THEN
            RAISE EXCEPTION 'Cantidad inesperada en %: %', r.tabla, filas;
        END IF;
        RAISE NOTICE 'OK: INSERT visible en %; filas=%', r.tabla, filas;

        FOREACH operacion IN ARRAY ARRAY['UPDATE', 'DELETE']
        LOOP
            IF operacion = 'UPDATE' THEN
                consulta := format(
                    'UPDATE sigd_rut.%I SET %I = %L WHERE %I = %L',
                    r.tabla, r.columna, marca || ' MODIFICADO',
                    r.columna, marca
                );
            ELSE
                consulta := format(
                    'DELETE FROM sigd_rut.%I WHERE %I = %L',
                    r.tabla, r.columna, marca
                );
            END IF;

            BEGIN
                EXECUTE consulta;
                RAISE EXCEPTION USING
                    ERRCODE = 'ZX001',
                    MESSAGE = 'Mutación histórica aceptada inesperadamente';
            EXCEPTION WHEN OTHERS THEN
                GET STACKED DIAGNOSTICS
                    estado_error = RETURNED_SQLSTATE,
                    mensaje_error = MESSAGE_TEXT,
                    contexto_error = PG_EXCEPTION_CONTEXT;

                IF estado_error = '23001'
                   AND mensaje_error LIKE
                       ('RutaDoc: ' || operacion ||
                        ' rechazado sobre histórico sigd_rut.%')
                   AND position(
                       'fn_rechazar_mutacion_historica' IN contexto_error
                   ) > 0
                THEN
                    RAISE NOTICE 'OK: % rechazado en % por append-only',
                                 operacion, r.tabla;
                ELSE
                    fallos := fallos + 1;
                    RAISE WARNING 'FALLO: % en %; SQLSTATE=%; mensaje=%',
                        operacion, r.tabla, estado_error, mensaje_error;
                END IF;
            END;
        END LOOP;

        EXECUTE format('SELECT count(*) FROM sigd_rut.%I', r.tabla)
        INTO filas;
        IF filas <> r.esperado THEN
            RAISE EXCEPTION 'Filas alteradas inesperadamente en %', r.tabla;
        END IF;
    END LOOP;

    -- 11. Catálogos mutables: filas auxiliares sin referencias entrantes.
    FOR r IN
        SELECT *
        FROM (VALUES
            ('accion_tramite', 'accion_tramite_id', 'descripcion'),
            ('estado_tramite', 'estado_tramite_id', 'descripcion'),
            ('tipo_relacion_movimiento',
             'tipo_relacion_movimiento_id', 'descripcion'),
            ('transicion_estado_tramite',
             'transicion_estado_tramite_id', 'condicion_descriptiva')
        ) AS v(tabla, clave, columna)
    LOOP
        IF r.tabla = 'transicion_estado_tramite' THEN
            INSERT INTO sigd_rut.transicion_estado_tramite
                (transicion_estado_tramite_id, estado_anterior_id,
                 accion_tramite_id, estado_resultante_id,
                 condicion_descriptiva)
            VALUES (spare_id, base_id, base_id, base_id, marca);
        ELSE
            EXECUTE format(
                'INSERT INTO sigd_rut.%I (%I, codigo, nombre, descripcion)
                 VALUES ($1, $2, $3, $3)',
                r.tabla, r.clave
            ) USING spare_id, marca || ' AUX', marca;
        END IF;

        EXECUTE format(
            'UPDATE sigd_rut.%I SET %I = $1 WHERE %I = $2',
            r.tabla, r.columna, r.clave
        ) USING marca || ' MODIFICADO', spare_id;
        GET DIAGNOSTICS filas = ROW_COUNT;
        IF filas <> 1 THEN
            RAISE EXCEPTION 'UPDATE no afectó una fila en %', r.tabla;
        END IF;

        EXECUTE format(
            'DELETE FROM sigd_rut.%I WHERE %I = $1', r.tabla, r.clave
        ) USING spare_id;
        GET DIAGNOSTICS filas = ROW_COUNT;
        IF filas <> 1 THEN
            RAISE EXCEPTION 'DELETE no afectó una fila en %', r.tabla;
        END IF;

        RAISE NOTICE 'OK: INSERT/UPDATE/DELETE experimental en %', r.tabla;
    END LOOP;

    -- Proyección: escritura manual de laboratorio, no escritor aprobado.
    INSERT INTO sigd_rut.estado_actual_tramite
        (id_expediente, movimiento_fecha_hora, movimiento_actual_id,
         estado_actual_id, secuencia_actual, actualizado_en,
         version_proyeccion)
    VALUES (marca, h26, m26, base_id, 1, h26, 1);

    UPDATE sigd_rut.estado_actual_tramite
    SET movimiento_fecha_hora = h27,
        movimiento_actual_id = m27,
        secuencia_actual = 2,
        actualizado_en = h27,
        version_proyeccion = 2
    WHERE id_expediente = marca;
    GET DIAGNOSTICS filas = ROW_COUNT;
    IF filas <> 1 THEN
        RAISE EXCEPTION 'UPDATE de proyección no afectó una fila';
    END IF;

    DELETE FROM sigd_rut.estado_actual_tramite
    WHERE id_expediente = marca;
    GET DIAGNOSTICS filas = ROW_COUNT;
    IF filas <> 1 THEN
        RAISE EXCEPTION 'DELETE de proyección no afectó una fila';
    END IF;

    RAISE NOTICE 'OK: INSERT/UPDATE/DELETE experimental en proyección';

    IF fallos = 0 THEN
        RAISE NOTICE 'RESULTADO: pruebas mínimas OK; pendiente ROLLBACK';
    ELSE
        RAISE WARNING 'RESULTADO: % pruebas negativas FALLARON', fallos;
    END IF;

EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
        estado_error = RETURNED_SQLSTATE,
        mensaje_error = MESSAGE_TEXT;
    RAISE WARNING
        'PRUEBA INCOMPLETA: SQLSTATE=%; mensaje=%. Cambios del bloque revertidos.',
        estado_error, mensaje_error;
END;
$pruebas$;

-- 12. Nunca confirmar los datos experimentales.
ROLLBACK;

-- Verificación posterior: exclusivamente lecturas de datos.
DO $verificacion$
DECLARE
    r record;
    filas bigint;
    tablas integer := 0;
    total bigint := 0;
BEGIN
    IF current_database() <> 'sigd_rut_h3_jhasy_test' THEN
        RAISE WARNING 'Verificación omitida: base incorrecta';
        RETURN;
    END IF;

    FOR r IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'sigd_rut'
          AND c.relkind IN ('r', 'p')
          AND NOT c.relispartition
        ORDER BY c.relname
    LOOP
        tablas := tablas + 1;
        EXECUTE format('SELECT count(*) FROM sigd_rut.%I', r.relname)
        INTO filas;
        total := total + filas;
        IF filas <> 0 THEN
            RAISE WARNING 'REVISAR: % contiene % filas', r.relname, filas;
        END IF;
    END LOOP;

    IF tablas = 12 AND total = 0 THEN
        RAISE NOTICE
            'OK POST-ROLLBACK: 12 tablas funcionales vacías; sin datos experimentales';
    ELSE
        RAISE WARNING
            'FALLO POST-ROLLBACK: tablas=%; filas totales=%', tablas, total;
    END IF;
END;
$verificacion$;

\q
~~~

### F. Criterios de aceptación de la reproducción

Deben cumplirse conjuntamente:

- Inventario D conforme y doce tablas funcionales vacías antes de las inserciones.
- Ausencia de ERROR no capturado.
- Ausencia de mensajes FALLO y PRUEBA INCOMPLETA.
- Presencia de RESULTADO: pruebas mínimas OK.
- Presencia de OK POST-ROLLBACK: 12 tablas funcionales vacías; sin datos experimentales.
- ROLLBACK explícito ejecutado y doce tablas funcionales vacías al finalizar.
- Exit code 0, consultado en PowerShell inmediatamente al salir de psql:

~~~powershell
$LASTEXITCODE
~~~

Los errores esperados deben aparecer capturados con SQLSTATE 23514 (fecha fuera de cobertura y secuencia no positiva), 23503 en fk_transicion_accion, y 23001 desde la función append-only. Un error distinto no equivale a rechazo conforme.

Los manejadores pueden producir WARNING sin cambiar el exit code de psql. Por ello, un 0 aislado, o tablas vacías después de una preparación fallida, no bastan. Exigir también los mensajes positivos y ausencia de FALLO/PRUEBA INCOMPLETA. Si una interrupción detiene la sesión antes del rollback explícito, no declarar el bloque superado; al cerrar la conexión se revierte su transacción pendiente.

Conservar la salida de la nueva ejecución, su fecha, entorno, versión y códigos como evidencia nueva, sin reemplazar ni alterar los resultados históricos de este documento. La reproducción no autoriza cerrar H3/H4 ni aprobar reglas institucionales.

### G. Incidencias conocidas y lectura de resultados

| Incidencia | Interpretación y actuación |
| --- | --- |
| Intento original con client_encoding WIN1252 | Falló en línea 217 frente al archivo UTF-8; se confirmó rollback y ausencia de esquema. No reproducir deliberadamente ese fallo. |
| Corrección temporal de codificación | Usar PGCLIENTENCODING=UTF8 en la sesión PowerShell; no modificar el DDL ni configuración del servidor. |
| Mojibake de consola | Incidencia de presentación, no corrupción demostrada. chcp 65001 y la codificación del cliente atienden capas distintas. |
| TimeZone America/Bogota | Entorno histórico reportado. Los límites experimentales son UTC; su representación a las 19:00 del día anterior en UTC−5 corresponde al mismo instante. No redefine el año fiscal institucional. |
| Segunda instalación original | Falló como se esperaba en línea 49 por esquema existente, con exit code 3; conservó el inventario básico. Ese código no es el esperado para una instalación limpia ni para la suite mínima. |

No volver a ejecutar automáticamente la instalación sobre el laboratorio ya instalado. La evidencia histórica de reinstalación no convierte el DDL en una migración idempotente. Las pruebas de concurrencia, secuencia e idempotencia globales, escritor, reconstrucción, rendimiento, Outbox, contratos, catálogo institucional, carga y deadlocks permanecen NO EJECUTADAS según la sección 17.
