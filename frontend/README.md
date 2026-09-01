# Módulo de Gestión de Expedientes (SGD)

Sistema web moderno, interactivo y responsivo para la gestión y trámite documentario institucional.

---

## 🚀 Características Principales

1. **Pantalla Principal de Trabajo (Bandeja del Área / Oficina)**:
   - Selector dinámico de área/oficina (*Mesa de Partes, Gerencia de Desarrollo Urbano, Subgerencia de Obras Privadas, Asesoría Jurídica, Secretaría General, Administración Tributaria, Catastro, etc.*).
   - Tarjetas de resumen KPI en tiempo real: Total Expedientes, En Plazo, Próximos a Vencer ($\le 3$ días) y Vencidos.

2. **Pestañas de Estado de Flujo con Contadores Dinámicos**:
   - 🟡 **Pendientes**: Expedientes ingresados pendientes de atención.
   - 🔵 **En Proceso**: Expedientes en evaluación o elaboración de informes.
   - 🟠 **Observados**: Expedientes con observaciones técnicas o legales.
   - 🟣 **Derivados**: Expedientes remitidos a otras áreas de la institución.
   - 🟢 **Notificados**: Trámites resueltos con notificación formal al administrado.
   - ⚫ **Archivados**: Expedientes concluidos y transferidos al Archivo Central.
   - ⚪ **Todos**: Vista integral de todos los estados.
   - *Los contadores de las pestañas se recalculan automáticamente según el área activa y las acciones ejecutadas.*

3. **Buscador y Filtros Avanzados**:
   - Búsqueda por formato estricto y flexible de expediente: `EXP-YYYY-XXXXXX` (ej. `EXP-2026-000124`).
   - Búsqueda por datos del solicitante (DNI de 8 dígitos, RUC de 11 dígitos, Nombres o Razón Social).
   - Filtro por rango de fechas (`Fecha Desde` - `Fecha Hasta`) con accesos rápidos (*Hoy*, *7 días*, *Este Mes*, *Quitar*).
   - Filtros adicionales por **Prioridad** (*Normal*, *Urgente*, *Muy Urgente*) y **Tipo de Documento** (*Solicitud*, *Oficio*, *Carta*, *Informe*).
   - Botón de limpieza de filtros y contador dinámico de resultados.

4. **Tabla Responsiva y Acciones Rápidas**:
   - 👁️ **Ver Detalle**: Modal con pestañas de *Resumen General*, *Trazabilidad / Línea de Tiempo* (recorrido histórico entre oficinas), *Documentos Adjuntos* y *Observaciones*.
   - 🔄 **Derivar**: Modal para derivar expediente a otra área con selección automática de especialistas y registro de proveído.
   - ⚠️ **Observar**: Modal para registrar causales de observación técnica/legal, fundamentación y plazo de subsanación.
   - ✉️ **Notificar**: Registro de cédula de notificación y medio (casilla electrónica o correo).
   - 📁 **Archivar**: Cierre de trámite con registro de ubicación física en archivo.
   - 📋 **Copiar Código**: Copia rápida al portapapeles con feedback visual.
   - 📊 **Exportar CSV & Imprimir**: Descarga de reportes en CSV y vista optimizada para impresión.

---

## 📁 Estructura del Proyecto

```
trabajo cristiam/
├── index.html              # Vista principal: Header, KPIs, pestañas de flujo, filtros y tabla
├── css/
│   └── styles.css          # Estilos personalizados (glassmorphism, animaciones, badges SLA, print)
├── js/
│   ├── data.js             # Base de datos simulada con persistencia en LocalStorage
│   ├── modals.js           # Lógica de modales (Detalle, Derivar, Observar, Notificar, Archivar, Nuevo)
│   └── app.js              # Controlador principal (filtros reactivos, contadores y renderizado)
└── README.md               # Documentación del proyecto
```

---

## 💻 Instrucciones de Uso

1. Abre directamente el archivo `index.html` en cualquier navegador moderno (Google Chrome, Microsoft Edge, Firefox).
2. Para probar las funciones:
   - Filtra por cualquiera de las pestañas superiores y observa cómo se actualiza la tabla.
   - Selecciona un área específica en la barra superior para ver los expedientes asignados a esa oficina.
   - Realiza búsquedas usando el código `EXP-2026-000124` o el DNI `45892134` o el RUC `20601234567`.
   - Haz clic en el botón de ojo (👁️) para ver la trazabilidad completa y los documentos del expediente.
   - Haz clic en derivar (🔄) u observar (⚠️) para cambiar el flujo y ver la actualización reactiva en tiempo real.
