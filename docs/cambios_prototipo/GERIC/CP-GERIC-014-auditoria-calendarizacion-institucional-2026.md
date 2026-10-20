# CP-GERIC-014 — Auditoría de Calendarización Institucional 2026

## 1. Alcance y referencia

- Rama revisada: `B_GERIC`.
- Commit de referencia: `4e06e512fe08d01712bc0b6feb33e95ca28c1b10`.
- Fuente externa revisada: `C:\Users\Geric\Downloads\calendarizaci_n_institucional_2026.md`.
- Sección fuente: `7.2 De la Calendarización Institucional`, líneas 1–27.
- Contenido fuente: 23 actividades fechadas del año 2026.
- Método: inspección estática. No se ejecutaron migraciones, bases de datos ni pruebas.

La fuente externa no está versionada en el repositorio auditado. Por ello, este
documento conserva su contenido literal como evidencia de análisis, pero no la
convierte por sí sola en una configuración operativa ni en una regla de cómputo
de plazos.

## 2. Veredicto ejecutivo

**SOPORTE PARCIAL — REQUIERE ACOPLAMIENTO.**

El SIGD sí contiene una tabla, servicio, endpoints y funciones para administrar
días laborables/no laborables y calcular SLA. Sin embargo:

1. no existe un modelo persistente de **actividades de calendarización
   institucional** con fecha inicial, fecha final y responsables;
2. las 23 actividades de la fuente no están cargadas ni referenciadas por el
   código;
3. el calendario SLA tiene varias fuentes divergentes (BD, constantes de
   backend y constantes de frontend);
4. RutaDoc calcula el SLA desde `fecha_radicacion`, no desde
   `fecha_radicacion_legal`;
5. el frontend y el endpoint de calendario tienen contratos incompatibles en
   lectura y escritura.

## 3. Respuestas explícitas

| Pregunta | Respuesta verificada | Evidencia |
|---|---|---|
| ¿Existe calendarización institucional? | **No** como agenda académica de actividades. Solo existe un calendario laboral de excepciones por fecha. | `backend/migraciones/03_sigd_org.sql`, líneas 246–277; búsqueda sin coincidencias de actividades fuente. |
| ¿Existe calendario de días hábiles para SLA? | **Sí, parcialmente.** Hay tabla, motor de cálculo, servicios y endpoints. No existe una única fuente conectada a todos los consumidores. | `calendario.service.ts`, líneas 139–357 y 744–959; `sla.service.ts`, líneas 18–105. |
| ¿Está persistido o hardcodeado? | **Ambos.** La BD persiste excepciones; RutaDoc y el frontend conservan listas en código. | Migración 03, líneas 248–277; `sla.calendario.ts`, líneas 15–18; `useCalendarioLaboral.ts`, líneas 40–58. |
| ¿Qué feriados contempla la BD? | El DDL versionado siembra solamente 24/06/2026 y 13/10/2026 como regionales de Ucayali. | Migración 03, líneas 271–277. |
| ¿Consume fuente institucional? | No se encontró carga, hash, parser ni referencia a la fuente de 23 actividades. | Búsqueda estática de nombres y fechas literales: sin coincidencias. |
| ¿La Calendarización 2026 está cargada? | **No.** | No existe tabla de actividades ni coincidencias con “Semana Técnica”, “Sistema Conecta” o el rango 03/03–31/03. |
| ¿Qué falta? | Modelo aditivo de actividades, procedencia/versionado, API de consulta, lectura frontend, decisión explícita sobre días inhábiles y centralización del calendario SLA. | Secciones 10–12 de este documento. |

## 4. Implementación actual inventariada

