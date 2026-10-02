# 04. Diccionario de Datos — DocuCore v2.1

**Sistema:** SIGD — Módulo DocuCore
**Autor:** Cristian
**Rama Git:** `B_CHRISTIAN`
**Entregable:** `backend/docs/modelo-datos/04_diccionario_datos_docucore_v2.md`
**Fecha:** 10 de septiembre de 2026
**Versión:** 3.1 — alineada con el modelo de datos v2.1, el esquema SQL v6.3 y la validación/H4.

Este diccionario explica, en lenguaje llano, qué representa cada entidad del modelo y por qué existe. Su objetivo es que cualquier integrante del equipo pueda comprender la estructura de DocuCore sin necesidad de leer directamente el SQL.

---

## 1. USUARIO

Los usuarios son gestionados por el módulo externo de identidad del SIGD (`sigd_auth`).

Por este motivo, **`USUARIO` no es una tabla propia de DocuCore** y DocuCore no crea una tabla local para almacenar usuarios.

Los campos:

* `id_usuario_creador`
* `id_usuario_solicitante`
* `id_evaluador`
* `id_usuario_subida`

son identificadores externos, normalmente UUID, que permiten relacionar una operación con el usuario correspondiente.

DocuCore **no mantiene una clave foránea local hacia `USUARIO`**.

La identidad, correo, roles, permisos y demás información del usuario pertenecen a `sigd_auth`.

---

## 2. TIPO_TRAMITE_TUPA

Representa la **clasificación legal y administrativa de un trámite según el TUPA**.

Puede contener información como:

* código TUPA;
* nombre del trámite;
* plazo de atención;
* costo;
* unidad responsable;
* base legal;
* modalidad o características administrativas correspondientes.

Esta entidad responde principalmente a la pregunta:

> **¿Qué representa este trámite desde el punto de vista legal y administrativo?**

No define cómo funciona técnicamente el formulario ni qué campos debe completar el ciudadano.

Por eso se mantiene separada de `TIPO_DOCUMENTO`.

### Diferencia con TIPO_DOCUMENTO

| Entidad             | Propósito                                            |
| ------------------- | ---------------------------------------------------- |
| `TIPO_TRAMITE_TUPA` | Clasificación legal/administrativa del trámite       |
| `TIPO_DOCUMENTO`    | Configuración técnica del trámite dentro de DocuCore |

La separación evita mezclar la información normativa del TUPA con la configuración técnica del sistema.

---

## 3. TIPO_DOCUMENTO

Representa la **configuración técnica de un trámite dentro de DocuCore**.

Define aspectos como:

* código de negocio (`codigo_tipo`);
* nombre y descripción;
* formulario que utiliza;
* requisitos que debe presentar;
* configuración y estado de activación.

Un `TIPO_DOCUMENTO` puede estar inicialmente en proceso de configuración antes de que su clasificación TUPA haya sido confirmada.

Cuando la configuración se encuentra activa, debe contar con su correspondiente clasificación `TIPO_TRAMITE_TUPA`, de acuerdo con las reglas definidas para el sistema.

El campo `activo` utiliza:

```sql
DEFAULT TRUE
```

La relación con `TIPO_TRAMITE_TUPA` permite separar la configuración técnica de la clasificación legal.

---

## 4. FORMULARIO_VERSION

Representa una **versión específica e inmutable de un formulario**.

El formulario utiliza **JSON Schema Draft 2020-12** para describir su estructura y reglas de validación.

La columna `schema_definicion JSONB` contiene la definición completa del formulario, incluyendo:

* campos;
* tipos de datos;
* propiedades;
* obligatoriedad;
* restricciones;
* opciones;
* reglas de validación;
* lógica condicional mediante `if/then/else`, cuando corresponda.

### Versionamiento

Una versión publicada no se modifica directamente.

Cuando el formulario cambia:

1. se crea una nueva fila;
2. se incrementa el número de versión;
3. la versión anterior permanece disponible como historial;
4. los expedientes existentes continúan apuntando a la versión que utilizaron originalmente.

Esto permite conservar la trazabilidad histórica.

Por ejemplo:

```text
Formulario v1 → Expediente A
Formulario v2 → Expediente B
Formulario v3 → Expediente C
```

El expediente A continúa asociado a v1 aunque posteriormente exista v2 o v3.

---

## 5. CAMPO_FORMULARIO — ELIMINADA

`CAMPO_FORMULARIO` ya no existe como tabla independiente.

