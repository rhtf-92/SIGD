2. Reglas TUPA y Admisibilidad — DocuCore v2.0
Sistema: Sistema Integral de Gestión Documentaria (SIGD)

Módulo: DocuCore — Documentos, Requisitos y Formularios (Grupo 5)

Fase: 2 — JSON Schema, PostgreSQL JSONB y Storage S3/MinIO

Autor: Valentín · Analista de Requisitos TUPA (B_VALENTIN)

Destinatario: Cristian · Sublíder y Modelador (B_CHRISTIAN)

Entregable: backend/docs/levantamiento_de_observaciones/02_reglas_tupa_admisibilidad_v2.md

Fecha: 30 de agosto de 2026

Versión: 2.3 — Correcciones normativas y de consistencia tras segunda revisión de Cristian

0. Control de Cambios
Historial resumido
v2.0 → v2.1: se incorporaron las reglas heredadas de Fase 1, se eliminó lo que ya no correspondía a este documento, y se agregó el catálogo TUPA.

v2.1 → v2.2: se corrigieron rigidez de plazos, reclasificación de PDF/A, contradicción de formatos, automatización de SAN, y estructura de preguntas pendientes.

v2.2 → v2.3 (esta versión)
#	Corrección	Resultado
1	Ley N.° 29060 citada como vigente	Aplicada. Eliminada del marco legal — fue derogada por el D. Leg. N.° 1272 (2016), que incorporó el régimen de silencio administrativo a la propia Ley 27444.
2	Precisar el TUO vigente	Aplicada. Se especifica D.S. N.° 006-2026-JUS, precisando su vigencia desde el 1 de mayo de 2026.
3	Referencia legal de subsanación	Validada contra el TUO vigente; se mantiene el Art. 125.
4	Sección de discrepancia (antigua sección 12)	Eliminada.
5	RN-FMT-003 contradecía a RN-FMT-001	Aplicada. Reclasificada de [CONFIRMADO] a [PROPUESTO / PENDIENTE].
6	Ejemplo de flujo asumía PDF/A como si ya fuera obligatorio	Aplicada. Reescrito en términos neutros (sección 10, paso 2).
7	RN-REQ-003 y EX-006 no eran consistentes entre sí	Aplicada. RN-REQ-003 ahora remite directamente al efecto de EX-006 (OBSERVADO).
8	RN-FMT-002 etiquetada como "modificado" en vez de solo [PROPUESTO]	Aplicada.
9	Definición de "No TUPA" sonaba a conclusión jurídica	Aplicada. Redactada como alcance interno del catálogo, no como afirmación legal.
10	Ejemplo del "día 11" simplificaba el cómputo del SAP	Aplicada. Generalizado sin fijar un número de día concreto.
11	Revisar uso de [CONFIRMADO] en reglas heredadas	Ver nota aclaratoria al inicio de la sección 5.
12	Priorización de preguntas pendientes	Aplicada. Columna de prioridad agregada en sección 11.
1. Contexto y Propósito
Este documento define las reglas de negocio, el catálogo y las reglas de admisibilidad que DocuCore debe aplicar para clasificar cada trámite según su naturaleza TUPA y validar sus adjuntos, consolidando lo que sigue vigente de la Fase 1 (02_reglas_requisitos_adjuntos.md v1.2) con lo nuevo que exige la Fase 2.

Es insumo funcional para las entidades requisito_tupa y (parcialmente) tipo_documento, que Cristian modela en 03_modelo_datos_docucore_v2.md. Este documento no define columnas ni tipos de dato de tabla física — solo reglas de negocio y catálogo conceptual, tal como corresponde al rol de Analista de Requisitos TUPA.

