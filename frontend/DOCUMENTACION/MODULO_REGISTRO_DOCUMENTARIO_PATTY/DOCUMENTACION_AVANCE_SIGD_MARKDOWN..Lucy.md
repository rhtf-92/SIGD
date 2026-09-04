# DOCUMENTACIÓN DE AVANCE DEL PROYECTO SIGD

## MÓDULO FRONTEND: REGISTRO DE TRÁMITES

**Sistema:** Sistema Integral de Gestión Documentaria (SIGD)

---

# 1. PLANIFICACIÓN

## 1.1 Investigación del estado situacional

El módulo de Registro de Trámites busca permitir al usuario registrar de forma sencilla y ordenada la información del solicitante y del trámite dentro del SIGD.

El módulo contempla el ingreso de datos, validaciones, carga de archivos, confirmación del registro y consulta de los trámites registrados.

### Objetivo del módulo

- Registrar información del solicitante.
- Registrar información del trámite.
- Cargar el documento principal y anexos.
- Validar los datos antes del envío.
- Confirmar el registro.
- Generar el cargo o comprobante de recepción.
- Consultar trámites registrados.

## 1.2 Documentación adecuada del SIGD

### Datos del equipo

- **Grupo:** N.º 1
- **Líder:** Patty
- **Integrantes:** Patty (Líder), Noelia, Lucy, Angy
- **Encargo Frontend:** Diseño, interfaz y comportamiento del Módulo de Registro de Trámites

---

# 2. ANÁLISIS

## 2.1 Documentación en Markdown

La documentación del módulo se organiza en formato Markdown para facilitar su lectura, mantenimiento y publicación en el repositorio del proyecto.

### Arquitectura y estructura

El módulo Frontend de Registro de Trámites permite registrar la información del solicitante y del trámite. Incluye un formulario con validaciones, mensajes de confirmación y generación del cargo o comprobante de recepción.

### Componentes principales

- `RegisterForm`
- `FileUploadZone`
- `ReceiptModal`
- `DataTable`

---

# 3. DISEÑO

## 3.1 Consolidación de los mockups de las interfaces

### Formulario principal — `RegisterForm`

#### Datos del solicitante

- **Tipo y N.º de Documento:** DNI, RUC o Pasaporte.
- **Nombres / Razón Social:** campo para ingresar los datos del solicitante.
- **Contacto:** correo electrónico y teléfono/celular.

#### Información del trámite

- **Tipo de Documento:** Solicitud, Oficio, Carta, Memorándum o Expediente.
- **Asunto:** área de texto para describir el motivo del trámite.
- **N.º de Folios:** cantidad de hojas.
- **Prioridad:** Normal, Urgente o Muy Urgente.
- **Oficina / Área Destino:** área responsable de recibir el trámite.

### Carga de archivos — `FileUploadZone`

- Zona para arrastrar y soltar archivos.
- Archivo principal y anexos.
- Formatos admitidos: `.pdf` y `.docx`.
- Barra de progreso.
- Previsualización de anexos.
- Eliminación de archivos antes de enviar.

### Confirmación — `ReceiptModal`

- Código o número de expediente.
- Fecha y hora del registro.
- Opción para imprimir o descargar el cargo en PDF.

### Vista de lista — `DataTable`

- Historial reciente de trámites.
- Paginación.
- Filtros por fecha.
- Búsqueda por código de trámite.

### Estados visuales

- Pendiente
- En Proceso
- Derivado
- Atendido

> **Pendiente:** agregar las capturas de todos los mockups realizados por el equipo.

---

# 4. DESARROLLO

## 4.1 Versión V1.0

La primera versión del módulo contempla la estructura del formulario de Registro de Trámites y sus principales componentes de interfaz.

### Funcionalidades

- Registro de datos del solicitante.
- Registro de información del trámite.
- Selección del tipo de documento.
- Selección de prioridad.
- Selección de oficina o área destino.
- Carga del documento principal.
- Carga de archivos anexos.
- Barra de progreso.
- Eliminación de anexos.
- Validación de información.
- Confirmación del registro.
- Visualización del código de expediente.
- Consulta de trámites registrados.

## 4.2 Estados del formulario

### Idle

Formulario listo para ingresar datos.

### Submitting

Procesando el registro, con botón deshabilitado e indicador de carga.

### Success

Registro realizado correctamente y apertura del modal de confirmación.

