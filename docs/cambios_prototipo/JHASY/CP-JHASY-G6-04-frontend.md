# CP-JHASY-G6-04 — Entrega frontend para revisión

**Estado de entrega:** Frontend G6-04 listo para revisión; lecturas verificadas contra API real en entorno descartable. Recuperación funcional de acciones y revisión del equipo pendientes.

**Fecha del informe:** 2026-10-16.

**Actualización de entrega: 2026-10-19.** El usuario comunica autorización de Geric para guardar y subir todo el avance útil exclusivamente a `B_JHASY`, incluidos los pendientes. La sección 11 registra el corte de entrega y sustituye las restricciones históricas de no commit/push para esta operación. La entrega del avance no equivale a declarar finalizadas las capacidades pendientes.

Este informe registra la implementación y las validaciones realizadas, incluida la fase autorizada por Geric y comunicada por el usuario: fast-forward exacto, nueva ejecución de las 12 suites y prueba integrada de lecturas. No se modificó código frontend en esa fase. Las pruebas con respuestas simuladas se mantienen separadas de la nueva prueba contra API y PostgreSQL reales. La versión anterior del informe se conserva íntegra en `CP-JHASY-G6-04-frontend-antes-ff.md`.

## 1. Rama, referencia y estado Git

| Elemento | Valor |
|---|---|
| Carpeta de trabajo | `C:\Users\Jhass\Desktop\SIGD-B_JHASY` |
| Rama requerida y actual | `B_JHASY` |
| HEAD anterior al fast-forward | `6b6f18619a763b73dfe6f6afde51db5cef4d60bb` |
| HEAD actual | `4e06e512fe08d01712bc0b6feb33e95ca28c1b10` |
| Referencia técnica de Geric | `4e06e512fe08d01712bc0b6feb33e95ca28c1b10` |
| Índice | Sin cambios staged |
| Working tree | Dirty; contiene la implementación local que debe conservarse |

Al iniciar G6-04 existía la modificación local de `frontend/src/utils/foliadoValidator.test.ts`. Se conservó durante toda la implementación y validación.

Antes de crear este informe había ocho archivos seguidos modificados y diez archivos nuevos sin seguimiento. Antes del fast-forward, con el informe ya creado, había ocho modificados, once nuevos sin seguimiento y cero staged. Los 19 archivos se inventariaron con ruta, tamaño y SHA-256 en `CP-JHASY-G6-04-preservacion.json`.

Después del fast-forward se verificaron **19 de 19 hashes idénticos**, incluido este informe antes de actualizarlo. El estado final de esta fase es siete archivos seguidos modificados, diecisiete archivos nuevos sin seguimiento y cero staged. Los siete modificados son los seis de implementación y la prueba local. El lockfile ya forma parte de HEAD y dejó de ser una modificación local. Los nuevos incluyen los diez de frontend y siete documentos/artefactos de evidencia. La actualización documental actual es intencionada; su versión previa conserva el hash inventariado en `CP-JHASY-G6-04-frontend-antes-ff.md`.

Con la autorización específica comunicada por el usuario, se preparó **solo** `frontend/package-lock.json` en el índice, pasó el dry-run y se ejecutó `git merge --ff-only 4e06e512fe08d01712bc0b6feb33e95ca28c1b10`. No se creó un commit de merge. No hubo rebase, cherry-pick, commit propio ni push. Los archivos backend/migraciones recibieron exclusivamente sus versiones del fast-forward; no se editaron manualmente. La carpeta original `C:\Users\Jhass\Desktop\SIGD` conserva su rama `docker/jhasy-local-stack` y HEAD `6b6f18619a763b73dfe6f6afde51db5cef4d60bb`.

## 2. Funcionalidad de lectura implementada

Se adaptaron las pantallas existentes y se reutilizó `apiClient`, conservando rutas, autenticación y el tratamiento centralizado RFC 7807. No se incluyeron fixtures como fallback del producto.

Todos los endpoints siguientes tienen prefijo `/api/v1`:

| Funcionalidad | Endpoint | DTO e identidad |
|---|---|---|
| Bandeja | `GET /expedientes` | `ResultadoBandeja`: elementos, contadores, cursor y `tieneMas`; expediente UUID string |
| Detalle directo | `GET /expedientes/:id` | `ExpedienteDetalle`; UUID recibido en la ruta, sin depender de la caché de bandeja |
| Trazabilidad | `GET /expedientes/:id/trazabilidad` | `{ expedienteId, actuaciones }`; movimiento UUID separado de secuencia y operador numéricos serializados como texto |
| Foliación | `GET /expedientes/:id/foliacion` | `FolioExpediente[]`; documentos UUID y rangos numéricos reales |
| SLA | `GET /expedientes/:id/sla-status` | `ResultadoSla`; valores y estado del backend sin recálculo frontend |

La bandeja usa pestañas, filtros, contadores y paginación del servidor. El cursor se trata como texto opaco y se reinicia al cambiar filtros o pestaña. Las consultas de detalle se separan por UUID y recurso; se utiliza cancelación para impedir que respuestas tardías de un expediente aparezcan en otro.

Se contemplan carga, vacío, fallo de red, errores 400/401/403/404, respuesta inválida y reintento. El SLA incluye una aclaración visible: el calendario institucional definitivo está pendiente de aprobación. No se sustituye el resultado backend por un plazo o cálculo local.

No se muestran tarifas, requisitos ni vigencias TUPA inventadas. La consulta del vínculo TUPA permanece pendiente de contrato confirmado; la interfaz no afirma que un expediente esté «sin vínculo TUPA».

La página 14 de `SIGD_prompts_equipo_acoplamiento_TUPA.pdf` prohíbe inferir la identidad desde CUT. No establece un resolvedor CUT→UUID como requisito independiente de cierre de Jhasy. Solo sería una dependencia para un flujo aprobado que parta exclusivamente del CUT y necesite obtener el UUID; no bloquea las lecturas que ya reciben un UUID válido.

## 3. Visibilidad recuperada y límites funcionales

| Capacidad | Presentación actual | Límite declarado |
|---|---|---|
| Derivar | Botón visible y deshabilitado, con explicación accesible | El envío a otra área no está disponible |
| Observar | Botón visible y deshabilitado, con explicación accesible | El registro de observaciones no está disponible; no se promete suspensión del SLA |
| Acumular | Botón visible y deshabilitado, con explicación accesible | La acumulación no está disponible |
| Clasificación CCD | Sección visible | La consulta no está disponible; no se afirma que el expediente carezca de clasificación |
| Versiones documentales | Sección visible | La consulta no está disponible; no se afirma ausencia de versiones |

Las acciones no abren formularios ni envían solicitudes de escritura. La interfaz no expone nombres de responsables, detalles técnicos internos o mensajes de coordinación. No se inventaron permisos ni se habilitaron operaciones por analogía con otros permisos.

Esta recuperación conserva la visibilidad de las capacidades; no equivale a recuperar su funcionamiento completo.

## 4. Bloqueos concretos y responsables

