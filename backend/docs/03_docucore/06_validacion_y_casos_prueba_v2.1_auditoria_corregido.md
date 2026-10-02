HEAD/06_validacion_y_casos_prueba.md

Validación y Casos de Prueba --- DocuCore v2.1

Sistema: Sistema Integral de Gestión Documentaria (SIGD)

Módulo: DocuCore --- Documentos, Requisitos y Formularios (Grupo 5)

Fase: 2 --- JSON Schema, PostgreSQL JSONB y Storage S3/MinIO

Responsable: Piero --- Implementador SQL (B_PIERO)

Esquema validado: sigd_doc

Script principal: 05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql

Modelo fuente: 03_modelo_datos_docucore_v2.md

Diccionario fuente: 04_diccionario_datos_docucore_v2.md

Fecha: 9 de septiembre de 2026

Versión: 2.1 --- Validación consolidada y corregida según auditoría

Objetivo

Este documento valida el esquema físico PostgreSQL de DocuCore y su correspondencia con el modelo de datos y el diccionario aprobados.

Se validan:

9 tablas principales del esquema sigd_doc.

ENUM, UUID, PK, FK, UNIQUE y CHECK.

Catálogo TUPA separado de TIPO_DOCUMENTO.

Relación 1:1 entre TIPO_TRAMITE_TUPA y TIPO_DOCUMENTO.

JSON Schema Draft 2020-12 + JSONB.

Versionado e inmutabilidad de FORMULARIO_VERSION.

payload_respuestas JSONB en EXPEDIENTE_FORMULARIO_RESPUESTA, con relación 1:1 respecto de EXPEDIENTE.

Requisitos obligatorios, opcionales y condicionales.

Estado derivado de EXPEDIENTE_REQUISITO.

Radicación explícita del expediente.

Adjuntos como metadatos de objetos MinIO/S3.

Magic Bytes y SHA-256.

Reemplazo y eliminación lógica.

Límites de tamaño y cantidad.

Índices GIN y ausencia de índices redundantes conocidos.

Las validaciones que dependen de bytes reales, MinIO/S3, JSON Schema completo o sigd_auth pertenecen a la aplicación/servicios y se identifican expresamente.

Fuentes

La validación utiliza como fuentes:

03_modelo_datos_docucore_v2.md

04_diccionario_datos_docucore_v2.md

05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql --- script físico corregido

El modelo y el script consolidado establecen que USUARIO es externo, que TUPA y TIPO_DOCUMENTO son entidades separadas, que FORMULARIO_VERSION concentra la definición JSON Schema y que EXPEDIENTE conserva la versión exacta del formulario. Las respuestas JSONB se registran en EXPEDIENTE_FORMULARIO_RESPUESTA, asociada 1:1 al expediente.

El diccionario establece que el estado de EXPEDIENTE_REQUISITO se deriva de los documentos, que BORRADOR no equivale a radicación y que el binario se almacena externamente en MinIO/S3.

Requisitos previos

PostgreSQL 18+.

Base de datos de prueba.

Permisos para crear esquema, tipos, tablas, funciones, triggers e índices.

psql o pgAdmin 4.

Ejecutar el script físico:

05_esquema_sigd_docucore_v2.sql

El script utiliza pgcrypto para gen_random_uuid().

Los datos de prueba deben ser ficticios y no deben contener DNI, nombres reales, contraseñas ni documentos reales.

Existencia del esquema

SELECT schema_name

FROM information_schema.schemata

WHERE schema_name = 'sigd_doc';

Esperado: sigd_doc.

Las 9 tablas oficiales

SELECT COUNT(*) AS cantidad_tablas

FROM information_schema.tables

WHERE table_schema = 'sigd_doc'

  AND table_type = 'BASE TABLE';

Esperado:

9

Tablas:

# Tabla

1 documento_adjunto

 2 expediente

 3 expediente_requisito

 4 formulario_version

 5 requisito

 6 tipo_documento

 7 tipo_documento_requisito

 8 tipo_tramite_tupa
