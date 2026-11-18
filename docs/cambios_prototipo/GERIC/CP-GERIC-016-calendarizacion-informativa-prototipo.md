# CP-GERIC-016 — Calendarización informativa del prototipo

## 1. Decisión y alcance

La Calendarización Institucional 2026 se acopla inicialmente como un catálogo
TypeScript inmutable y un servicio de consulta de solo lectura. No usa base de
datos, no modifica migraciones y no participa en el cálculo SLA.

Referencia de trabajo:

- rama: `B_GERIC`;
- commit base: `4e06e512fe08d01712bc0b6feb33e95ca28c1b10`;
- auditorías: CP-GERIC-014 y CP-GERIC-015;
- fuente disponible: `calendarizaci_n_institucional_2026.md`;
- sección: `7.2 De la Calendarización Institucional`;
- SHA-256 de la extracción Markdown:
  `648C5AD1AEA1ABBE6A6EEB20586A7C172365CE29D41E3C33B0616B3873A0BEC7`;
- `tipoFuente`: `EXTRACCION_DOCUMENTAL`.

El hash identifica únicamente el Markdown auditado. No se presenta como hash
del documento normativo institucional original.

## 2. Por qué no se utilizó migración 09

El perfil `BASELINE_2026_V1` usa un manifiesto fijo que termina en la migración
08. Una migración 09 no sería descubierta y ampliar solamente el manifiesto
rechazaría como parcial una BD con el ledger baseline actual de siete entradas.

La decisión de esta fase evita modificar:

- `backend/src/db/migrate.ts`;
- `backend/baselines/BASELINE_2026_V1.sql`;
- migraciones 01–08.

La persistencia queda como trabajo posterior, sujeto a un mecanismo autorizado
de migraciones post-baseline.

## 3. Patrón existente reutilizado

No se encontraron catálogos JSON versionados bajo `backend/src`. El patrón
compatible localizado es el catálogo TypeScript inmutable mediante
`Object.freeze`, acompañado de un servicio sustituible de consulta. El ejemplo
existente es `backend/src/domains/rutadoc/ccd.service.ts`.

Se reutiliza ese patrón dentro de OrganiCore, sin tocar RutaDoc:

- catálogo y metadatos inmutables;
- validación al cargar el módulo;
- servicio puro, sin `Pool` ni efectos externos;
- métodos exclusivamente de lectura;
- ninguna dependencia nueva.

## 4. Archivos de esta fase

| Archivo | Acción | Propósito |
|---|---|---|
| `backend/src/domains/organicore/calendarizacion.service.ts` | Creado | Fuente inmutable, validaciones, filtros, consulta por número y cruce TUPA informativo. |
| `backend/tests/unit/domains/organicore/calendarizacionInstitucional.spec.ts` | Creado | Especificación Vitest de las garantías del catálogo. |
| `docs/cambios_prototipo/GERIC/CP-GERIC-016-calendarizacion-informativa-prototipo.md` | Creado | Decisión, evidencia, límites y siguiente integración. |

No se modificaron archivos existentes.

## 5. Modelo informativo

Cada actividad expone únicamente:

- `numero`;
- `actividad`;
- `fechaInicio`;
- `fechaFin`;
- `fechaTextoOriginal`;
- `responsables`;
- `anio`;
- `fuente`;
- `referenciaSeccion`.

No existen las propiedades `esInhabil`, `afectaSla` o `feriado`.

## 6. Las 23 actividades

| N° | Actividad literal | Inicio | Fin |
|---:|---|---|---|
| 1 | Reincorporación, Traslados Internos y Externos | 2026-03-03 | 2026-03-31 |
| 2 | Matrícula del III - V ciclo | 2026-03-16 | 2026-04-30 |
| 3 | Matrícula del I ciclo (ingresantes) | 2026-04-06 | 2026-04-30 |
| 4 | Matrícula Extemporánea 2026-I con 10% de recargo | 2026-05-04 | 2026-05-29 |
| 5 | Inicio de Clases Semestre Académico 2026-I (I-III-V) | 2026-04-06 | 2026-04-06 |
| 6 | Entrega de Registros de Matrícula 2026-I (físico y virtual) | 2026-05-15 | 2026-05-15 |
| 7 | Evaluación Extraordinaria 2026-I | 2026-04-06 | 2026-08-05 |
| 8 | Término del Semestre Académico 2026-I (I-III-V) | 2026-08-07 | 2026-08-07 |
| 9 | Sustentación de Trabajo de Aplicación Profesional y/o Examen de Suficiencia Profesional | 2026-08-10 | 2026-08-31 |
| 10 | Ingreso de notas finales en el Sistema Registra - MINEDU 2026-I | 2026-08-10 | 2026-08-12 |
| 11 | Entrega de Actas de Evaluación 2026-I | 2026-08-14 | 2026-08-14 |
| 12 | Matrícula Semestre Académico 2026-II | 2026-08-17 | 2026-09-11 |
| 13 | Matrícula Extemporánea 2026-II con 10% de recargo | 2026-09-14 | 2026-10-09 |
| 14 | Inicio de Clases Semestre Académico 2026-II (II-IV-VI) | 2026-08-17 | 2026-08-17 |
| 15 | Entrega de Registros de Matrícula 2026-II (físico y virtual) | 2026-09-30 | 2026-09-30 |
| 16 | Semana Técnica | 2026-09-16 | 2026-09-18 |
| 17 | Evaluación Extraordinaria 2026-II | 2026-08-17 | 2026-12-11 |
| 18 | Término del Semestre Académico 2026-II | 2026-12-18 | 2026-12-18 |
| 19 | Sustentación de Trabajo de Aplicación Profesional y/o Examen de Suficiencia Profesional | 2026-12-18 | 2026-12-31 |
| 20 | Ingreso de notas finales en el Sistema Registra - MINEDU 2026-II | 2026-12-21 | 2026-12-22 |
| 21 | Entrega de Actas de Evaluación 2026-II | 2026-12-28 | 2026-12-28 |
| 22 | Clausura del Año Académico 2026 | 2026-12-28 | 2026-12-28 |
| 23 | Registro de Egresados en el Sistema Conecta - MINEDU. | 2026-12-28 | 2026-12-30 |