| Capacidad o dependencia | Evidencia del bloqueo | Responsable de resolver o confirmar | Estado |
|---|---|---|---|
| Derivar | HEAD usaba destinos como `area-dg`, incompatibles con el UUID exigido. El servicio de escritura consulta estructuras anteriores al baseline. Falta un catálogo autorizado y compatible de destinos | Cari: escritor y datos autorizados; Geric: contrato; Jhasy: consumo; Ricardo: interfaz | BLOCKED para habilitar escritura |
| Observar/Suspender | Existe actualización UUID de `expediente.estado` y respuesta `slaPaused: true`, pero no se demuestra suspensión en el motor SLA ni coherencia con la proyección que lee el detalle. Falta autorización específica confirmada de la acción | Cari y Geric: autorización y semántica; Jhasy: conexión después de confirmación | BLOCKED para habilitar escritura |
| Acumular | HEAD enviaba `expedientesConexos`; el controlador espera `expedienteAccesorioId`, `accesorioId` o `conexos[0].id`. No había búsqueda conectada de conexos. Cardinalidad y permisos requieren confirmación | Cari y Geric: contrato; Jhasy: adaptador y búsqueda; Ricardo: recorrido visual | BLOCKED para habilitar escritura |
| Clasificación CCD del expediente | El DTO de detalle no publica la asignación. El catálogo general no prueba la clasificación del expediente y su proveedor predeterminado contiene ejemplos no oficiales | Cari con el responsable de datos documentales; Geric coordina; Jhasy consume; Ricardo revisa presentación | PENDING |
| Versiones documentales | El DTO de detalle no contiene el historial. Los fixtures generan versiones y hashes demostrativos; no se identificó un endpoint equivalente confirmado por expediente | Cari con DocuCore; Geric coordina; Jhasy consume; Ricardo revisa presentación | PENDING |
| Contexto TUPA | Falta contrato API confirmado para consultar versión y vínculo; no se deduce el vínculo ni se publican datos institucionales no homologados | Cari: API; Geric: contrato/homologación; Jhasy: consumo | PENDING |
| Calendario SLA definitivo | El motor actual no acredita el calendario legal institucional; la limitación ya es visible | Geric coordina aprobación institucional; Cari confirma contrato backend | PENDING |
| API y datos compatibles | Se ejecutó un recorrido real de lecturas sobre el backend actualizado, dos UUID y PostgreSQL 18 nuevo. No certifica todas las escrituras, servicios externos ni permisos por expediente | Cari: garantías backend; Pool: entorno reproducible; Jhasy: consumo | PASS en el alcance probado; resto PENDING |
| Revisión e incorporación | Base técnica incorporada por fast-forward autorizado. La revisión final del trabajo propio y de pantallas/componentes compartidos sigue pendiente | Geric: revisión final; Ricardo: revisión visual/compatibilidad; Cari: contratos pendientes | PENDING revisión; incorporación de base PASS |

Las asignaciones de datos documentales requieren coordinación; no se presume que una API ausente esté aprobada ni que Jhasy deba implementarla en backend.

## 5. Archivos propios, compartidos y procedencia

### Existentes adaptados en frontend

```text
frontend/src/components/expedientes/BandejaTabFilter.tsx
frontend/src/components/expedientes/ExpedienteTable.tsx
frontend/src/hooks/useBandejaExpedientes.ts
frontend/src/hooks/useExpedienteTimeline.ts
frontend/src/pages/expedientes/BandejaExpedientesPage.tsx
frontend/src/pages/expedientes/ExpedienteDetallePage.tsx
```

Las páginas y componentes son zonas compartidas para revisión con Ricardo/Geric. No se editaron rutas globales, autenticación, `frontend/src/api/client.ts` ni contratos globales de escritura.

### Coordinación recibida de B_AREVALO — 2026-10-18

Según la comunicación de B_AREVALO trasladada por el usuario, no hay solapamiento reportado en los seis archivos anteriores: su working tree no contiene cambios en ellos y el último commit que los tocó es `6b6f186`, ya presente en el historial. B_AREVALO reporta estar en `692ea79`, sincronizada con `origin/B_AREVALO`; sus cambios locales de rediseño e integración TUPA se concentran en `/tramite`, HomePage, LoginPage y estilos. Esta información se registra como coordinación recibida; no se inspeccionó esa rama en esta actualización documental.

La compatibilidad visual M03 sigue **PENDING** de revisión de Ricardo. La ausencia de solapamiento reportada no constituye aprobación visual, aprobación de integración ni garantía de ausencia de conflictos futuros. El contexto TUPA del detalle sigue pendiente de contrato confirmado; G6-04 no lo expone ni determina que no exista vínculo.

### Resumen del diff de los seis archivos compartidos frente a HEAD

Las rutas de componentes siguientes pertenecen a `frontend/src/components/expedientes/`, las de hooks a `frontend/src/hooks/` y las páginas a `frontend/src/pages/expedientes/`.

| Archivo | Props, entradas o retorno antes → ahora | Presentación y comportamiento | Revisión concreta de Ricardo |
|---|---|---|---|
| `BandejaTabFilter.tsx` | `estadoActivo` y callback pasan de `EstadoFlujoExpediente` a `Pestana`; `conteos` obligatorio por estado pasa a opcional `Bandeja["contadores"]` | Conserva `tablist`, `tab`, `aria-selected` y callback. Las pestañas antiguas Pendientes/En Proceso/Observados/Derivados/Notificados/Archivados se sustituyen por Pendientes/En trámite/Derivados/Por firmar/Atendidos/Archivados del backend. Sin contadores muestra «—», no cero supuesto. Se eliminan estilos condicionales de pestaña activa, badges, sombras y borde inferior; quedan botones con borde y padding | Aprobar etiquetas y agrupación del contrato real; revisar distinción visual de selección, contraste, foco y disposición en móvil |
| `ExpedienteTable.tsx` | `expedientes: ExpedienteSGD[]` y callback de ese modelo pasan a `Resumen[]` y callback de `Resumen`; clave de fila `id` pasa a `idExpediente` UUID | Antes: CUT, Asunto, Solicitante, Serie CCD, Folios, Fecha Ingreso, Plazo Restante y Acciones. Ahora: CUT, Asunto, Estado, Área actual, Radicación y Detalle. Conserva vacío, desplazamiento horizontal y botón Ver; elimina SLA calculado localmente y columnas sin datos en el resumen real. La fecha se muestra como recibida, sin el formateador es-PE anterior. Se simplifican encabezados, padding, fondos, hover, bordes y sombra | Revisar legibilidad de UUID/fechas, columnas, espaciado, desbordamiento, formato visual de fecha y botón Ver; no restaurar campos ficticios ni SLA local |
| `useBandejaExpedientes.ts` | `{ estado?, busqueda? }` pasa a `Filtros` (`pestana`, `limite`, búsqueda, área, fechas y cursor). `data` deja de ser arreglo filtrado y pasa a objeto con `elementos`, `contadores`, `siguienteCursor`, `tieneMas`. Se elimina la exportación `useExpedientesBase` | Sustituye filtrado y conteos locales por consulta backend. Sin fallback a fixtures. React Query usa clave por filtros y `AbortSignal`; `retry: false`. Se retira `staleTime: 30_000` explícito | Revisar consumidores del retorno y de la exportación retirada; estados de consulta y comportamiento de refresco; mantener cursor opaco |
| `useExpedienteTimeline.ts` | Conserva entrada `string \| undefined`; `data` pasa de `BitacoraEventoExpediente[]` a `{ expedienteId, actuaciones }` | Lectura por UUID, sin fixtures; clave por expediente/recurso y cancelación. Ordena por secuencia con `BigInt` en el adaptador, en lugar de timestamp; UUID de movimiento separado de secuencia y operador. Conserva consulta deshabilitada sin id; retira `staleTime` explícito y fija `retry: false` | Revisar consumidores del nuevo objeto, orden de actuaciones, carga/error y presentación; no exigir nombres o hashes que el DTO no proporciona |
| `BandejaExpedientesPage.tsx` | Sin props externas; consume el nuevo retorno paginado en lugar del arreglo y `useExpedientesBase` | Conserva regreso al inicio y apertura del detalle por UUID. Añade formulario de CUT/asunto, área UUID, fechas y límite, contadores backend y Anterior/Siguiente; reinicia cursor e historial al cambiar filtros/pestaña. Retira selector CCD demostrativo, métricas locales de prioridad/vencimiento y temporizador. Sustituye cabecera, tarjetas y composición anteriores por contenedor y formulario más simples | Revisar jerarquía visual, filtros y aplicación explícita, botones, estados vacíos/error, paginación y adaptación móvil; confirmar pérdida intencional de elementos sin contrato real |
| `ExpedienteDetallePage.tsx` | Sin props externas; obtiene UUID de ruta y consume consultas separadas de detalle, trazabilidad, foliación y SLA | Conserva recorrido bandeja→detalle y regreso. Detalle mediante endpoint propio, sin depender de caché de bandeja. Presenta campos reales y carga/error/reintento por recurso. Derivar, Observar y Acumular visibles/deshabilitados, sin handlers de escritura ni formularios; CCD y versiones visibles con consulta no disponible. Sustituye composición anterior por ficha y secciones; acciones/CCD/versiones conservan tarjetas con borde y sombra | Revisar jerarquía, consistencia M03, accesibilidad de explicaciones, visibilidad de indisponibilidad, lectura de identificadores y valores SLA; no confundir visibilidad con recuperación funcional |

