04. Diccionario de Datos

Sistema: SIGD — Módulo DocuCore

Autor: Cristian

Rama Git: B_CHRISTIAN

Entregable: docs/modelo-datos/04_diccionario_datos.md

Fecha: 29 de agosto de 2026

Este diccionario explica, en lenguaje llano, qué representa cada entidad del modelo (03_modelo_datos.md) y por qué existe — pensado para que cualquier persona del equipo entienda el modelo sin tener que leer el SQL.

USUARIO

Los usuarios son gestionados por un módulo externo al DocuCore, por lo que USUARIO no se considera una tabla propia de este módulo. DocuCore utiliza los identificadores de usuario proporcionados por el sistema central para relacionar las operaciones con cada actor. Los campos como id_usuario_creador, id_usuario_solicitante o id_evaluador funcionan como referencias externas y no tienen una clave foránea (REFERENCES) hacia una tabla USUARIO local.

El sistema central de usuarios es responsable de la identidad, datos personales, autenticación, roles y permisos. DocuCore únicamente conserva los identificadores necesarios para relacionar cada operación con el usuario correspondiente.

TIPO_DOCUMENTO

El "molde" de un trámite — por ejemplo, "Certificado de Estudios". No representa ningún trámite en curso, solo la configuración: qué formulario usa y qué requisitos exige. Es la entidad que Azareño llamó "tipo de documento" y que probablemente sea la misma que Valentín menciona como TRAMITE_PLANTILLA (pendiente de confirmar).

FORMULARIO

La lista de campos que se le pide al solicitante al iniciar un trámite de cierto tipo. Se separa de TIPO_DOCUMENTO y se maneja mediante versiones para conservar el historial de cambios. Cada versión representa una configuración concreta del formulario y no debe modificarse una vez que haya sido utilizada por un expediente.

Cuando se modifica un formulario, se crea una nueva versión (version = 2, version = 3, etc.) en lugar de alterar la versión anterior. El EXPEDIENTE mantiene una relación directa con el FORMULARIO que utilizó al momento de su creación, de manera que sus respuestas siempre puedan interpretarse con la configuración exacta que estaba vigente en ese momento.

CAMPO_FORMULARIO

Cada campo individual dentro de un formulario — un nombre de campo, su tipo de dato (texto, número, fecha, selección) y si es obligatorio. Es lo que permite que el sistema arme formularios distintos sin programar cada uno a mano, que era justamente el objetivo que Azareño explicó para DocuCore.

EXPEDIENTE

Un trámite concreto que una persona está haciendo y cuya gestión documental pertenece a DocuCore dentro del alcance definido para este módulo. Por ello, EXPEDIENTE se mantiene como una entidad local y es responsable de su propio ciclo de vida documental.

Nace en estado BORRADOR apenas el solicitante inicia el trámite y solo se convierte en un trámite oficial (con codigo_oficial) cuando se cumplen los requisitos obligatorios — este es el punto exacto donde se conecta el flujo de Azareño con el de Valentín.

Cada expediente mantiene además una referencia directa al FORMULARIO utilizado para crearlo. Esto permite conservar la versión exacta del formulario aplicada al trámite, incluso si posteriormente se publica una nueva versión para el mismo TIPO_DOCUMENTO.

VALOR_CAMPO

La respuesta real que el solicitante escribió en cada campo del formulario. Se guarda separado de CAMPO_FORMULARIO porque el campo es la pregunta (reutilizable en todos los expedientes de ese tipo) y VALOR_CAMPO es la respuesta (única de cada expediente).

REQUISITO

El catálogo de "cosas que un trámite puede exigir" — por ejemplo, "DNI" o "Comprobante de Pago". Es reutilizable: un mismo requisito de DNI puede exigirse en muchos tipos de documento distintos, por eso vive separado y se conecta a través de TIPO_DOCUMENTO_REQUISITO.

TIPO_DOCUMENTO_REQUISITO

La tabla que conecta "qué tipo de documento" con "qué requisito exige". Existe porque un requisito no siempre se comporta igual en todos los trámites: por ejemplo, el DNI puede ser obligatorio para un certificado y opcional para otro. También guarda la condición que activa un requisito condicional (por ejemplo, "solo si el solicitante marcó Persona Jurídica").

EXPEDIENTE_REQUISITO

La versión "aplicada" de un requisito dentro de un expediente específico. Aquí es donde vive el estado real del requisito para ese trámite en particular (PENDIENTE, OBSERVADO, SUBSANADO, APROBADO) — y ese estado nunca lo cambia el evaluador directamente, sino que se deriva de lo que pasa con los archivos adjuntos (regla RN-REQ-005 de Valentín).

ARCHIVO_ADJUNTO

El archivo físico que el solicitante subió para cumplir un requisito. Guarda su nombre, su ruta de almacenamiento, su huella digital (para detectar duplicados) y su historial de versiones — porque cuando un evaluador rechaza un archivo, el sistema nunca lo borra: sube uno nuevo y deja el anterior enlazado como historial (id_adjunto_anterior).

Relaciones clave explicadas
USUARIO → TIPO_DOCUMENTO / EXPEDIENTE / EXPEDIENTE_REQUISITO: un mismo usuario puede crear muchos tipos de documento, solicitar muchos expedientes, o evaluar muchos requisitos — pero la relación utiliza identificadores provenientes del sistema central de usuarios. Estas referencias son externas y no dependen de una tabla USUARIO local en DocuCore.
TIPO_DOCUMENTO ↔ REQUISITO (vía TIPO_DOCUMENTO_REQUISITO): relación muchos-a-muchos — un requisito puede aplicar a varios tipos de documento, y un tipo de documento puede exigir varios requisitos.
EXPEDIENTE → FORMULARIO: cada expediente conserva una referencia directa al formulario y a la versión concreta que utilizó al momento de su creación. Esto garantiza la trazabilidad histórica aunque posteriormente se publique una nueva versión del formulario.
EXPEDIENTE_REQUISITO → ARCHIVO_ADJUNTO: un requisito instanciado puede tener varios archivos (si permite_multiples = true, o si hubo varias versiones por subsanación).
ARCHIVO_ADJUNTO → ARCHIVO_ADJUNTO: autorreferencia que forma una cadena de versiones (v1 → v2 → v3...), sin que ninguna versión se elimine físicamente.