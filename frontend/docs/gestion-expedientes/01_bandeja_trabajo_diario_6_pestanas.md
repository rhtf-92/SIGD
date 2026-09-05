# Bandeja de Trabajo Diario y Navegación de 6 Pestañas — Gestión de Expedientes

| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-GESTEXP-01 |
| **Módulo** | gestion-expedientes / Bandeja de Trabajo Diario y Navegación de 6 Pestañas |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Isack Vargas, Christiam Saúl |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

---

## 1. Visión General del Entorno de Trabajo Diario

La **Bandeja de Trabajo Diario** constituye el centro neurálgico operativo para los funcionarios, directivos, docentes y personal administrativo del Instituto de Educación Superior Tecnológico Público "Suiza" (IESTP "Suiza" — Pucallpa). Su objetivo primordial es concentrar, ordenar y gestionar las tareas documentales asignadas a cada unidad orgánica (Dirección General, Secretaría Académica, Unidades Académicas, Áreas de Coordinación, Administración), garantizando el cumplimiento de los principios de celeridad, eficacia y debido procedimiento consagrados en el Texto Único Ordenado (TUO) de la Ley N° 27444.

La arquitectura de navegación segmenta la carga laboral en **seis pestañas funcionales de estado**, eliminando la saturación visual y permitiendo el control riguroso de plazos administrativos mediante semáforos de advertencia en tiempo real.

---

## 2. Panel Superior de Indicadores de Rendimiento (KPIs de Bandeja)

En la parte superior de la bandeja se despliega un panel consolidado de métricas operativas calculadas al instante para el área del usuario autenticado:

```
┌───────────────────────────┬───────────────────────────┬───────────────────────────┐
│     VOLUMEN ACTIVO        │    TRÁMITES URGENTES      │    PRÓXIMOS A VENCER      │
│          42               │           05              │           03              │
│  Expedientes asignados    │ Prioridad Alta/Muy Urgente│  Vencimiento en <= 48 hrs │
│    a la unidad orgánica   │  con plazo legal acotado  │  Alerta Ámbar / Roja      │
└───────────────────────────┴───────────────────────────┴───────────────────────────┘
```

- **Sincronización Reactiva:** Las métricas se actualizan automáticamente mediante **TanStack Query v5** con una política de `staleTime: 30000` (30 segundos) e invalidación de caché reactiva (*cache invalidation*) tras cada acción de derivación, recepción o archivo.

---

## 3. Especificación Operativa de las 6 Pestañas Funcionales

Cada pestaña representa una etapa procesal exclusiva y bien delimitada dentro del flujo de trabajo de la oficina receptora:

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│  Pendientes  │  En Proceso  │  Observados  │  Derivados   │ Notificados  │  Archivados  │
│    ( 12 )    │    ( 18 )    │    ( 04 )    │    ( 27 )    │    ( 08 )    │   ( 145 )    │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### 3.1. Pestaña 1: Pendientes (`PENDIENTE_RECEPCION`)
- **Regla de Negocio:** Contiene todos los expedientes y trámites que han sido derivados recientemente a la unidad orgánica desde Mesa de Partes u otra oficina, los cuales aún no han sido aceptados físicamente ni abiertos digitalmente por el responsable.
- **Acciones Operativas Disponibles:**
  1. **Aceptar Recepción:** Incorpora el expediente a la carga laboral formal del área, cambiando su estado procesal a `EN_PROCESO`. Registra en auditoría la marca de tiempo de recepción efectiva y el usuario receptor.
  2. **Rechazar con Observación Formal:** Si el expediente fue derivado por error de competencia funcional o carece de documentos físicos anunciados en la guía de remisión, el operador rechaza la recepción, consignando obligatoriamente la motivación legal. El trámite retorna a la bandeja del área remitente.