| Archivo | Función/tabla/endpoint | Comportamiento observado |
|---|---|---|
| `backend/migraciones/03_sigd_org.sql` | `sigd_org.calendario_laboral` | Persiste una excepción por fecha y unidad territorial; incluye PK UUID, unicidad `(fecha, unidad_territorial)`, estado activo, tipo, base legal y bandera laborable. Líneas 246–277. |
| `backend/src/domains/organicore/calendario.service.ts` | `esDiaLaborable`, `contarDiasHabiles`, `sumarDiasHabiles` | Excluye sábado, domingo y excepciones no laborables; admite habilitaciones excepcionales. Líneas 139–357. |
| Mismo archivo | `CalendarioService` | Consulta BD, usa caché de 24 horas, registra excepciones con auditoría/Outbox y calcula semáforo de 30 días. Líneas 538–959. |
| `backend/src/domains/organicore/adminMaestras.routes.ts` | `GET /api/v1/admin/calendario-laboral` | Lista el calendario agrupado. Líneas 37–46; montaje en `backend/src/app.ts`, líneas 218–225. |
| Mismo archivo | `POST /api/v1/admin/calendario-laboral/feriado-excepcional` | Registra una excepción. Está montado sin autorización específica; el propio archivo declara ese control pendiente. Líneas 17–23 y 44–46. |
| `backend/src/domains/rutadoc/sla.service.ts` | `calcularSla` | Cuenta 30 días hábiles; el día inicial no consume plazo. El día 30 todavía no es vencido; `ROJO` comienza después de 30. Líneas 18–62. |
| Mismo archivo | `RepositorioSlaRutaDoc.obtenerFechaInicio` | Obtiene la fecha desde `sigd_tra.expediente.fecha_radicacion`, no desde `fecha_radicacion_legal`. Líneas 74–82. |
| `backend/src/domains/rutadoc/sla.calendario.ts` | calendario predeterminado | Fuente en memoria con recurrencias 24/06 y 13/10; no lee la tabla salvo que se inyecte otro puerto. Líneas 15–18 y 66–67. |
| `backend/src/domains/rutadoc/rutadoc.router.ts` | `GET /api/v1/expedientes/:id/sla-status` | Por defecto inyecta el calendario en memoria de RutaDoc. Líneas 38–51. |
| `backend/src/domains/tramicore/horarioCorte.util.ts` | `calcularHorarioCorte` | Usa America/Lima, apertura 08:00, corte 16:30, fines de semana y feriados. Líneas 15–20 y 155–181. |
| `backend/src/domains/tramicore/radicacionVirtual.service.ts` | `crearProveedorFeriados` | Lee `sigd_org.calendario_laboral`; ante cualquier error devuelve una lista vacía. Líneas 270–290. |
| `backend/baselines/BASELINE_2026_V1.sql` | `fn_mgd_dias_habiles_entre` y vista MGD | Los reportes usan la tabla si existe; si no, solo excluyen fines de semana. Líneas 637–706. |
| `frontend/src/hooks/useCalendarioLaboral.ts` | hook de administración | Arranca con 16 feriados hardcodeados; intenta consultar y registrar por API. Líneas 40–103 y 114–162. |
| `frontend/src/pages/administracion/CalendarioLaboralPage.tsx` | pantalla activa | Gestiona jornada, corte y feriados; ruta `/administracion/calendario-laboral`. `AdminRoutes.tsx`, líneas 32–35. |
| `frontend/src/pages/admin/CalendarioLaboralPage.tsx` | pantalla aislada | Mantiene dos fechas locales y afirma recalcular SLA, pero no es la pantalla importada por `AdminRoutes`. Líneas 13–27. |
| `frontend/src/utils/slaCalculator.ts` | SLA visual | Usa 16 feriados recurrentes hardcodeados más excepciones opcionales. Líneas 23–77. |
| `frontend/src/utils/diasHabiles.ts` | permanencia por etapa | Usa otro conjunto hardcodeado de 10 feriados. Líneas 7–36. |

## 5. Dos conceptos que no deben mezclarse

### 5.1 Calendarización institucional

Representa actividades y ventanas académicas: matrícula, traslados,
sustentaciones, cierre de semestre, notas, actas y otras tareas. Necesita como
mínimo actividad, intervalo, responsables, fuente y versión. Una actividad no
es automáticamente un día inhábil.

### 5.2 Calendario SLA

Representa días que sí alteran el cómputo: sábados, domingos, feriados y días
institucionalmente inhábiles o habilitados por una disposición explícita. Su
fuente actual es `sigd_org.calendario_laboral` más implementaciones en memoria.

**Regla de acoplamiento:** ninguna de las 23 actividades debe insertarse
automáticamente como feriado. Solo una decisión institucional explícita, con
base legal o acto equivalente, justificaría registrar fechas como
`INSTITUCIONAL` en el calendario SLA.

