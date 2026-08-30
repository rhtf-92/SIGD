**Revisor:** Cristian (B_CHRISTIAN)
**Documento revisado:** "Guion Corregido: DocuCore - Explicación Rápida (3 min)" — Versión 1.4
**Autor del guion:** Valentín (B_VALENTIN)
**Fecha de revisión:** 28 de agosto de 2026
**Estado general:** ✅ Aprobado — las mejoras de este informe son opcionales y no bloquean el arranque del modelo de datos

---

## Contexto

Las 4 correcciones bloqueantes solicitadas anteriormente (ERR-01 a ERR-04) quedaron resueltas correctamente en esta versión. Este informe cubre únicamente **2 mejoras menores** detectadas durante la verificación, que no impiden avanzar pero conviene dejar registradas para no perderlas de vista.

---

## MEJ-01 — Redundancia entre "Separación de Estados" y "Trazabilidad de Subsanación"

**Ubicación:** Sección 3, primer y segundo bullet.

Al corregir ERR-01, el bullet "Separación de Estados" pasó a explicar el mismo ciclo de vida del archivo (`OBSERVADO` → `REEMPLAZADO`/`CARGADO`) que ya cuenta el bullet "Trazabilidad de Subsanación" justo después. Antes eran complementarios; ahora se superponen.

**Sugerencia:** fusionar ambos bullets en uno solo, o dejar que "Separación de Estados" se quede solo con la idea general (Requisito = aprobación del trámite; Adjunto = condición del archivo) y que todo el detalle del ciclo `OBSERVADO → REEMPLAZADO/CARGADO` viva únicamente en "Trazabilidad de Subsanación".

**Prioridad:** baja — es una mejora de redacción, no afecta el modelo de datos.

---

## MEJ-02 — Falta definir la sincronización entre el estado del Requisito y el estado del Adjunto

**Ubicación:** Sección 2 (Pilares 2 y 3).

Tanto `EXPEDIENTE_REQUISITO` como `ARCHIVO_ADJUNTO` tienen un estado llamado `OBSERVADO`, pero en niveles distintos (uno a nivel del requisito completo, otro a nivel del archivo específico). El documento no especifica la relación entre ambos:

- ¿Cuándo el Adjunto pasa a `OBSERVADO`, el `EXPEDIENTE_REQUISITO` cambia automáticamente también a `OBSERVADO`?
- ¿Cuándo el usuario sube el v2 (`CARGADO`), el requisito pasa directo a `SUBSANADO`, o necesita que el evaluador lo revise de nuevo antes de llegar a `APROBADO`?

**Qué se necesita:** una regla explícita (puede ser una tabla corta de "estado del Adjunto → efecto en el estado del Requisito") para que Cristian pueda definir correctamente los triggers o restricciones entre ambas tablas del modelo.

**Prioridad:** media — no bloquea el inicio del modelado, pero sí debería resolverse antes de que Cristian defina las relaciones y restricciones entre `EXPEDIENTE_REQUISITO` y `ARCHIVO_ADJUNTO`.

---

## Próximos pasos sugeridos

1. Registrar MEJ-01 y MEJ-02 en `07_decisiones_y_preguntas_pendientes.md` como tareas de seguimiento (no bloqueantes).
2. Resolver MEJ-02 antes de que Cristian llegue a la etapa de definir relaciones/restricciones entre `EXPEDIENTE_REQUISITO` y `ARCHIVO_ADJUNTO` en el modelo de datos.
3. MEJ-01 se puede aplicar en cualquier momento, incluso después de iniciado el modelado, ya que es solo de redacción.
4. Cristian puede iniciar el diseño del modelo de datos con la base actual (guion v1.4), sin esperar a que se resuelvan estas dos mejoras.