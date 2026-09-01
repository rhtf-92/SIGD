# 06. Componentes de Interfaz (UI)

## 1. Objetivo

Definir los elementos visuales principales que usará el frontend en el módulo de Flujo Interno y Validez Legal, manteniendo un diseño uniforme, moderno y responsive.

## 2. Componentes del Módulo de Flujos de Trabajo

* **Bandeja de Trabajo (Inbox):** lista de trámites asignados al usuario con filtros por estado, tipo y prioridad.
* **Detalle de Trámite:** expediente completo, requisitos adjuntos, historial de etapas y observaciones.
* **Timeline (Línea de Tiempo):** recorrido visual del trámite por etapas, con fechas, responsables y resultados.
* **Tarjetas de Acción:** botones contextuales por etapa (Aprobar, Derivar, Observar, Rechazar, Devolver).
* **Formulario de Inicio de Trámite:** captura de datos del solicitante, tipo de trámite y requisitos.
* **Panel de Observaciones:** registro de los motivos de devolución y su subsanación.
* **Buscador y Seguimiento:** búsqueda por código de trámite o datos del interesado.

## 3. Componentes del Módulo de Documentos y Firma Digital

* **Selector de Plantillas:** elección de la plantilla oficial según el tipo de documento.
* **Previsualizador de Documento (PDF):** vista previa del documento con datos concatenados.
* **Estado de Firma (Badge):** indicador de *pendiente*, *firmado* u *observado* por cada firmante.
* **Botón "Firmar Digitalmente":** dispara la integración con el proveedor (Refirma/acreditado).
* **Verificador de Firma:** carga un PDF y comprueba integridad y validez de la firma.
* **Descarga y Código QR:** botón de descarga y opción de código QR para verificación externa.
* **Historial de Versiones:** control de versiones del documento antes y después de firmar.

## 4. Diseño y Experiencia de Usuario

* Diseño responsive (computadora, tablet y móvil).
* Navegación lateral integrada al sistema SIGD con fecha y hora actual.
* Selector de modo claro y oscuro consistente con el resto del sistema.
* Alertas y notificaciones amigables para informar cambios de etapa o acciones pendientes.
