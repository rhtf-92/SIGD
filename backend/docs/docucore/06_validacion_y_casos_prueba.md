<<<<<<< HEAD:docs/06_validacion_y_casos_prueba.md
06. Validación y Casos de Prueba --- DocuCore v2
Sistema: Sistema Integral de Gestión Documentaria (SIGD)
Módulo: DocuCore --- Documentos, Requisitos y Formularios (Grupo 5)
Fase: 2 --- JSON Schema, PostgreSQL JSONB y Storage S3/MinIO
Responsable: Piero --- Implementador SQL (B_PIERO)
Esquema validado: sigd_doc
Script principal: 05_esquema_sigd_doc_jsonb.sql
Modelo fuente: 03_modelo_datos_docucore_v2.md
Diccionario fuente: 04_diccionario_datos_docucore_v2.md
Fecha: 9 de septiembre de 2026
Versión: 2.0 --- Validación consolidada según DocuCore v2.0
1. Objetivo
Este documento valida el esquema físico PostgreSQL de DocuCore y su correspondencia con el modelo de datos y el diccionario aprobados.
Se validan:
8 tablas principales del esquema sigd_doc.
ENUM, UUID, PK, FK, UNIQUE y CHECK.
Catálogo TUPA separado de TIPO_DOCUMENTO.
Relación 1:1 entre TIPO_TRAMITE_TUPA y TIPO_DOCUMENTO.
JSON Schema Draft 2020-12 + JSONB.
Versionado e inmutabilidad de FORMULARIO_VERSION.
payload_respuestas JSONB en EXPEDIENTE.
Requisitos obligatorios, opcionales y condicionales.
Estado derivado de EXPEDIENTE_REQUISITO.
Radicación explícita del expediente.
Adjuntos como metadatos de objetos MinIO/S3.
Magic Bytes y SHA-256.
Reemplazo y eliminación lógica.
Límites de tamaño y cantidad.
Índices GIN y ausencia de índices redundantes conocidos.
Las validaciones que dependen de bytes reales, MinIO/S3, JSON Schema completo o sigd_auth pertenecen a la aplicación/servicios y se identifican expresamente.
2. Fuentes
La validación utiliza como fuentes:
03_modelo_datos_docucore_v2.md
04_diccionario_datos_docucore_v2.md
05_esquema_sigd_docucore_v2.sql --- nombre de archivo corregido para el esquema físico
El modelo establece que USUARIO es externo, que TUPA y TIPO_DOCUMENTO son entidades separadas, que FORMULARIO_VERSION concentra la definición JSON Schema y que EXPEDIENTE conserva payload_respuestas y la versión exacta del formulario.
El diccionario establece que el estado de EXPEDIENTE_REQUISITO se deriva de los documentos, que BORRADOR no equivale a radicación y que el binario se almacena externamente en MinIO/S3.
3. Requisitos previos
PostgreSQL 18+.
Base de datos de prueba.
Permisos para crear esquema, tipos, tablas, funciones, triggers e índices.
psql o pgAdmin 4.
Ejecutar el script físico:
05_esquema_sigd_docucore_v2.sql
El script utiliza pgcrypto para gen_random_uuid().
Los datos de prueba deben ser ficticios y no deben contener DNI, nombres reales, contraseñas ni documentos reales.
4. Existencia del esquema
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name = 'sigd_doc';
Esperado: sigd_doc.
5. Las 8 tablas oficiales
SELECT COUNT(*) AS cantidad_tablas
FROM information_schema.tables
WHERE table_schema = 'sigd_doc'
  AND table_type = 'BASE TABLE';
Esperado:
8
Tablas:
\# Tabla
1 `documento_adjunto`
 2 `expediente`
 3 `expediente_requisito`
 4 `formulario_version`
 5 `requisito`
 6 `tipo_documento`
 7 `tipo_documento_requisito`
 8 `tipo_tramite_tupa`