### 3.2. Pestaña 2: En Proceso (`EN_PROCESO`)
- **Regla de Negocio:** Agrupa los trámites que se encuentran en estudio, elaboración de informes técnicos, proyectos de resolución directoral, decretos de trámite o proveídos.
- **Acciones Operativas Disponibles:**
  1. **Adjuntar Actuación:** Permite incorporar documentos internos (oficios, informes técnicos, hojas de envío) escaneados en PDF/A con validación de Magic Bytes (`25 50 44 46`).
  2. **Crear Nueva Versión de Documento:** Permite actualizar un documento preliminar generando una versión correlativa (`v1.1`, `v1.2`) preservando de manera no destructiva el archivo original con su hash SHA-256.
  3. **Derivar Expediente:** Enruta el trámite hacia otra unidad orgánica o funcionario, indicando motivo de pase, prioridad y plazo estimado de atención.
  4. **Solicitar Subsanación Interna/Externa:** Si se detecta una omisión que deba corregir el administrado u otra área, traslada el expediente a la pestaña de Observados.

### 3.3. Pestaña 3: Observados (`OBSERVADO`)
- **Regla de Negocio:** Trámites que presentan defectos de forma, falta de sustento técnico o incumplimiento de requisitos normativos establecidos en el TUPA.
- **Plazo Perentorio Legal:** Conforme al TUO de la Ley N° 27444, se activa un contador perentorio de **48 horas hábiles** para la subsanación por parte del solicitante.
- **Acciones Operativas Disponibles:**
  1. **Notificar Observación al Administrado:** Envía la cédula de observación a la Casilla Electrónica institucional y al correo electrónico del ciudadano.
  2. **Levantar Observación:** Cuando el administrado remite la documentación complementaria requerida, el especialista valida el sustento y reincorpora el expediente a `EN_PROCESO`.
  3. **Declarar Inadmisibilidad / Abandono:** Si expira el plazo legal sin subsanación, se emite el acto que declara concluido el procedimiento por abandono.

### 3.4. Pestaña 4: Derivados (`DERIVADO`)
- **Regla de Negocio:** Expedientes que fueron instruidos o tramitados por el área y transferidos a otra dependencia institucional (ej. de Unidad Académica a Dirección General para firma de resolución). El área actual ya no tiene custodia física ni operativa, pero mantiene el derecho de seguimiento.
- **Acciones Operativas Disponibles:**
  1. **Consultar Hoja de Ruta / Trazabilidad Completa:** Despliega la línea de tiempo interactiva (*timeline*) con todas las oficinas por las que transitó el expediente, usuarios responsables, fechas de permanencia y proveídos.
  2. **Solicitar Reingreso o Devolución:** Emite una solicitud justificada a la oficina que custodia actualmente el expediente requiriendo su remisión para actuaciones complementarias.

### 3.5. Pestaña 5: Notificados (`NOTIFICADO`)
- **Regla de Negocio:** Comunicaciones oficiales, resoluciones directorales o constancias que han sido remitidas formalmente al administrado a través de su Casilla Electrónica o notificación personal en domicilio.
- **Acciones Operativas Disponibles:**
  1. **Registrar Cargo / Acuse de Recibo:** Asocia la constancia de entrega digital generada por el sistema de casilla electrónica o el cargo físico escaneado firmado por el administrado.
  2. **Cómputo de Plazos de Impugnación:** Monitorea el transcurso del plazo legal de 15 días hábiles para la interposición de recursos administrativos (Reconsideración o Apelación).

### 3.6. Pestaña 6: Archivados (`ARCHIVADO`)
- **Regla de Negocio:** Procedimientos administrativos fenecidos que cuentan con resolución consentida o informe de cierre formal, clasificados dentro de su respectiva Serie Documental según el Cuadro de Clasificación Documental (CCD).
- **Acciones Operativas Disponibles:**
  1. **Consultar Expediente Histórico:** Acceso de sólo lectura al expediente digital íntegro con foliación final.
  2. **Descargar Expediente Digital Consolidado:** Genera un archivo contenedor firmado digitalmente con la totalidad de actuaciones foliadas correlativamente.
  3. **Desarchivo Motivado:** Permite reabrir el expediente conforme al Artículo 160 del TUO de la Ley N° 27444 ante nuevas pruebas o petitorios fundados, previa autorización de la Dirección General o Jefatura de Archivo.

---

