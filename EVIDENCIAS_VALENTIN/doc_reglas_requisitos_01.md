# 02. Análisis Funcional B: Reglas de Negocio, Requisitos y Archivos Adjuntos

**Sistema:** Sistema Integral de Gestión Documentaria (SIGD)  
**Módulo:** Módulo de Gestión Documental y Expedientes - DocuCore  
**Autor:** Valentín  
**Rama Git:** `B_VALENTIN`  
**Entregable:** `docs/analisis-funcional/02_reglas_requisitos_adjuntos.md`  
**Destinatario:** Cristian (Modelado de Datos - `B_CHRISTIAN`)  
**Fecha:** 27 de agosto de 2026  

---

## 1. Contexto General y Propósito del Módulo

El Módulo **DocuCore** es el núcleo de captura, validación y procesamiento de trámites en el Sistema Integral de Gestión Documentaria (SIGD). Dentro de esta arquitectura, el **Análisis Funcional B** define el comportamiento estricto que deben seguir las solicitudes cuando los usuarios (ciudadanos o personal interno) radican documentos y cargan archivos adjuntos.

Este documento establece las reglas lógicas, restricciones y diccionarios de datos necesarios para garantizar que:
1. No se ingresen expedientes incompletos o con información inconsistente.
2. Los archivos adjuntos cumplan con estándares de integridad, peso y formato antes de almacenarse en el repositorio central.
3. El modelo de datos diseñado por Cristian pueda soportar la trazabilidad completa (auditoría) de cada documento desde su recepción hasta su resolución.

---

## 2. Clasificación Formativa de la Información

Para evitar asumir parámetros técnicos que dependan de la infraestructura del cliente, la información se divide en tres niveles de certeza:

### 2.1. Información Confirmada (Reglas del Negocio Oficiales)
* **Tipificación:** Cada tipo de trámite (ej. *Licencia de Funcionamiento*, *Acceso a la Información*, *Mesa de Partes*) posee una matriz de requisitos preconfigurada.
* **Bloqueo Operativo:** Un trámite no puede cambiar a estado `EN_REVISION` ni generar un código oficial de registro si falta al menos un requisito obligatorio.
* **Asociación Unívoca:** Todo archivo subido pertenece a un único requisito dentro de un expediente específico.
* **Control de Modificación:** Un archivo aprobado por un evaluador queda congelado de manera permanente (inmutable) y no puede ser eliminado o sobrescrito por el solicitante.

### 2.2. Propuestas Técnicas (Arquitectura Funcional Recomendada)
* **Estrategia de Almacenamiento (Storage Lógico):** Los archivos físicos no se guardarán dentro de la base de datos (evitando el uso de `BLOB`), sino en un servidor de archivos o Object Storage (S3/MinIO), registrando en la base de datos únicamente la ruta lógica `URI/Path`.
* **Mapeo Hash (Checksum SHA-256):** Calcular automáticamente una firma digital hash al subir el archivo para evitar la carga repetida de adjuntos idénticos en el mismo expediente.
* **Control de Versiones en Subsanación:** Cuando un requisito sea marcado como `OBSERVADO`, el sistema no eliminará el archivo rechazado, sino que creará un nuevo registro de archivo enlazado a la versión histórica (`v1`, `v2`, etc.).

### 2.3. Datos Pendientes de Validación (Parámetros Configurables)
* **Tope Máximo Global:** Límite máximo de megabytes (MB) permitidos por la suma total de adjuntos en un mismo expediente.
* **MIME-Types Habilitados:** Confirmación por parte de TI de la lista blanca oficial de extensiones autorizadas (ej. `.pdf`, `.png`, `.jpg`, `.docx`, `.xlsx`, `.dwG`, `.zip`).
* **Tiempo Límite de Subsanación:** Plazo máximo en días hábiles otorgado al ciudadano para subsanar observaciones antes del rechazo automático por caducidad (archivamiento).

---

## 3. Reglas de Negocio Detalladas (RN)

### 3.1. Reglas para Requisitos Documentales

#### **RN-REQ-001: Clasificación de Obligatoriedad**
Todo requisito configurado para un trámite en el catálogo del sistema debe asignarse a una de las siguientes tres categorías:
* `OBLIGATORIO`: Requisito indispensable para continuar con la radicación.
* `OPCIONAL`: Requisito complementario. Su ausencia no impide el envío.
* `CONDICIONAL`: Requisito cuya visibilidad y exigencia dependen de una regla lógica del formulario.