No deben existir campo_formulario ni valor_campo: DocuCore v2 elimina el modelo EAV.
6. ENUM
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
7. PK UUID
Todas las PK deben ser UUID y utilizar generación automática mediante gen_random_uuid().
Tabla                        PK
tipo_tramite_tupa          id_tipo_tramite_tupa tipo_documento             id_tipo_documento formulario_version         id_formulario_version expediente                 id_expediente requisito                  id_requisito tipo_documento_requisito   id_tipo_documento_requisito expediente_requisito       id_expediente_requisito documento_adjunto          id_documento_adjunto
8. Referencias externas de USUARIO
DocuCore no crea una tabla usuario local.
Son referencias UUID externas:
id_usuario_creador
id_usuario_solicitante
id_evaluador
id_usuario_subida
No deben agregarse FK locales hacia una tabla usuario de DocuCore.
La existencia y autorización del usuario se validan contra sigd_auth en la aplicación.
9. TUPA
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
10. TIPO_DOCUMENTO en borrador
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
11. Relación 1:1 TUPA ↔ TIPO_DOCUMENTO
La relación aprobada es:
TIPO_TRAMITE_TUPA  1 ───── 1  TIPO_DOCUMENTO
La restricción:
uq_tipo_documento_tupa
impide asociar el mismo TUPA a dos tipos documentales.
Esta restricción no debe eliminarse.
12. FORMULARIO_VERSION
Una fila representa una versión completa del formulario:
FORMULARIO_VERSION.schema_definicion = JSON Schema Draft 2020-12
Debe ser JSONB.
Debe cumplirse:
version > 0
UNIQUE(id_tipo_documento, version)
máximo una versión activa por tipo documental
La validación completa del JSON Schema corresponde a la aplicación.
13. Única versión activa
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
14. Inmutabilidad de FORMULARIO_VERSION
No se deben modificar después de creados:
schema_definicion
version
id_tipo_documento
Intentar modificar cualquiera de ellos debe producir error mediante:
tr_proteger_formulario_version
La modificación de un formulario se realiza creando una nueva versión.
15. EXPEDIENTE y JSONB
EXPEDIENTE conserva:
id_formulario_version;
id_usuario_solicitante;
payload_respuestas;
estado;
codigo_oficial;
fecha_creacion;
fecha_radicacion.
payload_respuestas debe ser JSONB y almacenar un objeto JSON.
El expediente mantiene la versión exacta del formulario usada al iniciar el trámite.
16. BORRADOR
Un expediente nuevo debe iniciar:
estado = BORRADOR
codigo_oficial = NULL
fecha_radicacion = NULL
El modelo distingue claramente:
BORRADOR ≠ RADICACIÓN
Completar el formulario o cargar requisitos no debe radicar automáticamente el expediente.
17. Invariantes de radicación
Caso inválido:
BORRADOR + codigo_oficial
Debe rechazarse por:
ck_expediente_codigo_oficial
Caso inválido:
BORRADOR + fecha_radicacion
Debe rechazarse por:
ck_expediente_radicacion
Estas restricciones no deben eliminarse.
18. Radicación explícita
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
19. REQUISITO
Debe permitir:
OBLIGATORIO
OPCIONAL
CONDICIONAL
El límite institucional de tamaño configurado es:
0 < peso_maximo_mb <= 25
Un valor superior a 25 debe rechazarse por:
ck_requisito_peso_maximo
20. Vigencia del requisito
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
21. TIPO_DOCUMENTO_REQUISITO
Representa la relación M:N:
TIPO_DOCUMENTO ↔ REQUISITO
Debe cumplirse:
UNIQUE(id_tipo_documento, id_requisito)
La obligatoriedad puede heredarse de REQUISITO o sobrescribirse mediante:
obligatoriedad_override
22. Requisitos condicionales
El modelo no utiliza una FK a CAMPO_FORMULARIO.
Utiliza:
campo_condicionante_path
valor_condicionante
Ejemplo:
/tipo_persona
JURIDICA
El path debe ser un JSON Pointer válido.
La aplicación debe comprobar que la ruta exista realmente en el JSON Schema correspondiente.
23. EXPEDIENTE_REQUISITO
Una instancia de requisito nace:
estado = PENDIENTE
Debe cumplirse:
UNIQUE(id_expediente, id_tipo_documento_requisito)
Además, el requisito debe corresponder al mismo TIPO_DOCUMENTO de la versión de formulario utilizada por el expediente.
La validación se realiza mediante:
tr_validar_expediente_requisito
24. Estado derivado del requisito
EXPEDIENTE_REQUISITO.estado no debe ser editado directamente por el evaluador.
Reglas:
Documento vigente                      Estado
No existe documento vigente            PENDIENTE Documento vigente observado            OBSERVADO Nueva versión después de observación   SUBSANADO Documento vigente aprobado             APROBADO
La protección se realiza mediante:
tr_proteger_estado_expediente_requisito
25. Diferencia entre carga inicial y subsanación
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
26. DOCUMENTO_ADJUNTO
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
27. Tamaño y cantidad de archivos
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
28. Formato y Magic Bytes
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
29. SHA-256
El hash debe tener:
64 caracteres hexadecimales
Ejemplo válido:
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
Ejemplo inválido:
HASH_INVALIDO
Debe rechazarse por:
ck_documento_hash
Además, el hash debe permanecer inmutable después de la inserción.
30. Deduplificación
El esquema consolidado utiliza:
uq_documento_sha256
para impedir duplicados del mismo SHA-256.
Esta regla debe mantenerse salvo que una decisión institucional futura defina explícitamente otra política.
31. Versionado de documentos
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
32. Documento aprobado
Un documento APROBADO es inmutable.
No debe poder modificarse.
Tampoco puede aprobarse si:
magic_bytes_validado = FALSE
Debe rechazarse por la protección del documento.
33. Eliminación lógica
No se permite eliminar físicamente un documento.
Debe utilizarse:
SELECT sigd_doc.fn_eliminar_logicamente_documento(
    'UUID_DOCUMENTO'
);
Resultado:
estado_documento = ELIMINADO
El registro histórico permanece en PostgreSQL.
Los documentos REEMPLAZADO o ELIMINADO no pueden volver a un estado activo.
34. Estado documental del expediente
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
35. Flujo correcto de estados
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
36. Índices JSONB
Debe existir GIN para:
formulario_version.schema_definicion
y:
expediente.payload_respuestas
El índice de respuestas debe utilizar:
jsonb_path_ops
cuando así lo define el script consolidado.
37. Ausencia de índice redundante
La restricción:
uq_expediente_requisito
ya crea el índice necesario para:
(id_expediente, id_tipo_documento_requisito)
Por tanto, no debe existir un índice adicional duplicado llamado:
idx_expediente_requisito_integridad
sin una justificación técnica.
38. Pruebas estructurales consolidadas
Ejecutar:
SELECT 'tablas_principales' AS prueba,
       COUNT(*) = 8 AS ok
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
39. Casos CP-01 a CP-20
ID      Escenario                                       Esperado
CP-01   Crear TUPA con clasificación válida             Correcto CP-02   TUPA formal sin clasificación                   Rechazado CP-03   Crear tipo documental en borrador sin TUPA      Correcto CP-04   Activar tipo documental sin TUPA                Rechazado CP-05   Asociar dos tipos al mismo TUPA                 Rechazado CP-06   Crear formulario versión 1                      Correcto CP-07   Repetir número de versión                       Rechazado CP-08   Crear versión 0                                 Rechazado CP-09   Crear versión 2 inactiva                        Correcto CP-10   Activar dos versiones                           Rechazado CP-11   Modificar definición de formulario              Rechazado CP-12   Crear expediente con formulario activo          BORRADOR CP-13   Crear expediente con formulario inactivo        Rechazado CP-14   Crear expediente con tipo documental inactivo   Rechazado CP-15   BORRADOR con código oficial                   Rechazado CP-16   BORRADOR con fecha de radicación              Rechazado CP-17   Completar requisitos de un borrador             Continúa BORRADOR CP-18   Radicar explícitamente                          EN_REVISION + código + fecha CP-19   Crear requisito válido                          Correcto CP-20   Peso > 25 MB                                   Rechazado
40. Casos CP-21 a CP-40
ID      Escenario                                     Esperado
CP-21   Vigencia incoherente                          Rechazado CP-22   Crear relación TIPO_DOCUMENTO--REQUISITO      Correcto CP-23   Repetir relación                              Rechazado CP-24   Crear requisito de expediente                 PENDIENTE CP-25   Modificar directamente estado del requisito   Rechazado CP-26   Carga inicial V1                              No es SUBSANADO CP-27   V1 observada + V2 enlazada                    SUBSANADO CP-28   Aprobar sin Magic Bytes                       Rechazado CP-29   Eliminar físicamente documento                Rechazado CP-30   Eliminación lógica                            ELIMINADO CP-31   Modificar documento aprobado                  Rechazado CP-32   SHA-256 inválido                              Rechazado CP-33   Modificar SHA-256                             Rechazado CP-34   Archivo sobre límite                          Rechazado CP-35   Segundo archivo sin múltiples                 Rechazado CP-36   Reemplazo V1→V2 válido                        Correcto CP-37   Reemplazo V1→V3 directo                       Rechazado CP-38   Reemplazo de otro requisito                   Rechazado CP-39   Documento anterior con dos sucesores          Rechazado CP-40   Documento reemplazado vuelve a activo         Rechazado
41. Casos JSON Schema CP-41 a CP-48
ID                      Escenario                      Esperado
CP-41                   Payload válido                 Aplicación acepta
CP-42                   Falta campo requerido          Aplicación rechaza
CP-43                   Tipo de dato incorrecto        Aplicación rechaza
CP-44                   Fecha inválida                 Aplicación rechaza
CP-45                   Valor fuera de enum          Aplicación rechaza
CP-46                   Propiedad adicional con        Aplicación rechaza additionalProperties=false
CP-47                   Condición no cumplida          Requisito no aplicable
CP-48                   Condición cumplida             Requisito aplicable
Estas pruebas no sustituyen el validador de aplicación.
42. Casos de flujo CP-49 a CP-52
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
43. Elementos que NO deben modificarse
No modificar para "simplificar":
Esquema sigd_doc.
Las 8 tablas.
TIPO_TRAMITE_TUPA separado de TIPO_DOCUMENTO.
Relación 1:1 TUPA ↔ TIPO_DOCUMENTO.
UUID como PK.
Usuarios como referencias externas sin FK local.
FORMULARIO_VERSION como JSON Schema completo en JSONB.
payload_respuestas JSONB dentro de EXPEDIENTE.
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
44. Validaciones que pertenecen a la aplicación
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
45. Resultado final
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
backend/docs/modelo-datos/05_esquema_sigd_docucore_v2.sql
Modelo:
backend/docs/modelo-datos/03_modelo_datos_docucore_v2.md
Diccionario:
backend/docs/modelo-datos/04_diccionario_datos_docucore_v2.md
46. Trazabilidad de la corrección
Esta versión sustituye el documento anterior y elimina referencias del modelo EAV, corrige la validación de fecha_radicacion, separa claramente borrador y radicación, corrige la interpretación de SUBSANADO, incorpora la protección del estado derivado del requisito, incorpora requisitos opcionales/condicionales y elimina la referencia al índice redundante.
Versión: 2.0
Estado: Lista para integración después de ejecutar las pruebas.
=======
# Validación y casos de prueba: documentos y formularios