## 4. Motor de Búsqueda Avanzada Multi-Criterio

Para permitir la rápida localización de expedientes en bandejas con alto volumen documental, se implementa una barra de filtros con siete dimensiones simultáneas:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ [🔍 EXP-2026-000104        ] [ Solicitante: DNI/RUC/Nombre ] [ Rango: DD/MM/AAAA - DD/MM/AAA ]│
│ [ Tipo Documento: OFICIO ▼ ] [ Serie CCD: TITULACION    ▼ ] [ Funcionario: Todos          ▼ ]│
│ [ Etiquetas / Tags: prácticas pre-profesionales, convalidación                             ]│
│ [                                   [ Limpiar Filtros ]  [ Aplicar Búsqueda ]              ]│
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1. Catálogo de Criterios de Búsqueda
1. **Código Único de Trámite (CUT):**
   - Máscara obligatoria: `EXP-YYYY-XXXXXX`.
   - Expresión regular de validación en tiempo real: `^EXP-[0-9]{4}-[0-9]{6}$`.
   - Búsqueda exacta indexada por clave única en PostgreSQL 18.
2. **Solicitante / Administrado:**
   - DNI (exactamente 8 dígitos).
   - RUC (exactamente 11 dígitos).
   - Carné de Extranjería (CE) o Pasaporte.
   - Búsqueda por concordancia de texto en Nombres, Apellidos o Razón Social.
3. **Rango de Fechas (ISO 8601):**
   - Fecha de ingreso inicial, fecha de última actuación o fecha límite de vencimiento (Filtro Desde / Hasta con calendario adaptativo).
4. **Tipología Documental Principal:**
   - Selección múltiple: `OFICIO`, `INFORME`, `CARTA`, `RESOLUCION_DIRECTORAL`, `SOLICITUD`, `PROVEIDO`.
5. **Serie Documental del CCD:**
   - Filtro jerárquico asociado a las series archivísticas del IESTP Suiza (ej. `CCD-SA-01: Títulos Profesionales`, `CCD-UA-02: Prácticas Pre-Profesionales`).
6. **Funcionario / Usuario Responsable:**
   - Selección del especialista asignado a la instrucción del expediente.
7. **Palabras Clave (Etiquetas Temáticas):**
   - Búsqueda de texto completo (*Full-Text Search*) sobre el asunto y los metadatos semánticos adjuntos.

---

## 5. Tabla de Trámites y Badges de Alerta de Vencimiento

La grilla principal presenta columnas configurables con soporte de ordenamiento ascendente/descendente:

| CUT | Asunto | Solicitante | Serie CCD | Folios | Fecha Ingreso | Plazo Restante | Acciones |
|:---|:---|:---|:---|:---:|:---:|:---:|:---:|
| `EXP-2026-000104` | Solicitud de Certificado Oficial de Estudios | Juan Pérez (DNI 47891234) | Matrícula y Actas | 3 | 2026-09-05 | <span style="color:#059669; font-weight:bold;">8 días hábiles [NORMAL]</span> | `[Ver]` `[Derivar]` |
| `EXP-2026-000089` | Proyecto de Resolución de Prácticas | Ana Ramos (DNI 74125896) | Titulación | 12 | 2026-09-02 | <span style="color:#d97706; font-weight:bold;">24 horas [ADVERTENCIA]</span> | `[Ver]` `[Actuar]` |
| `EXP-2026-000041` | Informe Técnico de Convalidación | Carlos Ruiz (DNI 45123687) | Convalidaciones | 8 | 2026-08-20 | <span style="color:#dc2626; font-weight:bold;">VENCIDO (-2 días) [VENCIDO]</span> | `[Ver]` `[Urgente]` |

- **Semáforo SLA:**
  - `NORMAL` (Verde): Margen mayor a 48 horas hábiles respecto al plazo LPAG.
  - `ADVERTENCIA` (Ámbar / Amarillo): Margen menor o igual a 48 horas hábiles. Notificación visual destacada al responsable.
  - `VENCIDO` (Rojo): Plazo legal expirado. Alerta prioritaria con reporte para control interno institucional.
