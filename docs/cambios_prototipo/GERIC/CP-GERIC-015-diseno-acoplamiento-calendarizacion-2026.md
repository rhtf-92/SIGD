# CP-GERIC-015 — Diseño de acoplamiento de Calendarización Institucional 2026

## 1. Alcance y referencia

- Rama revisada: `B_GERIC`.
- Commit de referencia: `4e06e512fe08d01712bc0b6feb33e95ca28c1b10`.
- Auditoría precedente: `CP-GERIC-014-auditoria-calendarizacion-institucional-2026.md`.
- Fuente local: `C:\Users\Geric\Downloads\calendarizaci_n_institucional_2026.md`.
- SHA-256 de la fuente local: `648C5AD1AEA1ABBE6A6EEB20586A7C172365CE29D41E3C33B0616B3873A0BEC7`.
- Sección: `7.2 De la Calendarización Institucional`.
- Entradas: 23 actividades de 2026.
- Método: diseño e inspección estática. No se ejecutaron migraciones, BD ni pruebas.

Este documento diseña un cambio futuro. No crea tablas, no carga datos y no
altera el comportamiento actual.

## 2. Soporte existente que debe conservarse

El sistema ya dispone de `sigd_org.calendario_laboral` para excepciones que
afectan el cálculo de días hábiles. La tabla representa una fecha concreta,
clasificación del feriado, unidad territorial, base legal y si el día es
laborable (`backend/migraciones/03_sigd_org.sql`, líneas 246–277).

La fuente de 23 actividades representa otra cosa: una agenda de intervalos,
hitos y responsables. No existe una tabla equivalente en las migraciones o el
código actual. Por tanto, reutilizar `calendario_laboral` para estas actividades
duplicaría significados y podría alterar indebidamente los SLA.

## 3. Auditoría del mecanismo de migraciones

### 3.1 Descubrimiento sin perfil

Sin `SIGD_MIGRATION_PROFILE`, el runner:

1. lee el directorio de migraciones;
2. filtra todos los archivos terminados en `.sql`;
3. los ordena por nombre;
4. calcula SHA-256;
5. omite los ya registrados con el mismo checksum;
6. ejecuta y registra los restantes dentro de una transacción.

Evidencia: `backend/src/db/migrate.ts`, líneas 235–280. En este modo, un archivo
`09_sigd_org_calendarizacion_2026.sql` sí sería descubierto después de `08` sin
agregarlo a una lista fija.

### 3.2 Descubrimiento con `BASELINE_2026_V1`

Con el perfil baseline, el runner usa un manifiesto fijo:

`01`, `02`, `03`, `04`, `05`, `BASELINE_2026_V1` y `08`.

Evidencia: `backend/src/db/migrate.ts`, líneas 33–48 y 219–252. La prueba de
integración confirma exactamente siete registros y una segunda ejecución sin
cambios (`backend/tests/integration/db/baseline-2026.test.ts`, líneas 22–27 y
78–105).

Una futura migración `09` no sería descubierta bajo ese perfil. Además,
`clasificarDestino` exige que el ledger tenga exactamente la misma longitud y
checksums que el manifiesto (`migrate.ts`, líneas 97–100). Por ello, limitarse a
agregar `09` al manifiesto produciría dos comportamientos:

- instalación nueva: podría ejecutar ocho elementos;
- BD ya instalada con los siete actuales: sería rechazada como ledger parcial
  antes de aplicar `09`.

No es seguro desactivar el perfil en una BD baseline existente: el modo normal
también intentaría ejecutar `06_sigd_rut.sql` y `07_sigd_reportes.sql`, que el
perfil reemplaza funcionalmente mediante el baseline.

### 3.3 Dictamen de viabilidad