Los campos del formulario se encuentran definidos dentro del JSON Schema almacenado en:

```text
FORMULARIO_VERSION.schema_definicion
```

Por ejemplo, una propiedad como:

```json
{
  "properties": {
    "tipo_persona": {
      "type": "string"
    }
  }
}
```

representa un campo del formulario sin necesidad de crear una fila en `CAMPO_FORMULARIO`.

Esto reduce la cantidad de tablas y relaciones necesarias para representar la estructura del formulario.

---

## 6. EXPEDIENTE

Representa un **trámite concreto iniciado por un solicitante**.

El expediente mantiene información administrativa y de seguimiento, además de la referencia a la versión exacta del formulario utilizado.

El expediente se crea inicialmente en:

```text
BORRADOR
```

La transición a un estado administrativo posterior se realiza mediante el flujo correspondiente. En particular, la radicación se ejecuta explícitamente mediante:

```text
fn_radicacion_expediente()
```

### Formulario utilizado

El expediente mantiene una referencia directa a:

```text
FORMULARIO_VERSION
```

Esto permite saber exactamente qué versión del formulario utilizó el ciudadano.

### Respuestas del formulario

Las respuestas **no se almacenan directamente dentro de `EXPEDIENTE`**.

Se almacenan en la entidad:

```text
EXPEDIENTE_FORMULARIO_RESPUESTA
```

Esta separación permite mantener claramente diferenciadas:

* la información administrativa del expediente;
* la versión del formulario utilizada;
* las respuestas entregadas por el solicitante.

### Estado del expediente

El estado administrativo del expediente **no cambia automáticamente únicamente porque cambie el estado de un requisito**.

La revisión documental y la radicación administrativa son responsabilidades relacionadas, pero diferenciadas.

Por tanto:

```text
EXPEDIENTE_REQUISITO.estado
```

no debe interpretarse como una actualización automática de:

```text
EXPEDIENTE.estado
```

La radicación continúa siendo una operación explícita del flujo.

---

## 7. EXPEDIENTE_FORMULARIO_RESPUESTA

Representa las **respuestas proporcionadas por el solicitante para un expediente**.

La entidad contiene:

```text
id_expediente_formulario_respuesta
id_expediente
id_formulario_version
payload_respuestas
```

La columna:

```text
payload_respuestas JSONB
```

almacena todas las respuestas como un único documento JSON.

### Relación

Cada expediente tiene una única colección de respuestas asociada:

```text
EXPEDIENTE 1 ─── 1 EXPEDIENTE_FORMULARIO_RESPUESTA
```

Además, la respuesta identifica la versión exacta del formulario:

```text
FORMULARIO_VERSION 1 ─── N EXPEDIENTE_FORMULARIO_RESPUESTA
```

La aplicación debe verificar que:

```text
EXPEDIENTE_FORMULARIO_RESPUESTA.id_formulario_version
```

corresponda exactamente con la versión de formulario asociada al expediente.

### Validación

El contenido de `payload_respuestas` se valida en la aplicación contra:

```text
FORMULARIO_VERSION.schema_definicion
```

La base de datos almacena el JSON, mientras que el validador JSON Schema de la aplicación comprueba la estructura y las reglas definidas para el formulario.

Se dispone además de un índice GIN para facilitar operaciones sobre el contenido JSONB.

---

## 8. VALOR_CAMPO — ELIMINADA

`VALOR_CAMPO` ya no existe como tabla independiente.

Las respuestas se almacenan dentro de:

```text
EXPEDIENTE_FORMULARIO_RESPUESTA.payload_respuestas
```

Esto reemplaza el antiguo modelo en el que existía una fila independiente por cada respuesta.

La validación completa del contenido corresponde al validador JSON Schema de la aplicación.

---

## 9. REQUISITO

Representa una **exigencia documental que puede ser solicitada dentro de un trámite**.

Ejemplos:

* DNI;
* comprobante de pago;
* certificado;
* declaración jurada.

Un mismo requisito puede ser reutilizado por diferentes tipos de documento.

La configuración del requisito contempla límites institucionales relacionados con los archivos que puede recibir.

El tamaño máximo permitido por archivo se encuentra sujeto al límite institucional configurado, con el límite global establecido por DocuCore.

---

## 10. TIPO_DOCUMENTO_REQUISITO

Es la entidad que relaciona:

```text
TIPO_DOCUMENTO
```

