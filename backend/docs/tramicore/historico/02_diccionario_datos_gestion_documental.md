# 02 ┬╖ Diccionario de datos ΓÇö Documentos de Trabajo Grupo 2

Autor: Ram├¡rez (B_RAMIREZ)
Estado: Borrador / propuesta sujeta a validaci├│n institucional

> Diccionario preliminar de entidades, atributos, claves, estados y relaciones.
> Marcar cada decisi├│n con: CONFIRMADO / PROPUESTO / PENDIENTE / EJEMPLO.

---

## 1. Entidad: tramite

| Campo | Tipo | Clave | Nulo | Default | Descripci├│n | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_tramite | BIGINT | PK | No | autogen | ID t├⌐cnico interno | PROPUESTO |
| codigo_tramite | VARCHAR(20) | | No | | C├│digo visible de tr├ímite | PENDIENTE |
| asunto | VARCHAR(500) | | No | | Descripci├│n del tr├ímite | PROPUESTO |
| estado | VARCHAR(30) | | No | 'REGISTRADO' | Estado del tr├ímite (CHECK) | PENDIENTE |
| fk_remitente | BIGINT | FK | No | | Usuario registrado (Grupo 4) o solicitante externo identificado sin cuenta | PROPUESTO |
| fk_destinatario | BIGINT | FK | S├¡ | | Usuario/├írea destino | PENDIENTE |
| creado_en | TIMESTAMPTZ | | No | now() | Marca de tiempo | PROPUESTO |
| actualizado_en | TIMESTAMPTZ | | S├¡ | | Marca de tiempo | PROPUESTO |

**Estados posibles (propuesta):** `REGISTRADO`, `EN_TRAMITE`, `OBSERVADO`, `CERRADO`, `ANULADO`, `REABIERTO` (validar con profesor).

---

## 2. Entidad: expediente

| Campo | Tipo | Clave | Nulo | Default | Descripci├│n | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_expediente | BIGINT | PK | No | autogen | ID t├⌐cnico interno | PROPUESTO |
| codigo_expediente | VARCHAR(50) | | No | | C├│digo visible de expediente | PENDIENTE |
| fk_tramite | BIGINT | FK | No | | Tr├ímite asociado (1 a 1) | PROPUESTO |
| creado_en | TIMESTAMPTZ | | No | now() | Fecha de creaci├│n | PROPUESTO |

---

## 3. Entidad: asiento_registro

| Campo | Tipo | Clave | Nulo | Default | Descripci├│n | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_asiento | BIGINT | PK | No | autogen | ID t├⌐cnico interno | PROPUESTO |
| numero_registro | BIGINT | UNIQUE | No | secuencia segura | Correlativo visible | PENDIENTE |
| fecha_ingreso | TIMESTAMPTZ | | No | now() | Fecha de ingreso | PROPUESTO |
| canal_ingreso | VARCHAR(30) | | No | 'MESA_PRESENCIAL' | CHECK: MESA_PRESENCIAL / MESA_VIRTUAL | PROPUESTO |
| asunto | VARCHAR(500) | | No | | Asunto del asiento | PROPUESTO |
| fk_expediente | BIGINT | FK | No | | Expediente asociado | PROPUESTO |
| fk_remitente | BIGINT | FK | No | | Usuario registrado (Grupo 4) o solicitante externo identificado sin cuenta | PROPUESTO |
| fk_destinatario | BIGINT | FK | S├¡ | | Destinatario | PENDIENTE |
| anulado | BOOLEAN | | No | false | Indica asiento anulado (no se borra) | PROPUESTO |
| motivo_anulacion | TEXT | | S├¡ | NULL | Motivo de la anulaci├│n (uso con anulado=true) | PROPUESTO |

---

## 4. Reglas de numeraci├│n (propuesta)

- Identificadores internos: generados por PostgreSQL (`BIGSERIAL` o `UUID`).
- Correlativos visibles: mediante secuencia/estrategia segura, **nunca `MAX(...) + 1`**.
- Nota: la secuencia garantiza unicidad y monotonicidad; pueden existir **huecos** si una transacci├│n consume `nextval()` y luego se revierte (`ROLLBACK`).
- Posible reinicio por a├▒o/libro/sede: PENDIENTE de confirmaci├│n.

## 5. Regla de anulaci├│n

- La anulaci├│n es un **borrado l├│gico**: `anulado = true` + `motivo_anulacion` sobre el asiento.
- `NO DELETE`, no se reutiliza el `numero_registro` original.
- El expediente pasa a estado `ANULADO` y el evento se entrega a trazabilidad (Grupo 1).

---

## 6. Pendientes para validar

- [ ] Formato y longitud de `codigo_tramite` / `codigo_expediente`.
- [ ] Periodo de numeraci├│n del `numero_registro` (a├▒o/libro/sede/├írea).
- [ ] ┬┐Tr├ímite y expediente son 1 a 1? ┬┐Comparten c├│digo?
- [ ] Estados oficiales y operaciones tras cierre/anulaci├│n/archivamiento.
- [ ] Datos exactos del libro institucional de registro.
- [ ] Registro maestro de administrados externos sin credenciales (Grupo 4).
