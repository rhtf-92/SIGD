# Documentación Técnica: Sistema de Gestión de Expedientes (SGD)

**Módulo:** Grupo 1 — Gestión de Expedientes y Trabajo Diario (Áreas / Destino)  
**Tarea:** 1.1 — Bandeja de Entrada, Salida y Filtrado de Expedientes  
**Estado:** Aprobado para Desarrollo  

---

## 1. Objetivo del Módulo y Lineamientos Generales

Desarrollar la pantalla principal de trabajo para la gestión diaria de expedientes por área/destino, garantizando el cumplimiento de los tres pilares de gestión documental institucional:
1. Organización según el **Cuadro de Clasificación Documental (CCD)**.
2. Indexación mediante **metadatos avanzados**.
3. **Trazabilidad estricta** con control de versiones inmutable.

---

## 2. Pilares de Arquitectura Documental (Requisitos Institucionales)

### 2.1. Estructura Jerárquica (Cuadro de Clasificación Documental - CCD)
Todo expediente dentro del sistema debe estar catalogado siguiendo la jerarquía archivística institucional:
* **Fondo Documental:** Entidad u organismo institucional.
* **Sección / Subsección:** Órgano de línea o unidad orgánica responsable (Área/Oficina).
* **Serie / Subserie Documental:** Categoría formal del trámite (ej. Trámites de Licencias, Adquisiciones, Resoluciones Directorales, etc.).

> **Impacto en Tarea 1.1:** Permite que la bandeja y la pestaña de Archivados organicen los expedientes bajo su serie documental correspondiente.

### 2.2. Metadatos Avanzados e Indexación
Cada expediente y documento integra un conjunto normalizado de metadatos para optimizar su búsqueda y auditoría:
* **Metadatos Temporales:** Fecha y hora exacta de creación, derivación, última modificación y plazos de vencimiento.
* **Tipología Documental:** Clasificación precisa del documento inicial y adjuntos (Oficio, Informe, Carta, Resolución, Solicitud, etc.).
* **Palabras Clave (Tags):** Términos descriptivos para indexación temática y búsqueda semántica rápida.
* **Creadores y Responsables:** Registro del usuario creador, funcionario asignado y área remitente.

> **Impacto en Tarea 1.1:** El buscador avanzado incorpora estos campos para permitir búsquedas cruzadas y filtros de alta precisión.

### 2.3. Control de Versiones y Trazabilidad Inmutable
Para garantizar la integridad y no repudio de la información original:
* **Historial de Modificaciones:** Registro de cada cambio de estado (de Pendiente a En Proceso, Observado, etc.), incluyendo marca de tiempo y usuario autor.
* **Versionado de Adjuntos:** Los documentos adjuntos a un expediente generan nuevas versiones numeradas (`v1.0`, `v1.1`, etc.) sin sobrescribir ni eliminar los archivos originales.
* **Registro de Auditoría:** Bitácora inmutable de eventos accesible desde el detalle del expediente.

---

## 3. Especificación Funcional de la Tarea 1.1

### 3.1. Bandeja Principal de Trabajo (Áreas / Destino)
* **Contextualización Automática:** La bandeja identifica el rol y la unidad orgánica del usuario autenticado, presentando únicamente la carga laboral asignada.
* **Panel de Indicadores:** Resumen de volumen total, expedientes urgentes y trámites por vencer.
* **Tabla de Expedientes:** Visualización clara con código, asunto, solicitante, serie documental (CCD), prioridad, fecha y acciones directas.

### 3.2. Gestión del Flujo por Pestañas de Estado

| Pestaña | Definición y Regla de Negocio | Acciones Principales |
| :--- | :--- | :--- |
| **Pendientes** | Expedientes remitidos o derivados recientemente al área que aún no han sido aceptados o abiertos para su atención. | Aceptar recepción, Rechazar con observación formal. |
| **En Proceso** | Expedientes en curso de atención, elaboración de informes técnicos, resoluciones o actos administrativos. | Adjuntar actuación, Crear nueva versión de documento, Derivar, Solicitar subsanación. |
| **Observados** | Documentos que presentan inconsistencias, falta de requisitos o esperan subsanación por parte del solicitante u otra área. | Levantar observación, Notificar observación al administrado, Reenviar. |
| **Derivados** | Expedientes enviados a otra oficina/área que se encuentran actualmente bajo custodia de dicha dependencia. | Consultar hoja de ruta / trazabilidad completa, Solicitar reingreso. |
| **Notificados** | Actos administrativos comunicados formalmente al administrado o partes interesadas. | Registrar cargo/acuse de recibo, Computar plazos de respuesta. |
| **Archivados** | Trámites concluidos formalmente o clasificados en el archivo de gestión según la Serie Documental del CCD. | Consultar expediente histórico, Desarchivar con justificación, Descargar expediente digital. |

### 3.3. Buscador Avanzado Multi-Criterio (Integrado con Metadatos)
El motor de búsqueda avanzado permite la localización ágil de expedientes cruzando los siguientes criterios:

