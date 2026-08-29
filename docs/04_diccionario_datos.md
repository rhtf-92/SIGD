# 04. Diccionario de Datos

**Sistema:** SIGD — Módulo DocuCore
**Autor:** Cristian
**Rama Git:** `B_CHRISTIAN`
**Entregable:** `docs/modelo-datos/04_diccionario_datos.md`
**Fecha:** 29 de agosto de 2026

Este diccionario explica, en lenguaje llano, qué representa cada entidad del modelo (`03_modelo_datos.md`) y por qué existe — pensado para que cualquier persona del equipo entienda el modelo sin tener que leer el SQL.

---

## USUARIO
Cualquier persona que usa el sistema. Un mismo tipo de tabla cubre los 4 actores identificados por Azareño porque todos comparten los mismos datos básicos (nombre, correo) y solo cambian en su rol. El rol determina qué puede hacer: el `ADMINISTRADOR` configura tipos de documento, el `SOLICITANTE` inicia trámites, el `EVALUADOR` revisa archivos y el `CONSULTANTE` solo consulta.

## TIPO_DOCUMENTO
El "molde" de un trámite — por ejemplo, "Certificado de Estudios". No representa ningún trámite en curso, solo la configuración: qué formulario usa y qué requisitos exige. Es la entidad que Azareño llamó "tipo de documento" y que probablemente sea la misma que Valentín menciona como `TRAMITE_PLANTILLA` (pendiente de confirmar).

## FORMULARIO
La lista de campos que se le pide al solicitante al iniciar un trámite de cierto tipo. Se separa de `TIPO_DOCUMENTO` para que, en el futuro, un mismo tipo de documento pueda tener distintas versiones de formulario sin perder el historial (por ejemplo, si cambian los campos requeridos de un año a otro).

## CAMPO_FORMULARIO
Cada campo individual dentro de un formulario — un nombre de campo, su tipo de dato (texto, número, fecha, selección) y si es obligatorio. Es lo que permite que el sistema arme formularios distintos sin programar cada uno a mano, que era justamente el objetivo que Azareño explicó para DocuCore.

## EXPEDIENTE
Un trámite concreto que una persona está haciendo. Nace en estado `BORRADOR` apenas el solicitante llena el formulario, y solo se convierte en un trámite oficial (con `codigo_oficial`) cuando se cumplen los requisitos obligatorios — este es el punto exacto donde se conecta el flujo de Azareño con el de Valentín.

## VALOR_CAMPO
La respuesta real que el solicitante escribió en cada campo del formulario. Se guarda separado de `CAMPO_FORMULARIO` porque el campo es la pregunta (reutilizable en todos los expedientes de ese tipo) y `VALOR_CAMPO` es la respuesta (única de cada expediente).

## REQUISITO
El catálogo de "cosas que un trámite puede exigir" — por ejemplo, "DNI" o "Comprobante de Pago". Es reutilizable: un mismo requisito de DNI puede exigirse en muchos tipos de documento distintos, por eso vive separado y se conecta a través de `TIPO_DOCUMENTO_REQUISITO`.

## TIPO_DOCUMENTO_REQUISITO
La tabla que conecta "qué tipo de documento" con "qué requisito exige". Existe porque un requisito no siempre se comporta igual en todos los trámites: por ejemplo, el DNI puede ser obligatorio para un certificado y opcional para otro. También guarda la condición que activa un requisito condicional (por ejemplo, "solo si el solicitante marcó Persona Jurídica").

## EXPEDIENTE_REQUISITO
La versión "aplicada" de un requisito dentro de un expediente específico. Aquí es donde vive el estado real del requisito para ese trámite en particular (`PENDIENTE`, `OBSERVADO`, `SUBSANADO`, `APROBADO`) — y ese estado nunca lo cambia el evaluador directamente, sino que se deriva de lo que pasa con los archivos adjuntos (regla RN-REQ-005 de Valentín).

## ARCHIVO_ADJUNTO
El archivo físico que el solicitante subió para cumplir un requisito. Guarda su nombre, su ruta de almacenamiento, su huella digital (para detectar duplicados) y su historial de versiones — porque cuando un evaluador rechaza un archivo, el sistema nunca lo borra: sube uno nuevo y deja el anterior enlazado como historial (`id_adjunto_anterior`).

---

## Relaciones clave explicadas

- **USUARIO → TIPO_DOCUMENTO / EXPEDIENTE / EXPEDIENTE_REQUISITO:** un mismo usuario puede crear muchos tipos de documento, solicitar muchos expedientes, o evaluar muchos requisitos — pero cada tipo de documento, expediente o evaluación individual pertenece a un solo usuario.
- **TIPO_DOCUMENTO ↔ REQUISITO (vía TIPO_DOCUMENTO_REQUISITO):** relación muchos-a-muchos — un requisito puede aplicar a varios tipos de documento, y un tipo de documento puede exigir varios requisitos.
- **EXPEDIENTE_REQUISITO → ARCHIVO_ADJUNTO:** un requisito instanciado puede tener varios archivos (si `permite_multiples = true`, o si hubo varias versiones por subsanación).
- **ARCHIVO_ADJUNTO → ARCHIVO_ADJUNTO:** autorreferencia que forma una cadena de versiones (v1 → v2 → v3...), sin que ninguna versión se elimine físicamente.
