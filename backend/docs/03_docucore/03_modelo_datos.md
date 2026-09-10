03. Modelo de Datos

Sistema: Sistema Integral de Gestión Documentaria (SIGD)
Módulo: DocuCore
Autor: Cristian
Rama Git: B_CHRISTIAN
Entregable: docs/modelo-datos/03_modelo_datos.md
Insumos: 01_analisis_objetivo_actores_flujo.md + 02_reglas_requisitos_adjuntos.md
Destinatario: Piero (SQL - B_PIERO)
Fecha: 29 de agosto de 2026

1. Criterio de diseño

El modelo se construye sobre dos ideas que ya vienen definidas y aprobadas en los análisis funcionales:

Configuración separada de instancia: existe un catálogo reutilizable (TIPO_DOCUMENTO, REQUISITO) y una instancia aplicada a un caso concreto (EXPEDIENTE, EXPEDIENTE_REQUISITO). Esto permite que DocuCore sea configurable y no requiera una tabla diferente para cada tipo de trámite.
El estado del requisito se deriva, no se asigna directamente: el evaluador actúa sobre el archivo y el estado del requisito cambia como consecuencia. El modelo soporta esto mediante la relación entre ARCHIVO_ADJUNTO y EXPEDIENTE_REQUISITO.

Decisiones de diseño:

USUARIO se considera una entidad externa al módulo DocuCore. Por ello, DocuCore no crea una tabla USUARIO propia ni mantiene una segunda fuente de identidad. Los identificadores de usuario utilizados en el módulo son referencias externas y no tienen FK hacia una tabla local de usuarios.
EXPEDIENTE se mantiene como entidad propia de DocuCore. Se asume que, para el alcance actual, DocuCore es responsable de gestionar el ciclo de vida documental del expediente. Esta decisión deberá quedar registrada y validarse con el equipo/profesor si posteriormente se define un módulo central de expedientes.
TIPO_DOCUMENTO se mantiene como la entidad que representa el catálogo de trámites configurables.
FORMULARIO se versiona. Cada versión constituye una configuración independiente y los expedientes conservan una referencia directa a la versión de formulario utilizada al momento de su creación.
2. Entidades
2.1. USUARIO — referencia externa

USUARIO no se crea como tabla dentro de DocuCore.

La gestión de identidad, datos personales, roles y estado de los usuarios corresponde al módulo externo responsable de usuarios/autenticación del SIGD.

Cuando DocuCore necesite identificar un usuario, almacenará únicamente su identificador externo.

Los siguientes atributos utilizados en otras entidades son, por tanto, referencias externas sin FK local:

id_usuario_creador
id_usuario_solicitante
id_evaluador

La existencia y validez del usuario deberá ser comprobada por la aplicación o mediante la integración correspondiente con el módulo externo de usuarios.

2.2. TIPO_DOCUMENTO

El catálogo de trámites configurables (ej. Solicitud, Certificado de Estudios, etc.).

Atributo	Tipo	Restricción
id_tipo_documento	BigInt	PK
codigo	Varchar(30)	NOT NULL, UNIQUE
nombre	Varchar(150)	NOT NULL
descripcion	Text	NULL
activo	Boolean	DEFAULT true
id_usuario_creador	BigInt	Referencia externa, sin FK local
fecha_creacion	DateTime	DEFAULT now()
2.3. FORMULARIO

Representa una versión de la definición de campos asociada a un tipo de documento.

El formulario se versiona para garantizar que un expediente conserve la configuración exacta que utilizó cuando fue creado.

Cuando se modifica la configuración de un formulario que ya fue utilizada por expedientes existentes, se debe crear una nueva versión en lugar de modificar la versión histórica.

Atributo	Tipo	Restricción
id_formulario	BigInt	PK
id_tipo_documento	BigInt	FK → TIPO_DOCUMENTO
version	SmallInt	NOT NULL, > 0
activo	Boolean	DEFAULT true
fecha_creacion	DateTime	DEFAULT now()

