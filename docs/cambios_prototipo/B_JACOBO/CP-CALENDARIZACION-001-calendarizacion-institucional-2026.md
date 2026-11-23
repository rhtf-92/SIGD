# CP-CALENDARIZACION-001 — Calendarización Institucional 2026

## Fuente y alcance

El catálogo reproduce las 23 actividades de la sección 7.2 de la **Calendarización Institucional 2026** del IESTP Suiza. Conserva la numeración, denominaciones y fechas provistas para esa fuente. Cada registro indica `fuente: "Calendarización Institucional 2026"` y `seccionFuente: "7.2"`.

**Calendarización Institucional 2026 tiene carácter informativo y no modifica el cálculo de SLA ni el calendario laboral.** Es un catálogo TypeScript de solo lectura dentro de OrganiCore. No usa PostgreSQL ni tiene operaciones de escritura.

## Actividades

| N.º | Actividad | Inicio | Fin |
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

## Servicio

Implementación: `backend/src/domains/organicore/calendarizacion.service.ts`.

- `listarTodas()` devuelve una copia inmutable ordenada por número.
- `listarPorAnio(anio)` filtra por año; un año válido sin registros devuelve `[]`.
- `obtenerPorNumero(numero)` devuelve una actividad o `null`.
- `listarPorRango(fechaInicio, fechaFin)` valida fechas ISO reales y devuelve intervalos superpuestos con límites inclusivos.
- `obtenerContextoTupa(referenciaFila)` devuelve contexto solo para las referencias informativas configuradas; otras devuelven `null`.

Las actividades `p5-fila-20` y `p5-fila-21` se asocian únicamente con la actividad n.º 1 de forma informativa. La carga TUPA versionada identifica SUZ26-065 “Traslado Interno” y SUZ26-066 “Traslado Externo” como procedimientos de la página 5; el catálogo frontend conserva esas mismas denominaciones. Ambas aparecen expresamente bajo “Traslados Internos y Externos” en la actividad institucional n.º 1. La referencia de fila se conserva como identificador dado para esta consulta; no impone una condición temporal al trámite.

Este contexto no bloquea ni rechaza una radicación fuera de las fechas indicadas, no modifica procedimientos, requisitos o costos y no mapea otros trámites por semejanza. No se añaden cálculos de días hábiles, feriados, plazos ni SLA.

## Ejemplo de consulta

```ts
import { calendarizacionInstitucional2026 } from './calendarizacion.service.js';

const traslados = calendarizacionInstitucional2026.obtenerContextoTupa('p5-fila-20');
const actividadesDeSeptiembre = calendarizacionInstitucional2026.listarPorRango(
  '2026-09-01',
  '2026-09-30',
);
```

## Pruebas

Las pruebas unitarias están en `backend/tests/unit/domains/organicore/calendarizacionInstitucional.spec.ts`. Verifican las 23 entradas, fechas, búsqueda, filtros, solapamiento inclusivo, validación calendárica, contexto TUPA y la inmutabilidad. En el momento de crear este documento, typecheck y pruebas quedan pendientes de ejecución y resultado en el informe de la intervención.

## Archivos de esta intervención

- Creado: `backend/src/domains/organicore/calendarizacion.service.ts`.
- Creado: `backend/tests/unit/domains/organicore/calendarizacionInstitucional.spec.ts`.
- Creado: `docs/cambios_prototipo/B_JACOBO/CP-CALENDARIZACION-001-calendarizacion-institucional-2026.md`.

No se modifican `calendario.service.ts`, `sla.service.ts`, las rutas, el frontend, PostgreSQL, las migraciones ni la infraestructura.