Las rutas y la autenticación permanecen conservadas. La foliación muestra rangos reales y el SLA conserva valores backend con aviso del calendario provisional. Las tres acciones deshabilitadas siguen bloqueadas por los contratos/datos/permisos descritos en la sección 4; no se habilitan por esta coordinación.

### Página vigente y reexportación

Verificado en el código local: `frontend/src/routes/AppRouter.tsx:16` importa directamente `../pages/expedientes/BandejaExpedientesPage`; la ruta `/expedientes` la monta en la línea 98. Esa es la implementación modificada por G6-04. El archivo `frontend/src/pages/BandejaExpedientesPage.tsx:1` únicamente reexporta el default y los exports de `./expedientes/BandejaExpedientesPage`: no contiene una segunda implementación. No se modificó ni eliminó la reexportación ni se afirma que sea un archivo huérfano.

Esta actualización modifica únicamente el informe. No se repitieron pruebas, no se cambió código ni se preparó staged, commit o push; los resultados históricos de validación permanecen separados y sin cambios.

### Nuevos de G6-04

```text
frontend/src/pages/expedientes/rutadoc/rutadoc.dto.ts
frontend/src/pages/expedientes/rutadoc/rutadoc.adapters.ts
frontend/src/pages/expedientes/rutadoc/rutadoc.service.ts
frontend/src/pages/expedientes/rutadoc/useRutaDocDetalle.ts
frontend/src/pages/expedientes/rutadoc/RutaDocEstado.tsx
frontend/src/pages/expedientes/rutadoc/RutaDocTimeline.tsx
frontend/src/pages/expedientes/rutadoc/RutaDocFoliacion.tsx
frontend/src/pages/expedientes/rutadoc/RutaDocSla.tsx
frontend/tests/unit/pages/expedientes/rutadoc.adapters.test.ts
frontend/tests/integration/expedientes/rutadoc-g6-04.test.tsx
docs/cambios_prototipo/JHASY/CP-JHASY-G6-04-frontend.md
```

### Prueba local previa conservada

`frontend/src/utils/foliadoValidator.test.ts` conserva la modificación de Jhasy sobre `Number.MAX_SAFE_INTEGER`. SHA-256 verificado previamente y conservado durante las últimas comprobaciones:

```text
F3A7E882A89CDC2D33FD81F72BA5EDBA02D67E6039E05B57E1033BEC6C4342D3
```

### Lockfile de Geric: no atribuir a Jhasy

`frontend/package-lock.json` se tomó mediante autorización específica de:

```text
4e06e512fe08d01712bc0b6feb33e95ca28c1b10:frontend/package-lock.json
```

El comando autorizado y ejecutado fue exclusivamente:

```powershell
git -C "C:\Users\Jhass\Desktop\SIGD-B_JHASY" restore --source=4e06e512fe08d01712bc0b6feb33e95ca28c1b10 --worktree -- frontend/package-lock.json
```

Su contenido coincide con la referencia según `git diff --exit-code 4e06e512fe08d01712bc0b6feb33e95ca28c1b10 -- frontend/package-lock.json`. El SHA-256 del archivo de trabajo es `38CE68D10EBDC0AA53F6D6A29EAB6E5E3F0B538E68C7DE899C9F71A20AB5CF15`. No se regeneró el lockfile ni se modificó `package.json`. `npm ci --no-audit --no-fund` terminó correctamente con 297 paquetes instalados y no alteró esos archivos.

La corrección del lockfile pertenece a Geric. Después del fast-forward ya está en HEAD y no aparece en el diff propio de G6-04: no debe duplicarse ni atribuirse a Jhasy.

## 6. Evidencia de validación: ejecuciones independientes

Los comandos npm de las suites frontend se ejecutaron desde `frontend`. Esas suites usan respuestas simuladas, no una API real. Las ejecuciones siguientes se superponen y no deben sumarse como un total de pruebas distintas. La prueba integrada de la sección 7 se ejecutó por separado, sin interceptar respuestas ni sustituir autenticación o permisos.

| Ejecución | Comando o alcance | Resultado final registrado |
|---|---|---|
| Validación inicial de G6-04 | Suites nuevas y relacionadas: adaptadores, página, componentes, hooks, API y `foliadoValidator.test.ts` | 119 pruebas aprobadas en 12 suites |
| Aviso de calendario SLA, posterior | `npm.cmd test -- tests/integration/expedientes/rutadoc-g6-04.test.tsx -t "advierte el calendario provisional"` | 1 prueba adicional aprobada; 32 excluidas por filtro |
| Revisión de capacidades retiradas | Página G6-04 y pruebas de modales, hook, API, utilidades de acciones y `foliadoValidator.test.ts` | 89 pruebas aprobadas en 6 suites; ejecución independiente |
| Validación de visibilidad recuperada, anterior al fast-forward | `npm.cmd test -- tests/integration/expedientes/rutadoc-g6-04.test.tsx` | 35 pruebas aprobadas en la suite afectada |
| Nueva ejecución tras el fast-forward | Las mismas 12 suites de la validación inicial, con su contenido actual | **122 pruebas aprobadas en 12 suites; 0 fallidas**, salida 0 |
| Último typecheck | `npm.cmd run typecheck` | PASS |
| Última revisión de whitespace | `git diff --check`, complementado con revisión del archivo de pruebas nuevo | PASS |