con:

```text
REQUISITO
```

Permite indicar:

* qué requisito se solicita;
* si es obligatorio;
* si permite múltiples documentos;
* si tiene una condición;
* qué condición debe evaluarse.

### Requisitos condicionales

Como `CAMPO_FORMULARIO` fue eliminada, ya no existe una FK hacia una fila que represente un campo.

En su lugar se utiliza una ruta dentro del JSON, por ejemplo:

```text
/tipo_persona
```

La aplicación debe verificar que esa ruta exista en el JSON Schema correspondiente y que pueda utilizarse para evaluar la condición.

Esto permite expresar reglas como:

> El requisito X solamente aplica cuando `tipo_persona = "JURIDICA"`.

La existencia y validez del JSON Pointer debe comprobarse en la capa de aplicación.

---

## 11. EXPEDIENTE_REQUISITO

Representa la **aplicación de un requisito concreto dentro de un expediente específico**.

Es decir, mientras `REQUISITO` define un requisito reutilizable del catálogo, `EXPEDIENTE_REQUISITO` representa ese requisito aplicado a un expediente determinado.

Aquí se controla el estado documental del requisito:

```text
PENDIENTE
OBSERVADO
SUBSANADO
APROBADO
```

### Estado derivado

El estado de `EXPEDIENTE_REQUISITO` se obtiene a partir de la situación de sus documentos adjuntos.

Por ejemplo:

```text
Documento CARGADO
        ↓
Requisito PENDIENTE
```

Si el documento es observado:

```text
Documento OBSERVADO
        ↓
Requisito OBSERVADO
```

Si posteriormente se presenta una nueva versión válida:

```text
V1 OBSERVADO
       ↓
V2 CARGADO
       ↓
Requisito SUBSANADO
```

El evaluador no debe modificar arbitrariamente el estado del requisito ignorando las reglas del flujo documental.

### Importante: no existe propagación automática al expediente

El cambio del estado de `EXPEDIENTE_REQUISITO` **no significa que `EXPEDIENTE.estado` se modifique automáticamente**.

Son dos niveles diferentes:

```text
EXPEDIENTE_REQUISITO
        ↓
Estado documental del requisito
```

y:

```text
EXPEDIENTE
        ↓
Estado administrativo del trámite
```

La radicación y las transiciones administrativas del expediente se ejecutan mediante las operaciones explícitas definidas por el flujo.

---

## 12. DOCUMENTO_ADJUNTO

Representa un **archivo presentado para cumplir un requisito**.

El archivo binario no se almacena directamente dentro de PostgreSQL.

El contenido se almacena en un sistema externo compatible con:

```text
MinIO / S3
```

PostgreSQL conserva principalmente los metadatos necesarios para localizar, identificar, validar y controlar el documento.

Entre ellos:

* `s3_bucket`;
* `s3_key`;
* `nombre_original`;
* extensión;
* MIME;
* tamaño;
* `sha256_hash`;
* resultado de validación mediante Magic Bytes;
* estado del documento;
* usuario que realizó la carga;
* fechas relevantes;
* referencia al documento anterior cuando existe reemplazo.

### Carga del archivo

El flujo previsto utiliza una URL temporal/presignada para permitir la transferencia del archivo hacia MinIO/S3.

La base de datos no necesita almacenar el binario completo.

### Magic Bytes

El MIME declarado y la extensión no son suficientes para confiar en el tipo real de un archivo.

Por ello, el sistema utiliza validación mediante **Magic Bytes**, que permite comprobar que el contenido real corresponde al formato esperado.

Esta comprobación debe realizarse sobre los bytes reales del archivo en la capa de aplicación/almacenamiento.

El campo:

```text
magic_bytes_validado
```

registra el resultado de dicha validación.

### SHA-256

`sha256_hash` representa la huella digital del contenido del archivo.

La unicidad se controla **dentro del requisito al que pertenece el documento**, no de manera global para todo DocuCore.

Esto permite que dos requisitos diferentes puedan tener archivos con el mismo contenido sin generar una colisión de unicidad entre ellos.

En términos conceptuales:

```text
(id_expediente_requisito, sha256_hash)
```

es la combinación utilizada para controlar duplicados dentro de un mismo requisito.

---

## 13. Reemplazo de documentos

Cuando un documento es observado y el solicitante debe presentar una nueva versión, el documento anterior **no se elimina físicamente**.