**Sistema:** SIGD — DocuCore
**Alcance:** configuración de tipos de documento, formularios versionados y captura de datos para la creación de expedientes en borrador.
**Base:** análisis funcional A, modelo de datos v2.0 y script SQL v3.
**Estado esperado general:** si todas las validaciones son correctas, se crea o actualiza el expediente en `BORRADOR`. La radicación y los adjuntos se validan en el módulo correspondiente.
**Versión de este documento:** 2.0 — corrige VAL-FOR-003, CP-05, VAL-FOR-008/CP-18 y agrega casos de versionado, para reflejar que `FORMULARIO` admite varias versiones y que `EXPEDIENTE` referencia `id_formulario` (versión exacta), no `id_tipo_documento`.

## Reglas de validación

| Código | Regla | Resultado esperado |
|---|---|---|
| VAL-FOR-001 | El código del tipo de documento es obligatorio y único. | No se permite registrar un código vacío ni repetido. |
| VAL-FOR-002 | El tipo de documento debe tener nombre. | Se rechaza el registro sin nombre. |
| VAL-FOR-003 | Un tipo de documento puede tener varias **versiones** de formulario, pero solo una puede estar activa a la vez. | Se permite crear una nueva versión; no se permite tener dos versiones activas simultáneamente para el mismo tipo de documento. |
| VAL-FOR-004 | Todo campo tiene nombre y orden positivo; el orden es único dentro de su versión de formulario. | Se rechazan nombres vacíos, orden 0/negativo y órdenes repetidos dentro de la misma versión. |
| VAL-FOR-005 | Un campo `SELECCION` requiere opciones; los demás tipos no deben almacenarlas. | Se rechaza una configuración incoherente. |
| VAL-FOR-006 | Los campos obligatorios deben tener un valor no vacío antes de guardar/enviar el formulario. | Se muestra el campo pendiente y no se completa la operación. |
| VAL-FOR-007 | El valor ingresado debe corresponder a su tipo: texto, número, fecha o una opción configurada. | Se informa el campo con formato inválido. |
| VAL-FOR-008 | Un expediente solo puede guardar valores de campos de la **versión exacta de formulario** (`id_formulario`) que tiene asociada — no de otra versión del mismo tipo de documento, ni de otro tipo. | Se rechaza la asociación inconsistente. |
| VAL-FOR-009 | Un campo solo puede tener una respuesta por expediente. | Se actualiza la respuesta existente o se rechaza el segundo registro. |
| VAL-FOR-010 | Un expediente en `BORRADOR` no tiene código oficial ni fecha de radicación. | Se rechaza cualquier combinación inconsistente de estado, código y fecha. |
| VAL-FOR-011 *(nuevo)* | Un expediente ya creado sigue funcionando con la versión de formulario que tenía al momento de su creación, aunque después se publique una versión nueva. | El expediente antiguo no se ve afectado por cambios posteriores al formulario. |