9 expediente_formulario_respuesta

No deben existir campo_formulario ni valor_campo: DocuCore v2 elimina el modelo EAV.

ENUM

Deben existir exactamente estos tipos principales:

calificacion_administrativa_enum

tipo_obligatoriedad_enum

estado_expediente_enum

estado_expediente_requisito_enum

estado_documento_enum

Valores esperados:

calificacion_administrativa_enum:

APROBACION_AUTOMATICA

EVALUACION_PREVIA_SAP

EVALUACION_PREVIA_SAN

tipo_obligatoriedad_enum:

OBLIGATORIO

OPCIONAL

CONDICIONAL

estado_expediente_enum:

BORRADOR

EN_REVISION

OBSERVADO

SUBSANACION

APROBADO

RECHAZADO_POR_CADUCIDAD

INACTIVO

estado_expediente_requisito_enum:

PENDIENTE

OBSERVADO

SUBSANADO

APROBADO

estado_documento_enum:

CARGADO

OBSERVADO

APROBADO

REEMPLAZADO

ELIMINADO

PK UUID

Todas las PK deben ser UUID y utilizar generación automática mediante gen_random_uuid().

Tabla                        PK

tipo_tramite_tupa          id_tipo_tramite_tupa tipo_documento             id_tipo_documento formulario_version         id_formulario_version expediente                 id_expediente requisito                  id_requisito tipo_documento_requisito   id_tipo_documento_requisito expediente_requisito       id_expediente_requisito documento_adjunto          id_documento_adjunto

Referencias externas de USUARIO

DocuCore no crea una tabla usuario local.

Son referencias UUID externas:

id_usuario_creador

id_usuario_solicitante

id_evaluador

id_usuario_subida

No deben agregarse FK locales hacia una tabla usuario de DocuCore.

La existencia y autorización del usuario se validan contra sigd_auth en la aplicación.

TUPA

Un registro TUPA con es_tupa = TRUE debe tener clasificación administrativa.

Caso inválido:

INSERT INTO sigd_doc.tipo_tramite_tupa (

    codigo_tupa,

    denominacion,

    es_tupa,

    calificacion_administrativa

)

VALUES (

    'TUPA-TEST-INVALIDO',

    'Trámite ficticio',

    TRUE,

    NULL

);

Esperado: rechazo por ck_tupa_calificacion_coherente.

No se debe asignar automáticamente EVALUACION_PREVIA_SAN.

TIPO_DOCUMENTO en borrador

Se permite crear un TIPO_DOCUMENTO sin TUPA mientras permanezca inactivo:

INSERT INTO sigd_doc.tipo_documento (

    id_tipo_tramite_tupa,

    codigo_tipo,

    nombre,

    descripcion,

    activo

)

VALUES (

    NULL,

    'TEST-BORRADOR',

    'Tipo documental de prueba',

    'Ejemplo no oficial',

    FALSE

);

Debe crearse.

Intentar activarlo sin TUPA:

UPDATE sigd_doc.tipo_documento

SET activo = TRUE

WHERE codigo_tipo = 'TEST-BORRADOR';

Esperado: rechazo por tr_validar_activacion_tipo_documento.

Relación 1:1 TUPA ↔ TIPO_DOCUMENTO

La relación aprobada es:

TIPO_TRAMITE_TUPA  1 ───── 1  TIPO_DOCUMENTO

La restricción:

uq_tipo_documento_tupa

impide asociar el mismo TUPA a dos tipos documentales.

Esta restricción no debe eliminarse.

FORMULARIO_VERSION

Una fila representa una versión completa del formulario:

FORMULARIO_VERSION.schema_definicion = JSON Schema Draft 2020-12

Debe ser JSONB.

Debe cumplirse:

version > 0

UNIQUE(id_tipo_documento, version)

máximo una versión activa por tipo documental

La validación completa del JSON Schema corresponde a la aplicación.

Única versión activa

El índice:

uq_formulario_version_activa

garantiza:

un TIPO_DOCUMENTO → máximo una FORMULARIO_VERSION activa

