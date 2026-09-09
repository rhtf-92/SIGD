# 05 · Decisiones y preguntas pendientes — Documentos de Trabajo Grupo 2

Autor: Ramírez (B_RAMIREZ)
Estado: Borrador — se actualiza a lo largo del flujo

## Categorías

- **CONFIRMADO** — indicado por el profesor / información institucional verificada.
- **PROPUESTO** — mejora técnica del grupo, con justificación.
- **PENDIENTE** — por preguntar o validar.
- **EJEMPLO** — dato solo de demostración, sin valor oficial.

---

## 1. Decisiones del grupo

| # | Decisión | Categoría | Justificación |
|---|----------|-----------|---------------|
| D01 | Los identificadores internos técnicos son distintos de los códigos visibles | PROPUESTO | Evita confundir datos internos con códigos institucionales |
| D02 | Los correlativos se generan con mecanismo seguro (no MAX+1) | PROPUESTO | MAX+1 falla con registros simultáneos |
| D03 | Trámite, expediente y asiento son conceptos distintos | PROPUESTO | Cada uno cumple un rol diferenciado |
| D04 | Los asientos anulados no se eliminan físicamente | PROPUESTO | Conserva historial y evidencia |
| D05 | La anulación se aplica sobre el asiento (`anulado = true` + `motivo_anulacion`); no se genera asiento nuevo ni se reutiliza el número | PROPUESTO | Mantiene la inmutabilidad del Libro y alinea análisis, diccionario, modelo y SQL |
| D06 | El solicitante externo sin usuario registrado se representa con registro asistido en el módulo de personas (Grupo 4), sin exigir credenciales | PROPUESTO | Todo administrado puede tramitar sin crear cuenta |

---

## 2. Supuestos

| # | Supuesto | Categoría |
|---|----------|-----------|
| S01 | El expediente se crea a partir de un trámite | PROPUESTO |
| S02 | Un trámite puede generar al menos un asiento de registro | PROPUESTO |
| S03 | La numeración de asientos es global, monotónica y sin duplicados; pueden existir huecos ante ROLLBACK | PROPUESTO |

---

## 3. Preguntas pendientes (para el profesor)

| # | Pregunta |
|---|----------|
| P01 | ¿Qué diferencia oficial existe entre trámite, expediente, documento presentado y asiento del libro de registro? |
| P02 | ¿Un trámite crea siempre un expediente y un único número de registro? |
| P03 | ¿El código de trámite y el de expediente son el mismo dato? ¿Formato y longitud? |
| P04 | ¿El número de registro se reinicia por año, libro, sede o área? ¿Quién lo genera? |
| P05 | ¿El destinatario inicial es usuario, área, oficina o combinación? |
| P06 | ¿Qué estados oficiales existen y qué se permite tras cierre/anulación/archivamiento? |
| P07 | ¿Cómo se corrige un asiento equivocado sin perder historial ni reutilizar su número? |
| P08 | ¿Qué pasa a trazabilidad y qué ocurre si faltan documentos/requisitos? |
| P09 | ¿El solicitante externo debe registrarse previamente como usuario o basta capturar sus datos al recibir el trámite? |

---

## 4. Observaciones resueltas / pendientes

| Fecha | Responsable | Observación | Estado |
|-------|-------------|-------------|--------|
| 2026-08-30 | Elmer Ramírez | Sin observaciones externas registradas a la fecha | PENDIENTE |