#### **RN-REQ-002: Lógica de Condicionalidad Dinámica**
La exigencia de un requisito condicional se evaluará en tiempo real durante la interacción con el formulario.  
* *Regla:* `SI (Atributo_Formulario == Valor_Desencadenante) ENTONCES Estado_Requisito = ACTIVO_OBLIGATORIO`.
* *Ejemplo:* Si el usuario selecciona *Tipo de Solicitante = "Persona Jurídica"*, el sistema activa como obligatorio el requisito `Vigencia de Poder del Representante Legal`. Si selecciona *"Persona Natural"*, dicho requisito se mantiene oculto e inactivo.

#### **RN-REQ-003: Control de Antigüedad y Vigencia**
Si la bandera `Requiere_Vigencia` está habilitada en la configuración del requisito:
1. El usuario debe ingresar obligatoriamente la **Fecha de Emisión** del documento adjunto.
2. El sistema calculará la diferencia de días entre la `Fecha_Actual` y la `Fecha_Emisión`.
3. Si `(Fecha_Actual - Fecha_Emisión) > Dias_Vigencia_Maximos`, el sistema generará una alerta de caducidad y aplicará la regla de caso excepcional correspondiente.

#### **RN-REQ-004: Secuencia Ordinal de Presentación**
Los requisitos deben mostrarse en las interfaces de usuario (web y móvil) ordenados estrictamente de manera ascendente según el atributo `Orden_Presentacion`. Esto garantiza una experiencia de usuario estandarizada y coherente con las normativas legales de la entidad.

---

### 3.2. Reglas para Archivos Adjuntos

#### **RN-ADJ-001: Validación Estricta de Extensiones y Formato (MIME-Type)**
El sistema no se basará únicamente en la extensión del archivo (ej. `.pdf`), sino que inspeccionará los cabezales del archivo (MIME-Type real) durante el proceso de carga. Cualquier discordancia entre la extensión y el contenido real bloqueará la subida.

#### **RN-ADJ-002: Control de Peso y Almacenamiento**
Cada tipo de requisito tendrá parametrizado un tamaño máximo individual (`Tamanio_Max_MB`). El sistema rechazará en el frontend y validará nuevamente en el backend que el archivo no supere dicho valor antes de consumar la subida al repositorio físico.

#### **RN-ADJ-003: Generación del Nombre Lógico Unificado**
Para evitar conflictos de nombres, caracteres especiales, espacios o riesgos de seguridad (inyección de código), el sistema nunca guardará el archivo con su nombre de origen. En su lugar, generará un `Nombre_Logico` único mediante la siguiente regla:

$$\text{Nombre\_Logico} = \text{"TRM\_"} + \text{ID\_EXPEDIENTE} + \text{"\_REQ\_"} + \text{ID\_REQUISITO} + \text{"\_"} + \text{TIMESTAMP\_MS} + \text{"."} + \text{EXT}$$

*Ejemplo:* `TRM_109482_REQ_004_1724781082123.pdf`

#### **RN-ADJ-004: Cardinalidad y Múltiples Adjuntos**
Cuando un requisito esté configurado con `Permite_Multiples = VERDADERO`:
* Se establecerá un límite entero en el atributo `Cantidad_Max_Archivos`.
* El sistema permitirá al usuario adjuntar varios archivos de forma independiente para el mismo requisito.
* Cada archivo adjunto se registrará como un ítem individual en la entidad `Archivo_Adjunto`, compartiendo el mismo `ID_Requisito_Expediente`.

---

## 4. Diccionario de Datos / Insumo para Cristian (`B_CHRISTIAN`)

Para facilitar el diseño de la base de datos relacional (tablas, tipos de datos y claves foráneas), se detallan los campos necesarios para cada entidad funcional:

### 4.1. Entidad: `REQUISITO` (Catálogo Base)
* **`id_requisito`** (PK, BigInt, Auto): Identificador único del requisito.
* **`codigo_requisito`** (Varchar(20)): Código alfanumérico estandarizado (ej. `REQ-DNI-01`).
* **`nombre`** (Varchar(150)): Título del requisito visible al público.
* **`descripcion_guia`** (Text): Explicación detallada e instrucciones sobre cómo emitir o adjuntar el documento.
* **`tipo_obligatoriedad`** (Enum: `'OBLIGATORIO'`, `'OPCIONAL'`, `'CONDICIONAL'`): Regla de exigencia.
* **`orden_presentacion`** (SmallInt): Posición numérica en pantalla.
* **`requiere_vigencia`** (Boolean): Indica si evalúa vigencia por fecha de emisión.
* **`dias_vigencia_max`** (Integer, Nullable): Antigüedad máxima permitida en días.
* **`permite_multiples`** (Boolean): Permite asociar más de un archivo.
* **`cantidad_max_archivos`** (SmallInt, Default 1): Límite de subida cuando es múltiple.
* **`peso_maximo_mb`** (Decimal(5,2)): Límite de tamaño para el archivo.
* **`formatos_permitidos`** (Varchar(100)): Lista separada por comas de extensiones válidas (ej. `"PDF,JPG,PNG"`).