## 6. Matriz literal de las 23 actividades

| N° | Actividad | FechaInicio | FechaFin | Responsables | Posible impacto SIGD | Impacto SLA | Requiere decisión |
|---:|---|---|---|---|---|---|---|
| 1 | Reincorporación, Traslados Internos y Externos | 03/03/2026 | 31/03/2026 | Dirección General; Secretaría Académica; Coordinadores | Ventana informativa o validación de recepción para TUPA | NINGUNO | Sí: definir si la ventana bloquea solicitudes fuera de fecha o solo informa |
| 2 | Matrícula del III - V ciclo | 16/03/2026 | 30/04/2026 | Dirección General; Unidad Administrativa; Unidad Académica; Coordinadores; estudiantes | Agenda/avisos de matrícula | NINGUNO | No para SLA; sí para alcance funcional de agenda |
| 3 | Matrícula del I ciclo (ingresantes) | 06/04/2026 | 30/04/2026 | Dirección General; Unidad Académica; Coordinadores; estudiantes | Agenda/avisos de matrícula | NINGUNO | No para SLA |
| 4 | Matrícula Extemporánea 2026-I con 10% de recargo | 04/05/2026 | 29/05/2026 | Dirección General; Unidad Administrativa; Unidad Académica; Coordinadores; estudiantes | Ventana y recargo informativos; no convertir en tarifa TUPA | NINGUNO | Sí: propietario de la regla de recargo |
| 5 | Inicio de Clases Semestre Académico 2026-I (I-III-V) | 06/04/2026 | 06/04/2026 | Dirección General; Unidad Académica; Coordinadores; estudiantes | Hito académico | NINGUNO | No |
| 6 | Entrega de Registros de Matrícula 2026-I (físico y virtual) | 15/05/2026 | 15/05/2026 | Secretaría Académica; Coordinadores; administrativos; estudiantes | Tarea/recordatorio documental | NINGUNO | Sí: determinar si se modela como evento o tarea |
| 7 | Evaluación Extraordinaria 2026-I | 06/04/2026 | 05/08/2026 | Coordinadores; docentes; estudiantes | Ventana académica | NINGUNO | No para SLA |
| 8 | Término del Semestre Académico 2026-I (I-III-V) | 07/08/2026 | 07/08/2026 | Dirección General; Unidad Académica; Coordinadores; estudiantes | Hito académico | NINGUNO | No |
| 9 | Sustentación de Trabajo de Aplicación Profesional y/o Examen de Suficiencia Profesional | 10/08/2026 | 31/08/2026 | Dirección General; Unidades Administrativa y Académica; Secretaría Académica; Coordinadores; estudiantes | Contexto informativo para titulación | NINGUNO | Sí: no equiparar automáticamente a expediente de titulación |
| 10 | Ingreso de notas finales en el Sistema Registra - MINEDU 2026-I | 10/08/2026 | 12/08/2026 | Secretaría Académica; Coordinadores; docentes | Tarea interna/integración futura | NINGUNO | Sí: fuera del alcance documentario actual |
| 11 | Entrega de Actas de Evaluación 2026-I | 14/08/2026 | 14/08/2026 | Secretaría Académica; Coordinadores; administrativos; estudiantes | Tarea documental interna | NINGUNO | Sí: evento o flujo documental |
| 12 | Matrícula Semestre Académico 2026-II | 17/08/2026 | 11/09/2026 | Dirección General; Unidades Administrativa y Académica; Coordinadores; estudiantes | Agenda/avisos de matrícula | NINGUNO | No para SLA |
| 13 | Matrícula Extemporánea 2026-II con 10% de recargo | 14/09/2026 | 09/10/2026 | Dirección General; Unidades Administrativa y Académica; Coordinadores; estudiantes | Ventana y recargo informativos | NINGUNO | Sí: propietario de la regla de recargo |
| 14 | Inicio de Clases Semestre Académico 2026-II (II-IV-VI) | 17/08/2026 | 17/08/2026 | Dirección General; Unidad Académica; Coordinadores; estudiantes | Hito académico | NINGUNO | No |
| 15 | Entrega de Registros de Matrícula 2026-II (físico y virtual) | 30/09/2026 | 30/09/2026 | Secretaría Académica; Coordinadores; administrativos; estudiantes | Tarea/recordatorio documental | NINGUNO | Sí: evento o tarea |
| 16 | Semana Técnica | 16/09/2026 | 18/09/2026 | Dirección General; Unidades Administrativa y Académica; Coordinadores | Agenda institucional | REQUIERE_DECISION | Sí: la fuente no declara suspensión de atención ni día inhábil |
| 17 | Evaluación Extraordinaria 2026-II | 17/08/2026 | 11/12/2026 | Coordinadores; docentes; estudiantes | Ventana académica | NINGUNO | No para SLA |
| 18 | Término del Semestre Académico 2026-II | 18/12/2026 | 18/12/2026 | Dirección General; Unidad Académica; Coordinadores; estudiantes | Hito académico | NINGUNO | No |
| 19 | Sustentación de Trabajo de Aplicación Profesional y/o Examen de Suficiencia Profesional | 18/12/2026 | 31/12/2026 | Dirección General; Unidades Administrativa y Académica; Secretaría Académica; Coordinadores; estudiantes | Contexto informativo para titulación | NINGUNO | Sí: no equiparar automáticamente a expediente de titulación |
| 20 | Ingreso de notas finales en el Sistema Registra - MINEDU 2026-II | 21/12/2026 | 22/12/2026 | Secretaría Académica; Coordinadores; docentes | Tarea interna/integración futura | NINGUNO | Sí: fuera del alcance documentario actual |
| 21 | Entrega de Actas de Evaluación 2026-II | 28/12/2026 | 28/12/2026 | Secretaría Académica; Coordinadores; administrativos; estudiantes | Tarea documental interna | NINGUNO | Sí: evento o flujo documental |
| 22 | Clausura del Año Académico 2026 | 28/12/2026 | 28/12/2026 | Dirección General; Unidades Administrativa y Académica | Agenda institucional | REQUIERE_DECISION | Sí: la fuente no declara cierre administrativo ni día inhábil |
| 23 | Registro de Egresados en el Sistema Conecta - MINEDU | 28/12/2026 | 30/12/2026 | Unidad de Bienestar y Empleabilidad; Coordinadores | Tarea interna/integración futura | NINGUNO | Sí: fuera del alcance documentario actual |