Las responsabilidades y el texto original de las fechas también se conservan
literalmente en el catálogo fuente.

## 7. Validaciones

`validarCatalogoCalendarizacion` comprueba al cargar el módulo:

1. total exacto de 23 actividades;
2. número entero, positivo y único;
3. actividad no vacía;
4. responsables no vacíos;
5. fechas civiles ISO válidas;
6. `fechaInicio <= fechaFin`;
7. correspondencia de ambas fechas con el año declarado.

## 8. Servicio de consulta

`CalendarizacionInstitucionalService` ofrece únicamente:

- `listar()`;
- `listar({ anio })`;
- `listar({ desde, hasta })`, incluyendo actividades que se solapan con el
  intervalo;
- `obtenerPorNumero(numero)`;
- `obtenerContextoTupa(referenciaFila)`.

No contiene métodos de alta, actualización o eliminación. Las colecciones y
actividades expuestas están congeladas.

En esta primera fase no se añadió un endpoint HTTP. El servicio es el punto de
lectura interno que una siguiente integración podrá exponer mediante un GET en
el router administrativo existente, sin crear otro dominio ni otra
arquitectura.

## 9. Cruce informativo con TUPA

El cruce es explícito por referencias estables del staging, nunca por texto:

| TUPA | Actividad | Tipo | Ventana |
|---|---:|---|---|
| Traslado Interno, `p5-fila-20` | 1 | `INFORMATIVO` | 2026-03-03–2026-03-31 |
| Traslado Externo, `p5-fila-21` | 1 | `INFORMATIVO` | 2026-03-03–2026-03-31 |

Resultado retornado:

```json
{
  "tipo": "INFORMATIVO",
  "fechaInicio": "2026-03-03",
  "fechaFin": "2026-03-31",
  "actividad": "Reincorporación, Traslados Internos y Externos"
}
```

No impide radicar fuera del rango. No se asociaron Reserva de Matrícula,
Licencia de Estudios, Expedición de Título ni certificados. Las sustentaciones
permanecen como actividades institucionales, no como plazo de expedición.

## 10. Separación agenda/SLA

Este cambio no importa ni referencia `calendario_laboral` y no modifica:

- `sigd_org.calendario_laboral`;
- `backend/src/domains/rutadoc/sla.service.ts`;
- `fecha_radicacion`;
- `fecha_radicacion_legal`;
- feriados;
- fórmula de los días 30/31;
- código RutaDoc o TramiCore.

Impacto SLA verificado por diseño: **0**.

## 11. Evidencia de pruebas

### Especificación agregada

La suite Vitest cubre:

- 23 actividades;
- numeración única y correlativa;
- campos obligatorios;
- fechas válidas y ordenadas;
- fuente `EXTRACCION_DOCUMENTAL`;
- ausencia de propiedades SLA;
- filtros por año y rango;
- consulta por número;
- Traslado Interno y Externo;
- ausencia de asociaciones automáticas adicionales;
- superficie de solo lectura e inmutabilidad;
- rechazo de un catálogo incompleto.

### Ejecución disponible

| Validación | Resultado | Evidencia |
|---|---|---|
| RED por implementación ausente | Confirmado | Importar `calendarizacion.service.ts` antes de crearlo produjo `ERR_MODULE_NOT_FOUND`. |
| Suite Vitest configurada | No ejecutable en este entorno | `backend/node_modules/vitest/vitest.mjs` no existe. No se instalaron dependencias. |
| Sintaxis TypeScript mediante Node 24 `--experimental-strip-types --check` | PASS | Código de salida 0. |
| Smoke de catálogo, filtros, TUPA y separación SLA | PASS | 23 actividades y dos mapeos informativos verificados con `node:assert/strict`. |
| Comparación literal contra Markdown | PASS | 23/23 actividades, responsables y fechas originales coinciden. |

No se presenta la suite Vitest como ejecutada. Debe correrse con
`npm run test:unit -- tests/unit/domains/organicore/calendarizacionInstitucional.spec.ts`
cuando las dependencias ya estén instaladas por el flujo autorizado.

## 12. Control arquitectónico

- migraciones modificadas: 0;
- cambios en baseline: 0;
- cambios en `migrate.ts`: 0;
- cambios RutaDoc: 0;
- cambios TramiCore: 0;
- cambios frontend: 0;
- cambios de arquitectura: 0;
- archivos eliminados: 0;
- dependencias agregadas: 0.

## 13. Siguiente integración posible

1. Geric revisa literalidad y procedencia de la extracción.
2. Christian puede exponer el contexto TUPA solo después de acordar el contrato
   GET; no debe convertir la ventana en validación de radicación.
3. Ricardo puede mostrar el bloque `calendarizacion` como información, sin
   impedir continuar.
4. Valentin ejecuta Vitest en entorno preparado y prueba que fuera de rango la
   radicación sigue habilitada.
5. La persistencia se retoma únicamente cuando exista soporte post-baseline
   autorizado.

## 14. Conclusión

**CALENDARIZACIÓN INFORMATIVA 2026 ACOPLADA SIN MODIFICAR ARQUITECTURA.**

El catálogo de 23 actividades puede consultarse programáticamente, mantiene la
procedencia como extracción documental, relaciona explícitamente solo los dos
traslados y no modifica SLA, BD, migraciones ni módulos protegidos.
