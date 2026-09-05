# Cuadro de Clasificación Documental (CCD) y Normalización Archivística — Gestión de Expedientes

| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-GESTEXP-02 |
| **Módulo** | gestion-expedientes / Cuadro de Clasificación Documental (CCD) y Normalización Archivística |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Isack Vargas, Christiam Saúl |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

---

## 1. Justificación y Marco Archivístico Institucional

El Sistema Integral de Gestión Documentaria (SIGD) del Instituto de Educación Superior Tecnológico Público "Suiza" (IESTP "Suiza" — Pucallpa) estructura la totalidad de sus documentos, trámites y expedientes bajo las directivas del Sistema Nacional de Archivos, regulado por el **Archivo General de la Nación (AGN)** y el Modelo de Gestión Documental de la Secretaría de Gobierno y Transformación Digital de la Presidencia del Consejo de Ministros (MGD-PCM).

La estandarización archivística garantiza la integridad, autenticidad, inalterabilidad y accesibilidad a largo plazo del acervo documental técnico y pedagógico de la institución, eliminando prácticas informales de archivo físico y digital.

---

## 2. Saneamiento Institucional del Fondo Documental

> ⚠️ **Dictamen Forense de Saneamiento:** En las versiones preliminares de la documentación técnica del módulo de gestión de expedientes se detectó la presencia residual del término `'MUNICIPALIDAD_PROVINCIAL'` en los ejemplos de clasificación. Mediante la presente homologación técnica de nivel de producción, **se declara la erradicación definitiva y total de cualquier denominación ajena o foránea**, estableciendo formalmente que el único e indivisible Fondo Documental institucional es:
> 
> $$\textbf{Fondo Documental:} \quad \mathbf{\text{IESTP\_SUIZA}}$$

El IESTP "Suiza" es una institución pública de educación superior licenciada, con personería jurídica y autonomía académica y administrativa bajo la jurisdicción de la Dirección Regional de Educación de Ucayali (DREU) y el Ministerio de Educación (MINEDU). Su estructura archivística responde estrictamente a su organigrama funcional institucional.

---

## 3. Jerarquía Institucional Archivística (Estructura CCD)

El **Cuadro de Clasificación Documental (CCD)** del IESTP "Suiza" se organiza bajo un modelo jerárquico de tres niveles: Fondo $\rightarrow$ Sección/Subsección $\rightarrow$ Serie/Subserie Documental:

```
FONDO DOCUMENTAL
└── IESTP_SUIZA (Instituto de Educación Superior Tecnológico Público "Suiza")
    │
    ├── SECCIÓN 01: DIRECCIÓN GENERAL (DG)
    │   ├── Serie 01.01: Resoluciones Directorales Institucionales
    │   ├── Serie 01.02: Convenios Marco y Específicos Interinstitucionales
    │   └── Serie 01.03: Planes Institucionales (PEI, POI, PCI, PAT)
    │
    ├── SECCIÓN 02: SECRETARÍA ACADÉMICA (SA)
    │   ├── Serie 02.01: Expedientes de Titulación Profesional Técnica
    │   ├── Serie 02.02: Actas Oficiales Consolidadas de Evaluación Semestral
    │   ├── Serie 02.03: Certificados Oficiales y Constancias de Estudio
    │   └── Serie 02.04: Matrícula y Traslados Internos/Externos
    │
    ├── SECCIÓN 03: UNIDAD ACADÉMICA (UA)
    │   ├── Serie 03.01: Programación y Sílabos Curriculares por Competencias
    │   ├── Serie 03.02: Experiencias Formativas en Situaciones Reales de Trabajo (EFSRT)
    │   └── Serie 03.03: Convalidación y Homologación de Unidades Didácticas
    │
    ├── SECCIÓN 04: COORDINACIONES DE ÁREA ACADÉMICA (CA)
    │   ├── Serie 04.01: Desarrollo de Sistemas de Información (DSI)
    │   ├── Serie 04.02: Enfermería Técnica (ET)
    │   ├── Serie 04.03: Construcción Civil (CC)
    │   ├── Serie 04.04: Mecánica Automotriz (MA)
    │   └── Serie 04.05: Contabilidad (CO)
    │
    ├── SECCIÓN 05: UNIDAD DE ADMINISTRACIÓN (AD)
    │   ├── Serie 05.01: Legajos Personales de Docentes y Administrativos
    │   ├── Serie 05.02: Contrataciones, Órdenes de Compra y Servicios
    │   └── Serie 05.03: Inventario Físico Patrimonial y Bajas
    │
    └── SECCIÓN 06: UNIDAD DE BIENESTAR Y EMPLEABILIDAD (UB)
        ├── Serie 06.01: Bolsa de Trabajo y Seguimiento de Egresados
        └── Serie 06.02: Tutoría Integral y Apoyo Psicopedagógico
```

### 3.1. Codificación Alfanumérica Normalizada de Series CCD
Toda serie documental cuenta con un código canónico institucional indexable en la base de datos:
- `CCD-DG-RES`: Resoluciones Directorales
- `CCD-DG-CONV`: Convenios Institucionales
- `CCD-SA-TIT`: Titulación Profesional Técnica
- `CCD-SA-ACTA`: Actas de Evaluación
- `CCD-UA-EFSRT`: Prácticas Pre-Profesionales / EFSRT
- `CCD-UA-CONV`: Convalidaciones Académicas
- `CCD-AD-CONTR`: Contrataciones y Adquisiciones