### 4.2. Entidad: `ARCHIVO_ADJUNTO` (Instancia de Archivo en Expediente)
* **`id_adjunto`** (PK, BigInt, Auto): Identificador único del archivo físico subido.
* **`id_expediente_requisito`** (FK, BigInt): Clave foránea al requisito asociado en la solicitud.
* **`nombre_original`** (Varchar(255)): Nombre real del archivo en la computadora del usuario.
* **`nombre_logico`** (Varchar(255), Unique): Nombre procesado con el que se guarda en el storage.
* **`ruta_storage`** (Varchar(500)): Path relativo o URL privada en el servidor/cloud.
* **`formato_extension`** (Varchar(10)): Extensión detectada (ej. `"pdf"`).
* **`mime_type`** (Varchar(100)): Tipo MIME oficial (ej. `"application/pdf"`).
* **`tamanio_bytes`** (BigInt): Tamaño exacto registrado.
* **`hash_sha256`** (Varchar(64)): Hash para verificación de integridad y prevención de duplicados.
* **`version_num`** (SmallInt, Default 1): Número de versión en caso de subsanación.
* **`estado_adjunto`** (Enum: `'CARGADO'`, `'APROBADO'`, `'OBSERVADO'`, `'REEMPLAZADO'`): Estado funcional del archivo en la revisión.
* **`fecha_creacion`** (DateTime): Timestamp exacto de la subida.

---

## 5. Matriz Integrada de Requisitos y Adjuntos

Esta tabla especifica el comportamiento esperado para distintos escenarios típicos dentro del SIGD:

| ID Requisito | Nombre del Requisito | Tipo Obligatoriedad | Formatos Permitidos | Peso Máx. Ind. | Permite Múltiples | Regla de Vigencia / Regla Condicional |
|---|---|---|---|---|---|---|
| **REQ-001** | Documento Nacional de Identidad (DNI) | Obligatorio | PDF, JPG, PNG | 5 MB | No (1:1) | Sin vigencia. Aplica a todo tipo de solicitante. |
| **REQ-002** | Comprobante de Pago de Derechos de Tramitación | Obligatorio | PDF, JPG | 2 MB | No (1:1) | Vigencia máx. de 30 días desde la fecha de emisión del voucher. |
| **REQ-003** | Vigencia de Poder Representante Legal | Condicional | PDF | 10 MB | No (1:1) | Activo solo si *Tipo_Persona = "JURIDICA"*. Vigencia máx. de 30 días. |
| **REQ-004** | Anexos Técnicos, Planos y Memorias Descriptivas | Opcional | PDF, DWG, ZIP | 25 MB | Sí (1:N, Máx 5) | Sin vigencia. Permite cargas múltiples progresivas. |
| **REQ-005** | Autorización Sectorial Previa | Condicional | PDF | 8 MB | No (1:1) | Activo si *Afecta_Entorno = "VERDADERO"*. Vigencia máx. de 365 días. |

---

## 6. Matriz de Casos Excepcionales, Control de Errores y Mensajes al Usuario

Esta matriz define la respuesta del sistema tanto en interfaz (frontend) como en lógica (backend) ante eventualidades y fallos de usuario:

