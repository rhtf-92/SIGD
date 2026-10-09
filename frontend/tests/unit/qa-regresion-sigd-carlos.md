# SIGD — Pruebas de regresión del frontend (Carlos Perea Saldaña)

> Integrante: Carlos Alexis Perea Saldaña (rama: `F_PEREA`)  
> Tipo: Pruebas unitarias nuevas (sin backend, sin modificaciones productivas)  
> Marco: Vitest 5 + @testing-library/react + jsdom  
> Fecha: 2026-10-09

## Objetivo
Detectar fallos del frontend durante la integración general, reutilizando patrones existentes (naming, estructura `tests/unit/...`, setup Vitest, imports relativos).

## Estado de ejecución
- **Ejecución automatizada**: NO EJECUTADA (motivo: no existe `frontend/node_modules` y el brief prohíbe instalar paquetes). Las pruebas fueron creadas pero no corrieron en este entorno.
- **Pruebas a ejecutar cuando haya dependencias**: `npm test` desde `frontend/` o `npx vitest run` (según ambiente). Verificado: `vitest` está en `devDependencies` y config en `vitest.config.ts` (`environment: "jsdom"`, `setupFiles: ["./tests/setup.ts"]`, `include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"]`).

## Archivos nuevos creados
| Archivo | Alcance | Notas |
|---|---|---|
| `frontend/tests/unit/utils/expedientePresentacion.test.ts` | `src/utils/expedientePresentacion.ts` | etiquetaExpediente (catálogo + fallback), fechaExpediente/fecha-hora (America/Lima), plazoExpediente (vencido/restante/ahora/daño límite). |
| `frontend/tests/unit/utils/diasHabiles.test.ts` | `src/utils/diasHabiles.ts` | esDiaHabil (Lun–Vie hábiles, Sáb–Dom no, feriados fijos + extra), diasHabilesEntre (inválido, fin<inicio, fin exclusivo, conteo solo hábiles), clasificarPermanencia (umbral 0.6 y sla<=0). |
| `frontend/tests/unit/utils/schemaFormParser.test.ts` | `src/utils/schemaFormParser.ts` | isWeekend (LPAG, defensivo), parseJsonSchema/alias (inferencia widget: text/textarea/number/select/date, options, validationRules), extractDefaultValues, validateFieldValue (requerido, minLength/maxLength, pattern, numérico min/max, LPAG). |

## Casos de regresión priorizados (2–4 comportamientos, válidos sin backend)
1. **Formularios (parser dinámico)**: inferencia correcta de widgets, `required`, `options`, reglas de validación y bloqueo LPAG para campos fecha (`noWeekends`).  
2. **Cálculo días hábiles**: conteo normativo (excluye Sáb/Dom y feriados fijos) y `clasificarPermanencia` según SLA.  
3. **Transformaciones de datos**: etiquetado, formato fecha-hora canónico (America/Lima), cálculo relativo de plazo con borde `Vence ahora`.  
4. **Validación campo-a-campo**: casos límite (vacío, minLength, maxLength, pattern, rango numérico).

## Precondiciones / Supuestos
- Zona horaria para validación de formato: `America/Lima` (coincide con implementación).  
- LPAG: fines de semana no hábiles.  
- Entradas ISO con desplazamiento (`-05:00`) toleradas (parser defensivo en `isWeekend`).

