# MÓDULO FRONTEND: REGISTRO DE TRÁMITES

**Sistema Integral de Gestión Documentaria**

## Datos del Equipo

- **Grupo:** N.º 1
- **Líder:** Patty
- **Integrantes:** Patty (Líder), Noelia, Lucy, Angy
- **Encargo Frontend:** Diseño, interfaz y comportamiento del Módulo de Registro de Trámites

## 1. Arquitectura y Estructura del Módulo

El módulo Frontend: Registro de Trámites permite al usuario registrar de forma sencilla la información del solicitante y del trámite. Incluye un formulario con validaciones, mensajes de confirmación y generación del cargo o comprobante de recepción, facilitando un registro rápido y ordenado dentro del Sistema.

## 2. Componentes UI del Formulario de Registro

La interfaz se compone de las siguientes secciones y elementos de entrada:

### A. Formulario Principal de Captura (`RegisterForm`)

#### Datos del Solicitante

- **Tipo y N.º de Documento:** Selector (DNI, RUC, Pasaporte) con validación de formato y longitud.
- **Nombres / Razón Social:** Campo de texto para ingresar los datos del solicitante.
- **Contacto:** Campos para correo electrónico y teléfono/celular.

#### Información del Trámite

- **Tipo de Documento:** Menú desplegable (Solicitud, Oficio, Carta, Memorándum, Expediente).
- **Asunto:** Área de texto para describir el motivo del trámite.
- **N.º de Folios:** Campo numérico para indicar la cantidad de hojas.
- **Prioridad:** Selección entre Normal, Urgente y Muy Urgente.
- **Oficina / Área Destino:** Selector para elegir el área responsable de recibir el trámite.

### B. Módulo de Carga de Archivos (`FileUploadZone`)

- **Zona Dropzone:** Permite arrastrar y soltar el archivo principal y sus anexos. Admite formatos `.pdf` y `.docx`.
- **Barra de Progreso:** Muestra visualmente el avance de la carga de los archivos.
- **Previsualizador de Anexos:** Muestra los archivos adjuntados y permite eliminarlos antes de enviar el trámite.

### C. Modal de Confirmación y Cargo (`ReceiptModal`)

- **Ventana Emergente (Modal):** Se muestra cuando el trámite ha sido registrado correctamente.
- **Muestra:**
  - **Código/Número de Expediente:** Identificador asignado al trámite.
  - **Fecha y hora:** Indica el momento exacto del registro.
  - **Botón de Cargo:** Permite imprimir o descargar el comprobante en PDF.

## 3. Manejo de Estados e Interacción (UI/UX)

### Estados del Formulario

- **Idle:** Formulario listo para ingresar datos.
- **Submitting:** Procesando el registro, con botón deshabilitado y indicador de carga.
- **Success:** Registro realizado correctamente y apertura del modal de confirmación.
- **Error:** Muestra un mensaje cuando ocurre un error de validación o conexión.

### Validación en Cliente

- Verifica los datos antes del envío y muestra mensajes de alerta para campos obligatorios, correos inválidos o archivos que superen el tamaño permitido.

## 4. Layout y Tablas de Gestión (Vista de Lista)

Además del formulario de registro, la vista del usuario administrativo/operativo incluye:

- **Tabla de Trámites Registrados (`DataTable`):** Muestra el historial reciente de trámites ingresados con paginación, filtros por fecha y buscador por código de trámite.
- **Badges de Estado:** Etiquetas de colores dinámicas para identificar el estado actual (Pendiente, En Proceso, Derivado, Atendido).