| Contexto | ¿Detecta 09 sin tocar `migrate.ts`? | Dictamen |
|---|---:|---|
| Runner normal, BD creada por secuencia histórica | Sí | Viable técnicamente, pero no corresponde al recorrido baseline vigente. |
| Instalación nueva con `BASELINE_2026_V1` | No | El manifiesto fijo termina en 08. |
| BD existente instalada con baseline | No | El perfil retorna como completo con siete entradas; ampliar solo la lista rechazaría el ledger previo. |

**Bloqueo:** para soportar `09` de manera uniforme en el recorrido vigente se
requiere autorización para extender el runner con una fase de migraciones
aditivas posteriores al baseline, o un mecanismo equivalente aprobado. Ese
cambio afectaría `backend/src/db/migrate.ts`, actualmente protegido, y su prueba
de integración. Este documento no lo modifica.

## 4. Entidad propuesta

Nombre futuro: `sigd_org.calendarizacion_institucional`.

| Campo | Tipo propuesto | Nulabilidad | Justificación |
|---|---|---:|---|
| `calendarizacion_id` | `UUID DEFAULT gen_random_uuid()` | NOT NULL, PK | Identidad técnica sin reutilizar identificadores SLA. |
| `anio` | `SMALLINT` | NOT NULL | Año institucional consultable; no se infiere únicamente de la fecha porque una versión futura podría cruzar años. |
| `numero_actividad` | `SMALLINT` | NOT NULL | Conserva el número literal 1–23 de la sección 7.2. |
| `actividad` | `TEXT` | NOT NULL | Denominación literal de la fuente. |
| `fecha_inicio` | `DATE` | NOT NULL | Inicio normalizado cuando la fecha es inequívoca. |
| `fecha_fin` | `DATE` | NOT NULL | Fin normalizado; para hitos de un día será igual al inicio. |
| `fecha_texto_original` | `TEXT` | NOT NULL | Conserva “Del ... al ...” o la fecha puntual exactamente como fuente. |
| `responsables` | `TEXT` | NOT NULL | Conserva literalmente la lista; no crea entidades organizativas inferidas. |
| `fuente_nombre` | `TEXT` | NOT NULL | Identifica el documento fuente. |
| `documento_sha256` | `CHAR(64)` | NOT NULL | Vincula cada fila con la versión física auditada. |
| `referencia_seccion` | `TEXT` | NOT NULL | En este conjunto: `7.2`. |
| `version_fuente` | `TEXT` | NOT NULL | En este conjunto: `2026`; evita el nombre ambiguo `version`. |
| `creado_en` | `TIMESTAMPTZ DEFAULT now()` | NOT NULL | Trazabilidad técnica de carga. |

### 4.1 Evaluación de los campos inicialmente propuestos

- Se conservan todos, salvo que `version` se renombra a `version_fuente` para
  expresar su semántica.
- `responsables` será texto literal, no JSON ni FK, porque la fuente no entrega
  identificadores organizacionales.
- Se agrega `fecha_texto_original`: sin ella se perdería el literal al convertir
  el intervalo a `DATE`.
- No se propone `actualizado_en`: las filas de procedencia deben tratarse como
  inmutables; una corrección oficial debe entrar como nueva versión/migración.
- No se propone `es_dia_inhabil`, `impacta_sla` ni `feriado`: no aparecen en la
  fuente.

### 4.2 Restricciones e índices propuestos

- `CHECK (anio BETWEEN 2000 AND 2999)`.
- `CHECK (numero_actividad > 0)`.
- `CHECK (btrim(actividad) <> '')`.
- `CHECK (fecha_fin >= fecha_inicio)`.
- `CHECK (documento_sha256 ~ '^[0-9a-f]{64}$')`.
- `UNIQUE (documento_sha256, referencia_seccion, numero_actividad)`.
- Índice de consulta `(anio, fecha_inicio, fecha_fin)`.
- Comentarios SQL que indiquen expresamente: “agenda; no altera SLA”.

No se propone FK hacia `sigd_org.calendario_laboral`: una actividad puede durar
varios días sin que ninguno sea inhábil y un feriado puede existir sin actividad
académica asociada.

## 5. Separación contractual agenda/SLA