**No hubo una ejecución conjunta de 120 pruebas.** La nueva ejecución autorizada de las 12 suites dio 122; no se asumió ni reutilizó el total anterior de 119. El comando completo y el hash actual de cada suite están registrados en `CP-JHASY-G6-04-validacion-post-ff.json`.

La suite de página verifica, con dos UUID:

- Visibilidad de Derivar, Observar, Acumular, Clasificación CCD y Versiones documentales.
- Botones deshabilitados, explicaciones accesibles y ausencia de formularios.
- Ausencia de llamadas de escritura y de consultas inventadas para CCD/versiones.
- Continuidad de detalle, trazabilidad, foliación y SLA del expediente correcto.
- Paginación, filtros, cursor opaco, vacíos, errores y respuestas inválidas.
- Navegación A→B con respuestas tardías, sin mezcla de eventos, folios o SLA.
- Aviso de calendario provisional y conservación de todos los valores SLA.
- No presentación de las capacidades del expediente cuando falla el acceso al detalle.

Las incidencias de tipado y sincronización asíncrona encontradas durante la validación se corrigieron en la suite nueva, sin eliminar comprobaciones. El último resultado de esa suite y del typecheck es satisfactorio. El acceso denegado de esbuild dentro del entorno aislado se resolvió ejecutando las pruebas con permiso fuera de ese entorno, sin cambiar configuración del proyecto.

## 7. Incorporación autorizada y prueba integrada real

El fast-forward recibió los cuatro commits y 40 archivos de Geric, sin editar manualmente backend/migraciones. Se preservaron todos los archivos locales inventariados. El único archivo preparado en el índice fue el lockfile ya coincidente con el destino; después de avanzar HEAD el índice quedó sin cambios staged.

La comprobación previa que rechazaba el lockfile dejó de bloquear después de su preparación específica autorizada. La actualización fue exclusivamente fast-forward al SHA acordado, sin stash, descarte de archivos propios ni resolución con `ours/theirs`.

### Entorno y comprobaciones integradas

Comando de verificación, desde la raíz: `python docs/cambios_prototipo/JHASY/verificar_integracion_g604.py`. El script no contiene credenciales; las genera en memoria. Evidencia del ensayo satisfactorio: `CP-JHASY-G6-04-integracion-g604-ffcd95330c2f.json`.

| Recurso | Evidencia |
|---|---|
| Base PostgreSQL | `g604_ffcd95330c2f`, creada vacía, cero esquemas `sigd_*` antes de instalar; distinta de `sigd_demo` |
| PostgreSQL | Contenedor nuevo `g604-ffcd95330c2f-pg`, imagen `postgres:18-alpine`, almacenamiento tmpfs en `/var/lib/postgresql`, sin volumen de datos |
| Backend | Contenedor nuevo `g604-ffcd95330c2f-api`, código recibido en B_JHASY, montaje de fuente de solo lectura y copia aislada de ejecución; imagen `node:24.19-bookworm-slim` |
| Dependencias backend | `npm ci --no-audit --no-fund` en volumen nuevo `g604-ffcd95330c2f-work`; salida 0; manifiestos comparados sin cambios |
| Red | `g604-ffcd95330c2f-net`, nueva y etiquetada por ejecución; no se reutilizaron redes, contenedores, bases o volúmenes existentes |
| Instalación | Runner real con `SIGD_MIGRATION_PROFILE=BASELINE_2026_V1`; ledger de siete scripts: 01–05, baseline y 08; sin registrar 06/07 |
| Autenticación | Cuentas efímeras con hash Argon2, roles físicos y login real; JWT emitidos por el backend, sin proveedor de identidad simulado |
| Frontend/navegador | Vite de este working tree, mocks deshabilitados, Edge headless con perfil temporal nuevo; sin interceptores de respuestas del ensayo |
| Limpieza | Los dos contenedores nuevos, el volumen y la red fueron eliminados; se cerraron Vite/Edge y se retiró el perfil temporal |

Se comprobaron mediante HTTP real: login de operador y ciudadano; 401 sin token; 403 de bandeja para rol no permitido; 400 para UUID inválido; 404 para UUID inexistente; dos páginas distintas reutilizando el cursor sin decodificarlo; detalle, historial y folios aislados para dos UUID, con 3 y 7 folios; SLA VERDE y ROJO del motor real.

En el navegador se comprobaron bandeja y paginación reales, detalle directo de ambos UUID, separación de movimientos/documentos, valores SLA idénticos a los recibidos y acciones visibles/deshabilitadas sin formulario. El tráfico de la UI de lecturas registrado contiene solo GET/OPTIONS, sin escrituras. El login real y la preparación de fixtures se realizaron fuera de ese recorrido UI, exclusivamente en la base efímera.

Docker Desktop estaba detenido; se inició para este ensayo. Sus contenedores `sigd_demo` preexistentes reaparecieron, pero no se usaron como destino de pruebas ni se ejecutaron sobre ellos comandos de modificación o limpieza. Docker Desktop queda en ejecución; no se detuvieron recursos ajenos para restaurar el estado del motor.

### Límites y primer intento

El primer intento se detuvo antes de instalar backend al consultar el campo incorrecto de Docker para comprobar tmpfs. La base nueva estaba vacía; sus recursos se eliminaron. Esa evidencia se conserva en `CP-JHASY-G6-04-integracion.json`. Se corrigió solo el verificador para consultar `HostConfig.Tmpfs`, manteniendo la exigencia de almacenamiento temporal y ausencia de volúmenes. El segundo intento, con recursos nuevos, terminó PASS.

Este resultado no certifica producción, bases existentes, servicios S3/Redis/correo/firma, escrituras, reversión, contexto TUPA, CCD/versiones ni la autorización fina por expediente. Se conservaron las políticas actuales del backend; no se sustituyeron ni desactivaron permisos. El caso 403 probado corresponde al rol de bandeja, no a una auditoría completa de autorización.

La navegación integrada recorrió enlaces directos y paginación con dos UUID. El caso específico de respuesta A tardía después de navegar a B sigue respaldado por la prueba frontend simulada; no se forzó retraso real de red en el ensayo integrado. Tampoco se certifica el calendario legal institucional.

### Pendientes del equipo

1. Geric revisa el diff propio, la evidencia y la atribución del lockfile. Ricardo revisa pantallas, accesibilidad y compatibilidad de componentes compartidos.
2. Cari confirma permisos y semántica de escritura antes de recuperar acciones funcionales, así como contratos TUPA, CCD y versiones; no se reactivan handlers incompatibles ni datos de demostración.
3. Pool revisa la reproducibilidad del entorno y la ruta de despliegue pertinente. El ensayo nuevo no autoriza aplicar el baseline a bases existentes.
4. Cualquier ampliación de pruebas o habilitación de escrituras requiere alcance revisado. La aprobación para fast-forward y este ensayo no equivale a cierre de todos los pendientes ni a autorización para commit o push.

## 8. Resultado de entrega