Se permite conservar versiones históricas inactivas.

Flujo recomendado:

V1 activa

   ↓

crear V2 inactiva

   ↓

desactivar V1

   ↓

activar V2

Inmutabilidad de FORMULARIO_VERSION

No se deben modificar después de creados:

schema_definicion

version

id_tipo_documento

Intentar modificar cualquiera de ellos debe producir error mediante:

tr_proteger_formulario_version

La modificación de un formulario se realiza creando una nueva versión.

EXPEDIENTE y JSONB

EXPEDIENTE conserva:

id_formulario_version;

id_usuario_solicitante;

estado;

codigo_oficial;

fecha_creacion;

fecha_radicacion.

Las respuestas del formulario se conservan en EXPEDIENTE_FORMULARIO_RESPUESTA, que debe tener un único registro por expediente y id_formulario_version igual al del expediente.

payload_respuestas debe ser JSONB y almacenar un objeto JSON en EXPEDIENTE_FORMULARIO_RESPUESTA.

El expediente mantiene la versión exacta del formulario usada al iniciar el trámite.

BORRADOR

Un expediente nuevo debe iniciar:

estado = BORRADOR

codigo_oficial = NULL

fecha_radicacion = NULL

El modelo distingue claramente:

BORRADOR ≠ RADICACIÓN

Completar el formulario o cargar requisitos no debe radicar automáticamente el expediente.

Invariantes de radicación

Caso inválido:

BORRADOR + codigo_oficial

Debe rechazarse por:

ck_expediente_codigo_oficial

Caso inválido:

BORRADOR + fecha_radicacion

Debe rechazarse por:

ck_expediente_radicacion

Estas restricciones no deben eliminarse.

Radicación explícita

La radicación se realiza mediante:

fn_radicacion_expediente()

Ejemplo:

SELECT sigd_doc.fn_radicacion_expediente(

    'UUID_EXPEDIENTE',

    'EXP-TEST-0001'

);

Resultado esperado:

estado = EN_REVISION

codigo_oficial = EXP-TEST-0001

fecha_radicacion = valor válido

Solo un expediente BORRADOR puede ser radicado mediante esta operación.

REQUISITO

Debe permitir:

OBLIGATORIO

OPCIONAL

CONDICIONAL

El límite institucional de tamaño configurado es:

0 < peso_maximo_mb <= 25

Un valor superior a 25 debe rechazarse por:

ck_requisito_peso_maximo

Vigencia del requisito

Si:

requiere_vigencia = TRUE

entonces:

dias_vigencia_max > 0

Si:

requiere_vigencia = FALSE

entonces:

dias_vigencia_max IS NULL

La regla corresponde a:

ck_requisito_vigencia

TIPO_DOCUMENTO_REQUISITO

Representa la relación M:N:

TIPO_DOCUMENTO ↔ REQUISITO

Debe cumplirse:

UNIQUE(id_tipo_documento, id_requisito)

La obligatoriedad puede heredarse de REQUISITO o sobrescribirse mediante:

obligatoriedad_override

Requisitos condicionales

El modelo no utiliza una FK a CAMPO_FORMULARIO.

Utiliza:

campo_condicionante_path

valor_condicionante

Ejemplo:

/tipo_persona

JURIDICA

El path debe ser un JSON Pointer válido.

La aplicación debe comprobar que la ruta exista realmente en el JSON Schema correspondiente.

EXPEDIENTE_REQUISITO

Una instancia de requisito nace:

estado = PENDIENTE

Debe cumplirse:

UNIQUE(id_expediente, id_tipo_documento_requisito)

Además, el requisito debe corresponder al mismo TIPO_DOCUMENTO de la versión de formulario utilizada por el expediente.

La validación se realiza mediante:

tr_validar_expediente_requisito

Estado derivado del requisito

EXPEDIENTE_REQUISITO.estado no debe ser editado directamente por el evaluador.

Reglas:

Documento vigente                      Estado

No existe documento vigente            PENDIENTE Documento vigente observado            OBSERVADO Nueva versión después de observación   SUBSANADO Documento vigente aprobado             APROBADO