2. Taxonomía de Certeza
Etiqueta	Significado
CONFIRMADO	Existe una norma externa verificada, o una decisión institucional/del proyecto ya aprobada formalmente.
PROPUESTO	El equipo diseñó el comportamiento, pero todavía falta aprobación institucional o de arquitectura.
PENDIENTE	Falta una decisión externa, información institucional, o aprobación legal específica.
EJEMPLO	Valor ilustrativo para dar contexto, no es un dato definitivo.
3. Marco Legal de Referencia
Nota sobre la versión del TUO citada: salvo que se indique lo contrario, toda referencia a "TUO de la Ley N.° 27444" en este documento corresponde al texto aprobado por el Decreto Supremo N.° 006-2026-JUS, publicado el 30 de abril de 2026. Precisión importante: el D.S. N.° 006-2026-JUS entró en vigencia el 1 de mayo de 2026 (al día siguiente de su publicación), derogando el anterior D.S. N.° 004-2019-JUS. Por tanto, a la fecha de este documento (30 de agosto de 2026), es la norma formalmente aplicable.

Norma	Relevancia para DocuCore	Estado
TUO de la Ley N.° 27444, Art. 30 y 37	Clasifica todo procedimiento en Aprobación Automática o Evaluación Previa (SAP/SAN); presunción supletoria de SAN si no hay indicación expresa. El régimen de silencio administrativo está incorporado a este texto desde el D. Leg. N.° 1272 (2016).	Confirmado
TUO de la Ley N.° 27444, Art. 125 — "Observaciones a documentación presentada"	Art. 125.1: plazo máximo de 2 días hábiles para subsanar defectos de forma. Art. 125.3: mientras la subsanación está pendiente, no corre el cómputo de plazos para el silencio administrativo. Art. 125.4: si vence sin subsanar, se considera no presentada y corresponde reembolso. Sustenta RN-ADM-002.	Confirmado
TUO de la Ley N.° 27444, Art. 40 — "Documentación prohibida de solicitar"	Prohíbe exigir documentos que la entidad ya posee o emitió. Sustenta la nota de sobre-exigencia en RN-ADM-003.	Confirmado
TUO de la Ley N.° 27444, Art. 160 — Acumulación de procedimientos administrativos	Permite —de forma facultativa, no obligatoria— que la entidad acumule en un solo expediente procedimientos conexos entre sí. Relevante solo si DocuCore llegara a soportar la fusión de expedientes en una fase futura; no genera ninguna regla activa hoy (ver nota de alcance abajo).	Confirmado (verificado con jurisprudencia TFL-SUNAFIL, Res. 387-2021)
D. Leg. N.° 1412, Ley de Gobierno Digital	Da equivalencia legal entre canales digitales y presenciales.	Confirmado
Modelo de Gestión Documental — MGD (Res. de Secretaría de Gobierno Digital N.° 001-2017-PCM/SEGDI, en el marco del D. Leg. N.° 1310)	Establece los lineamientos nacionales para digitalización, trazabilidad, conservación e interoperabilidad de documentos electrónicos (vía la PIDE). Precisión importante: regula gestión documental digital en general — no define la calificación administrativa del trámite (eso es el Art. 30). No es fuente de la clasificación TUPA.	Confirmado
D.S. N.° 001-2000-JUS	Reglamento nacional sobre uso de tecnologías avanzadas en archivo de documentos (Sistema Nacional de Archivos / AGN). Respaldo normativo general de digitalización, no mandato específico de PDF/A.	Confirmado
Principio de Informalismo (TUO Ley 27444, Título Preliminar 1.6)	Fundamento general detrás del Art. 125.	Confirmado
Nota de alcance sobre el Art. 160: se documenta por completitud normativa, pero no genera ninguna regla de negocio activa en este documento — DocuCore v2.0 no contempla todavía la acumulación de expedientes como funcionalidad.

4. Catálogo de Trámites TUPA y No TUPA
4.1. Definición Operativa [CONFIRMADO]
Trámite TUPA: procedimiento administrativo formal que la institución está legalmente obligada a listar en su Texto Único de Procedimientos Administrativos, con requisitos, plazos y costos oficiales.

Trámite No TUPA (Servicio Interno): solicitud interna que, para efectos del catálogo de DocuCore, no corresponde a un procedimiento administrativo incluido en el TUPA institucional. (Redacción ajustada: esto describe el alcance del sistema, no una conclusión jurídica sobre si la solicitud tiene o no garantías legales — esa determinación excede lo que DocuCore puede afirmar por sí solo.)

