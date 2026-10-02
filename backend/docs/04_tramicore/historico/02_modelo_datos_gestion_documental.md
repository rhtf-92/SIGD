# 02 ┬╖ Modelo de datos ΓÇö Documentos de Trabajo Grupo 2

Autor: Ram├¡rez (B_RAMIREZ)
Estado: Borrador / propuesta sujeta a validaci├│n institucional

> Este documento presenta el modelo l├│gico preliminar para **tr├ímite, expediente y
> asiento del libro de registro**. Es una propuesta t├⌐cnica del grupo y NO fija
> decisiones institucionales oficiales.

---

## 1. Prop├│sito

Representar, de forma coherente y verificable, c├│mo el sistema registrar├í:

- Lo que una persona desea tramitar (**tr├ímite**).
- La agrupaci├│n de su documentaci├│n (**expediente**).
- La constancia de su ingreso (**asiento del libro de registro**).

El modelo distingue los **identificadores t├⌐cnicos internos** de los **c├│digos
visibles** (c├│digo de tr├ímite/expediente, n├║mero de registro), que a├║n est├ín
pendientes de validaci├│n institucional.

---

## 2. Modelo entidadΓÇôrelaci├│n

> Diagrama elaborado en Diagrams.net/DrawSQL. Conservar aqu├¡ el enlace o ruta al
> archivo editable (`.drawio`, `.drawsql`, etc.) y una captura/imagen.

**Archivo editable local:** `backend/docs/tramicore/02_modelo_datos_gestion_documental_diagrama.drawio`
**Archivo editable (enlace):** https://drive.google.com/file/d/1yqBMqSWnYsDR2i0lF1vfXubf5bbWIphV/view?usp=drive_link
**Imagen del diagrama:** https://drive.google.com/uc?export=view&id=1n0hUWtJvuAf7bARQFl9vFQpsYdYUhhJu

![Modelo E-R SIGD ┬╖ Grupo 2 (TramiCore)](https://drive.google.com/uc?export=view&id=1n0hUWtJvuAf7bARQFl9vFQpsYdYUhhJu)

---

## 3. Entidades principales

### 3.1 Tr├ímite (tramite)
| Atributo | Tipo | Descripci├│n |
|----------|------|-------------|
| id_tramite (PK) | BIGINT / UUID | Identificador t├⌐cnico interno |
| codigo_tramite | VARCHAR(20) | C├│digo visible ΓÇö PENDIENTE de formato oficial |
| asunto | VARCHAR(500) | Descripci├│n del tr├ímite |
| estado | VARCHAR(30) + CHECK | REGISTRADO, EN_TRAMITE, OBSERVADO, CERRADO, ANULADO, REABIERTO |
| fk_remitente | FK | Usuario registrado (Grupo 4) o solicitante externo identificado sin cuenta |
| fk_destinatario | FK NULL | Usuario/├írea destino (Grupo 3) |
| creado_en | TIMESTAMPTZ | Marca de creaci├│n (NOT NULL) |
| actualizado_en | TIMESTAMPTZ | Marca de actualizaci├│n (NULL hasta el primer cambio) |

### 3.2 Expediente (expediente)
| Atributo | Tipo | Descripci├│n |
|----------|------|-------------|
| id_expediente (PK) | BIGINT / UUID | Identificador t├⌐cnico interno |
| codigo_expediente | VARCHAR(50) | C├│digo visible ΓÇö PENDIENTE |
| fk_tramite | FK UNIQUE | Relaci├│n con tr├ímite (1 a 1) |
| creado_en | TIMESTAMPTZ | Fecha de creaci├│n |

### 3.3 Asiento de libro de registro (asiento_registro)
| Atributo | Tipo | Descripci├│n |
|----------|------|-------------|
| id_asiento (PK) | BIGINT | Identificador t├⌐cnico interno |
| numero_registro | BIGINT UNIQUE | N├║mero correlativo visible ΓÇö SEQUENCE, NO MAX+1 |
| fecha_ingreso | TIMESTAMPTZ | Fecha y hora de ingreso |
| canal_ingreso | VARCHAR(30) | CHECK: MESA_PRESENCIAL / MESA_VIRTUAL |
| asunto | VARCHAR(500) | Asunto del asiento |
| fk_expediente | FK | Relaci├│n con expediente |
| fk_remitente | FK | Usuario registrado (Grupo 4) o solicitante externo identificado sin cuenta |
| fk_destinatario | FK NULL | Destinatario (Grupo 3) |
| anulado | BOOLEAN | Bandera de anulaci├│n l├│gica (default false) |
| motivo_anulacion | TEXT NULL | Motivo de la anulaci├│n (uso con anulado=true) |

---

## 4. Relaciones y cardinalidades

| Origen | Cardinalidad | Destino |
|--------|--------------|---------|
| tramite | 1 ΓöÇΓöÇΓöÇ 1 | expediente |
| expediente | 1 ΓöÇΓöÇΓöÇ 1..n | asiento_registro |
| persona (remitente) | 1 ΓöÇΓöÇΓöÇ n | tramite |
| persona (remitente) | 1 ΓöÇΓöÇΓöÇ n | asiento_registro |
| usuario/├írea (destino) | 1 ΓöÇΓöÇΓöÇ n | tramite |
| usuario/├írea (destino) | 1 ΓöÇΓöÇΓöÇ n | asiento_registro |

> Las cardinalidades entre tr├ímite, expediente y registro est├ín marcadas como
> PROPUESTO hasta validar con el profesor.

---

## 5. Reglas de anulaci├│n

- La anulaci├│n es un **borrado l├│gico**: `anulado = true` + `motivo_anulacion` sobre el asiento.
- `NO DELETE`; el `numero_registro` original no se reutiliza y ├║nicamente se actualizan los campos de control de anulaci├│n (`anulado`, `motivo_anulacion`).
- El expediente pasa a estado `ANULADO` y el evento se entrega a trazabilidad (Grupo 1).

---

## 6. Identificadores

| Identificador | Tipo | Inmutable | Observaci├│n |
|---------------|------|-----------|-------------|
| id_tramite (t├⌐cnico) | interno | S├¡ | Generado por PostgreSQL |
| codigo_tramite (visible) | c├│digo | PENDIENTE | Formato por validar |
| numero_registro (visible) | correlativo | PENDIENTE | Estrategia segura |

---

## 7. Contratos de integraci├│n (sin duplicar entidades)

- **Grupo 4 ΓÇö Personas/remitente:** referencia a `usuario` (internos) o registro asistido de administrado externo sin credenciales, sin repetir datos personales.
- **Grupo 3 ΓÇö ├üreas/destinatario:** referencia a `area`, marcada pendiente si la regla no est├í confirmada.
- **Grupo 5 ΓÇö Documentos/adjuntos:** referencia a `documento`, sin redise├▒ar.
- **Grupo 1 ΓÇö Trazabilidad:** entrega de expediente, referenciando eventos sin duplicar.

---

## 8. Criterios de aceptaci├│n (checklist)

- [ ] Cada entidad tiene un prop├│sito ├║nico y relaciones justificadas.
- [ ] Tr├ímite, expediente y asiento tienen prop├│sitos diferenciados y cardinalidades justificadas.
- [ ] Los c├│digos visibles NO se usan como claves primarias t├⌐cnicas.
- [ ] Los correlativos NO se generan con `MAX(...) + 1`.
- [ ] El modelo evita duplicar usuarios, ├íreas, documentos y eventos de trazabilidad.
- [ ] La anulaci├│n conserva el registro (`anulado = true` + motivo), sin `DELETE` ni reuso del n├║mero.
