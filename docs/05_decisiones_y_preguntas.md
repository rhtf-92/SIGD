# 07. Decisiones y Preguntas Pendientes

**Autor:** Cristian
**Rama Git:** `B_CHRISTIAN`
**Fecha:** 29 de agosto de 2026

---

## 1. Decisiones tomadas por Cristian (durante el modelado)

**D-01 — Rol de usuario como atributo enum, no como catálogo separado.**
Se modeló `USUARIO.rol` como un único campo enum (`ADMINISTRADOR`, `SOLICITANTE`, `EVALUADOR`, `CONSULTANTE`) en vez de crear una tabla `ROL` aparte con relación muchos-a-muchos. Es más simple para el alcance actual del proyecto. Si en el futuro un mismo usuario necesita tener más de un rol a la vez, este diseño tendría que cambiar a una tabla intermedia `USUARIO_ROL`.

**D-02 — Relación 1:1 entre `TIPO_DOCUMENTO` y `FORMULARIO`.**
Azareño dejó como pregunta pendiente si un formulario puede reutilizarse entre distintos tipos de documento. Mientras no haya respuesta, se modeló como 1:1 (cada tipo de documento tiene su propio formulario) por ser el caso más simple y el que no pierde información si luego se confirma que sí deben ser reutilizables — pasar de 1:1 a 1:N es un cambio menor; lo contrario habría sido más costoso de deshacer.

**D-03 — `TIPO_DOCUMENTO_REQUISITO` en vez de vincular `EXPEDIENTE_REQUISITO` directo a `REQUISITO`.**
Se agregó la tabla intermedia `TIPO_DOCUMENTO_REQUISITO` porque un mismo requisito (ej. "DNI") puede tener distinta obligatoriedad según el tipo de documento. Sin esta tabla, no habría dónde guardar esa diferencia ni la condición de activación de un requisito condicional (RN-REQ-002).

**D-04 — Restricciones cruzadas (peso máximo, conteo de archivos, propagación de estado) se dejan para trigger o aplicación, no CHECK de columna.**
Un `CHECK` de PostgreSQL no puede validar contra otra tabla ni contar filas relacionadas. Se documentaron como reglas pendientes de implementar por Piero (ver Sección 4 de `03_modelo_datos.md`).

---

## 2. Supuestos utilizados

- Se asume que `TRAMITE_PLANTILLA` (mencionada en la especificación de Valentín) y `TIPO_DOCUMENTO` (descrita por Azareño) son la **misma entidad**. Se modeló una sola vez. **Pendiente de confirmación formal** — ver P-01.
- Se asume que un `EXPEDIENTE` solo puede tener un `USUARIO` solicitante (no un trámite iniciado en conjunto por varias personas).
- Se asume que los campos de formulario (`CAMPO_FORMULARIO`) no cambian una vez que un expediente ya tiene valores cargados (no se versiona el formulario en este modelo; si se necesita, requeriría agregar un campo de versión a `VALOR_CAMPO`).

---

## 3. Propuestas técnicas (heredadas de Valentín, no confirmadas institucionalmente)

Se mantienen marcadas con 🔧 en el modelo: `ruta_storage`, `hash_sha256`, `version_num`, `id_adjunto_anterior` en `ARCHIVO_ADJUNTO`. Son necesarias para que el modelo funcione tal como está diseñado, pero dependen de que la institución confirme la estrategia de almacenamiento externo (Object Storage) en vez de guardar archivos como `BLOB`.

---

## 4. Preguntas pendientes de confirmar con el profesor / la institución

**P-01 (bloqueante para Piero, prioridad alta):** ¿`TRAMITE_PLANTILLA` es la misma entidad que `TIPO_DOCUMENTO`, o son dos conceptos distintos? Afecta directamente si Piero debe crear una tabla o dos.

**P-02:** ¿Un formulario puede reutilizarse entre varios tipos de documento? (Ver decisión D-02 — hoy modelado como 1:1.)

**P-03:** ¿Cuál es la lista oficial de tipos de documento? Define si el catálogo final se parece a los ejemplos de Azareño (académico) o a los de Valentín (municipal) — no cambia el modelo, pero sí los datos de prueba que Piero use.

**P-04:** ¿A quién corresponde formalizar los casos EX-008 (campo obligatorio vacío) y EX-009 (formulario/plantilla inactivo) — a Azareño (verificación inicial del formulario) o a Valentín (matriz de excepciones)? Ninguno de los dos documentos los tiene formalizados todavía.

**P-05 (heredada de Valentín):** tope máximo global de MB por expediente.

**P-06 (heredada de Valentín):** ¿se permiten archivos `.ZIP`/`.RAR` en requisitos múltiples, o deben descomprimirse antes de subir?

**P-07 (heredada de Valentín):** ¿el módulo debe validar firma digital PKI dentro del PDF, o se acepta el archivo y la firma se revisa visualmente?

**P-08 (heredada de Valentín):** plazo (SLA) en días hábiles para subsanar un requisito observado antes del rechazo automático por caducidad.

**P-09 (heredada de Valentín):** confirmación final del proceso de limpieza de archivos huérfanos (expedientes en `BORRADOR` sin radicar).

**P-10 (heredada de Valentín):** caso de borde — ¿qué pasa con el archivo ya subido de un requisito condicional si el usuario cambia su respuesta y el requisito deja de aplicar? (No resuelto en el modelo actual: el archivo quedaría huérfano de un requisito ya inactivo.)

---

## 5. Próximos pasos

1. Resolver P-01 antes de que Piero cree las tablas — es la única pregunta que cambia la estructura del modelo, no solo los datos.
2. Piero puede empezar con el resto del modelo mientras se resuelve P-01, dejando `TIPO_DOCUMENTO` como está.
3. Registrar aquí la resolución de cada pregunta a medida que se confirme, con fecha.