| Objeto | Propósito | Entrada | Efecto permitido |
|---|---|---|---|
| `sigd_org.calendario_laboral` | Calendario legal/operativo | Fecha individual, clasificación, unidad, base legal | Excluir o habilitar un día en el cálculo SLA. |
| `sigd_org.calendarizacion_institucional` | Agenda académica/institucional | Actividad, intervalo, responsables, procedencia | Mostrar, consultar o advertir una ventana; sin efecto SLA automático. |

Regla de frontera: una futura disposición que declare un día inhábil debe crear
una entrada independiente y trazable en `calendario_laboral`. La mera presencia
de Semana Técnica, Clausura, matrícula o sustentación en la agenda no basta.

## 6. Estrategia de carga de las 23 actividades

### 6.1 Opciones evaluadas

| Opción | Trazabilidad | Idempotencia | Demo | Actualización futura | Evaluación |
|---|---|---|---|---|---|
| A. `INSERT` simple en migración | Alta | Depende del SQL | Alta | Requiere nueva migración | Insuficiente si no declara conflicto/procedencia. |
| B. Seed idempotente versionado | Alta | Alta mediante clave de procedencia y `ON CONFLICT` | Alta | Nuevo año o corrección en una migración posterior | **Recomendada**. |
| C. Importador controlado | Alta si se construye staging/validador | Alta si se diseña | Media | Muy flexible | Excesivo para 23 filas estables y añade herramientas operativas. |
| D. Configuración estática | Baja para BD | Local, no persistente | Alta | Riesgo de divergencia | Rechazada; repetiría el problema de feriados hardcodeados. |

### 6.2 Decisión

Usar un **seed idempotente dentro de la futura migración 09**:

- crea la tabla y sus restricciones;
- inserta exactamente 23 filas literales;
- usa la clave única de procedencia y `ON CONFLICT ... DO NOTHING`;
- queda cubierto por el checksum y la transacción del runner;
- una nueva versión o corrección nunca modifica la migración aplicada: se añade
  una migración posterior.

Esta elección depende de resolver primero el bloqueo del perfil baseline. No se
creará un importador paralelo ni se conectará el staging TUPA con esta carga.

## 7. Versionado y procedencia

Para las 23 filas se conservará:

- `fuente_nombre`: nombre institucional acordado del documento, sin usar la
  ruta personal como contrato;
- `documento_sha256`:
  `648c5ad1aea1abbe6a6eeb20586a7c172365ce29d41e3c33b0616b3873a0bec7`;
- `referencia_seccion`: `7.2`;
- `version_fuente`: `2026`;
- actividad y responsables literales;
- expresión original de fecha;
- conversión a `DATE` solo para las 23 fechas/rangos inequívocos.

Antes de implementar debe confirmarse si el Markdown es la fuente institucional
canónica o una extracción. Si es extracción, el hash del documento oficial debe
acompañar o sustituir el hash de procedencia, sin inventarlo.

## 8. Integración aditiva con TUPA

### 8.1 Tres usos posibles

| Uso | Comportamiento | Requisito |
|---|---|---|
| `INFORMATIVO` | Muestra la ventana sin impedir radicación. | Correspondencia explícita y texto que aclare su carácter informativo. |
| `ADVERTENCIA` | Permite continuar, pero alerta si la fecha está fuera del intervalo. | Regla funcional aprobada y prueba de que no bloquea. |
| `BLOQUEANTE` | Rechaza la radicación fuera del intervalo. | Norma o decisión institucional explícita, contrato API y tratamiento de excepciones. |

**Recomendación para el prototipo: `INFORMATIVO`.** La fuente demuestra una
ventana institucional, pero no declara que el SIGD deba rechazar solicitudes
fuera de ella.

### 8.2 Correspondencias verificables

