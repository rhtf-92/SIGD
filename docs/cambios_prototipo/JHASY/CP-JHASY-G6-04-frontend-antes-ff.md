# CP-JHASY-G6-04 — Entrega frontend para revisión

**Estado de entrega:** Frontend G6-04 listo para revisión; integración y recuperación funcional de acciones pendientes.

**Fecha del informe:** 2026-10-16.

Este informe registra la implementación y las validaciones locales ya realizadas. Su elaboración no ejecutó nuevas pruebas ni modificó código frontend. Las respuestas simuladas se utilizaron exclusivamente en pruebas; no constituyen validación integrada contra una API real.

## 1. Rama, referencia y estado Git

| Elemento | Valor |
|---|---|
| Carpeta de trabajo | `C:\Users\Jhass\Desktop\SIGD-B_JHASY` |
| Rama requerida y actual | `B_JHASY` |
| HEAD actual | `6b6f18619a763b73dfe6f6afde51db5cef4d60bb` |
| Referencia técnica de Geric | `4e06e512fe08d01712bc0b6feb33e95ca28c1b10` |
| Índice | Sin cambios staged |
| Working tree | Dirty; contiene la implementación local que debe conservarse |

Al iniciar G6-04 existía la modificación local de `frontend/src/utils/foliadoValidator.test.ts`. Se conservó durante toda la implementación y validación.

Antes de crear este informe había ocho archivos seguidos modificados y diez archivos nuevos sin seguimiento. Con este informe, el estado esperado es ocho modificados, once nuevos sin seguimiento y cero staged. Los ocho modificados comprenden seis archivos de implementación, la prueba local previa y el lockfile tomado de Geric. Los once nuevos comprenden ocho archivos de soporte frontend, dos suites y este informe.

No se incorporaron los commits de Geric. No hubo `git add`, merge, rebase, cherry-pick, commit ni push. No se modificaron backend, migraciones, infraestructura ni archivos de la carpeta original `C:\Users\Jhass\Desktop\SIGD`.

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
| API y datos compatibles | No se ejecutó el recorrido integrado contra backend UUID y datos de prueba autorizados | Cari: API; Pool: entorno aislado; Jhasy: pruebas de consumo | BLOCKED para certificar integración |
| Revisión e incorporación | Falta revisión del equipo y autorización específica para incorporar la base técnica y la entrega | Geric: decisión e integración; Ricardo: revisión de pantallas/componentes compartidos | PENDING |

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

La corrección del lockfile pertenece a Geric. Debe distinguirse del diff propio de G6-04 para no duplicarla ni atribuirla a Jhasy al integrar.

## 6. Evidencia de validación: ejecuciones independientes

Todos los comandos npm se ejecutaron desde `frontend`. Las suites usan respuestas simuladas, no una API real. Las ejecuciones siguientes se superponen y no deben sumarse como un total de pruebas distintas.

| Ejecución | Comando o alcance | Resultado final registrado |
|---|---|---|
| Validación inicial de G6-04 | Suites nuevas y relacionadas: adaptadores, página, componentes, hooks, API y `foliadoValidator.test.ts` | 119 pruebas aprobadas en 12 suites |
| Aviso de calendario SLA, posterior | `npm.cmd test -- tests/integration/expedientes/rutadoc-g6-04.test.tsx -t "advierte el calendario provisional"` | 1 prueba adicional aprobada; 32 excluidas por filtro |
| Revisión de capacidades retiradas | Página G6-04 y pruebas de modales, hook, API, utilidades de acciones y `foliadoValidator.test.ts` | 89 pruebas aprobadas en 6 suites; ejecución independiente |
| Última validación de visibilidad recuperada | `npm.cmd test -- tests/integration/expedientes/rutadoc-g6-04.test.tsx` | 35 pruebas aprobadas en la suite afectada |
| Último typecheck | `npm.cmd run typecheck` | PASS |
| Última revisión de whitespace | `git diff --check`, complementado con revisión del archivo de pruebas nuevo | PASS |

**No hubo una ejecución conjunta de 120 pruebas.** La última ejecución relevante es la de 35 pruebas de la página; no se repitieron suites ajenas al ajuste de visibilidad.

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

## 7. Diferencias con Geric y plan de incorporación

La comparación ya realizada identificó 40 archivos diferentes entre HEAD y el commit técnico. La implementación propia de G6-04 y la prueba local no se superponen textualmente con los archivos que modifica Geric. Los archivos nuevos no colisionan con rutas del objetivo. La única superposición local es `frontend/package-lock.json`, cuyo contenido ya coincide con Geric, aunque continúa modificado respecto del índice de HEAD.

La comprobación previa de Git en modo dry-run rechazó la actualización directa por `frontend/package-lock.json not uptodate`. No se descartó el archivo ni se preparó el índice. Este informe no repite el diagnóstico de ancestría ni autoriza incorporar commits.

Plan pendiente, sin ejecutar:

1. Geric revisa este informe, el diff propio y la procedencia del lockfile; Ricardo revisa las pantallas y componentes compartidos.
2. Cari confirma API UUID, permisos y semántica de escritura antes de recuperar acciones funcionales; confirma por separado los contratos de contexto TUPA, CCD y versiones.
3. Pool facilita un entorno aislado compatible y datos autorizados para validación integrada. Jhasy no ejecuta migraciones ni usa `sigd_demo` para ensayos.
4. Con autorización específica de Geric, se acuerda la preparación mínima del índice y el procedimiento de incorporación que preserve todos los cambios locales y la base técnica.
5. Se prueba contra la API compatible con dos expedientes UUID y se registra evidencia integrada por separado de las pruebas frontend.
6. Las escrituras solo se habilitan mediante una ampliación revisada de alcance, con datos reales, autorización confirmada y pruebas desde la página. No se reactivan los handlers incompatibles ni datos de demostración.

## 8. Resultado de entrega

| Área | Resultado |
|---|---|
| Lecturas frontend y aislamiento entre UUID | PASS local |
| Visibilidad de las cinco capacidades | PASS local |
| Acciones de escritura | BLOCKED; visibles y deshabilitadas |
| Consulta de clasificación CCD y versiones | PENDING; indisponibilidad visible, sin inferir ausencia de datos |
| Contexto TUPA y calendario definitivo | PENDING de contratos/aprobación |
| Prueba contra API compatible | PENDING; no se declara validación integrada |
| Revisión del equipo e incorporación | PENDING |

Se entrega la implementación frontend, sus pruebas y este informe para revisión. No se declara terminada la integración ni recuperadas funcionalmente las acciones.

**Frontend G6-04 listo para revisión; integración y recuperación funcional de acciones pendientes.**