| Área | Resultado |
|---|---|
| Lecturas frontend y aislamiento entre UUID | PASS local y PASS integrado acotado con API real y PostgreSQL nuevo |
| Visibilidad de las cinco capacidades | PASS local |
| Acciones de escritura | BLOCKED; visibles y deshabilitadas |
| Consulta de clasificación CCD y versiones | PENDING; indisponibilidad visible, sin inferir ausencia de datos |
| Contexto TUPA y calendario definitivo | PENDING de contratos/aprobación |
| Prueba contra API compatible | PASS en el alcance de lecturas descrito; límites explícitos en sección 7 |
| Incorporación de base técnica | PASS: fast-forward exacto autorizado |
| Revisión final del equipo | PENDING |

Se entrega la implementación frontend, las pruebas actuales y evidencia integrada de lecturas para revisión. No se declaran recuperadas funcionalmente las acciones ni certificado un despliegue productivo.

**Frontend G6-04 listo para revisión; lecturas verificadas contra API real en entorno descartable. Recuperación funcional de acciones y revisión del equipo pendientes.**

## 9. Ajuste visual posterior a revisión remota — 2026-10-18

Esta sección actualiza la presentación descrita en el resumen de diff de la sección 5. El usuario comunicó que Ricardo verificó el ZIP v2 y su manifiesto, revisó originales sin reconstrucciones y obtuvo typecheck, build y 461 pruebas aprobadas en su worktree. Son resultados **reportados por Ricardo**, anteriores al ajuste siguiente; no se atribuyen a una ejecución propia ni se suman a otras ejecuciones.

### Cambios mínimos autorizados

| Área | Ajuste y conservación del contrato |
|---|---|
| Pestañas | Selección con fondo azul, texto blanco, negrita y subrayado; mantiene `aria-selected`. Todas incluyen contorno `focus-visible`. Se conservan las seis pestañas del backend |
| Contadores | El «—» anterior procedía de `conteos?.[p] ?? "—"`, no de convertir cero a ausencia. Ahora carga muestra «Cargando…», error «No disponible» y ausencia «Sin dato»; un cero real se muestra como 0. El esquema sigue rechazando respuestas sin contadores; «Sin dato» es defensa de presentación y no sustituye un contrato válido. No se fabrican cantidades |
| Fechas | Se reutiliza `fechaExpediente` de `utils/expedientePresentacion.ts` para instantes, en es-PE y zona `America/Lima`. Las fechas civiles `YYYY-MM-DD` se presentan directamente como `DD/MM/YYYY`, sin convertir medianoche UTC. El elemento `time` conserva el original en `dateTime`; no se alteran DTO, ordenamiento ni parámetros de consulta |
| Identificadores | El UUID principal queda completo y puede partir línea. Los secundarios largos tienen resumen abreviado y un `details`/`summary` nativo para desplegar el valor completo, con foco visible y texto explicativo. Los cortos siguen completos. Las rutas y solicitudes conservan los IDs originales. No se inventan nombres ni consultas. Se mantiene el nombre documental del DTO y se muestran remitente/destinatario solo si el DTO los proporciona |
| SLA y capacidades | Solo cambia la presentación de sus fechas. No se recalculan valores ni plazos. Se conserva el aviso del calendario; Derivar, Observar y Acumular siguen deshabilitados, y CCD/versiones con consulta no disponible. No se restauran KPIs ni datos demostrativos |

Los auxiliares de presentación `FechaRutaDoc` e `IdentificadorRutaDoc` se exportan desde el archivo ya autorizado `rutadoc/RutaDocEstado.tsx`; no se añade ni mueve otro módulo en este ajuste. Se usan en tabla, detalle, trazabilidad, foliación y SLA según corresponda. Los otros archivos de producto tocados son `BandejaTabFilter.tsx`, `ExpedienteTable.tsx`, `BandejaExpedientesPage.tsx`, `ExpedienteDetallePage.tsx`, `RutaDocTimeline.tsx`, `RutaDocFoliacion.tsx` y `RutaDocSla.tsx`. Se adapta únicamente la suite nueva de página para la presentación y los casos adicionales.

### Búsqueda aplicada y búsqueda en vivo

La búsqueda mantiene CUT/asunto y los filtros de área, fechas, pestaña y límite acordados, mediante consulta backend. Escribir no dispara consultas: se aplican con «Aplicar filtros» o el envío del formulario, reiniciando cursor e historial. Cambiar pestaña consulta de inmediato y reinicia el cursor. La búsqueda en vivo anterior filtraba localmente el arreglo conforme se escribía, incluyendo nombre del solicitante del modelo antiguo. Esa búsqueda por solicitante no está ofrecida por el contrato confirmado y no se promete ahora. No se implementa debounce ni otro contrato de búsqueda. La diferencia de interacción es explícita y debe revisar Ricardo; no bloquea las lecturas por UUID.

### Consumidores y propuesta estructural separada

| Módulo o relación | Consumidores encontrados en `frontend/src` | Propuesta fuera de este ajuste |
|---|---|---|
| `BandejaTabFilter`, `ExpedienteTable`, `useBandejaExpedientes` | Página `pages/expedientes/BandejaExpedientesPage.tsx` | Extraer contratos de lectura fuera de `pages` en un cambio coordinado, actualizando imports y pruebas en conjunto |
| `useExpedienteTimeline` | `pages/expedientes/ExpedienteDetallePage.tsx` | Mismo traslado coordinado del contrato/servicio; conservar retorno real |
| `rutadoc.dto`, `rutadoc.service`, auxiliares de presentación | Componentes compartidos, hooks y módulos RutaDoc | Separar en una futura propuesta contratos/servicios y presentación compartida; hoy no se mueven archivos ni se elimina la dependencia components→pages |
| `pages/BandejaExpedientesPage.tsx` | Reexportación de la implementación que el router importa directamente desde `pages/expedientes/` | Mantener como compatibilidad; no se detectó otra implementación ni se justifica borrarla solo por no ser import directo del router |
| `ExpedienteTimeline.tsx` | Sin consumidor de producción encontrado; conserva pruebas del componente | Revisar reutilización visual con el DTO real antes de retirar el componente o sus pruebas |
| `CcdFoliadoConectado.tsx` | `dev/ccdConectado.tsx` | No es huérfano; consolidar aparte su cliente de foliación legado, que exige ID numérico, con el contrato UUID |
| `ExpedienteMetadatos`, `ExpedienteClasificacion`, `ExpedienteVersiones` | Sin consumidor de producción encontrado tras la adaptación; reutilizan utilidades existentes | Inventariar contratos y recorridos antes de proponer adaptación o retirada; no reactivar datos demostrativos para reutilizarlos |

### Resultados propios de este ajuste

Node `v24.20.0`, npm `11.19.0` y dependencias frontend ya disponibles; Node satisface `>=24.19.0 <25`. No se instalaron ni cambiaron dependencias.

Desde `frontend`:

```text
npm.cmd run typecheck
PASS, salida 0

npm.cmd test -- tests/integration/expedientes/rutadoc-g6-04.test.tsx tests/unit/pages/expedientes/rutadoc.adapters.test.ts src/utils/foliadoValidator.test.ts
PASS: 66 pruebas en 3 suites; 0 fallidas
```