Restricciones de versionado:

Un mismo TIPO_DOCUMENTO no puede tener dos formularios con la misma version.
Puede existir más de una versión histórica para un mismo tipo de documento.
La versión vigente se identifica mediante activo.
Los formularios utilizados por expedientes históricos no deben modificarse; cualquier cambio estructural debe generar una nueva versión.
2.4. CAMPO_FORMULARIO

Los campos individuales que componen una versión determinada del formulario.

Atributo	Tipo	Restricción
id_campo	BigInt	PK
id_formulario	BigInt	FK → FORMULARIO
nombre_campo	Varchar(150)	NOT NULL
tipo_dato	Enum(TEXTO, NUMERO, FECHA, SELECCION)	NOT NULL
obligatorio	Boolean	DEFAULT true
orden	SmallInt	NOT NULL
opciones	JSONB	NULL; obligatorio para SELECCION

Un campo pertenece a una versión específica de FORMULARIO. Por ello, los cambios realizados en una nueva versión no modifican los campos de las versiones anteriores.

2.5. EXPEDIENTE

El trámite en curso. Para este modelo, EXPEDIENTE permanece como una entidad propia de DocuCore.

Justificación: el módulo necesita controlar el expediente y su ciclo de vida documental dentro del alcance actual. Por ello, no se trata como una referencia externa.

Además, cada expediente conserva directamente el formulario utilizado para su creación. Esto permite mantener la trazabilidad histórica aunque posteriormente exista una nueva versión del formulario.

Atributo	Tipo	Restricción
id_expediente	BigInt	PK
codigo_oficial	Varchar(30)	UNIQUE, NULL; se asigna en la radicación
id_tipo_documento	BigInt	FK → TIPO_DOCUMENTO
id_formulario	BigInt	FK → FORMULARIO
id_usuario_solicitante	BigInt	Referencia externa, sin FK local
estado	Enum(BORRADOR, EN_REVISION, OBSERVADO, APROBADO, RECHAZADO_POR_CADUCIDAD)	DEFAULT BORRADOR
fecha_creacion	DateTime	DEFAULT now()
fecha_radicacion	DateTime	NULL

Regla de trazabilidad:

EXPEDIENTE.id_formulario debe identificar la versión exacta de FORMULARIO utilizada por el expediente.

Por ejemplo:

TIPO_DOCUMENTO
      │
      ├── FORMULARIO v1
      │       └── EXPEDIENTE A
      │
      └── FORMULARIO v2
              └── EXPEDIENTE B

El expediente A seguirá asociado a la versión 1 aunque la versión 2 sea la actualmente activa.

2.6. VALOR_CAMPO

Los datos que el solicitante ingresó en cada campo del formulario utilizado por el expediente.

Atributo	Tipo	Restricción
id_valor_campo	BigInt	PK
id_expediente	BigInt	FK → EXPEDIENTE
id_campo	BigInt	FK → CAMPO_FORMULARIO
valor	Text	NOT NULL

Restricción:

UNIQUE(id_expediente, id_campo) — un campo no puede tener dos valores en el mismo expediente.

La aplicación y/o la base de datos deberá verificar que id_campo pertenezca al FORMULARIO almacenado en EXPEDIENTE.id_formulario.

2.7. REQUISITO

Catálogo de requisitos documentales definido por el análisis funcional.

Atributo	Tipo	Restricción
id_requisito	BigInt	PK
codigo_requisito	Varchar(20)	NOT NULL, UNIQUE
nombre	Varchar(150)	NOT NULL
descripcion_guia	Text	NULL
tipo_obligatoriedad	Enum(OBLIGATORIO, OPCIONAL, CONDICIONAL)	NOT NULL
orden_presentacion	SmallInt	NOT NULL
requiere_vigencia	Boolean	DEFAULT false
dias_vigencia_max	Integer	NULL
permite_multiples	Boolean	DEFAULT false
cantidad_max_archivos	SmallInt	DEFAULT 1
peso_maximo_mb	Decimal(5,2)	NOT NULL
formatos_permitidos	Varchar(100)	NOT NULL
2.8. TIPO_DOCUMENTO_REQUISITO