La protección se realiza mediante:

tr_proteger_estado_expediente_requisito

Diferencia entre carga inicial y subsanación

Carga inicial

V1

id_documento_anterior = NULL

estado_documento = CARGADO

No debe producir:

SUBSANADO

Subsanación

V1 = OBSERVADO

        ↓

V2 = CARGADO

id_documento_anterior = V1

Debe producir:

EXPEDIENTE_REQUISITO = SUBSANADO

Esta prueba corrige el error del modelo anterior donde cualquier CARGADO podía interpretarse como SUBSANADO.

DOCUMENTO_ADJUNTO

La tabla contiene únicamente metadatos.

El archivo físico no se almacena en PostgreSQL.

Metadatos principales:

nombre_original

s3_bucket

s3_key

formato_extension

mime_type

tamanio_bytes

sha256_hash

magic_bytes_validado

version_num

id_documento_anterior

estado_documento

El objeto físico permanece en MinIO/S3.

Tamaño y cantidad de archivos

tr_validar_adjunto comprueba:

peso máximo del requisito;

cantidad máxima de archivos;

configuración permite_multiples.

Ejemplo:

peso_maximo_mb = 5

tamanio > 5 MB

Debe rechazarse.

Si:

permite_multiples = FALSE

no debe aceptarse un segundo archivo activo para el mismo requisito.

Formato y Magic Bytes

La extensión declarada no es suficiente.

El flujo correcto es:

Solicitud de URL prefirmada

        ↓

Carga directa a MinIO/S3

        ↓

Lectura/verificación del objeto

        ↓

Validación de Magic Bytes

        ↓

Cálculo SHA-256

        ↓

Confirmación

        ↓

Documento habilitado para evaluación

La validación física pertenece a la aplicación/servicio.

PostgreSQL conserva el resultado mediante:

magic_bytes_validado

SHA-256

El hash debe tener:

64 caracteres hexadecimales

Ejemplo válido:

aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

Ejemplo inválido:

HASH_INVALIDO

Debe rechazarse por:

ck_documento_hash

Además, el hash debe permanecer inmutable después de la inserción.

Deduplificación

El esquema consolidado utiliza:

uq_documento_sha256

para impedir duplicados del mismo SHA-256.

Esta regla debe mantenerse salvo que una decisión institucional futura defina explícitamente otra política.

Versionado de documentos

Una cadena válida:

V1 → V2 → V3

debe conservar:

id_documento_anterior

version_num

El reemplazo debe cumplir:

documento anterior existente;

mismo EXPEDIENTE_REQUISITO;

documento anterior OBSERVADO;

versión consecutiva;

un único sucesor directo.

No se permite:

V1 → V3

sin la secuencia correspondiente.

Documento aprobado

Un documento APROBADO es inmutable.

No debe poder modificarse.

Tampoco puede aprobarse si:

magic_bytes_validado = FALSE

Debe rechazarse por la protección del documento.

Eliminación lógica

No se permite eliminar físicamente un documento.

Debe utilizarse:

SELECT sigd_doc.fn_eliminar_logicamente_documento(

    'UUID_DOCUMENTO'

);

Resultado:

estado_documento = ELIMINADO

El registro histórico permanece en PostgreSQL.

Los documentos REEMPLAZADO o ELIMINADO no pueden volver a un estado activo.

Estado documental del expediente

La función:

fn_calcular_estado_documental_expediente()

calcula una conclusión documental sin convertir por sí misma un borrador en expediente radicado.

La evaluación considera:

requisitos no opcionales;

requisitos condicionales aplicables;

requisitos aprobados;

requisitos observados;

requisitos subsanados.

Los requisitos OPCIONALES no deben bloquear por sí solos la conclusión documental.

Flujo correcto de estados

BORRADOR

   │

   │ radicación explícita

   ▼

EN_REVISION

   │

   │ observación

   ▼

SUBSANACION

   │

   │ nueva versión

   ▼