4.2. Calificación Administrativa [CONFIRMADO]
Calificación	Descripción	Silencio Administrativo
APROBACION_AUTOMATICA	Aprobada desde la presentación, sujeta a fiscalización posterior.	No aplica
EVALUACION_PREVIA_SAP	La entidad resuelve; si no lo hace a tiempo, se entiende aprobada.	Positivo
EVALUACION_PREVIA_SAN	La entidad resuelve; si no lo hace a tiempo, se entiende denegada.	Negativo
Regla de presunción RN-TUPA-001 [CONFIRMADO el hecho legal / PENDIENTE la automatización]: el hecho de que la ley presuma EVALUACION_PREVIA_SAN cuando el TUPA no especifica el tipo de silencio (Art. 37) está confirmado y verificado. Lo que no debe automatizarse ciegamente es que el sistema le asigne ese valor por defecto a cualquier trámite nuevo sin revisión: cada entrada de TIPO_TRAMITE_TUPA debe declarar su tipo de silencio de forma explícita, validado contra el TUPA real y con visto bueno del área legal/administrativa, antes de publicarse como trámite activo. El flujo recomendado es: crear trámite → definir calificación → definir SAP/SAN → validar contra el TUPA oficial → aprobación institucional → publicar — nunca crear trámite → asignar SAN automáticamente → publicar.

4.3. Catálogo Conceptual — TIPO_TRAMITE_TUPA
Nota: se listan los atributos que este catálogo necesita conceptualmente. Cristian decide el tipo de dato físico y si esto se modela como tabla requisito_tupa/tipo_documento o como ambas relacionadas.

Código TUPA oficial (o nulo si es No TUPA).

Denominación del trámite.

Indicador de si es TUPA formal o servicio interno.

Calificación administrativa (una de las tres categorías de la sección 4.2).

Plazo máximo en días hábiles (solo evaluación previa).

Costo oficial del trámite.

Unidad orgánica responsable.

Base legal que sustenta el trámite.

Indicador de vigencia (activo/desactivado).