### Error

Mensaje cuando ocurre un error de validación o conexión.

## 4.3 Validación en cliente

Se verifican los datos antes del envío:

- Campos obligatorios.
- Formato y longitud del documento.
- Correos electrónicos inválidos.
- Cantidad de folios.
- Archivos que superen el tamaño permitido.

---

# 4.4 Manual de usuario

## Paso 1. Ingresar al módulo

Acceder al módulo **Registro de Trámites**.

## Paso 2. Registrar los datos del solicitante

Ingresar:

1. Tipo de documento.
2. Número de documento.
3. Nombres o razón social.
4. Correo electrónico.
5. Teléfono o celular.

## Paso 3. Registrar la información del trámite

Ingresar:

1. Tipo de documento.
2. Asunto.
3. Número de folios.
4. Prioridad.
5. Oficina o área destino.

## Paso 4. Adjuntar archivos

Cargar el documento principal y los anexos permitidos.

Formatos contemplados:

- PDF
- DOCX

## Paso 5. Registrar el trámite

Verificar la información y enviar el formulario.

## Paso 6. Verificar la confirmación

Cuando el registro sea exitoso, se muestra el `ReceiptModal` con:

- Código o número de expediente.
- Fecha y hora.
- Cargo o comprobante.

## Paso 7. Consultar los trámites

La tabla permite consultar el historial mediante:

- Paginación.
- Filtro por fecha.
- Búsqueda por código.

---

# 5. TEST / QA

## 5.1 Pruebas funcionales

| N.º | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| 1 | Ingresar datos válidos | El formulario permite continuar | Pendiente |
| 2 | Campos obligatorios vacíos | Se muestran mensajes de validación | Pendiente |
| 3 | Documento inválido | Se muestra alerta de validación | Pendiente |
| 4 | Correo inválido | Se muestra mensaje de error | Pendiente |
| 5 | Cargar archivo permitido | El archivo aparece en la lista | Pendiente |
| 6 | Archivo no permitido | El sistema rechaza el archivo | Pendiente |
| 7 | Registrar trámite | Se muestra el modal de confirmación | Pendiente |
| 8 | Error de conexión | Se muestra mensaje de error | Pendiente |
| 9 | Consultar trámites | Se muestra la tabla | Pendiente |
| 10 | Buscar por código | Se filtran los resultados | Pendiente |

> **Pendiente:** reemplazar los estados por los resultados reales después de ejecutar las pruebas.

---

# 6. DESPLIEGUE

## 6.1 Preparación

Antes del despliegue se debe verificar:

- Código actualizado.
- Ausencia de errores que impidan ejecutar el módulo.
- Funcionalidades principales probadas.
- Documentación actualizada.

## 6.2 Publicación

El código del módulo debe mantenerse en el repositorio correspondiente y en la rama de trabajo asignada.

> **Pendiente:** agregar la evidencia del despliegue y la dirección donde se encuentra publicada la aplicación.

## 6.3 Verificación posterior

Comprobar:

- Acceso al sistema.
- Visualización del módulo.
- Funcionamiento del formulario.
- Validaciones.
- Carga de archivos.
- Registro del trámite.
- Modal de confirmación.
- Consulta de trámites.

---

# 7. RESUMEN DEL AVANCE

| Etapa | Actividad | Avance |
|---|---|---|
| Planificación | Investigación del estado situacional | En documentación |
| Planificación | Documentación del SIGD | En documentación |
| Análisis | Documentación Markdown | Completado |
| Diseño | Estructura y componentes de interfaces | Completado |
| Diseño | Mockups | Pendiente de evidencias |
| Desarrollo | V1.0 | En desarrollo |
| Desarrollo | Manual de usuario | Documentado |
| Test / QA | Pruebas funcionales | Pendiente |
| Despliegue | Publicación | Pendiente |

---

# 8. CONCLUSIÓN

El módulo **Frontend: Registro de Trámites** cuenta con la definición de sus principales componentes, estructura de interfaz, campos de registro, carga de archivos, confirmación, estados del formulario, validaciones y vista de trámites registrados.

La documentación está organizada según las etapas solicitadas para el proyecto: **Planificación, Análisis, Diseño, Desarrollo, Test/QA y Despliegue**.

Las evidencias de mockups, pruebas QA, versión V1.0 ejecutada y despliegue deberán incorporarse conforme avance la implementación.