EN_REVISION

   │

   │ requisitos aplicables aprobados

   ▼

APROBADO

La carga de requisitos no constituye radicación.

Índices JSONB

Debe existir GIN para:

formulario_version.schema_definicion

y:

expediente_formulario_respuesta.payload_respuestas

El índice de respuestas de EXPEDIENTE_FORMULARIO_RESPUESTA debe utilizar:

jsonb_path_ops

cuando así lo define el script consolidado.

Ausencia de índice redundante

La restricción:

uq_expediente_requisito

ya crea el índice necesario para:

(id_expediente, id_tipo_documento_requisito)

Por tanto, no debe existir un índice adicional duplicado llamado:

idx_expediente_requisito_integridad

sin una justificación técnica.

Pruebas estructurales consolidadas

Ejecutar:

SELECT 'tablas_principales' AS prueba,

       COUNT(*) = 9 AS ok

FROM information_schema.tables

WHERE table_schema = 'sigd_doc'

  AND table_name IN (

      'tipo_tramite_tupa',

      'tipo_documento',

      'formulario_version',

      'expediente',

      'requisito',

      'tipo_documento_requisito',

      'expediente_requisito',

      'documento_adjunto'

  );

También comprobar:

uq_formulario_version_activa

ck_expediente_codigo_oficial

ck_expediente_radicacion

ck_requisito_peso_maximo

ck_documento_hash

tr_proteger_sha256

tr_proteger_estado_expediente_requisito

tr_recalcular_estado_requisito

tr_validar_expediente_activo

fn_radicacion_expediente

fn_calcular_estado_documental_expediente

Cada comprobación estructural debe devolver:

TRUE

Casos CP-01 a CP-20

ID      Escenario                                       Esperado

CP-01   Crear TUPA con clasificación válida             Correcto CP-02   TUPA formal sin clasificación                   Rechazado CP-03   Crear tipo documental en borrador sin TUPA      Correcto CP-04   Activar tipo documental sin TUPA                Rechazado CP-05   Asociar dos tipos al mismo TUPA                 Rechazado CP-06   Crear formulario versión 1                      Correcto CP-07   Repetir número de versión                       Rechazado CP-08   Crear versión 0                                 Rechazado CP-09   Crear versión 2 inactiva                        Correcto CP-10   Activar dos versiones                           Rechazado CP-11   Modificar definición de formulario              Rechazado CP-12   Crear expediente con formulario activo          BORRADOR CP-13   Crear expediente con formulario inactivo        Rechazado CP-14   Crear expediente con tipo documental inactivo   Rechazado CP-15   BORRADOR con código oficial                   Rechazado CP-16   BORRADOR con fecha de radicación              Rechazado CP-17   Completar requisitos de un borrador             Continúa BORRADOR CP-18   Radicar explícitamente                          EN_REVISION + código + fecha CP-19   Crear requisito válido                          Correcto CP-20   Peso > 25 MB                                   Rechazado

Casos CP-21 a CP-40

ID      Escenario                                     Esperado

CP-21   Vigencia incoherente                          Rechazado CP-22   Crear relación TIPO_DOCUMENTO--REQUISITO      Correcto CP-23   Repetir relación                              Rechazado CP-24   Crear requisito de expediente                 PENDIENTE CP-25   Modificar directamente estado del requisito   Rechazado CP-26   Carga inicial V1                              No es SUBSANADO CP-27   V1 observada + V2 enlazada                    SUBSANADO CP-28   Aprobar sin Magic Bytes                       Rechazado CP-29   Eliminar físicamente documento                Rechazado CP-30   Eliminación lógica                            ELIMINADO CP-31   Modificar documento aprobado                  Rechazado CP-32   SHA-256 inválido                              Rechazado CP-33   Modificar SHA-256                             Rechazado CP-34   Archivo sobre límite                          Rechazado CP-35   Segundo archivo sin múltiples                 Rechazado CP-36   Reemplazo V1→V2 válido                        Correcto CP-37   Reemplazo V1→V3 directo                       Rechazado CP-38   Reemplazo de otro requisito                   Rechazado CP-39   Documento anterior con dos sucesores          Rechazado CP-40   Documento reemplazado vuelve a activo         Rechazado

