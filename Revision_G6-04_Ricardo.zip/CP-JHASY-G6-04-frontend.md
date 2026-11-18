# CP-JHASY-G6-04 — Entrega frontend para revisión

**Estado de entrega:** Frontend G6-04 listo para revisión; lecturas verificadas contra API real en entorno descartable. Recuperación funcional de acciones y revisión del equipo pendientes.

**Fecha del informe:** 2026-10-16.

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