4.4. Matriz Ilustrativa de Trámites [EJEMPLO]
⚠️ Los nombres de trámite están basados en categorías reales verificadas en TUPAs vigentes de otros IESTP del Perú. Los códigos, plazos y montos son inventados. Este catálogo no está listo para cargarse como información real — todavía faltan el código oficial, nombre oficial, plazo oficial, costo oficial, clasificación, base legal y unidad responsable reales del IESTP "Suiza" (ver pregunta pendiente #1).

Código (ejemplo)	Denominación (categoría real observada)	Calificación	Plazo	Costo
TUPA-001	Constancia de Matrícula	Aprobación Automática	—	S/ 15.00
TUPA-002	Constancia de Egresado / Notas / Estudios	Aprobación Automática	—	S/ 15.00
TUPA-003	Certificado de Estudios	Evaluación Previa (SAP)	10 días	S/ 25.00
TUPA-004	Certificado Modular	Evaluación Previa (SAP)	10 días	S/ 30.00
TUPA-005	Convalidación de Estudios	Evaluación Previa (SAN)	30 días	S/ 40.00
TUPA-006	Traslado Interno / Externo	Evaluación Previa (SAN)	30 días	S/ 40.00
TUPA-007	Rectificación de Datos del Alumno	Evaluación Previa (SAP)	5 días	S/ 10.00
TUPA-008	Título Profesional Técnico	Evaluación Previa (SAN)	30 días	S/ 40.00
N/A	Solicitud Informativa Interna	No TUPA	—	Gratuito
5. Reglas de Negocio Heredadas de la Fase 1 (Vigentes)
Estas reglas no dependen del mecanismo de almacenamiento (JSONB/S3) — son lógica de negocio pura y se mantienen sin cambios de fondo respecto a 02_reglas_requisitos_adjuntos.md v1.2.

Aclaración sobre la etiqueta [CONFIRMADO] en esta sección: ninguna de estas reglas proviene de una norma legal externa — son decisiones de negocio ya aprobadas por el equipo del proyecto en la Fase 1 (no propuestas nuevas a la espera de aprobación). Bajo la taxonomía de la sección 2, esto sí califica como [CONFIRMADO] ("decisión institucional/del proyecto ya aprobada formalmente"), distinto de una regla que dependa de una norma externa. Los valores de estado (CARGADO, OBSERVADO, SUBSANADO, APROBADO) son terminología del modelo funcional propio de DocuCore, no categorías impuestas por la Ley 27444 — se marcan confirmados en tanto ya fueron aprobados como diseño del proyecto, no porque la ley los exija.

RN-REQ-001 (Clasificación de Obligatoriedad) [CONFIRMADO]: todo requisito se clasifica en OBLIGATORIO, OPCIONAL o CONDICIONAL.

RN-REQ-002 (Lógica de Condicionalidad Dinámica) [CONFIRMADO]: un requisito condicional se activa como obligatorio cuando un atributo del formulario alcanza un valor desencadenante (ej. Tipo_Solicitante = "Persona Jurídica" activa "Vigencia de Poder"). Nota técnica: en la Fase 2 esta lógica se expresa como bloque if/then de JSON Schema — ver 01_analisis_json_schema_storage_s3.md, sección 4, pero la regla de negocio en sí no cambia.

RN-REQ-003 (Control de Antigüedad y Vigencia) [CONFIRMADO]: si Requiere_Vigencia está habilitado, se exige fecha de emisión y se calcula la antigüedad contra Dias_Vigencia_Maximos. Si se excede, el requisito queda marcado como OBSERVADO conforme a EX-006 y sujeto a evaluación — no se trata de una simple alerta informativa, es un cambio de estado real que bloquea el avance hasta revisión del evaluador. (Redacción alineada con EX-006 para eliminar la inconsistencia entre "alerta" y "observación".)

RN-REQ-004 (Secuencia Ordinal de Presentación) [CONFIRMADO]: los requisitos se muestran ordenados ascendentemente por Orden_Presentacion.

RN-REQ-005 (Multiplicidad y Sincronización de Estados) [CONFIRMADO]: el requisito pasa a CARGADO con ≥1 archivo activo, y a OBSERVADO si al menos uno de sus archivos activos está observado. La sincronización completa entre el estado del archivo y el estado del requisito es:

Evento en el Adjunto	Efecto en el Requisito
Se marca un archivo activo como observado	El requisito pasa a OBSERVADO (basta 1 archivo observado)
Se sube el reemplazo de un archivo observado	El requisito pasa a SUBSANADO — no salta directo a APROBADO, requiere revisión del evaluador
El evaluador aprueba todos los archivos activos	El requisito pasa a APROBADO
El evaluador rechaza de nuevo el reemplazo	El requisito regresa a OBSERVADO, reiniciando el ciclo
RN-ADJ-004 (Cardinalidad y Múltiples Adjuntos) [CONFIRMADO]: cuando Permite_Multiples = VERDADERO, se permite adjuntar hasta Cantidad_Max_Archivos, cada uno como ítem individual.

RN-ADJ-005 (Deduplicación — Política de Negocio) [CONFIRMADO]: (el mecanismo técnico de cálculo de hash es responsabilidad de Azareño; aquí solo se define la regla de negocio)

Si el mismo archivo (mismo contenido) se intenta adjuntar en dos requisitos distintos del mismo expediente, el sistema debe advertir al usuario y pedir confirmación antes de aceptarlo.

Si se intenta adjuntar un duplicado dentro del mismo requisito, el sistema debe bloquear la subida sin pedir confirmación.

Matriz de Excepciones Heredadas (vigentes, sin cambio de fondo)
Código	Condición	Resultado Esperado	Mensaje al Usuario
EX-001	Envío incompleto de requisitos obligatorios o condicionales activos.	Bloquea el envío y resalta la sección faltante.	"No se puede completar el registro. Aún faltan requisitos obligatorios por adjuntar."
EX-002	Exceso de peso individual del archivo.	Rechaza el archivo antes de enviarlo a storage. Cubierta por RN-ADM-003, ítem 3.	"El archivo excede el peso máximo permitido para este requisito."
EX-003	Formato o MIME-Type no autorizado para el requisito.	Rechaza la selección del archivo. Cubierta por RN-ADM-003, ítem 2, y por RN-FMT-002 (sección 7).	"El formato del archivo no está permitido para este requisito."
EX-004 / EX-004b	Hash duplicado — en requisito distinto (EX-004) o en el mismo requisito (EX-004b).	Ver RN-ADJ-005: pide confirmación (distinto requisito) o bloquea sin confirmación (mismo requisito).	"Este archivo ya fue adjuntado en otro requisito de esta solicitud. ¿Desea continuar?" / "Archivo duplicado, no se puede adjuntar de nuevo en este requisito."
EX-005	Intento de modificar adjuntos en trámites en evaluación o finalizados.	Deshabilita los controles de subida, eliminación o reemplazo.	"El expediente se encuentra en fase de evaluación y no admite cambios en este momento."
EX-006	Exceso en días de antigüedad (Dias_Vigencia_Max).	Registra la subida pero marca el requisito como OBSERVADO.	"El documento adjunto supera los [X] días de antigüedad permitidos. Quedará sujeto a evaluación."
EX-007	Superación de Cantidad_Max_Archivos en requisitos múltiples.	Deshabilita el botón de agregar otro archivo.	"Ha alcanzado el límite máximo permitido de [X] archivos para este requisito."
EX-008	Interrupción de red durante la carga de un archivo.	Fuera del alcance de este documento — es un caso técnico de infraestructura, no una regla de negocio TUPA. Corresponde a Azareño en 01_analisis_json_schema_storage_s3.md (sección de excepciones de storage).	—
EX-009	Campo obligatorio del formulario no diligenciado.	Bloquea el avance del formulario. Cubierta por RN-ADM-003, ítem 5 ("coordinado con Azareño").	"El campo '[Nombre_Campo]' es obligatorio para continuar con la solicitud."
EX-010	Intento de iniciar un trámite con formulario/plantilla desactivado.	Impide la apertura del formulario y notifica la inactividad. Sin regla explícita hasta ahora en este documento — se agrega aquí; coordinar mecanismo de vigencia con Azareño (formulario_version, sección 7 de su documento técnico).	"El trámite seleccionado no se encuentra disponible temporalmente."
6. Reglas de Admisibilidad Formal
RN-ADM-001 (Distinción Forma/Fondo) [CONFIRMADO]: la admisibilidad formal (¿está completo y en el formato correcto?) es distinta de la evaluación de fondo (¿cumple los requisitos legales?). DocuCore automatiza solo la primera.

RN-ADM-002 (Subsanación de Defectos de Forma) [CONFIRMADO]: conforme al Art. 125.1 del TUO de la Ley 27444: recibir la solicitud igual, notificar el defecto, otorgar hasta un máximo de 2 días hábiles para subsanar — sin correr el plazo de evaluación mientras tanto (Art. 125.3) —, y si vence sin subsanación (Art. 125.4), marcar como no presentada y activar reembolso si aplica.

RN-ADM-003 (Checklist de Admisibilidad) [PROPUESTO]:

Orden	Verificación	Bloquea si falla
1	Requisitos OBLIGATORIO/CONDICIONAL activo con al menos un archivo cargado.	Sí
2	Cada archivo cumple el formato permitido para su requisito (sección 7).	Sí
3	Cada archivo cumple el peso máximo (sección 8).	Sí
4	Documento principal con firma digital o manuscrita legible, si el trámite lo exige.	Sí
5	Campos obligatorios del formulario dinámico completos.	Sí (coordinado con Azareño)
Nota sobre sobre-exigencia [CONFIRMADO]: por el Art. 40, el catálogo no debe configurar como obligatorio ningún documento que la propia institución ya emitió o posee.

7. Reglas de Formato Permitido — PDF/A
RN-FMT-001 (Formato Base) [PROPUESTO / PENDIENTE]: se propone que el documento principal de todo trámite TUPA se presente en PDF/A (ISO 19005), por preservación a largo plazo y por prohibir contenido dependiente de recursos externos. Ninguna norma citada en la sección 3 exige específicamente este perfil — el marco legal respalda la digitalización y firma digital en general, no un formato de archivo particular. Queda como regla institucional propuesta, salvo que el IESTP "Suiza" tenga una norma interna propia que sí lo exija explícitamente (ver pregunta pendiente #6).

RN-FMT-002 (Formatos Permitidos por Tipo de Documento) [PROPUESTO]: para evitar contradicción con la matriz de la sección 9, se distinguen dos niveles — ambos son decisiones funcionales del catálogo de DocuCore, no obligaciones legales:

Formatos de imagen estándar (JPG, PNG): autorizados de forma general para documentos que típicamente se reciben ya escaneados como imagen (ej. DNI, comprobantes), sin necesitar justificación caso por caso.

Formatos técnicos no convertibles (DWG, ZIP, y cualquier otro no-PDF/A): solo se autorizan si el requisito específico queda explícitamente marcado como EXCEPCIÓN JUSTIFICADA en el catálogo (sección 9).

RN-FMT-003 (Validación de Conformidad) [PROPUESTO / PENDIENTE]: si se aprueba institucionalmente el uso obligatorio de PDF/A (RN-FMT-001), el documento principal deberá validarse como un PDF/A conforme, y no simplemente como un PDF genérico con extensión renombrada. Esta regla depende directamente de que RN-FMT-001 sea aprobada — mientras esa decisión no exista, tampoco hay obligación de validar conformidad PDF/A. El mecanismo técnico de esa validación (inspección de metadatos XMP, Magic Bytes) sigue siendo responsabilidad de Azareño — ver 01_analisis_json_schema_storage_s3.md, sección 18.

8. Reglas de Límite de Tamaño
RN-PESO-001 (Techo Institucional) [CONFIRMADO]: 25 MB es el tope máximo institucional por archivo individual. Ningún requisito puede configurarse por encima de este techo.

RN-PESO-002 (Límite Configurable por Requisito) [PROPUESTO]: cada requisito del catálogo define su propio peso_maximo_mb, que puede ser igual o menor a 25 MB según la naturaleza del documento (ej. DNI → 5 MB, Comprobante de Pago → 2 MB, Vigencia de Poder → 10 MB, Anexos Técnicos → 25 MB). El valor de 25 MB no es una meta a alcanzar, es un techo que no debe excederse.

RN-PESO-003 (Límite Agregado por Expediente) [PENDIENTE]: sigue sin resolverse si existe un tope acumulado por expediente. Esto no bloquea el cierre de este documento mientras el alcance actual de Fase 2 no lo requiera explícitamente, pero sí debe resolverse antes de implementar los controles de almacenamiento en S3/MinIO (ver 01_analisis_json_schema_storage_s3.md). No se debe inventar un valor mientras tanto.

9. Matriz de Requisitos Documentales (Reconciliada con PDF/A)
⚠️ Igual que la matriz de trámites, los pesos y formatos de esta tabla son ilustrativos sobre una base real de tipos de requisito, pendientes de confirmación institucional final.

Requisito	Formato Permitido	Peso Máx.	¿Excepción Justificada (RN-FMT-002)?
Documento Nacional de Identidad (DNI)	PDF/A, JPG, PNG	5 MB	No aplica — JPG/PNG están autorizados de forma general para documentos que se reciben escaneados.
Comprobante de Pago de Derechos	PDF/A, JPG	2 MB	No aplica — mismo caso que el DNI.
Vigencia de Poder del Representante Legal	PDF/A	10 MB	No aplica — solo admite PDF/A, sin formatos adicionales.
Autorización Sectorial Previa	PDF/A	8 MB	No aplica — solo admite PDF/A.
Anexos Técnicos, Planos y Memorias	PDF/A, DWG, ZIP	25 MB (techo institucional)	Sí — EXCEPCIÓN JUSTIFICADA: un plano técnico en DWG pierde su naturaleza editable/vectorial si se fuerza a PDF/A. El ZIP se acepta únicamente para consolidar múltiples planos relacionados, pero no debe considerarse listo para producción: la pregunta pendiente #2 (validación de su contenido interno) sigue sin resolverse, y es un requisito de seguridad, no un detalle menor.
10. Ejemplo de Flujo
Caso: Solicitud de Certificado de Estudios (Evaluación Previa — SAP).

El estudiante inicia el trámite TUPA-003. El sistema muestra el plazo legal aplicable y advierte que opera el Silencio Administrativo Positivo si la entidad no resuelve a tiempo.

Sube el documento principal en el formato permitido por el requisito y dentro del peso máximo configurado (RN-FMT-002, RN-PESO-002) — ejemplo: si PDF/A ya hubiera sido aprobado institucionalmente como formato obligatorio para este trámite (RN-FMT-001), el archivo debería presentarse en ese formato.

Sube un anexo en JPG de 1.5 MB — permitido porque ese requisito específico admite JPG.

Falta un campo del formulario — se bloquea el envío (EX-001, coordinado con Azareño para la validación de JSON Schema).

Completa el campo; pasa la admisibilidad formal (RN-ADM-003); se asigna código de expediente y fecha límite de resolución.

Si vence el plazo legal aplicable sin resolución, y se cumplen las condiciones para el Silencio Administrativo Positivo, se procesa el efecto correspondiente según las reglas propias del procedimiento (fecha de inicio válida, cómputo en días hábiles, suspensiones por subsanación, y cualquier regla particular del trámite) — mecanismo exacto de notificación al ciudadano: pendiente (pregunta #4).

11. Preguntas Pendientes de Validación Institucional
#	Pregunta	Prioridad	Responsable	Fecha Límite	Impacto	Estado
1	¿Cuáles son los códigos, plazos y montos reales del TUPA vigente del IESTP "Suiza"?	Crítica	(asignar — sugerido: Valentín con apoyo de Geric ante la institución)	(asignar, antes de cierre H1)	Carga inicial del catálogo TIPO_TRAMITE_TUPA.	Abierta
2	¿Se requiere descomprimir y validar el contenido interno de los .ZIP autorizados como excepción en "Anexos Técnicos"?	Alta	(asignar — sugerido: Azareño, es una decisión de seguridad de storage)	(asignar, antes de H3 — bloquea a Piero)	Regla de validación de contenido de ZIP; afecta directamente la seguridad del worker de validación de Azareño.	Abierta — urgente
3	¿El límite de 25 MB aplica igual a todos los archivos, o algún requisito adicional necesita un techo distinto?	Media	(asignar — sugerido: Valentín)	(asignar)	Configuración fina del catálogo REQUISITO_TUPA.	Abierta
4	¿Quién notifica al ciudadano cuando opera el Silencio Administrativo Positivo?	Alta	(asignar — requiere acuerdo con Grupo 2)	(asignar)	Contrato de integración con el Grupo 2 (TramiCore).	Abierta
5	¿El catálogo TIPO_TRAMITE_TUPA se sincroniza automáticamente contra el TUPA institucional publicado, o es 100% manual?	Media	(asignar — sugerido: Cristian, es decisión de arquitectura)	(asignar)	Diseño del proceso de actualización del catálogo.	Abierta
6	¿El IESTP "Suiza" tiene alguna norma interna propia que exija PDF/A específicamente?	Alta	(asignar — sugerido: Valentín, ante la institución)	(asignar, antes de que Piero implemente la validación de conformidad PDF/A)	Determina si RN-FMT-001 y RN-FMT-003 pueden subir de PROPUESTO a CONFIRMADO.	Abierta
7	¿Cada entrada de TIPO_TRAMITE_TUPA tiene su tipo de silencio administrativo (SAP/SAN) confirmado individualmente contra el TUPA real, antes de publicarse como trámite activo?	Crítica	(asignar — sugerido: área legal/administrativa del IESTP, no un rol técnico)	(asignar, bloquea publicación de cualquier trámite en el catálogo real)	RN-TUPA-001 — evita que el sistema asuma SAN por defecto sin revisión, lo cual tiene consecuencia legal directa.	Abierta
Nota: las preguntas #1 y #7 (marcadas Crítica) determinan si el catálogo puede publicarse con datos reales; #2, #4 y #6 (Alta) bloquean piezas específicas de implementación (seguridad de ZIP, integración con TramiCore, y validación de PDF/A respectivamente); #3 y #5 (Media) son configuraciones finas que no bloquean el arranque.

Recomendación: los campos de responsable y fecha límite quedan marcados (asignar) porque no pueden fijarse unilateralmente en este documento — deben completarse en la reunión de Hito H1, idealmente con Geric moderando la asignación final. Mientras el documento esté en revisión (NO LISTO), esto es aceptable; para marcarlo LISTO, al menos las preguntas de prioridad Crítica (#1 y #7) deberían tener responsable y fecha asignados.