| Procedimiento TUPA | Calendarización | Propuesta |
|---|---|---|
| Traslado Interno (`p5-fila-20`) | Actividad 1: 03/03/2026–31/03/2026 | Mostrar la ventana informativa. |
| Traslado Externo (`p5-fila-21`) | Actividad 1: 03/03/2026–31/03/2026 | Mostrar la ventana informativa. |
| Reserva de Matrícula (`p5-fila-18`) | La agenda contiene matrícula, pero no reserva de matrícula | No inferir ventana; mantener sin cruce automático. |
| Licencia de Estudios (`p5-fila-19`) | No existe actividad literal equivalente | Sin ventana derivada. |
| Titulación (`p4-fila-05`, `p6-fila-04`) | Actividades 9 y 19 son sustentación/examen, no expedición o titulación completa | Contexto informativo separado; no usar como plazo del procedimiento. |

No se propone en esta fase una FK directa con TUPA. Si luego se requiere un
vínculo automatizado, debe diseñarse una tabla de asociación explícita entre
`registro_version_id` y `calendarizacion_id`, con tipo de uso, en vez de comparar
denominaciones o índices. Ese vínculo no debe insertarse antes de que ambas
filas existan y hayan sido validadas.

## 9. Impacto sobre SLA

Las 23 actividades **no deben modificar automáticamente**:

- el contador de días hábiles;
- el vencimiento o color del SLA;
- `fecha_radicacion_legal`;
- `sigd_org.calendario_laboral`;
- las funciones de reportes;
- las constantes actuales del frontend.

Semana Técnica y Clausura tampoco modifican SLA: la fuente no declara cierre,
suspensión de atención ni día inhábil. Solo una disposición posterior,
independiente y trazable podría producir una excepción en
`calendario_laboral`.

## 10. Prioridad de los problemas de calendario/SLA existentes

| Ranking | Problema | Severidad | Impacto | Responsable propuesto |
|---:|---|---|---|---|
| 1 | POST de calendario sin autorización específica | **CRÍTICO** | Permite alterar días que influyen en plazos legales; el router declara el control pendiente. | Ricardo/Christian según capa, con validación de Geric. |
| 2 | `fecha_radicacion_legal` no existe en la migración 05 | **CRÍTICO** | El servicio intenta persistir una columna ausente en el DDL versionado. | Christian, coordinado con Geric. |
| 3 | SLA de RutaDoc usa `fecha_radicacion`, no `fecha_radicacion_legal` | **CRÍTICO** | Puede iniciar el plazo en una fecha distinta de la calculada por horario de corte. | Jhasy. |
| 4 | TramiCore convierte cualquier error del calendario en `[]` | **ALTO** | Una falla de BD se vuelve calendario vacío y puede cambiar fechas legales sin visibilidad. | Christian. |
| 5 | RutaDoc usa calendario predeterminado en memoria | **ALTO** | El SLA puede divergir del calendario persistido administrativamente. | Jhasy. |
| 6 | Contrato GET backend/frontend no coincide | **ALTO** | El frontend busca `feriados`, pero el backend devuelve colecciones agrupadas y `calendario`. | Ricardo. |
| 7 | POST frontend envía `motivo`, rechazado por el schema estricto | **ALTO** | El alta real puede fallar siempre con el body actual. | Ricardo. |
| 8 | Frontend silencia el error y muestra éxito | **ALTO** | Genera evidencia visual falsa de persistencia. | Ricardo. |
| 9 | Frontend administrativo usa 16 feriados hardcodeados | **MEDIO** | La pantalla puede mostrar datos distintos de BD. | Ricardo. |
| 10 | Otra utilidad frontend usa solo 10 feriados | **MEDIO** | Dos pantallas pueden calcular días hábiles diferentes. | Ricardo, QA de Valentin. |

Estas correcciones son independientes de la tabla de agenda. No deben incluirse
en la futura migración 09 ni resolverse mezclando las 23 actividades con SLA.

## 11. Responsabilidades propuestas