La suite de página pasa de 35 a 41 casos: carga/error/ausencia de contadores, cero real y selección/foco, aplicación explícita de búsqueda, fecha civil frente a instante cercano a medianoche, acceso al identificador completo y nombre documental. Conserva los casos de aislamiento, errores y escrituras deshabilitadas. Las pruebas SLA ahora verifican fecha formateada y `dateTime` original, manteniendo invariancia del DTO y valores numéricos. La prueba local de MAX_SAFE_INTEGER permanece intacta.

El primer intento quedó bloqueado por acceso denegado de esbuild al cargar Vitest en el aislamiento. Se ejecutó con permiso fuera de ese entorno. La primera ejecución efectiva dio 64 PASS y 2 FAIL en pruebas nuevas: espera asíncrona de contadores y selección del `summary` en vez de su texto interior. Se corrigieron esas pruebas conservando sus comprobaciones; la siguiente ejecución completa de las tres suites dio los 66 PASS anteriores.

Estos resultados son independientes de los 122/12 históricos y los 461 reportados por Ricardo. No se repitió build ni integración real tras este ajuste. La prueba integrada anterior sigue siendo evidencia del recorrido de lecturas previo, no una certificación de la nueva presentación.

`git diff --check` terminó PASS tras el ajuste (solo avisos LF→CRLF). El SHA-256 de `foliadoValidator.test.ts` sigue siendo `F3A7E882A89CDC2D33FD81F72BA5EDBA02D67E6039E05B57E1033BEC6C4342D3`; el índice continúa sin cambios staged. No se modificaron backend, contratos, manifiestos, lockfiles ni migraciones.

**Revisión visual de escritorio/móvil, foco y contraste en navegador: PENDING.** Esta sesión no dispone de una herramienta de navegador interactivo ni de la sesión autenticada con API descartable del ensayo anterior; las pruebas DOM de foco y clases no sustituyen esa revisión. Ricardo debe confirmar selección, foco real con teclado, contraste, apertura/cierre de identificadores, fechas y desbordamiento móvil. No se declara aprobación visual ni ausencia de conflictos futuros. Sin commit ni push.

## 10. Revisión visual propia con navegador — 2026-10-18

Esta ejecución resuelve el pendiente de revisión visual local de la sección 9 mediante Edge headless controlado por Chrome DevTools Protocol. **Se utilizaron respuestas simuladas exclusivamente en un arnés temporal, no una API real.** Las páginas, componentes, hooks y CSS se importaron directamente del working tree; el adaptador simulado de Axios existió solo en la entrada del arnés. No se añadió fallback al producto, no se modificaron permisos y no se reutilizó autenticación ni datos de una API. La ausencia de contadores se revisó como estado aislado del componente: una respuesta API sin contadores sigue siendo inválida.

### Entorno, dimensiones y recorrido

- Navegador: Edge `155.0.4283.62`, motor Chromium headless, perfil temporal nuevo. Vite escuchó únicamente en `127.0.0.1`, sin cargar archivos `.env` (`envDir: false`) y sin proxy a backend. Los procesos del servidor y navegador de cada ejecución se detuvieron al terminar.
- Escritorio: viewport CSS **1440×1000**, escala 1.
- Móvil emulado: viewport CSS **390×844**, escala 1, emulación táctil. No equivale a un dispositivo físico ni a verificación de todos los navegadores.
- Recorrido en cada dimensión: bandeja normal con cero y otros contadores; Tab por controles; foco en pestaña; estados carga/error/ausencia; detalle con fechas civiles e instante UTC cercano al cambio de día; identificador cerrado y abierto. En móvil se comprobó desplazamiento horizontal con flecha de teclado y acceso a la última columna; el identificador se abrió con eventos táctiles reales de CDP. En escritorio se abrió con Enter.
- Las capturas incluyen el rótulo «REVISIÓN VISUAL · RESPUESTAS SIMULADAS · SIN API REAL». No representan el shell global de autenticación ni un recorrido integrado del router de producción: el arnés monta las páginas originales en MemoryRouter.

### Hallazgos corregidos dentro del alcance visual

1. Los campos de filtro no tenían límites visuales claros y las etiquetas de fecha quedaban pegadas al control. Se añadió cuadrícula adaptable (una/dos/tres columnas), separación etiqueta/campo, bordes, padding y foco visible de inputs/selects, sin cambiar consultas ni envío explícito.
2. La tabla comprimía columnas hasta superponer textos en móvil. Ahora tiene ancho mínimo, distribución fija, separación entre celdas, encabezados con `scope`, contenedor con desplazamiento horizontal y foco por teclado. El contenido de la última columna sigue accesible sin ampliar el ancho del documento.
3. Se reforzó la presentación y el foco de Aplicar filtros, Ver, navegación, regreso y reintento, manteniendo los estados deshabilitados existentes. Los archivos de producto modificados en esta fase son `BandejaExpedientesPage.tsx`, `ExpedienteTable.tsx`, `ExpedienteDetallePage.tsx` y `rutadoc/RutaDocEstado.tsx`; se añadieron comprobaciones a la suite de página ya existente.

### Resultado observado y evidencia

| Comprobación | Escritorio | Móvil | Evidencia o límite |
|---|---|---|---|
| Pestaña activa | PASS | PASS | Fondo azul, blanco, negrita, subrayado y `aria-selected`; estilos computados registrados |
| Teclado y foco | PASS | PASS con teclado emulado | Tab recorre controles; contorno visible de pestaña y región de tabla. No se sustituye por una prueba DOM |
| Contraste de texto de pestañas y controles habilitados | PASS en muestra medida | PASS en muestra medida | Relación mínima medida 8,82:1 en bandeja y 7,58:1 en detalle, sobre colores computados de elementos muestreados; botones deshabilitados excluidos. No es certificación WCAG exhaustiva |
| Contador cero/carga/ausencia/error | PASS | PASS | 0 real, «Cargando…», «Sin dato» aislado y «No disponible», respectivamente; ninguna cantidad inventada |
| Fechas civiles | PASS | PASS | `2026-10-01` se muestra `01/10/2026`, y límite `2026-11-29` se muestra `29/11/2026` |
| Instantes es-PE | PASS | PASS | `2026-10-01T02:30:00Z` se muestra `30/09/2026, 21:30` en Lima, conversión correcta del instante |
| Identificador completo | PASS con Enter | PASS con toque | Se despliega el UUID exacto, sin cambios de identidad |
| Filtros/tabla/detalle | PASS tras corrección | PASS tras corrección | Sin solapamiento observado en capturas finales. Tabla con desplazamiento horizontal intencional; se verificó acceso a Ver en última columna y documento sin overflow horizontal global |

Evidencia final: `visual-g6-04/revision-navegador.json`, con checks, estilos, ratios y dimensiones de **13 capturas PNG**. Capturas representativas:

- [Bandeja escritorio](visual-g6-04/desktop-bandeja.png).
- [Bandeja móvil](visual-g6-04/mobile-bandeja.png).
- [Última columna móvil accesible](visual-g6-04/mobile-tabla-ultima-columna.png).
- [Identificador abierto con teclado](visual-g6-04/desktop-identificador-abierto.png).
- [Detalle móvil](visual-g6-04/mobile-detalle.png).
- [Identificador abierto con toque](visual-g6-04/mobile-identificador-abierto.png).