Se registra un nuevo `DOCUMENTO_ADJUNTO` y se relaciona con el documento anterior mediante:

```text
id_documento_anterior
```

La cadena puede representarse como:

```text
V1 → V2 → V3
```

Cada versión permanece almacenada como registro histórico.

La sustitución debe respetar la secuencia de versiones y no debe permitir cadenas inválidas.

---

## 14. Eliminación lógica

Los documentos no se eliminan físicamente de la base de datos como mecanismo normal de operación.

Cuando corresponda retirar un documento de la operación activa, se utiliza el mecanismo de **eliminación lógica** previsto por el modelo.

Esto permite conservar:

* trazabilidad;
* historial;
* auditoría;
* relación entre versiones;
* evidencia de las operaciones realizadas.

---

# Relaciones clave explicadas

## USUARIO → entidades DocuCore

DocuCore puede almacenar identificadores de usuarios en entidades como:

```text
TIPO_DOCUMENTO
EXPEDIENTE
EXPEDIENTE_REQUISITO
DOCUMENTO_ADJUNTO
```

Estos identificadores pertenecen al sistema externo `sigd_auth`.

No existe una tabla `USUARIO` local en DocuCore.

---

## TIPO_TRAMITE_TUPA ↔ TIPO_DOCUMENTO

La relación representa la separación entre:

```text
clasificación legal
        ↕
configuración técnica
```

Un `TIPO_DOCUMENTO` puede encontrarse inicialmente sin clasificación TUPA mientras se encuentra en proceso de validación/configuración.

Una configuración técnica activa debe contar con la clasificación TUPA correspondiente.

---

## TIPO_DOCUMENTO ↔ REQUISITO

La relación es de muchos a muchos mediante:

```text
TIPO_DOCUMENTO_REQUISITO
```

Por ejemplo:

```text
TIPO_DOCUMENTO A
 ├── DNI
 ├── Comprobante de pago
 └── Declaración jurada

TIPO_DOCUMENTO B
 ├── DNI
 └── Certificado
```

El mismo requisito puede reutilizarse en diferentes trámites.

---

## TIPO_DOCUMENTO → FORMULARIO_VERSION → EXPEDIENTE

El tipo de documento utiliza una o varias versiones de formulario.

Cada expediente apunta directamente a la versión exacta que utilizó.

Conceptualmente:

```text
TIPO_DOCUMENTO
       ↓
FORMULARIO_VERSION
       ↓
EXPEDIENTE
```

La referencia directa del expediente a `FORMULARIO_VERSION` garantiza la trazabilidad histórica.

Si posteriormente se publica una nueva versión, los expedientes anteriores no cambian de formulario.

---

## EXPEDIENTE → EXPEDIENTE_FORMULARIO_RESPUESTA

La relación es:

```text
EXPEDIENTE 1 ─── 1 EXPEDIENTE_FORMULARIO_RESPUESTA
```

El expediente mantiene la información administrativa, mientras que `EXPEDIENTE_FORMULARIO_RESPUESTA` mantiene las respuestas JSON del formulario.

---

## FORMULARIO_VERSION → EXPEDIENTE_FORMULARIO_RESPUESTA

Una versión de formulario puede estar asociada a las respuestas de muchos expedientes:

```text
FORMULARIO_VERSION 1 ─── N EXPEDIENTE_FORMULARIO_RESPUESTA
```

Esto permite conservar la relación histórica entre las respuestas y el esquema utilizado para validarlas.

---

## EXPEDIENTE_REQUISITO → DOCUMENTO_ADJUNTO

Un requisito aplicado a un expediente puede tener:

* ningún documento;
* un documento;
* varios documentos cuando se permiten múltiples archivos;
* varias versiones debido a subsanaciones o reemplazos.

Ejemplo:

```text
EXPEDIENTE_REQUISITO
        │
        ├── DOCUMENTO V1
        │
        └── DOCUMENTO V2
                ↑
        reemplaza a V1
```

---

## DOCUMENTO_ADJUNTO → DOCUMENTO_ADJUNTO

Existe una autorreferencia mediante:

```text
id_documento_anterior
```

que permite representar la cadena histórica de reemplazos:

```text
V1 → V2 → V3
```

Los documentos anteriores permanecen disponibles para trazabilidad.

---

# Resumen de las 9 entidades físicas de DocuCore