Resultado SLA: 21 actividades tienen impacto `NINGUNO` según la evidencia
disponible y 2 requieren decisión. Ninguna tiene impacto `CONFIRMADO`.

## 7. Cruce con el catálogo TUPA del prototipo

| Tema | Entrada TUPA | Relación con calendarización | Uso seguro propuesto |
|---|---|---|---|
| Traslado interno | `p5-fila-20`, aprobada para prototipo | Actividad 1 fija 03/03–31/03 | Mostrar ventana como información; bloquear fuera de fecha solo tras decisión funcional explícita. |
| Traslado externo | `p5-fila-21`, aprobada para prototipo | Actividad 1 fija 03/03–31/03 | Igual que traslado interno. |
| Reincorporación | `p5-fila-05`, pendiente/excluida | Actividad 1 la incluye | No reintroducirla al selector solo por aparecer en la calendarización. |
| Reserva de matrícula | `p5-fila-18`, aprobada | Actividades 2, 3, 4, 12 y 13 hablan de matrícula, no de reserva | Relación posible, no equivalencia contractual. Requiere regla específica. |
| Licencia de estudios | `p5-fila-19`, aprobada | No hay actividad literal de licencia | Sin ventana derivable de esta fuente. |
| Titulación | `p4-fila-05` y `p6-fila-04`, aprobadas | Actividades 9 y 19 son sustentaciones/examen | Mostrar como contexto; no usar esas fechas como plazo de expedición o de radicación. |
| Certificados/constancias | Varias entradas aprobadas (`p1-fila-05/06`, `p4-fila-02/06/07`, `p5-fila-06/07`) | No hay ventana explícita de emisión | No aplicar restricción temporal. |

Evidencia TUPA: `backend/src/tools/tupa/staging/tupa-suiza-2026.staging.json`,
líneas aproximadas 39–50, 214–252, 348–365 y 439–491.