---

## 4. Protocolo de Foliado Progresivo del Archivo General de la Nación (AGN)

### 4.1. Marco Normativo y Obligatoriedad
La foliación de expedientes en el SIGD se rige obligatoriamente por la **Directiva N° 001-2019-AGN/DDPA**, aprobada mediante Resolución Jefatural N° 088-2019-AGN/J, la cual norma los procedimientos técnicos para la foliación de documentos archivísticos en las entidades de la administración pública peruana.

### 4.2. Principios de Foliación Técnica
1. **Numeración Continua y Correlativa:** La foliatura se realiza de manera ininterrumpida utilizando exclusivamente **números arábigos** (1, 2, 3, 4...).
2. **Prohibición de Foliado Literal o Compuesto:** Queda terminantemente prohibido el uso de letras (ej. 1-A, 1-B), signos suplementarios o expresiones tales como "bis", "ter" o "quáter". Cada hoja física o digital representa exactamente una unidad de folio.
3. **Ubicación Canónica del Sello de Folio:** En el documento digital, el sistema imprime de forma automática un sello visible en el **ángulo superior derecho** de la página, respetando la orientación de lectura.
4. **Foliación Progresiva Acumulativa:** Cuando una nueva oficina adjunta una actuación (informe técnico, oficio o resolución), el sistema consulta el último folio vigente del expediente y asigna correlativamente el rango subsiguiente:
   $$\text{folio\_inicio} = \text{ultimo\_folio\_expediente} + 1$$
   $$\text{folio\_fin} = \text{folio\_inicio} + \text{cantidad\_hojas\_documento} - 1$$
   $$\text{total\_folios\_expediente} = \text{total\_folios\_expediente} + \text{cantidad\_hojas\_documento}$$

### 4.3. Modelo de Datos de Foliación (`sigd_tra.expediente_documento_folio`)

La relación entre los documentos adjuntos y la foliación del expediente se gobierna en PostgreSQL 18 mediante la entidad especializada:

```sql
CREATE TABLE sigd_tra.expediente_documento_folio (
    folio_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(id),
    documento_id UUID NOT NULL REFERENCES sigd_doc.documento(id),
    folio_inicio INTEGER NOT NULL CHECK (folio_inicio >= 1),
    folio_fin INTEGER NOT NULL CHECK (folio_fin >= folio_inicio),
    total_folios INTEGER GENERATED ALWAYS AS (folio_fin - folio_inicio + 1) STORED,
    fecha_foliado TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    usuario_foliador_id UUID NOT NULL REFERENCES sigd_auth.usuario(id),
    observacion_foliado TEXT,
    CONSTRAINT uq_expediente_folio_rango UNIQUE (expediente_id, folio_inicio, folio_fin)
);
```

### 4.4. Procedimiento de Subsanación de Errores de Foliado
Si se detectara un error material en la foliación (ej. salto de número o documento omitido en el escaneo):
- No se permite el borrado de folios ni la reescritura destructiva.
- El especialista genera una **Acta de Rectificación de Foliado**, en la cual se describe el error detectado y se establece la nueva equivalencia numérica.
- El sistema asocia el acta al expediente como un documento formal que recibe foliatura propia.

---

## 5. Transferencia al Archivo Central y Reglas de Desarchivo

### 5.1. Ciclo de Retención Documental
1. **Archivo de Gestión (Oficina Productora):** El expediente permanece en la unidad que emitió la resolución o informe final durante su etapa activa (1 a 2 años lectivos).
2. **Transferencia al Archivo Central Institucional:**
   - Una vez fenecido el trámite y cumplido el plazo de retención activa, la oficina productora genera en el SIGD una **Guía de Transferencia Documental**.
   - El responsable del Archivo Central coteja que el expediente digital cuente con su totalidad de folios correlativos, firmas digitales válidas y hash de integridad inalterado.
   - Aprobada la transferencia, el expediente pasa a custodia definitiva en la pestaña de `Archivados` con estatus `CUSTODIA_CENTRAL`.

### 5.2. Desarchivo Justificado (Artículo 160 del TUO Ley N° 27444)
Conforme a la normativa del procedimiento administrativo general, un expediente fenecido puede ser reabierto (*desarchivado*) únicamente bajo circunstancias jurídicamente acreditadas:
- **Causales Legítimas:**
  1. Interposición oportuna de un recurso extraordinario o solicitud de nulidad de oficio.
  2. Acreditación de nuevos hechos o pruebas instrumentales determinantes no conocidas al momento de la resolución.
  3. Requerimiento judicial o mandamiento de la Contraloría General de la República.
- **Protocolo en el SIGD:**
  1. El solicitante o funcionario presenta una solicitud formal motivada de desarchivo.
  2. Requiere autorización expresa de la Dirección General del IESTP Suiza.
  3. El sistema reactiva el expediente, retornándolo de la pestaña de `Archivados` a `En Proceso`.
  4. **Preservación de Trazabilidad:** El expediente **mantiene su mismo Código CUT original** (`EXP-YYYY-XXXXXX`). Los nuevos documentos incorporados inician su foliación a partir del último folio histórico que poseía el expediente archivado, salvaguardando la continuidad documental.
