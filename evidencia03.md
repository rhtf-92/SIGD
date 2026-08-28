# Guion Corregido: DocuCore - Explicación Rápida (3 min)
### Versión 1.5 — Ajustes menores tras verificación de Cristian (B_CHRISTIAN)

**Autor:** Valentín (`B_VALENTIN`)

---

## 1. El Objetivo Principal (¿Qué estamos haciendo?)

"Estamos definiendo la especificación técnica de DocuCore, el módulo encargado de gestionar todos los requisitos y archivos adjuntos de los trámites. El objetivo es que Cristian pueda diseñar la base de datos de forma exacta, sin asumir reglas y dejando todo preparado para auditoría completa y subsanaciones."

## 2. Los 3 Pilares del Modelo (¿Cómo se organiza?)

1. **Catálogo (`REQUISITO`):** Las reglas base que configura el sistema (pesos máximos, formatos permitidos, si es obligatorio u opcional, si requiere fecha de vencimiento y si permite subida múltiple).

2. **Instancia por Trámite (`EXPEDIENTE_REQUISITO`):** La regla aplicada a la persona que tramita. Aquí controlamos el estado global del requisito (`PENDIENTE`, `OBSERVADO`, `SUBSANADO`, `APROBADO`), quién lo evaluó y cuándo.

3. **Archivos Físicos (`ARCHIVO_ADJUNTO`):** El documento real subido. Maneja las versiones (v1, v2), la ruta física en el almacenamiento, la deduplicación de espacio y el borrado lógico. *(nota — MEJ-02)* Este estado es independiente del estado del Requisito: uno describe el archivo puntual, el otro el trámite completo. La relación entre ambos se detalla en la sección 4.

## 3. Las 3 Reglas de Negocio Clave (Lo más importante para Backend)

*(fusionado — MEJ-01: se combinaron "Separación de Estados" y "Trazabilidad de Subsanación", que describían el mismo ciclo con distinto nivel de detalle)*

- **Ciclo de Vida y Trazabilidad del Adjunto:** El Requisito mide si el trámite se puede aprobar; el Adjunto mide la condición de cada archivo individual — son dos niveles distintos. Cuando el evaluador rechaza un archivo, el v1 queda en `OBSERVADO`. Cuando el usuario sube el reemplazo, el sistema no borra nada: el v1 pasa a `REEMPLAZADO` (queda congelado como historial), el v2 nace en `CARGADO`, y ambos quedan enlazados explícitamente (`id_adjunto_anterior`) para no perder el rastro de versiones.

- **Seguridad y Espacio (Storage):**
  - **Nombre Único:** Estándar sin ambigüedades en la nube: `TRM_[EXP]_EXPREQ_[ID]_V[VER]_[TIMESTAMP].[EXT]`, incluyendo siempre la extensión real del archivo.
  - **Deduplicación:** Si un usuario sube el mismo archivo en dos requisitos distintos, el sistema detecta el hash repetido y **pide confirmación** antes de reutilizar el archivo físico existente — nunca es automático ni silencioso. Si el duplicado ocurre **dentro del mismo requisito**, la subida se bloquea directamente, sin pedir confirmación.
  - **Validación Real (Magic Bytes):** No confiamos en la extensión `.pdf` del nombre; el backend lee la cabecera del archivo para evitar virus o archivos falsos.

- **Manejo de Borrados y Concurrencia:** Los archivos nunca se borran físicamente; se usa borrado lógico (`ELIMINADO`). Para el conflicto entre `403` y `409` cuando el evaluador interviene mientras el usuario sube un archivo, ya hay un orden de precedencia definido: primero se revisa si el expediente sigue editable (`403` si no); solo si seguía editable, se revisa si cambió de estado durante la subida (`409` en ese caso). Decisión registrada en `07_decisiones_y_preguntas_pendientes.md`.

## 4. Sincronización entre el Estado del Requisito y el Estado del Adjunto
*(nuevo — MEJ-02)*

Ambas entidades usan el valor `OBSERVADO`, pero describen cosas distintas. Esta tabla deja explícita la relación entre los dos niveles, para que Cristian pueda definir los triggers/restricciones correctos:

| Evento en `ARCHIVO_ADJUNTO` | Efecto automático en `EXPEDIENTE_REQUISITO` |
|---|---|
| El evaluador marca un archivo activo como `OBSERVADO` | El requisito pasa a `OBSERVADO` (basta con que 1 archivo activo esté observado — RN-REQ-005) |
| El usuario sube el reemplazo y este queda `CARGADO` (v2) | El requisito pasa a `SUBSANADO` — **no** salta directo a `APROBADO`; requiere revisión del evaluador |
| El evaluador revisa el v2 y lo marca `APROBADO` | El requisito pasa a `APROBADO` (si todos sus archivos activos ya están aprobados) |
| El evaluador vuelve a rechazar el v2 | El requisito regresa a `OBSERVADO`, reiniciando el ciclo |

En resumen: el estado del Requisito **se deriva** del estado de sus archivos activos — el evaluador nunca cambia el estado del Requisito directamente, lo hace indirectamente al evaluar cada Adjunto.

## 5. ¿Por qué este documento es un buen punto de partida (y qué falta)?

"Resolvimos 17 puntos críticos de inconsistencia: vacíos en la máquina de estados, el manejo de requisitos opcionales, la trazabilidad de versiones y evaluadores, y el tope de almacenamiento por expediente. *(el detalle completo queda como anexo de trazabilidad, aparte de esta presentación de 3 minutos)*. Con esto, Cristian tiene una base sólida para empezar a modelar.

Aún quedan pendientes algunos puntos que **no bloquean el arranque, pero sí hay que resolver pronto**:
- Tres preguntas institucionales: validación de contenido de archivos `.ZIP`, firmas digitales PKI, y el plazo (SLA) de subsanación antes de rechazo automático.
- El proceso de limpieza automática de archivos huérfanos — ya reincorporado en la especificación técnica, pendiente solo de confirmación final.
- Un caso de borde: qué pasa con el archivo subido para un requisito condicional si el usuario cambia su respuesta y el requisito deja de aplicar.
- La entidad `TRAMITE_PLANTILLA`, ya con nota de procedencia, pero pendiente de confirmar sus campos definitivos.