La matriz de configuración: qué requisitos aplican a qué tipo de documento y bajo qué condición.

Atributo	Tipo	Restricción
id_tipo_documento_requisito	BigInt	PK
id_tipo_documento	BigInt	FK → TIPO_DOCUMENTO
id_requisito	BigInt	FK → REQUISITO
obligatoriedad_override	Enum(OBLIGATORIO, OPCIONAL, CONDICIONAL)	NULL
id_campo_condicionante	BigInt	FK → CAMPO_FORMULARIO, NULL
valor_condicionante	Varchar(100)	NULL

Restricción:

UNIQUE(id_tipo_documento, id_requisito) — un requisito no se repite dos veces para el mismo tipo de documento.

2.9. EXPEDIENTE_REQUISITO

La instancia de un requisito aplicado a un expediente concreto.

Atributo	Tipo	Restricción
id_expediente_requisito	BigInt	PK
id_expediente	BigInt	FK → EXPEDIENTE
id_tipo_documento_requisito	BigInt	FK → TIPO_DOCUMENTO_REQUISITO
estado	Enum(PENDIENTE, OBSERVADO, SUBSANADO, APROBADO)	DEFAULT PENDIENTE
id_evaluador	BigInt	Referencia externa, sin FK local, NULL
fecha_evaluacion	DateTime	NULL
fecha_activacion	DateTime	NULL

Restricción:

UNIQUE(id_expediente, id_tipo_documento_requisito).

2.10. ARCHIVO_ADJUNTO

Archivos asociados a un requisito de un expediente, incluyendo el versionado de archivos.

Atributo	Tipo	Restricción
id_adjunto	BigInt	PK
id_expediente_requisito	BigInt	FK → EXPEDIENTE_REQUISITO
nombre_original	Varchar(255)	NOT NULL
nombre_logico	Varchar(255)	NOT NULL, UNIQUE
ruta_storage	Varchar(500)	NOT NULL
formato_extension	Varchar(10)	NOT NULL
mime_type	Varchar(100)	NOT NULL
tamanio_bytes	BigInt	NOT NULL
hash_sha256	Varchar(64)	NOT NULL
version_num	SmallInt	DEFAULT 1
id_adjunto_anterior	BigInt	FK → ARCHIVO_ADJUNTO, NULL
estado_adjunto	Enum(CARGADO, OBSERVADO, APROBADO, REEMPLAZADO)	DEFAULT CARGADO
fecha_creacion	DateTime	DEFAULT now()

Los campos técnicos como ruta_storage, hash_sha256, version_num e id_adjunto_anterior corresponden a propuestas técnicas del modelo.

3. Relaciones y cardinalidades
Relación	Cardinalidad
Referencia externa USUARIO — TIPO_DOCUMENTO (crea)	1 : N
Referencia externa USUARIO — EXPEDIENTE (solicita)	1 : N
Referencia externa USUARIO — EXPEDIENTE_REQUISITO (evalúa)	1 : N (opcional)
TIPO_DOCUMENTO — FORMULARIO	1 : N (versiones)
FORMULARIO — CAMPO_FORMULARIO	1 : N
TIPO_DOCUMENTO — EXPEDIENTE	1 : N
FORMULARIO — EXPEDIENTE	1 : N
EXPEDIENTE — VALOR_CAMPO	1 : N
CAMPO_FORMULARIO — VALOR_CAMPO	1 : N
TIPO_DOCUMENTO — TIPO_DOCUMENTO_REQUISITO	1 : N
REQUISITO — TIPO_DOCUMENTO_REQUISITO	1 : N
CAMPO_FORMULARIO — TIPO_DOCUMENTO_REQUISITO (condicionante)	1 : N (opcional)
EXPEDIENTE — EXPEDIENTE_REQUISITO	1 : N
TIPO_DOCUMENTO_REQUISITO — EXPEDIENTE_REQUISITO	1 : N
EXPEDIENTE_REQUISITO — ARCHIVO_ADJUNTO	1 : N
ARCHIVO_ADJUNTO — ARCHIVO_ADJUNTO (versión anterior)	1 : N (autorreferencia opcional)

