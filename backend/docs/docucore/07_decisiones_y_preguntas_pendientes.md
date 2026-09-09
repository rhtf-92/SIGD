07. Decisiones y Preguntas Pendientes

Autor: Cristian

Rama Git: B_CHRISTIAN

Fecha: 29 de agosto de 2026

1. Decisiones tomadas por Cristian (durante el modelado)

D-01 — USUARIO como referencia externa al módulo DocuCore.

Se decidió que USUARIO no será una tabla propia de DocuCore, debido a que la gestión de usuarios, identidad, roles y permisos corresponde a un módulo externo del SIGD. Por ello, los campos id_usuario_creador, id_usuario_solicitante e id_evaluador utilizados por las entidades de DocuCore serán identificadores provenientes del sistema externo y no tendrán una restricción REFERENCES hacia una tabla USUARIO local. La existencia y validez del usuario será responsabilidad del sistema central correspondiente.

D-02 — EXPEDIENTE se mantiene como entidad local de DocuCore, con justificación.

Se decidió mantener EXPEDIENTE como tabla propia de DocuCore porque, dentro del alcance actual, este módulo gestiona el ciclo de vida documental del expediente y necesita controlar directamente su estado, formulario aplicado, requisitos y archivos adjuntos. Esta decisión evita que DocuCore dependa de un módulo externo para las operaciones que forman parte de su flujo documental. La decisión queda formalizada como parte del modelo y no como una dependencia implícita.

D-03 — Versionado de FORMULARIO para conservar la trazabilidad histórica.

Se reemplaza la decisión anterior CAM-01. El versionado de FORMULARIO se establece ahora como una decisión formal del modelo, justificada por la necesidad de conservar la configuración exacta utilizada por cada expediente.

Cada modificación relevante del formulario deberá generar una nueva versión, sin alterar la versión que ya fue utilizada por expedientes existentes. EXPEDIENTE mantiene una relación directa con el FORMULARIO específico utilizado, permitiendo identificar la versión aplicada al momento de crear el trámite. De esta manera, las respuestas históricas de VALOR_CAMPO continúan interpretándose con los campos y reglas correspondientes a la versión original.

D-04 — TIPO_DOCUMENTO_REQUISITO en vez de vincular EXPEDIENTE_REQUISITO directo a REQUISITO.

Se agregó la tabla intermedia TIPO_DOCUMENTO_REQUISITO porque un mismo requisito (ej. "DNI") puede tener distinta obligatoriedad según el tipo de documento. Sin esta tabla, no habría dónde guardar esa diferencia ni la condición de activación de un requisito condicional (RN-REQ-002).

D-05 — Restricciones cruzadas (peso máximo, conteo de archivos, propagación de estado) se dejan para trigger o aplicación, no CHECK de columna.

Un CHECK de PostgreSQL no puede validar contra otra tabla ni contar filas relacionadas. Se documentaron como reglas pendientes de implementar por Piero (ver Sección 4 de 03_modelo_datos.md).

D-06 — Rutas documentales revisadas.

Se revisaron las rutas documentales utilizadas para referenciar archivos del repositorio, verificando que las referencias correspondan con la estructura y ubicación esperada de los documentos. Esta revisión incluye las referencias a documentos .md y archivos de diagramas utilizados por el modelo.

2. Supuestos utilizados
Se asume que TRAMITE_PLANTILLA (mencionada en la especificación de Valentín) y TIPO_DOCUMENTO (descrita por Azareño) son la misma entidad. Se modeló una sola vez. Pendiente de confirmación formal — ver P-01.
Se asume que un EXPEDIENTE solo puede tener un usuario solicitante (no un trámite iniciado en conjunto por varias personas).
Se asume que cada EXPEDIENTE conserva la referencia al FORMULARIO y a la versión concreta utilizada al momento de su creación. Las versiones de formulario utilizadas por expedientes existentes no deben modificarse; los cambios generan una nueva versión.
3. Propuestas técnicas (heredadas de Valentín, no confirmadas institucionalmente)

Se mantienen marcadas con 🔧 en el modelo: ruta_storage, hash_sha256, version_num, id_adjunto_anterior en ARCHIVO_ADJUNTO. Son necesarias para que el modelo funcione tal como está diseñado, pero dependen de que la institución confirme la estrategia de almacenamiento externo (Object Storage) en vez de guardar archivos como BLOB.

4. Preguntas pendientes de confirmar con el profesor / la institución

P-01 (bloqueante para Piero, prioridad alta): ¿TRAMITE_PLANTILLA es la misma entidad que TIPO_DOCUMENTO, o son dos conceptos distintos? Afecta directamente si Piero debe crear una tabla o dos.

P-02: ¿Un formulario puede reutilizarse entre varios tipos de documento? La relación actual se mantiene en 1:1, pero el formulario está versionado para conservar la trazabilidad histórica de los expedientes.

P-03: ¿Cuál es la lista oficial de tipos de documento? Define si el catálogo final se parece a los ejemplos de Azareño (académico) o a los de Valentín (municipal) — no cambia el modelo, pero sí los datos de prueba que Piero use.

P-04: ¿A quién corresponde formalizar los casos EX-008 (campo obligatorio vacío) y EX-009 (formulario/plantilla inactivo) — a Azareño (verificación inicial del formulario) o a Valentín (matriz de excepciones)? Ninguno de los dos documentos los tiene formalizados todavía.

P-05 (heredada de Valentín): tope máximo global de MB por expediente.

P-06 (heredada de Valentín): ¿se permiten archivos .ZIP/.RAR en requisitos múltiples, o deben descomprimirse antes de subir?

P-07 (heredada de Valentín): ¿el módulo debe validar firma digital PKI dentro del PDF, o se acepta el archivo y la firma se revisa visualmente?

P-08 (heredada de Valentín): plazo (SLA) en días hábiles para subsanar un requisito observado antes del rechazo automático por caducidad.

P-09 (heredada de Valentín): confirmación final del proceso de limpieza de archivos huérfanos (expedientes en BORRADOR sin radicar).

P-10 (heredada de Valentín): caso de borde — ¿qué pasa con el archivo ya subido de un requisito condicional si el usuario cambia su respuesta y el requisito deja de aplicar? (No resuelto en el modelo actual: el archivo quedaría huérfano de un requisito ya inactivo.)