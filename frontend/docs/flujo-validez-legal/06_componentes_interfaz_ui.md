| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-FLUJO-VALIDEZ-LEGAL-06 |
| **Módulo** | flujo-validez-legal / Flujo Interno de Trabajo y Validez Legal |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Geric, Jacobo, Jhasy |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 06. Catálogo de Componentes de Interfaz de Usuario (UI)

## 1. Visión General del Sistema de Diseño

El catálogo de componentes de interfaz para el Módulo de Flujo Interno y Validez Legal está construido bajo el estándar **Tailwind CSS 4** y directivas de accesibilidad **WCAG 2.1 Nivel AA**. Los componentes son modulares, altamente reutilizables y preparados para soportar interacciones asíncronas con feedback inmediato al usuario mediante indicadores de carga y notificaciones tipo toast accesibles (`role="alert"`).

---

## 2. Catálogo Detallado de Componentes

### 2.1. Bandeja de Despacho e Inbox (`WorkflowInboxTable.tsx`)
Tabla interactiva con paginación en servidor y filtrado en tiempo real:
* **Insignias de Estado (Badges):**
  - `REGISTRADO`: Fondo azul claro `bg-blue-50`, texto `text-blue-700`, borde `border-blue-200`.
  - `EN_REVISION`: Fondo púrpura `bg-purple-50`, texto `text-purple-700`, borde `border-purple-200`.
  - `OBSERVADO`: Fondo ámbar `bg-amber-50`, texto `text-amber-700`, borde `border-amber-200`.
  - `RESUELTO`: Fondo esmeralda `bg-emerald-50`, texto `text-emerald-700`, borde `border-emerald-200`.
* **Indicador Semafórico SLA:** Chip visual que calcula los días hábiles restantes; si restan menos de 48 horas cambia a parpadeo suave con texto `text-red-700 font-semibold`.
* **Acciones Rápidas:** Menú desplegable accesible con teclado (`Enter`/`Espacio`) para [Ver Detalle], [Tomar Trámite] y [Derivar].

---

### 2.2. Línea de Tiempo del Recorrido (`WorkflowTimeline.tsx`)
Visualizador gráfico secuencial que grafica las etapas superadas y pendientes del expediente:
* **Nodos de Etapa:** Círculos numerados que representan cada unidad orgánica:
  - *Completada:* Fondo verde institucional con icono de verificación (`CheckCircleIcon`).
  - *Activa / En Proceso:* Fondo azul con pulso de animación (`animate-pulse`) e indicador de especialista asignado.
  - *Pendiente:* Borde gris punteado con texto secundario.
  - *Observada:* Fondo rojo tenue con icono de advertencia y botón para desplegar el pliego de subsanación.
* **Información por Nodo:** Fecha y hora exacta de recepción/despacho, funcionario actuante y proveído emitido.

---

### 2.3. Previsualizador de Documentos Oficiales (`PdfDocumentViewer.tsx`)
Visor embebido seguro para documentos generados y borradores oficiales:
* **Barra de Herramientas:** Selector de número de página, zoom dinámico (50% a 200%), rotación, botón de pantalla completa y descarga de copia autorizada.
* **Seguridad de Renderizado:** Implementado mediante `iframe` aislado o componente canvas con `sandbox` restrictivo, deshabilitando scripts maliciosos y cumpliendo con las directivas de cabecera `Content-Security-Policy`.
* **Panel Lateral de Metadatos:** Despliega el asunto, destinatario, correlativo asignado y estado actual de firmas requeridas.

---

### 2.4. Modal de Suscripción Digital (`DigitalSignatureModal.tsx`)
Diálogo interactivo modal con foco atrapado (*focus trapping*) para la invocación criptográfica:
* **Cabecera de Alerta Legal:** Mensaje explícito recordando que la suscripción digital ostenta plena validez conforme a la Ley N° 27269.
* **Selector de Mecanismo de Firma:**
  - Opción 1: *DNI Electrónico (DNIe / Lector USB)*.
  - Opción 2: *Certificado en Software / Token Criptográfico*.
* **Área de Estado de Invocación:** Muestra spinner interactivo con los pasos:
  1. `[✓]` Conectando con servicio local Refirma...
  2. `[•]` Esperando confirmación de PIN en dispositivo seguro...
  3. `[ ]` Solicitando estampillado de tiempo oficial (TSA)...
  4. `[ ]` Sellando Código de Verificación Digital (CVD)...

---

### 2.5. Verificador Público CVD (`CvdPublicValidatorWidget.tsx`)
Componente accesible y responsivo disponible en el portal público institucional:
* **Entrada de Código CVD:** Campo de texto con máscara automática que formatea el código en mayúsculas (`CVD-YYYY-TIP-XXXXXX-HASH`).
* **Lector de Código QR:** Acceso opcional a la cámara web del dispositivo móvil o laptop para escanear el QR estampado en documentos impresos.
* **Ficha de Resultados Dinámica:** Presenta tarjeta de seguridad con borde verde o rojo según la autenticidad del documento, listando los firmantes oficiales y habilitando la descarga del documento PDF/A legítimo.

---

## 3. Accesibilidad y Estándares de Experiencia de Usuario (UX)

1. **Navegación Integral por Teclado:** Todo el flujo de selección de trámites, apertura de previsualización y confirmación de firma puede operarse exclusivamente mediante las teclas `Tab`, `Shift+Tab`, flechas direccionales y `Escape`.
2. **Contraste de Color WCAG 2.1 AA:** La paleta de colores institucional garantiza una relación de contraste mínima de 4.5:1 en textos normales y 3:1 en componentes gráficos interactivos frente a sus fondos.
3. **Regiones Vivas ARIA (`aria-live="polite"`):** Los cambios de estado de carga y las alertas de validación de firma se anuncian inmediatamente a los usuarios que emplean lectores de pantalla (NVDA, JAWS, VoiceOver).