Casos JSON Schema CP-41 a CP-48

ID                      Escenario                      Esperado

CP-41                   Payload válido                 Aplicación acepta

CP-42                   Falta campo requerido          Aplicación rechaza

CP-43                   Tipo de dato incorrecto        Aplicación rechaza

CP-44                   Fecha inválida                 Aplicación rechaza

CP-45                   Valor fuera de enum          Aplicación rechaza

CP-46                   Propiedad adicional con        Aplicación rechaza additionalProperties=false

CP-47                   Condición no cumplida          Requisito no aplicable

CP-48                   Condición cumplida             Requisito aplicable

Estas pruebas no sustituyen el validador de aplicación.

Casos de flujo CP-49 a CP-52

CP-49 --- Borrador

Crear expediente

→ BORRADOR

→ agregar requisitos

→ cargar documentos

→ sigue BORRADOR

CP-50 --- Radicación

BORRADOR

→ fn_radicacion_expediente()

→ EN_REVISION

CP-51 --- Observación y subsanación

EN_REVISION

→ documento OBSERVADO

→ requisito OBSERVADO

→ expediente SUBSANACION

→ V2 CARGADO

→ requisito SUBSANADO

→ expediente EN_REVISION

CP-52 --- Conclusión documental

Cuando todos los requisitos aplicables estén aprobados:

fn_calcular_estado_documental_expediente()

→ APROBADO

La operación administrativa que actualice el estado del expediente debe ser controlada por el workflow y no debe convertir automáticamente un BORRADOR en radicado.

Elementos que NO deben modificarse

No modificar para "simplificar":

Esquema sigd_doc.

Las 9 tablas.

TIPO_TRAMITE_TUPA separado de TIPO_DOCUMENTO.

Relación 1:1 TUPA ↔ TIPO_DOCUMENTO.

UUID como PK.

Usuarios como referencias externas sin FK local.

FORMULARIO_VERSION como JSON Schema completo en JSONB.

payload_respuestas JSONB dentro de EXPEDIENTE_FORMULARIO_RESPUESTA, asociado 1:1 al EXPEDIENTE.

Eliminación de CAMPO_FORMULARIO y VALOR_CAMPO.

Una sola versión activa.

Inmutabilidad de versiones.

Radicación explícita.

codigo_oficial y fecha_radicacion ligados a la radicación.

EXPEDIENTE_REQUISITO.estado derivado.

MinIO/S3 como almacenamiento físico.

Magic Bytes en aplicación/servicio.

SHA-256 de 64 caracteres hexadecimales e inmutable.

Cadena de reemplazo.

Eliminación lógica.

Límite máximo de 25 MB.

Índices GIN.

Ausencia del índice redundante.

Validaciones que pertenecen a la aplicación

No deben forzarse artificialmente como CHECK PostgreSQL:

JSON Schema Draft 2020-12 completo.

Existencia y permisos de usuarios en sigd_auth.

Magic Bytes sobre los bytes reales.

Lectura/confirmación del objeto MinIO/S3.

Cálculo SHA-256 del contenido real.

Generación y control de URLs prefirmadas.

Existencia real del JSON Pointer dentro del schema.

Autorización del evaluador.

Workflow administrativo completo.

PostgreSQL sí debe proteger las invariantes estructurales y conservar los resultados validados por la aplicación.

Resultado final

La validación queda LISTA PARA INTEGRACIÓN cuando:

las pruebas estructurales devuelven TRUE;

los casos obligatorios producen los resultados esperados;

el expediente permanece BORRADOR hasta la radicación explícita;

el estado del requisito se deriva correctamente;

una carga inicial no se confunde con una subsanación;

los requisitos opcionales y condicionales se tratan correctamente;

los adjuntos cumplen tamaño, cantidad, formato, Magic Bytes y SHA-256;

los reemplazos mantienen la cadena;

los documentos aprobados permanecen inmutables;

