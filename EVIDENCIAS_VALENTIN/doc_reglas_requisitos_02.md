## 1. El Objetivo Principal (¿Qué estamos haciendo?)

"Estamos definiendo la especificación técnica de DocuCore, el módulo encargado de gestionar todos los requisitos y archivos adjuntos de los trámites. El objetivo es que Cristian pueda diseñar la base de datos de forma exacta, sin asumir reglas y dejando todo preparado para auditoría completa y subsanaciones."

## 2. Los 3 Pilares del Modelo (¿Cómo se organiza?)

1. **Catálogo (`REQUISITO`):** Las reglas base que configura el sistema (pesos máximos, formatos permitidos, si es obligatorio u opcional, si requiere fecha de vencimiento y si permite subida múltiple).

2. **Instancia por Trámite (`EXPEDIENTE_REQUISITO`):** La regla aplicada a la persona que tramita. Aquí controlamos el estado del requisito (`PENDIENTE`, `OBSERVADO`, `SUBSANADO`, `APROBADO`), quién lo evaluó y cuándo.

3. **Archivos Físicos (`ARCHIVO_ADJUNTO`):** El documento real subido. Maneja las versiones (v1, v2), la ruta física en el almacenamiento, la deduplicación de espacio y el borrado lógico.

## 3. Las 4 Reglas de Negocio Clave (Lo más importante para Backend)

- **Separación de Estados:** El Requisito mide si el trámite se puede aprobar o no; el Adjunto mide la versión del archivo (v1 observada, v2 cargada).

- **Trazabilidad de Subsanación (Historial):** Si un evaluador observa un documento, el usuario sube uno nuevo. El sistema no borra el anterior: marca el v1 como `REEMPLAZADO`, sube el v2 como `CARGADO` y los enlaza explícitamente (`id_adjunto_anterior`).

- **Seguridad y Espacio (Storage):**
  - **Nombre Único:** Se crea un estándar sin ambigüedades en la nube: `TRM_[EXP]_EXPREQ_[ID]_V[VER]_[TIMESTAMP]`.
  - **Deduplicación:** Si un usuario sube el mismo archivo en dos requisitos distintos, la base de datos crea dos registros independientes, pero el servidor guarda un solo archivo físico usando su huella digital (`SHA-256`). *Ojo: si el duplicado ocurre dentro del mismo requisito, la subida se bloquea directamente (no se permite continuar).*
  - **Validación Real (Magic Bytes):** No confiamos en la extensión `.pdf` del nombre; el backend lee la cabecera del archivo para evitar virus o archivos falsos.

- **Manejo de Borrados y Concurrencia:** Los archivos nunca se borran físicamente si se equivoca el usuario; se usa borrado lógico (`ELIMINADO`). Además, si el evaluador entra a revisar mientras el usuario está subiendo un archivo, el sistema debe bloquear la subida para no romper el estado. *Nota para Cristian: hoy tenemos dos reglas que cubren este mismo escenario con dos respuestas distintas (`403` y `409`) — hay que decidir en esta reunión cuál prevalece antes de implementar.*

## 4. ¿Por qué este documento es un buen punto de partida (y qué falta)?

"Resolvimos 17 puntos críticos de inconsistencia: vacíos en la máquina de estados, el manejo de requisitos opcionales, la trazabilidad de versiones y evaluadores, y el tope de almacenamiento por expediente. Con esto, Cristian tiene una base sólida para empezar a modelar la base de datos.

Aún quedan pendientes algunos puntos que **no bloquean el arranque, pero sí hay que resolver pronto**:
- Tres preguntas institucionales sin respuesta: validación de contenido de archivos `.ZIP`, firmas digitales PKI, y el plazo (SLA) de subsanación antes de rechazo automático.
- El proceso de limpieza automática de archivos huérfanos (trámites en `BORRADOR` sin radicar) que teníamos definido en la primera versión, y que hay que confirmar si sigue vigente o se descartó.
- Un caso de borde: qué pasa con el archivo subido para un requisito condicional si el usuario cambia su respuesta y el requisito deja de aplicar.
- La entidad `TRAMITE_PLANTILLA`, que se menciona para el tope global de almacenamiento, necesita confirmarse si ya existe o si Cristian debe crearla.

Ninguno de estos impide que Cristian empiece hoy, pero sí conviene dejarlos como tareas asignadas con fecha, para no perderlos de vista."

---

**Cambios aplicados:** se retiró la mención de la limpieza de huérfanos como algo ya resuelto (ahora aparece como pendiente a confirmar), se suavizó el cierre para no prometer un modelo "sin riesgo de rediseño", se añadió la aclaración del caso bloqueado en deduplicación, y se incluyó una nota explícita sobre el conflicto 403/409 para que se resuelva en la misma reunión.