## 8. Auditoría específica del SLA

### 8.1 Fecha de inicio

RutaDoc usa `(fecha_radicacion AT TIME ZONE 'America/Lima')::date`, no
`fecha_radicacion_legal` (`backend/src/domains/rutadoc/sla.service.ts`, líneas
74–82). TramiCore sí calcula `fecha_radicacion_legal` considerando 16:30,
fines de semana y feriados (`horarioCorte.util.ts`, líneas 155–181) y trata de
persistirla (`radicacionVirtual.service.ts`, líneas 166–179).

Además, la migración versionada de expediente solo define
`fecha_radicacion` y `fecha_limite` (`backend/migraciones/05_sigd_tra.sql`,
líneas 90–106). No se encontró en las migraciones auditadas la columna
`fecha_radicacion_legal`. Esto es una contradicción estática pendiente de
resolver antes de afirmar que el SLA jurídico comienza desde la fecha legal.

### 8.2 Fines de semana y feriados

- Todos los motores inspeccionados excluyen sábado y domingo.
- La BD siembra solo 24/06/2026 y 13/10/2026.
- RutaDoc usa esas dos fechas como recurrencias anuales en memoria.
- `slaCalculator.ts` usa 16 recurrencias nacionales/regionales.
- `diasHabiles.ts` usa otra lista de 10 recurrencias.
- La pantalla administrativa empieza con 16 fechas hardcodeadas.

No existe, por tanto, una única fuente de verdad efectiva para todos los
consumidores.

### 8.3 Fórmula del día 30/31

En `calcularSla`, el estado es rojo solo cuando
`diasHabilesTranscurridos > 30`. El día hábil 30 permanece en plazo con cero
días restantes; el día hábil 31 pasa a vencido. Evidencia:
`backend/src/domains/rutadoc/sla.service.ts`, líneas 35–61.

### 8.4 Contrato frontend/backend

El backend devuelve `feriados_nacionales`, `feriados_regionales_ucayali`,
`feriados_institucionales`, `duelos_nacionales` y `calendario`
(`adminMaestras.controller.ts`, líneas 74–97; `calendario.service.ts`, líneas
744–774). El hook busca `res.data.feriados`, por lo que conserva el fallback
si la respuesta real no es un arreglo (`useCalendarioLaboral.ts`, líneas
71–98).

En escritura, el hook envía `motivo` y `descripcion` (líneas 125–131), pero el
schema backend es estricto y no admite `motivo` (líneas 480–508). El error se
silencia y la interfaz muestra “Feriado registrado”, aunque la persistencia
puede haber fallado (líneas 131–135). El botón de quitar solo modifica estado
local (líneas 138–140).

## 9. Riesgos confirmados

1. **Confusión conceptual:** cargar las 23 actividades como feriados alteraría
   ilegalmente o sin evidencia los plazos SLA.
2. **Fuentes divergentes:** BD, RutaDoc y frontend pueden calcular fechas
   distintas para el mismo expediente.
3. **Inicio incorrecto del SLA:** RutaDoc no usa la fecha legal calculada por
   TramiCore.
4. **Falso éxito en frontend:** el alta puede fallar y aun así mostrar éxito.
5. **Escritura sensible sin permiso:** el POST que altera plazos está montado
   sin autorización específica; el propio router lo reconoce como pendiente.
6. **Degradación silenciosa:** TramiCore convierte cualquier error del catálogo
   en calendario vacío (`radicacionVirtual.service.ts`, líneas 270–290).
7. **Taxonomía territorial inconsistente:** el seed usa
   `REGIONAL_UCAYALI` como unidad, mientras el servicio valida `UCAYALI`
   (`03_sigd_org.sql`, líneas 271–277; `calendario.service.ts`, líneas 451–471).
8. **Datos nacionales incompletos en BD:** los 14 feriados nacionales visibles
   en frontend no están sembrados por la migración auditada.
9. **Documentación interna desactualizada:** comentarios del servicio aún dicen
   que el DDL no está versionado, aunque existe en la migración 03.

## 10. Propuesta de integración aditiva

### Paso 1 — conservar el calendario SLA existente