no existe eliminación física;

los índices GIN están presentes;

no existe el índice redundante identificado.

Archivo oficial de validación:

backend/docs/modelo-datos/06_validacion_y_casos_prueba.md

Script físico de referencia:

backend/docs/modelo-datos/05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql

Modelo:

backend/docs/modelo-datos/03_modelo_datos_docucore_v2.md

Diccionario:

backend/docs/modelo-datos/04_diccionario_datos_docucore_v2.md

Trazabilidad de la corrección

Esta versión sustituye el documento anterior y elimina referencias del modelo EAV, corrige la validación de fecha_radicacion, separa claramente borrador y radicación, corrige la interpretación de SUBSANADO, incorpora la protección del estado derivado del requisito, incorpora requisitos opcionales/condicionales y elimina la referencia al índice redundante.

Versión: 2.1

Estado: Correcciones documentales listas; integración pendiente de ejecución real de H4.

47. Ejecución reproducible de H4

La auditoría exige evidencia de ejecución real. Por tanto, este documento no declara las pruebas como aprobadas mientras no se ejecuten contra una base PostgreSQL 18+ vacía o de prueba.

Script de ejecución

Archivo:

06_H4_ejecucion_reproducible_docucore_v6.3.sql

La ejecución debe realizarse con psql y detención ante el primer error:

psql -v ON_ERROR_STOP=1 -d <BASE_DE_PRUEBA> -f 06_H4_ejecucion_reproducible_docucore_v6.3.sql

También puede ejecutarse desde pgAdmin 4, registrando los resultados de cada caso.

Evidencia obligatoria

Registrar:

fecha y hora de ejecución;

versión de PostgreSQL;

base de datos de prueba utilizada;

comando ejecutado;

salida de las consultas;

errores encontrados, si existen;

correcciones aplicadas;

código de salida real del proceso;

resultado final de cada caso H4.

Estado actual

PENDIENTE DE EJECUCIÓN REAL.

No debe escribirse PASSED, TRUE ni LISTA PARA INTEGRACIÓN como resultado de ejecución hasta contar con evidencia real.

48. Correcciones incorporadas por la auditoría

Esta versión corrige específicamente las inconsistencias detectadas en la auditoría:

elimina los marcadores de conflicto Git de este documento;

elimina la segunda versión duplicada del documento que aparecía después del marcador =======;

cambia la validación de 8 a 9 tablas;

incorpora EXPEDIENTE_FORMULARIO_RESPUESTA;

mueve la referencia de payload_respuestas desde EXPEDIENTE hacia EXPEDIENTE_FORMULARIO_RESPUESTA, en concordancia con el script SQL v6.3 corregido;

mantiene EXPEDIENTE.id_formulario_version como referencia a la versión exacta utilizada;

actualiza el índice GIN de respuestas JSONB;

mantiene la diferencia entre carga inicial CARGADO y subsanación OBSERVADO → nueva versión CARGADO;

mantiene la radicación como operación explícita;

mantiene la unicidad de SHA-256 por id_expediente_requisito, no global;

mantiene la eliminación lógica y la inmutabilidad de documentos aprobados;

mantiene la protección de EXPEDIENTE_REQUISITO.estado;

deja explícitamente pendiente la ejecución real de H4.

49. Criterio final de integración

El documento podrá marcarse como VALIDADO / LISTO PARA INTEGRACIÓN solamente cuando:

el script SQL v6.3 se ejecute correctamente;

las pruebas estructurales devuelvan TRUE;

CP-01 a CP-52 produzcan los resultados esperados según corresponda;

H4 tenga evidencia de ejecución real;

no existan marcadores de conflicto;

el modelo, diccionario, diagrama, SQL y este documento utilicen los mismos nombres, relaciones y reglas;

la rama consolidada no contenga cambios ajenos a DocuCore;

las contribuciones de otros autores se mantengan con su autoría.

Estado de esta versión: corregida documentalmente, pendiente de ejecución real y de verificación final de alineación con modelo, diccionario, diagrama y rama Git.