| Persona | Alcance |
|---|---|
| Geric | Modelo de calendarización, procedencia, revisión del seed, coordinación del bloqueo del runner e integración final. |
| Jhasy | Fuente de fecha y calendario de RutaDoc/SLA; lecturas sin duplicar el modelo de agenda. |
| Christian | TramiCore, adaptación observable del proveedor de calendario y coherencia de `fecha_radicacion_legal`. |
| Ricardo | Pantalla administrativa, contrato GET/POST y futura visualización informativa de actividades. |
| Valentin | QA: idempotencia, 23/23 filas, no regresión SLA, permisos, frontend/backend y TUPA informativo. |

La asignación no autoriza a Geric a modificar por adelantado los archivos de
los demás responsables.

## 12. Archivos potenciales de una implementación futura

| Archivo | Tipo de cambio | Condición |
|---|---|---|
| `backend/migraciones/09_sigd_org_calendarizacion_2026.sql` | Nuevo: tabla, restricciones y seed 23/23 | Solo cuando el runner baseline admita migraciones posteriores. |
| `backend/src/domains/organicore/calendarizacion.service.ts` | Nuevo: consulta, sin reglas SLA | Después del DDL. |
| `backend/src/domains/organicore/adminMaestras.controller.ts` | Mínima ampliación para lectura | Mantener contratos existentes. |
| `backend/src/domains/organicore/adminMaestras.routes.ts` | Nuevo GET de calendarización | Sin reutilizar el endpoint SLA. |
| `backend/src/app.ts` | Solo si el router existente no cubre el montaje | Evitar una segunda arquitectura. |
| `backend/tests/integration/db/calendarizacion-2026.test.ts` | Nuevo: DDL, seed, idempotencia, procedencia | PostgreSQL descartable. |
| `backend/tests/unit/domains/organicore/calendarizacion.spec.ts` | Nuevo: rangos y DTO de lectura | Sin afirmar impacto SLA. |
| Frontend administrativo/TUPA | Fase posterior de Ricardo | Solo tras fijar el contrato API. |

Para resolver el bloqueo, una autorización futura tendría que modificar y
probar `backend/src/db/migrate.ts` y
`backend/tests/integration/db/baseline-2026.test.ts`. No se propone el parche en
esta fase porque ambos forman parte del mecanismo protegido.

## 13. Archivos protegidos/intocables en esta fase

- `backend/migraciones/01_sigd_audit.sql` a
  `backend/migraciones/08_sigd_tupa_acoplamiento.sql`;
- `backend/baselines/BASELINE_2026_V1.sql`;
- `backend/src/db/migrate.ts`;
- dominios RutaDoc y TramiCore;
- frontend;
- Auth, reportes, Docker y lockfiles;
- staging y herramientas TUPA;
- archivo fuente de calendarización.

## 14. Criterios de aceptación futuros

1. El runner aplica 09 tanto en instalación nueva baseline como sobre un ledger
   baseline completo existente, sin intentar 06/07.
2. La migración es aditiva y no altera objetos históricos.
3. Existen exactamente 23 filas con números únicos 1–23.
4. Texto, responsables y fechas corresponden literalmente a la fuente.
5. Una segunda ejecución no duplica filas.
6. Ninguna fila crea o modifica `calendario_laboral`.
7. Traslados muestran la ventana solo como información.
8. Reserva, Licencia y Titulación no reciben fechas inferidas.
9. No cambia ningún resultado SLA antes/después de instalar la agenda.
10. Procedencia y checksum pueden verificarse desde BD.

## 15. Conclusión

**BLOQUEADO POR MECANISMO DE MIGRACIONES.**

El modelo, la carga idempotente y la separación agenda/SLA están definidos. No
obstante, el perfil vigente `BASELINE_2026_V1` no descubre una migración 09 y su
validación exacta de ledger impide resolverlo agregando únicamente un nombre al
manifiesto para bases ya instaladas. La siguiente decisión debe autorizar un
mecanismo de migraciones post-baseline compatible; hasta entonces no es seguro
implementar ni aplicar `09`.