Las otras capturas muestran carga, error, ausencia y detalle de escritorio. Se inspeccionaron visualmente las capturas representativas, además de las verificaciones DOM/geometría en el navegador. No hubo excepciones JavaScript en la ejecución final.

### Incidencias del arnés y límites

Antes del resultado final hubo intentos no válidos: ruta inicial incorrecta del plugin React; watcher de Vite sobre un archivo bloqueado del perfil de Edge; generación incompleta de utilidades Tailwind en la raíz temporal; espera insuficiente de compilación y evento Enter incompleto del controlador. Se corrigieron únicamente los scripts temporales del arnés. Las capturas iniciales sin CSS completo o sin servidor no se usan como evidencia del resultado final. El evento Enter completo confirmó funcionamiento nativo sin cambiar el componente.

Las pruebas de contraste registran texto y fondo computados; la revisión visual también comprobó límites y foco de controles, pero no constituye una auditoría formal de todos los estados, zoom, lectores de pantalla o combinaciones de colores. La pantalla móvil es emulada. Esta revisión no acredita autenticación, permisos ni integración API actuales; la evidencia integrada histórica conserva sus límites propios. La aceptación del equipo y la revisión de Ricardo sobre este nuevo diff siguen pendientes.

### Validación propia después de las correcciones visuales

Desde `frontend`, `npm.cmd run typecheck`: **PASS**, salida 0.

```text
npm.cmd test -- tests/integration/expedientes/rutadoc-g6-04.test.tsx tests/unit/pages/expedientes/rutadoc.adapters.test.ts src/utils/foliadoValidator.test.ts
PASS: 66 pruebas en 3 suites; 0 fallidas
```

La suite de página mantiene 41 casos y añade aserciones de contenedor de tabla enfocable, ancho mínimo/distribución y cuadrícula de filtros dentro de un caso existente. La prueba previa de MAX_SAFE_INTEGER sigue intacta. Esta ejecución de 66 no se suma a la ejecución anterior de 66, a los 122 históricos ni a los 461 reportados por Ricardo. No se ejecutaron build ni integración API de nuevo.

`git diff --check`: PASS después de las correcciones; únicamente avisos LF→CRLF. El hash de la prueba local sigue coincidiendo con el registrado en la sección 5 y el índice permanece sin cambios staged.

### Paquete de revisión v3

`Revision_G6-04_Ricardo_v3.zip` se prepara fuera del repositorio con el diff completo contra HEAD (incluidos archivos nuevos mediante patches de creación y capturas binarias), copias actuales de los archivos modificados/nuevos de G6-04, informe, módulos, suites, evidencia y manifiesto SHA-256. Las rutas internas usan `/`; el manifiesto cubre todos los archivos salvo el propio manifiesto. Se comprueba por extracción en una carpeta temporal nueva y comparación de bytes/hashes. No incluye `.env`, dependencias, secretos ni reconstrucciones de Ricardo. No se hace staged, commit ni push.

## 11. Entrega de todo el avance útil a B_JHASY — 2026-10-19

### Autorización y coordinación

El usuario comunica autorización de Geric para preparar el índice, crear el commit del avance y ejecutar únicamente `git push origin B_JHASY:B_JHASY`, aunque existan funcionalidades incompletas. No se autoriza ni se realiza integración adicional de ramas ni force push. Las referencias históricas de este documento a «sin commit/push» describen aquellas fases; no bloquean esta entrega autorizada.

Se registra la **conformidad M03 de Ricardo comunicada por el usuario al solicitar esta entrega**. La coordinación previa de B_AREVALO informó ausencia de solapamiento en los seis archivos compartidos. Los resultados técnicos de Ricardo sobre originales del ZIP v2 (typecheck, build y 461 pruebas) pertenecen a su worktree y a ese corte; no se presentan como una nueva ejecución propia ni como pruebas adicionales de v3. La conformidad comunicada no habilita escrituras ni implica terminación de TUPA, CCD, versiones o permisos.

### Estado comprobado antes de preparar el índice

- Raíz: `C:/Users/Jhass/Desktop/SIGD-B_JHASY`; rama: `B_JHASY`; HEAD inicial de entrega: `4e06e512fe08d01712bc0b6feb33e95ca28c1b10`.
- Inventario: **38 archivos útiles: 7 modificados y 31 nuevos**, con 0 staged al iniciar esta entrega. Incluye 17 archivos frontend y 21 de documentación/evidencia. El inventario nominal se detalla debajo.
- `git fetch origin` terminó correctamente después de conceder acceso a los metadatos compartidos del worktree. `origin/B_JHASY` quedó en `6b6f18619a763b73dfe6f6afde51db5cef4d60bb`; `HEAD...origin/B_JHASY` dio **4 locales / 0 remotos**. No había commits remotos ausentes en la local. El push recibirá los cuatro commits de base ya autorizados más el commit propio, sin modificar otras ramas.
- **`frontend/src/utils/expedientePresentacion.ts` está versionado y presente en HEAD local**, confirmado con `git ls-files --error-unmatch` y `git show HEAD:...`; no tiene diferencias locales. Se reutiliza `fechaExpediente` para instantes. No necesita copiarse desde Ricardo ni añadirse como archivo nuevo. El cálculo local `plazoExpediente` no se usa como sustituto del SLA conectado.
- El lockfile de Geric ya pertenece a HEAD, sin diff propio. No se atribuye su corrección a Jhasy.

### Revisión y evidencia reutilizada

Se compararon por contenido los **38 archivos locales** con los originales incluidos en el ZIP v3 verificado: coincidieron todos antes de esta actualización exclusivamente documental. Por tanto, no hay código ni pruebas posteriores sin validar y no se repiten suites para retrasar la entrega. El informe actual es la única diferencia intencionada respecto de aquel paquete.

| Evidencia | Alcance y resultado conservado |
|---|---|
| Última ejecución propia de frontend, posterior a correcciones visuales | 66 PASS en 3 suites; typecheck PASS. Incluye página (41 casos), adaptadores y prueba local de foliación |
| Validación propia anterior al ajuste visual | 122 PASS en 12 suites, corte histórico distinto; no se suma con 66 ni con ejecuciones previas |
| Prueba integrada anterior | Lecturas con backend actualizado, PostgreSQL 18 nuevo y descartable, autenticación real, dos UUID, cursores, detalle, trazabilidad, folios, SLA y errores; límites en sección 7. No se repitió tras los ajustes visuales |
| Revisión visual posterior propia | Edge en 1440×1000 y móvil emulado 390×844; 33 comprobaciones registradas aprobadas y 13 capturas. Respuestas simuladas solo en arnés temporal; no equivale a integración real |
| Ricardo | Typecheck, build y 461 pruebas reportadas en su worktree sobre v2; conformidad M03 comunicada por el usuario, sin inventar una ejecución nueva sobre v3 |

La prueba local conserva SHA-256 `F3A7E882A89CDC2D33FD81F72BA5EDBA02D67E6039E05B57E1033BEC6C4342D3`. Se ejecuta `git diff --check` para este corte y se exige también `git diff --cached --check` antes del commit. El resultado y SHA final de la subida se comunicarán al verificar el remoto; no se inserta un SHA propio anticipado en este documento.