Mantener `sigd_org.calendario_laboral` exclusivamente para excepciones que
afecten el cómputo de días. No importar automáticamente actividades académicas.

### Paso 2 — agregar un modelo separado de actividades

Como la tabla actual no representa intervalos, responsables ni procedencia, se
justifica en una fase posterior una **nueva migración aditiva** (nunca editar
01–08) para una entidad como `sigd_org.calendarizacion_institucional`, con:

- identificador UUID;
- número/orden de actividad;
- denominación literal;
- `fecha_inicio` y `fecha_fin`;
- responsables documentales;
- fuente, versión y hash;
- estado de validación/vigencia;
- observación de impacto SIGD;
- sin efecto SLA por defecto.

El nombre físico final y el propietario deben confirmarse antes de crear la
migración. La fuente debe conservarse versionada o acompañada por hash.

### Paso 3 — exponer lectura sin alterar flujos

Agregar un endpoint de consulta bajo el módulo propietario existente y una
vista informativa en frontend. Los procedimientos TUPA podrían recibir una
ventana informativa por referencia explícita; no por coincidencia de texto.

### Paso 4 — decisión separada sobre días inhábiles

Si una resolución declara una fecha inhábil, registrar esa fecha de forma
separada en `calendario_laboral`, con `tipo_feriado = INSTITUCIONAL`,
`unidad_territorial = IESTP_SUIZA` y base legal. No convertir rangos completos
sin acto expreso.

### Paso 5 — centralizar consumidores SLA

Adaptar RutaDoc, TramiCore, reportes y frontend al mismo contrato de calendario;
eliminar fallbacks silenciosos únicamente después de disponer de una política
de error acordada. Alinear el inicio del SLA con la fecha jurídica aprobada.

## 11. Archivos que eventualmente cambiarían

| Área | Cambio futuro aditivo |
|---|---|
| Nueva migración posterior a 08 | Tabla independiente de actividades y carga trazable de las 23 filas. |
| OrganiCore | Repositorio/servicio/endpoint de consulta de calendarización. |
| RutaDoc SLA | Inyectar el calendario persistido y definir fecha legal de inicio. |
| TramiCore | Sustituir degradación silenciosa por comportamiento observable acordado. |
| Frontend administración | Alinear respuesta GET, body POST y confirmación real de persistencia. |
| Frontend TUPA | Mostrar ventanas informativas vinculadas explícitamente. |
| Pruebas | Separar pruebas de agenda institucional de pruebas de días hábiles/SLA. |

## 12. Archivos que no deben tocarse para este acoplamiento

- migraciones históricas 01–08;
- `backend/baselines/BASELINE_2026_V1.sql`;
- `backend/src/db/migrate.ts`;
- contratos UUID de expediente;
- arquitectura de RutaDoc, TramiCore, Auth y reportes;
- staging TUPA y sus textos originales;
- frontend existente hasta acordar el contrato API;
- el archivo fuente original de calendarización.

## 13. Criterios de aceptación de una fase posterior

1. Las 23 actividades se importan con texto, fechas, responsables, fuente y
   versión sin inferencias.
2. Ninguna actividad afecta SLA por defecto.
3. Una excepción SLA exige acto/base legal trazable.
4. GET frontend/backend usa el mismo contrato.
5. El POST confirma persistencia antes de mostrar éxito y exige autorización.
6. RutaDoc, TramiCore y reportes obtienen feriados desde una fuente coherente.
7. Se prueba que el día 30 permanece en plazo y el 31 está vencido.
8. Se prueba `fecha_radicacion_legal` después de 16:30, fines de semana y
   feriados.
9. Traslado interno/externo muestra la ventana 03/03–31/03 sin bloquear hasta
   que exista decisión expresa.
10. Dos actividades solapadas no se confunden ni alteran el calendario SLA.

## 14. Conclusión

**SOPORTE PARCIAL — REQUIERE ACOPLAMIENTO.**

El motor de días hábiles existe, pero la calendarización institucional de 23
actividades no está modelada ni cargada. La integración compatible es aditiva:
agenda institucional separada, calendario SLA existente reservado para días
inhábiles expresamente autorizados y consumidores alineados a una única fuente
de verdad.