Relación clave para la trazabilidad del formulario:

TIPO_DOCUMENTO
      │
      ├── FORMULARIO v1 ──────┐
      │                       │
      │                       └── EXPEDIENTE 001
      │
      └── FORMULARIO v2 ──────┐
                              │
                              └── EXPEDIENTE 002

De esta manera, un expediente histórico no cambia de formulario cuando se publica una nueva versión.

4. Restricciones que no se resuelven con CHECK simple (para Piero)

Estas reglas de negocio cruzan tablas, por lo que no se implementan únicamente como CHECK de columna. Pueden requerir trigger o validación en aplicación:

Trazabilidad EXPEDIENTE → FORMULARIO: al crear un expediente, id_formulario debe corresponder a un formulario perteneciente al id_tipo_documento seleccionado.
Versión del formulario: no debe permitirse modificar estructuralmente una versión de formulario que ya esté siendo utilizada por expedientes; los cambios deben generar una nueva versión.
Usuario externo: id_usuario_creador, id_usuario_solicitante e id_evaluador no tienen FK local. La existencia del usuario debe validarse mediante el mecanismo de integración con el módulo externo de usuarios.
RN-ADJ-002 (peso máximo): ARCHIVO_ADJUNTO.tamanio_bytes no debe superar REQUISITO.peso_maximo_mb del requisito asociado.
RN-REQ-005 (propagación de estado): al cambiar ARCHIVO_ADJUNTO.estado_adjunto, debe recalcularse EXPEDIENTE_REQUISITO.estado según las reglas correspondientes.
RN-ADJ-005 (deduplicación): requiere lógica de aplicación para verificar hash_sha256.
RN-ADJ-004 (múltiples adjuntos): el número de archivos activos por id_expediente_requisito no debe superar cantidad_max_archivos.

CHECK simples que sí aplican directamente:

EXPEDIENTE.codigo_oficial debe ser NULL mientras estado = BORRADOR.
EXPEDIENTE.fecha_radicacion debe ser NULL mientras estado = BORRADOR.
CAMPO_FORMULARIO.opciones solo debe tener valor cuando tipo_dato = SELECCION.
FORMULARIO.version debe ser mayor que cero.
No debe existir más de una misma versión para un TIPO_DOCUMENTO.
5. Pendiente antes de que Piero traduzca esto a SQL

Antes de implementar el DDL definitivo se debe considerar:

USUARIO: tratarlo como entidad externa y no crear una tabla usuario dentro de DocuCore. Los identificadores de usuario utilizados por DocuCore serán referencias externas sin FOREIGN KEY local.
EXPEDIENTE: mantenerlo como entidad propia de DocuCore para este alcance, dejando documentada esta decisión y su justificación.
FORMULARIO: implementar versionado real. Un TIPO_DOCUMENTO puede tener varias versiones históricas de FORMULARIO.
EXPEDIENTE → FORMULARIO: EXPEDIENTE debe almacenar directamente id_formulario, de modo que cada expediente conserve la versión exacta utilizada.
Integridad del versionado: validar que EXPEDIENTE.id_formulario pertenezca al mismo TIPO_DOCUMENTO indicado en EXPEDIENTE.id_tipo_documento.
Mantener las decisiones y supuestos anteriores documentados en 07_decisiones_y_preguntas_pendientes.md, especialmente los relacionados con la titularidad de USUARIO, EXPEDIENTE y el versionado de FORMULARIO.