Se revisó el conjunto de archivos: no se incluyen `.env`, claves privadas, credenciales guardadas, dependencias, builds, perfiles de navegador, cachés ni temporales ajenos. Las capturas conservan datos sintéticos y rótulo de simulación. Los JSON de integración no contienen contraseñas/tokens. El verificador Python genera secretos en memoria; su expresión que construye el DSN no es una credencial literal. Se incluye por reproducibilidad del ensayo descartable, sin ejecutarlo en esta entrega.

Quedan fuera, sin borrarlos: `node_modules`, archivos sensibles y generados ignorados, perfiles/arneses temporales de revisión y ZIP de intercambio del Escritorio. No hay un archivo útil pendiente excluido dentro del inventario local revisado. Los archivos sensibles no se abren para elaborar este inventario; no se incluye su contenido ni se hace copia.

### Avance entregado, pendientes y próximos pasos

Se entrega bandeja backend con pestañas, filtros, contadores y cursor opaco; detalle por endpoint propio UUID; trazabilidad separando identidad y secuencias precisas; rangos reales de foliación; SLA backend sin recálculo; estados de consulta, errores RFC 7807 y aislamiento entre expedientes; además de accesibilidad y ajustes visuales v3. No se restauran KPIs ni catálogos ficticios.

Derivar, Observar y Acumular siguen visibles/deshabilitados: faltan contratos de escritura/datos autorizados/permisos compatibles descritos en sección 4. CCD y versiones indican consulta no disponible; no se infiere ausencia de datos. TUPA y calendario institucional definitivo permanecen pendientes. No se presenta G6-04 como cierre funcional total.

Próximos pasos: Cari y Geric confirman destinos UUID, payloads, autorización y semántica de acciones; después Jhasy conecta escrituras con pruebas revisadas. Cari/DocuCore y Geric confirman las lecturas CCD/versiones y vínculo TUPA; Ricardo coordina presentación; Pool revisa entorno y despliegue. La reorganización de imports components→pages y consolidación del cliente legado de foliación queda como cambio separado, sin mover ni eliminar archivos ahora. No se requiere resolver CUT→UUID para las lecturas que ya reciben un UUID válido.

Para integrar el avance frontend, revisar conjuntamente los seis archivos compartidos, los ocho módulos RutaDoc, las dos suites nuevas y la prueba previa de foliación; el formateador compartido ya está en la base. Acompañan informe, historial, verificador y evidencia. La subida a B_JHASY no integra automáticamente otras ramas ni certifica producción.


### Inventario nominal de los 38 archivos de entrega

| Archivo | Estado inicial | Función |
|---|---|---|
| `docs/cambios_prototipo/JHASY/CP-JHASY-G6-04-frontend-antes-ff.md` | nuevo | Documentación/evidencia |
| `docs/cambios_prototipo/JHASY/CP-JHASY-G6-04-frontend.md` | nuevo | Documentación/evidencia |
| `docs/cambios_prototipo/JHASY/CP-JHASY-G6-04-integracion-g604-ffcd95330c2f.json` | nuevo | Documentación/evidencia |
| `docs/cambios_prototipo/JHASY/CP-JHASY-G6-04-integracion.json` | nuevo | Documentación/evidencia |
| `docs/cambios_prototipo/JHASY/CP-JHASY-G6-04-preservacion.json` | nuevo | Documentación/evidencia |
| `docs/cambios_prototipo/JHASY/CP-JHASY-G6-04-validacion-post-ff.json` | nuevo | Documentación/evidencia |
| `docs/cambios_prototipo/JHASY/verificar_integracion_g604.py` | nuevo | Verificador reproducible |
| `docs/cambios_prototipo/JHASY/visual-g6-04/desktop-absent.png` | nuevo | Captura visual simulada |
| `docs/cambios_prototipo/JHASY/visual-g6-04/desktop-bandeja.png` | nuevo | Captura visual simulada |
| `docs/cambios_prototipo/JHASY/visual-g6-04/desktop-detalle.png` | nuevo | Captura visual simulada |
| `docs/cambios_prototipo/JHASY/visual-g6-04/desktop-error.png` | nuevo | Captura visual simulada |
| `docs/cambios_prototipo/JHASY/visual-g6-04/desktop-identificador-abierto.png` | nuevo | Captura visual simulada |
| `docs/cambios_prototipo/JHASY/visual-g6-04/desktop-loading.png` | nuevo | Captura visual simulada |
| `docs/cambios_prototipo/JHASY/visual-g6-04/mobile-absent.png` | nuevo | Captura visual simulada |
| `docs/cambios_prototipo/JHASY/visual-g6-04/mobile-bandeja.png` | nuevo | Captura visual simulada |
| `docs/cambios_prototipo/JHASY/visual-g6-04/mobile-detalle.png` | nuevo | Captura visual simulada |
| `docs/cambios_prototipo/JHASY/visual-g6-04/mobile-error.png` | nuevo | Captura visual simulada |
| `docs/cambios_prototipo/JHASY/visual-g6-04/mobile-identificador-abierto.png` | nuevo | Captura visual simulada |
| `docs/cambios_prototipo/JHASY/visual-g6-04/mobile-loading.png` | nuevo | Captura visual simulada |
| `docs/cambios_prototipo/JHASY/visual-g6-04/mobile-tabla-ultima-columna.png` | nuevo | Captura visual simulada |
| `docs/cambios_prototipo/JHASY/visual-g6-04/revision-navegador.json` | nuevo | Documentación/evidencia |
| `frontend/src/components/expedientes/BandejaTabFilter.tsx` | M | Implementación frontend |
| `frontend/src/components/expedientes/ExpedienteTable.tsx` | M | Implementación frontend |
| `frontend/src/hooks/useBandejaExpedientes.ts` | M | Implementación frontend |
| `frontend/src/hooks/useExpedienteTimeline.ts` | M | Implementación frontend |
| `frontend/src/pages/expedientes/BandejaExpedientesPage.tsx` | M | Implementación frontend |
| `frontend/src/pages/expedientes/ExpedienteDetallePage.tsx` | M | Implementación frontend |
| `frontend/src/pages/expedientes/rutadoc/RutaDocEstado.tsx` | nuevo | Implementación frontend |
| `frontend/src/pages/expedientes/rutadoc/RutaDocFoliacion.tsx` | nuevo | Implementación frontend |
| `frontend/src/pages/expedientes/rutadoc/RutaDocSla.tsx` | nuevo | Implementación frontend |
| `frontend/src/pages/expedientes/rutadoc/RutaDocTimeline.tsx` | nuevo | Implementación frontend |
| `frontend/src/pages/expedientes/rutadoc/rutadoc.adapters.ts` | nuevo | Implementación frontend |
| `frontend/src/pages/expedientes/rutadoc/rutadoc.dto.ts` | nuevo | Implementación frontend |
| `frontend/src/pages/expedientes/rutadoc/rutadoc.service.ts` | nuevo | Implementación frontend |
| `frontend/src/pages/expedientes/rutadoc/useRutaDocDetalle.ts` | nuevo | Implementación frontend |
| `frontend/src/utils/foliadoValidator.test.ts` | M | Pruebas |
| `frontend/tests/integration/expedientes/rutadoc-g6-04.test.tsx` | nuevo | Pruebas |
| `frontend/tests/unit/pages/expedientes/rutadoc.adapters.test.ts` | nuevo | Pruebas |
