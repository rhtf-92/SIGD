# 02 · Modelo de datos — Documentos de Trabajo Grupo 2

Autor: Ramírez (B_RAMIREZ)
Estado: Borrador / propuesta sujeta a validación institucional

> Este documento presenta el modelo lógico preliminar para **trámite, expediente y
> asiento del libro de registro**. Es una propuesta técnica del grupo y NO fija
> decisiones institucionales oficiales.

---

## 1. Propósito

Representar, de forma coherente y verificable, cómo el sistema registrará:

- Lo que una persona desea tramitar (**trámite**).
- La agrupación de su documentación (**expediente**).
- La constancia de su ingreso (**asiento del libro de registro**).

El modelo distingue los **identificadores técnicos internos** de los **códigos
visibles** (código de trámite/expediente, número de registro), que aún están
pendientes de validación institucional.

---

## 2. Modelo entidad–relación

> Diagrama elaborado en Diagrams.net/DrawSQL. Conservar aquí el enlace o ruta al
> archivo editable (`.drawio`, `.drawsql`, etc.) y una captura/imagen.

**Archivo editable local:** `backend/docs/tramicore/02_modelo_datos_gestion_documental_diagrama.drawio`
**Archivo editable (enlace):** https://drive.google.com/file/d/1yqBMqSWnYsDR2i0lF1vfXubf5bbWIphV/view?usp=drive_link
**Imagen del diagrama:** https://drive.google.com/uc?export=view&id=1n0hUWtJvuAf7bARQFl9vFQpsYdYUhhJu

![Modelo E-R SIGD · Grupo 2 (TramiCore)](https://drive.google.com/uc?export=view&id=1n0hUWtJvuAf7bARQFl9vFQpsYdYUhhJu)

---

## 3. Entidades principales

### 3.1 Trámite (tramite)
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| id_tramite (PK) | BIGINT / UUID | Identificador técnico interno |
| codigo_tramite | VARCHAR(20) | Código visible — PENDIENTE de formato oficial |
| asunto | VARCHAR(500) | Descripción del trámite |
| estado | VARCHAR(30) + CHECK | REGISTRADO, EN_TRAMITE, OBSERVADO, CERRADO, ANULADO, REABIERTO |
| fk_remitente | FK | Usuario registrado (Grupo 4) o solicitante externo identificado sin cuenta |
| fk_destinatario | FK NULL | Usuario/área destino (Grupo 3) |
| creado_en | TIMESTAMPTZ | Marca de creación (NOT NULL) |
| actualizado_en | TIMESTAMPTZ | Marca de actualización (NULL hasta el primer cambio) |

### 3.2 Expediente (expediente)
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| id_expediente (PK) | BIGINT / UUID | Identificador técnico interno |
| codigo_expediente | VARCHAR(50) | Código visible — PENDIENTE |
| fk_tramite | FK UNIQUE | Relación con trámite (1 a 1) |
| creado_en | TIMESTAMPTZ | Fecha de creación |

### 3.3 Asiento de libro de registro (asiento_registro)
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| id_asiento (PK) | BIGINT | Identificador técnico interno |
| numero_registro | BIGINT UNIQUE | Número correlativo visible — SEQUENCE, NO MAX+1 |
| fecha_ingreso | TIMESTAMPTZ | Fecha y hora de ingreso |
| canal_ingreso | VARCHAR(30) | CHECK: MESA_PRESENCIAL / MESA_VIRTUAL |
| asunto | VARCHAR(500) | Asunto del asiento |
| fk_expediente | FK | Relación con expediente |
| fk_remitente | FK | Usuario registrado (Grupo 4) o solicitante externo identificado sin cuenta |
| fk_destinatario | FK NULL | Destinatario (Grupo 3) |
| anulado | BOOLEAN | Bandera de anulación lógica (default false) |
| motivo_anulacion | TEXT NULL | Motivo de la anulación (uso con anulado=true) |

---

## 4. Relaciones y cardinalidades

| Origen | Cardinalidad | Destino |
|--------|--------------|---------|
| tramite | 1 ─── 1 | expediente |
| expediente | 1 ─── 1..n | asiento_registro |
| persona (remitente) | 1 ─── n | tramite |
| persona (remitente) | 1 ─── n | asiento_registro |
| usuario/área (destino) | 1 ─── n | tramite |
| usuario/área (destino) | 1 ─── n | asiento_registro |

> Las cardinalidades entre trámite, expediente y registro están marcadas como
> PROPUESTO hasta validar con el profesor.

---

## 5. Reglas de anulación

- La anulación es un **borrado lógico**: `anulado = true` + `motivo_anulacion` sobre el asiento.
- `NO DELETE`; el `numero_registro` original no se reutiliza y únicamente se actualizan los campos de control de anulación (`anulado`, `motivo_anulacion`).
- El expediente pasa a estado `ANULADO` y el evento se entrega a trazabilidad (Grupo 1).

---

## 6. Identificadores

| Identificador | Tipo | Inmutable | Observación |
|---------------|------|-----------|-------------|
| id_tramite (técnico) | interno | Sí | Generado por PostgreSQL |
| codigo_tramite (visible) | código | PENDIENTE | Formato por validar |
| numero_registro (visible) | correlativo | PENDIENTE | Estrategia segura |

---

## 7. Contratos de integración (sin duplicar entidades)

- **Grupo 4 — Personas/remitente:** referencia a `usuario` (internos) o registro asistido de administrado externo sin credenciales, sin repetir datos personales.
- **Grupo 3 — Áreas/destinatario:** referencia a `area`, marcada pendiente si la regla no está confirmada.
- **Grupo 5 — Documentos/adjuntos:** referencia a `documento`, sin rediseñar.
- **Grupo 1 — Trazabilidad:** entrega de expediente, referenciando eventos sin duplicar.

---

## 8. Criterios de aceptación (checklist)

- [ ] Cada entidad tiene un propósito único y relaciones justificadas.
- [ ] Trámite, expediente y asiento tienen propósitos diferenciados y cardinalidades justificadas.
- [ ] Los códigos visibles NO se usan como claves primarias técnicas.
- [ ] Los correlativos NO se generan con `MAX(...) + 1`.
- [ ] El modelo evita duplicar usuarios, áreas, documentos y eventos de trazabilidad.
- [ ] La anulación conserva el registro (`anulado = true` + motivo), sin `DELETE` ni reuso del número.