## Datos de prueba base

Crear el tipo de documento **SOL-001 — Solicitud general**, con la versión 1 del formulario:

| Orden | Campo | Tipo | Obligatorio | Opciones |
|---:|---|---|---|---|
| 1 | asunto | TEXTO | Sí | — |
| 2 | cantidad_copias | NUMERO | Sí | — |
| 3 | fecha_solicitud | FECHA | Sí | — |
| 4 | tipo_persona | SELECCION | Sí | NATURAL, JURIDICA |
| 5 | observacion | TEXTO | No | — |

Para los casos de versionado (CP-21 a CP-23), se crea además una **versión 2** del mismo tipo de documento, agregando el campo `numero_expediente_anterior` (TEXTO, opcional) a los cinco campos anteriores.

## Casos de prueba

| ID | Escenario y datos de entrada | Resultado esperado |
|---|---|---|
| CP-01 | Registrar `SOL-001`, nombre "Solicitud general". | El tipo se registra correctamente. |
| CP-02 | Registrar otro tipo con código `SOL-001`. | Se rechaza por código duplicado (VAL-FOR-001). |
| CP-03 | Registrar un tipo con código vacío o solo espacios. | Se rechaza (VAL-FOR-001). |
| CP-04 | Crear el formulario versión 1 para `SOL-001`, `activo = true`. | Se crea correctamente. |
| CP-05 | Crear un segundo formulario (versión 2) para `SOL-001`. | **Se crea correctamente** — ya no se rechaza (VAL-FOR-003 corregida). Ver CP-21 a CP-23 para el comportamiento de activación. |
| CP-06 | Agregar campo `asunto` con orden 1 en la versión 1. | El campo se registra. |
| CP-07 | Agregar otro campo con orden 1 en la misma versión de formulario. | Se rechaza por orden duplicado (VAL-FOR-004). |
| CP-08 | Configurar `tipo_persona` como `SELECCION` sin opciones. | Se rechaza (VAL-FOR-005). |
| CP-09 | Configurar `observacion` como `TEXTO` con opciones `A,B`. | Se rechaza (VAL-FOR-005). |
| CP-10 | Crear un expediente de la versión 1 de `SOL-001` en `BORRADOR`, sin código oficial. | Se crea correctamente, referenciando `id_formulario` de la versión 1. |
| CP-11 | Crear un expediente `BORRADOR` con código oficial `EXP-2026-0001`. | Se rechaza (VAL-FOR-010). |
| CP-12 | Guardar: asunto "Solicitud de certificado", cantidad 2, fecha válida, tipo_persona `NATURAL`. | Se guardan los cuatro valores y el expediente continúa en borrador. |
| CP-13 | Intentar enviar dejando `asunto` vacío. | Se bloquea el envío y se indica que `asunto` es obligatorio (VAL-FOR-006). |
| CP-14 | Ingresar `dos` en `cantidad_copias`. | Se rechaza por formato numérico inválido (VAL-FOR-007). |
| CP-15 | Ingresar `29/02/2025` como fecha. | Se rechaza por fecha inexistente (VAL-FOR-007). |
| CP-16 | Elegir `EXTRANJERO` en `tipo_persona`. | Se rechaza: no pertenece a las opciones configuradas (VAL-FOR-007). |
| CP-17 | Guardar dos respuestas para `asunto` en el mismo expediente. | Solo debe existir una; se actualiza o se rechaza el duplicado (VAL-FOR-009). |
| CP-18 | Intentar guardar en un expediente de la versión 1 un valor para el campo `numero_expediente_anterior`, que solo existe en la versión 2. | Se rechaza por pertenencia inválida — el campo no es de la versión exacta que el expediente referencia (VAL-FOR-008 corregida). |
| CP-19 | Dejar `observacion` sin valor. | Se permite porque es opcional. |
| CP-20 | Marcar el formulario o tipo de documento como inactivo e intentar iniciar un nuevo expediente. | Se bloquea la creación y se informa que el trámite no está disponible. |
| CP-21 *(nuevo)* | Activar la versión 2 de `SOL-001` (`activo = true`). | La versión 2 queda activa y la versión 1 pasa automáticamente a `activo = false` (índice único parcial). Nunca hay dos versiones activas a la vez para el mismo tipo de documento. |
| CP-22 *(nuevo)* | Con la versión 2 ya activa, consultar el expediente creado en CP-10 (creado sobre la versión 1). | El expediente sigue referenciando la versión 1 sin cambios; sus valores de campo siguen siendo válidos (VAL-FOR-011). |
| CP-23 *(nuevo)* | Iniciar un expediente nuevo de `SOL-001` estando la versión 2 activa. | El expediente nuevo se crea referenciando `id_formulario` de la versión 2, no la 1. |

## Criterio de aceptación

La funcionalidad se acepta cuando los casos CP-01 a CP-23 producen el resultado esperado, no se pueden guardar configuraciones ni respuestas inconsistentes, nunca hay dos versiones de formulario activas simultáneamente para un mismo tipo de documento, los expedientes antiguos no se ven afectados por nuevas versiones, y los mensajes identifican el campo que debe corregirse.

> Nota: las validaciones de tipo de dato y obligatoriedad deben ejecutarse en la interfaz y en el servicio de backend. El script SQL asegura además la integridad estructural, la unicidad de versión activa y la pertenencia del campo a la versión exacta de formulario del expediente; PostgreSQL no puede interpretar por sí solo el contenido de texto como número o fecha sin una regla adicional de aplicación.
>
> Pendiente: este documento describe el plan de pruebas. Sigue faltando la ejecución real (INSERTs) contra una base de datos vacía, con evidencia de resultado, errores encontrados y correcciones — ver solicitud de corrección previa a Piero.
>>>>>>> 71c3a153299304822ebc4b54c4ef320bc500cc90:backend/docs/docucore/06_validacion_y_casos_prueba.md