| # | Entidad                           | Propósito                                               |
| - | --------------------------------- | ------------------------------------------------------- |
| 1 | `TIPO_TRAMITE_TUPA`               | Clasificación legal/administrativa                      |
| 2 | `TIPO_DOCUMENTO`                  | Configuración técnica del trámite                       |
| 3 | `FORMULARIO_VERSION`              | Versión inmutable del formulario y su JSON Schema       |
| 4 | `EXPEDIENTE`                      | Trámite concreto iniciado por un solicitante            |
| 5 | `EXPEDIENTE_FORMULARIO_RESPUESTA` | Respuestas JSON del expediente                          |
| 6 | `REQUISITO`                       | Catálogo reutilizable de requisitos                     |
| 7 | `TIPO_DOCUMENTO_REQUISITO`        | Relación entre trámite y requisito                      |
| 8 | `EXPEDIENTE_REQUISITO`            | Requisito aplicado a un expediente                      |
| 9 | `DOCUMENTO_ADJUNTO`               | Metadatos y control de archivos almacenados en MinIO/S3 |

**`USUARIO` no forma parte de estas nueve tablas porque pertenece a `sigd_auth`.**

También fueron eliminadas como tablas independientes:

* `CAMPO_FORMULARIO`;
* `VALOR_CAMPO`.

---

# Reglas de alineación importantes

El diccionario debe mantenerse consistente con el modelo, SQL y pruebas de DocuCore.

### 1. Respuestas del formulario

La estructura correcta es:

```text
EXPEDIENTE
    │
    └── EXPEDIENTE_FORMULARIO_RESPUESTA
              │
              └── payload_respuestas JSONB
```

No debe existir simultáneamente otro `payload_respuestas` dentro de `EXPEDIENTE`.

### 2. Estados

La carga de un documento no implica automáticamente:

```text
EXPEDIENTE → EN_REVISION
```

ni la observación de un requisito implica automáticamente:

```text
EXPEDIENTE → SUBSANACION
```

La radicación y las transiciones administrativas del expediente deben seguir el flujo explícito definido para DocuCore.

### 3. Documento CARGADO

Un documento recién cargado no debe considerarse automáticamente `APROBADO`.

El flujo documental diferencia, como mínimo:

```text
CARGADO
   ↓
revisión
   ↓
APROBADO / OBSERVADO
```

### 4. SHA-256

La unicidad de:

```text
sha256_hash
```

se controla por requisito mediante la combinación:

```text
id_expediente_requisito + sha256_hash
```

No debe existir una restricción UNIQUE global sobre `sha256_hash`.

### 5. Nombres canónicos

Para evitar diferencias entre documentos, diagrama y SQL se utilizan los nombres:

```text
nombre_original
sha256_hash
```

y no variantes como:

```text
nombre_archivo
sha256
```

### 6. TIPO_DOCUMENTO

El campo:

```text
activo
```

tiene como valor predeterminado:

```text
TRUE
```

### 7. Calificación administrativa

`calificacion_administrativa` se considera un campo obligatorio conforme al modelo y al esquema SQL.

### 8. Validación H4

La existencia de este diccionario y la consistencia documental **no significa que H4 haya sido aprobado**.

H4 debe ejecutarse realmente contra PostgreSQL y conservar:

* comando utilizado;
* salida obtenida;
* resultado de cada caso;
* código de salida real del proceso.

Hasta disponer de esa evidencia, H4 debe permanecer como:

```text
PENDIENTE DE EJECUCIÓN
```

---

# Alineación documental

Este diccionario debe mantenerse alineado con:

```text
03_modelo_datos_docucore_v2.md
05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql
06_validacion_y_casos_prueba.md
06_H4_ejecucion_reproducible_docucore_v6.3.sql
06_DocuCore_Diagrama_ER_Auditoria_v3.drawio
```

La cantidad de tablas físicas de DocuCore debe ser consistente entre el modelo, diccionario, diagrama y SQL:

```text
9 tablas locales de DocuCore
+
USUARIO externo de sigd_auth
```

Cualquier cambio posterior en el modelo debe reflejarse también en el diccionario, SQL, diagrama y casos de validación antes de considerar el entregable integrado.

---

# Estado de este documento

**Versión:** 3.1
**Estado:** Corregido para alineación documental con el modelo v2.1 y SQL v6.3.
**H4:** Pendiente de ejecución real.
**PR hacia `B_GERIC`:** No crear hasta completar la limpieza/alineación de la rama, resolver conflictos, verificar el diff final y ejecutar las pruebas H4.