1. **Código de Expediente:** Máscara `EXP-YYYY-XXXXXX` (ej. `EXP-2026-000142`) validada mediante regex (`^EXP-[0-9]{4}-[0-9]{6}$`).
2. **Solicitante / Administrado:** Búsqueda por DNI (8 dígitos), RUC (11 dígitos), Carné de Extranjería o Nombres / Razón Social.
3. **Rango de Fechas:** Filtro por fecha de ingreso, última actualización o plazo límite (Desde - Hasta).
4. **Tipo de Documento:** Filtro por tipología (Oficio, Informe, Carta, Resolución, Solicitud, etc.).
5. **Serie Documental (CCD):** Filtro por categoría o clasificación dentro del cuadro documental.
6. **Creador / Funcionario:** Filtrado por usuario originador o responsable asignado.
7. **Palabras Clave:** Búsqueda sobre etiquetas y resumen temático del asunto.

---

## 4. Modelo de Datos Integral (TypeScript / JSON)

Estructura completa de datos para el expediente, metadatos, versiones y CCD:

```typescript
export interface ClasificacionCCD {
  fondo: string;              // Ej: 'MUNICIPALIDAD_PROVINCIAL'
  seccion: string;            // Ej: 'GERENCIA_DESARROLLO_URBANO'
  serieDocumental: string;    // Ej: 'LICENCIAS_DE_EDIFICACION'
  codigoSerie: string;        // Ej: 'CCD-GDU-04'
}

export interface VersionDocumento {
  versionId: string;          // Ej: 'v1.0', 'v1.1'
  numeroVersion: number;
  nombreArchivo: string;
  urlArchivo: string;
  autorCambio: string;
  fechaRegistro: string;      // ISO 8601
  motivoModificacion: string;
  hashIntegridad: string;     // SHA-256 para control de inmutabilidad
}

export interface MetadatosAvanzados {
  tipoDocumentoPrincipal: 'OFICIO' | 'INFORME' | 'CARTA' | 'RESOLUCION' | 'SOLICITUD' | 'OTRO';
  palabrasClave: string[];
  creadorId: string;
  creadorNombre: string;
  responsableAsignadoId?: string;
  responsableAsignadoNombre?: string;
}

export interface ExpedienteSGD {
  id: string;
  codigoExpediente: string;   // Formato EXP-YYYY-XXXXXX
  asunto: string;
  solicitante: {
    tipoPersona: 'NATURAL' | 'JURIDICA';
    tipoDocumento: 'DNI' | 'RUC' | 'CE';
    numeroDocumento: string;
    nombreOrazonSocial: string;
  };
  clasificacionCCD: ClasificacionCCD;
  metadatos: MetadatosAvanzados;
  areaOrigen: string;
  areaActual: string;
  estadoFlujo: 'PENDIENTE' | 'EN_PROCESO' | 'OBSERVADO' | 'DERIVADO' | 'NOTIFICADO' | 'ARCHIVADO';
  prioridad: 'NORMAL' | 'URGENTE' | 'MUY_URGENTE';
  fechaIngreso: string;       // ISO 8601
  fechaUltimoMovimiento: string;
  versionesDocumentos: VersionDocumento[];
  cantidadFolios: number;
}
```

---

## 5. Criterios de Aceptación y Matriz de Validación

- [ ] **Organización CCD:** Cada expediente listado refleja su serie documental y permite agruparse/filtrarse según el CCD.
- [ ] **Buscador con Metadatos:** El buscador filtra con éxito por código (`EXP-YYYY-XXXXXX`), solicitante, rango de fechas, tipo de documento, palabras clave y creador.
- [ ] **Pestañas de Trabajo:** Visualización organizada en las 6 pestañas con contadores en tiempo real.
- [ ] **Control de Versiones:** El detalle del expediente muestra el historial completo de versiones de documentos sin sobrescrituras destructivas.
- [ ] **Integridad de Datos:** Se registran marcas de tiempo y autores en cada cambio de estado.

---

## 6. Ampliación de Reglas de Negocio y Control de Plazos (Gestión de Expedientes)

* **6.1. Validación de Origen y Destino:** Todo expediente ingresado al sistema debe estar asociado obligatoriamente a una unidad orgánica del organigrama institucional y a una serie del Cuadro de Clasificación Documental (CCD).
* **6.2. Control de Plazos y Alertas:** El sistema calcula automáticamente los días hábiles transcurridos desde el ingreso del expediente hasta su derivación o respuesta final, generando alertas visuales para trámites próximos a vencer.
* **6.3. Trazabilidad de Adjuntos:** Los documentos complementarios (oficios, informes, resoluciones) no se sobrescriben de forma destructiva; cada cambio genera un registro automático en el historial de versiones con su respectiva marca temporal y el usuario responsable.

---

## 7. Modelo de Datos Complementario (TypeScript)

Estructuras técnicas adicionales para la gestión de flujos de expedientes, plazos y derivaciones:

```typescript
export interface DetalleDerivacion {
  derivacionId: string;
  expedienteId: string;
  areaOrigenId: string;
  areaDestinoId: string;
  usuarioRemitenteId: string;
  usuarioAsignadoId: string;
  fechaDerivacion: string;       // ISO 8601
  plazoAtencionDias: number;
  estadoDerivacion: 'PENDIENTE_RECEPCION' | 'ACEPTADO' | 'RECHAZADO';
  observacionDevolucion?: string;
}

export interface HistorialPlazosExpediente {
  expedienteId: string;
  fechaIngresoSistema: string;
  fechaLimiteAtencion: string;
  diasRestantes: number;
  alertaVencimiento: 'NORMAL' | 'ADVERTENCIA' | 'VENCIDO';
}
```