| Código | Condición / Evento de Error | Resultado Esperado del Sistema | Mensaje Amigable para el Usuario |
|---|---|---|---|
| **EX-001** | Intento de enviar el trámite con requisitos obligatorios o condicionales activos no adjuntados. | Bloquea la acción de envío, enfoca la pantalla en la sección faltante y resalta los bloques incompletos en rojo. | *"No se puede completar el registro. Aún faltan requisitos obligatorios por adjuntar. Por favor revise la lista."* |
| **EX-002** | Intento de subida de un archivo que supera el límite de peso configurado (`tamanio_bytes > peso_maximo_mb`). | Cancela la transferencia del archivo en segundo plano, no consume almacenamiento y limpia el campo. | *"El archivo '[nombre_original]' excede el peso máximo permitido ([X] MB). Por favor optimice o comprima el documento."* |
| **EX-003** | Selección de un archivo cuya extensión o MIME-Type no figura en `formatos_permitidos`. | Rechaza la selección del archivo en el selector del navegador y muestra alerta de formato no válido. | *"El formato del archivo '.[ext]' no está permitido para este requisito. Formatos aceptados: [Lista_Formatos]."* |
| **EX-004** | Detección de `hash_sha256` duplicado para dos requisitos diferentes dentro del mismo expediente. | Alerta al usuario sobre la duplicidad detectada antes de confirmar la carga. | *"Advertencia: El archivo '[nombre_original]' ya ha sido adjuntado en otro requisito de esta misma solicitud. ¿Desea continuar?"* |
| **EX-005** | Intento de modificar o adjuntar archivos en un trámite en estado `EN_REVISION`, `APROBADO` o `INACTIVO`. | Deshabilita todos los botones de subida, eliminación o reemplazo de archivos en la interfaz. | *"El expediente se encuentra en fase de evaluación y no admite cambios ni nuevos adjuntos en este momento."* |
| **EX-006** | La fecha de emisión ingresada supera los días de antigüedad permitidos (`Dias_Vigencia_Max`). | Registra la subida pero etiqueta automáticamente el requisito con estado preventivo `'OBSERVADO'`. | *"Atención: El documento adjunto supera los [X] días de antigüedad permitidos. Quedará sujeto a evaluación del revisor."* |
| **EX-007** | Intento de adjuntar más archivos de los permitidos cuando `Permite_Multiples = VERDADERO`. | Oculta o deshabilita el botón "Agregar otro archivo" al alcanzar el límite `cantidad_max_archivos`. | *"Ha alcanzado el límite máximo permitido de [X] archivos para este requisito."* |

---

## 7. Ejemplo de Flujo de Operación Completo

### Escenario: Registro de Trámite por Persona Jurídica con Subsanación
1. **Paso 1 (Inicio):** El usuario ingresa a la plataforma web e inicia la solicitud del trámite *"Licencia Ambiental"*.
2. **Paso 2 (Evaluación Condicional):** En los datos generales del formulario, el usuario elige `Tipo_Persona = "Jurídica"`. El motor de reglas (RN-REQ-002) activa automáticamente los requisitos `REQ-001`, `REQ-002` y el condicional `REQ-003: Vigencia de Poder`.
3. **Paso 3 (Validación de Subida Exitoso):** Para `REQ-001` sube `dni_representante.pdf` (2.1 MB). El sistema valida la extensión, genera el hash SHA-256 y le asigna el nombre lógico `TRM_8819_REQ_001_1724782001.pdf`.
4. **Paso 4 (Manejo de Excepción por Tamaño):** Para `REQ-003` intenta subir un plano de 30 MB. Se activa el caso excepcional **EX-002**, mostrando el mensaje de error y cancelando la subida. El usuario comprime el plano a 8 MB y el sistema lo acepta.
5. **Paso 5 (Radicación):** Con todos los requisitos obligatorios cargados, el sistema otorga el código oficial de expediente `EXP-2026-008819` y cambia el estado a `EN_REVISION`.
6. **Paso 6 (Ciclo de Subsanación por el Evaluador):** El evaluador interno observa el `REQ-003` por estar borroso. El sistema actualiza el estado del requisito a `'OBSERVADO'` y notifica al usuario.
7. **Paso 7 (Reemplazo y Versionado):** El usuario vuelve a la plataforma, sube un nuevo archivo en `REQ-003`. El sistema mantiene el archivo original con `version_num = 1` y marca el nuevo archivo como `version_num = 2`, `estado_adjunto = 'CARGADO'`, garantizando la trazabilidad histórica.

---

## 8. Preguntas Pendientes de Validación Institucional

Las siguientes interrogantes deben ser coordinadas con el cliente o el líder del proyecto para ajustar los parámetros en la base de datos:

1. **Topes Globales de Almacenamiento:** ¿Existe un límite de peso sumado para todo el expediente (ej. máximo 50 MB en total sumando todos los adjuntos) para evitar la saturación del servidor?
2. **Admisibilidad de Comprimidos:** ¿Se permitirá oficialmente la subida de archivos `.ZIP` o `.RAR` en requisitos de tipo múltiple, o es obligatorio descompresionarlos previamente?
3. **Firmas Digitales PKI:** ¿El módulo debe integrar una librería para validar el certificado digital nativo (Firma Perú / Refirma) dentro de los PDF al momento de la subida, o el archivo se acepta tal cual y la firma se valida visualmente por el evaluador?
4. **Plazos Caducidad de Subsanación (SLA):** ¿Cuántos días hábiles tendrá el usuario para corregir un requisito observado antes de que el sistema cambie automáticamente el trámite a estado `'RECHAZADO_POR_CADUCIDAD'`?