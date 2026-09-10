# 02 · Diccionario de datos — Documentos de Trabajo Grupo 2

Autor: Ramírez (B_RAMIREZ)
Estado: Borrador / propuesta sujeta a validación institucional

> Diccionario preliminar de entidades, atributos, claves, estados y relaciones.
> Marcar cada decisión con: CONFIRMADO / PROPUESTO / PENDIENTE / EJEMPLO.

---

## 1. Entidad: tramite

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_tramite | BIGINT | PK | No | autogen | ID técnico interno | PROPUESTO |
| codigo_tramite | VARCHAR(20) | | No | | Código visible de trámite | PENDIENTE |
| asunto | VARCHAR(500) | | No | | Descripción del trámite | PROPUESTO |
| estado | VARCHAR(30) | | No | 'REGISTRADO' | Estado del trámite (CHECK) | PENDIENTE |
| fk_remitente | BIGINT | FK | No | | Usuario registrado (Grupo 4) o solicitante externo identificado sin cuenta | PROPUESTO |
| fk_destinatario | BIGINT | FK | Sí | | Usuario/área destino | PENDIENTE |
| creado_en | TIMESTAMPTZ | | No | now() | Marca de tiempo | PROPUESTO |
| actualizado_en | TIMESTAMPTZ | | Sí | | Marca de tiempo | PROPUESTO |

**Estados posibles (propuesta):** `REGISTRADO`, `EN_TRAMITE`, `OBSERVADO`, `CERRADO`, `ANULADO`, `REABIERTO` (validar con profesor).

---

## 2. Entidad: expediente

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_expediente | BIGINT | PK | No | autogen | ID técnico interno | PROPUESTO |
| codigo_expediente | VARCHAR(50) | | No | | Código visible de expediente | PENDIENTE |
| fk_tramite | BIGINT | FK | No | | Trámite asociado (1 a 1) | PROPUESTO |
| creado_en | TIMESTAMPTZ | | No | now() | Fecha de creación | PROPUESTO |

---

## 3. Entidad: asiento_registro

| Campo | Tipo | Clave | Nulo | Default | Descripción | Estado |
|-------|------|-------|------|---------|-------------|--------|
| id_asiento | BIGINT | PK | No | autogen | ID técnico interno | PROPUESTO |
| numero_registro | BIGINT | UNIQUE | No | secuencia segura | Correlativo visible | PENDIENTE |
| fecha_ingreso | TIMESTAMPTZ | | No | now() | Fecha de ingreso | PROPUESTO |
| canal_ingreso | VARCHAR(30) | | No | 'MESA_PRESENCIAL' | CHECK: MESA_PRESENCIAL / MESA_VIRTUAL | PROPUESTO |
| asunto | VARCHAR(500) | | No | | Asunto del asiento | PROPUESTO |
| fk_expediente | BIGINT | FK | No | | Expediente asociado | PROPUESTO |
| fk_remitente | BIGINT | FK | No | | Usuario registrado (Grupo 4) o solicitante externo identificado sin cuenta | PROPUESTO |
| fk_destinatario | BIGINT | FK | Sí | | Destinatario | PENDIENTE |
| anulado | BOOLEAN | | No | false | Indica asiento anulado (no se borra) | PROPUESTO |
| motivo_anulacion | TEXT | | Sí | NULL | Motivo de la anulación (uso con anulado=true) | PROPUESTO |

---

## 4. Reglas de numeración (propuesta)

- Identificadores internos: generados por PostgreSQL (`BIGSERIAL` o `UUID`).
- Correlativos visibles: mediante secuencia/estrategia segura, **nunca `MAX(...) + 1`**.
- Nota: la secuencia garantiza unicidad y monotonicidad; pueden existir **huecos** si una transacción consume `nextval()` y luego se revierte (`ROLLBACK`).
- Posible reinicio por año/libro/sede: PENDIENTE de confirmación.

## 5. Regla de anulación

- La anulación es un **borrado lógico**: `anulado = true` + `motivo_anulacion` sobre el asiento.
- `NO DELETE`, no se reutiliza el `numero_registro` original.
- El expediente pasa a estado `ANULADO` y el evento se entrega a trazabilidad (Grupo 1).

---

## 6. Pendientes para validar

- [ ] Formato y longitud de `codigo_tramite` / `codigo_expediente`.
- [ ] Periodo de numeración del `numero_registro` (año/libro/sede/área).
- [ ] ¿Trámite y expediente son 1 a 1? ¿Comparten código?
- [ ] Estados oficiales y operaciones tras cierre/anulación/archivamiento.
- [ ] Datos exactos del libro institucional de registro.
- [ ] Registro maestro de administrados externos sin credenciales (Grupo 4).