## Matriz de casos manuales (para validar cuando se ejecuten pruebas)
| ID | Archivo/función | Caso | Dato de prueba | Esperado | Estado |
|---|---|---|---|---|---|
| EP-01 | expedientePresentacion.etiquetaExpediente | catálogo traduce | `"TITULACION_PROFESIONAL"` | `"Titulación Profesional"` | PENDIENTE_EJECUCION |
| EP-02 | etiquetaExpediente | fallback legible | `"NUEVA_AREA"` | `"Nueva area"` (capitaliza, separa _) | PENDIENTE_EJECUCION |
| EP-03 | fechaExpediente | fecha dd/mm/yyyy | `"2026-09-05T11:42:15-05:00"` | `"05/09/2026"` | PENDIENTE_EJECUCION |
| EP-04 | fechaExpediente(conHora=true) | fecha-hora 24h | `"2026-09-05T11:42:15-05:00"`, true | `"05/09/2026, 11:42"` | PENDIENTE_EJECUCION |
| EP-05 | plazoExpediente | resta días | límite `2026-09-08`, ahora `2026-09-05` | `"3 días restantes"` | PENDIENTE_EJECUCION |
| EP-06 | plazoExpediente | vence ahora | igual instante | `"Vence ahora"` | PENDIENTE_EJECUCION |
| EP-07 | plazoExpediente | vencido 1 día | límite `2026-09-04`, ahora `2026-09-05` | `"Vencido hace 1 día"` | PENDIENTE_EJECUCION |
| DH-01 | diasHabiles.esDiaHabil | lun–vie hábiles, sáb–dom no | 2026-09-07..13 | L-V true; S-D false | PENDIENTE_EJECUCION |
| DH-02 | esDiaHabil | feriados fijos | 2026-12-25, 2026-07-28, 2026-07-29 | false | PENDIENTE_EJECUCION |
| DH-03 | esDiaHabil | feriados extra | 2026-10-13 + extra | false cuando extra incluye fecha | PENDIENTE_EJECUCION |
| DH-04 | diasHabilesEntre | inválido/fin<inicio | undefined, "2026-09-10","2026-09-09" | 0 | PENDIENTE_EJECUCION |
| DH-05 | diasHabilesEntre | fin exclusivo | 07→14 Sep 2026 | 5 | PENDIENTE_EJECUCION |
| DH-06 | clasificarPermanencia | umbrales | (0,10)=EN_PLAZO; (6,10)=POR_VENCER; (10,10)=POR_VENCER; (11,10)=VENCIDA | según umbrales | PENDIENTE_EJECUCION |
| DH-07 | clasificarPermanencia | sla<=0 | (100,0),(100,-5) | EN_PLAZO | PENDIENTE_EJECUCION |
| SF-01 | schemaFormParser.isWeekend | Sáb/Dom true, Lun–Vie false | 2026-09-12/13/07/11 | true/true/false/false | PENDIENTE_EJECUCION |
| SF-02 | isWeekend | defensivo | "2026-09-12T10:00:00-05:00", " ", "", "no-fecha" | true, true, false, false | PENDIENTE_EJECUCION |
| SF-03 | parseJsonSchema | infiere widgets/select/options | esquema TUPA-04 | integer→number, enum→select con options, date→noWeekends true | PENDIENTE_EJECUCION |
| SF-04 | extractDefaultValues | sane defaults | boolean/integer/number/string + default | flag false, entero con min, number "", string "", default preservado | PENDIENTE_EJECUCION |
| SF-05 | validateFieldValue | requerido vacío | text required | mensaje "obligatorio" | PENDIENTE_EJECUCION |
| SF-06 | validateFieldValue | minLength/maxLength | 5–10 | errores mínimos/máximos, válido en rango | PENDIENTE_EJECUCION |
| SF-07 | validateFieldValue | pattern | ^[A-Z]{3}$ | error si no cumple; ok si cumple | PENDIENTE_EJECUCION |
| SF-08 | validateFieldValue | número min/max/NaN | 0,101,"abc",50 con min=1,max=100 | errores correctos; válido 50 | PENDIENTE_EJECUCION |
| SF-09 | validateFieldValue | LPAG fecha fin de semana | 2026-09-12/13/07 con noWeekends true | error con Ley N° 27444; válido 07 | PENDIENTE_EJECUCION |

## Diferenciación: ejecutadas vs pendientes
- **Ejecutadas**: ninguna (no se instalaron dependencias; brief prohíbe instalar paquetes).  
- **Creadas/pendientes de ejecución**: los 3 archivos de prueba anteriores + presente matriz.  
- **Reutilización**: se siguió estructura existente (`frontend/tests/unit/...`), naming `.test.ts`, imports relativos `../../../src/...`, setup `@testing-library/jest-dom/vitest` + cleanup, sin duplicar pruebas existentes.

## Comandos (referenciales, NO ejecutados aquí)
- `cd frontend && npx vitest run tests/unit/utils/expedientePresentacion.test.ts tests/unit/utils/diasHabiles.test.ts tests/unit/utils/schemaFormParser.test.ts`
- `cd frontend && npm test` (ejecuta todo lo incluido por vitest.config.ts)
- `cd frontend && npm run typecheck` (para verificar tipos; sin ejecutar lógica productiva)

## Notas de cumplimiento del brief
- Únicamente archivos NUEVOS de pruebas y esta documentación QA. **No** se modificaron archivos productivos, backend, frontend productivo, Docker, migraciones, package.json, lock, ni se cambió rama.  
- No se fabricaron endpoints; casos puramente unitarios sobre utilidades existentes.  
- No se ejecutaron pruebas (se registra explícitamente).  
- Rama: `F_PEREA`, working tree limpio antes/tras creación de archivos.
