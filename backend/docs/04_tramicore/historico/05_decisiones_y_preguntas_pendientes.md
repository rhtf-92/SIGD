# 05 ┬╖ Decisiones y preguntas pendientes ΓÇö Documentos de Trabajo Grupo 2

Autor: Ram├¡rez (B_RAMIREZ)
Estado: Borrador ΓÇö se actualiza a lo largo del flujo

## Categor├¡as

- **CONFIRMADO** ΓÇö indicado por el profesor / informaci├│n institucional verificada.
- **PROPUESTO** ΓÇö mejora t├⌐cnica del grupo, con justificaci├│n.
- **PENDIENTE** ΓÇö por preguntar o validar.
- **EJEMPLO** ΓÇö dato solo de demostraci├│n, sin valor oficial.

---

## 1. Decisiones del grupo

| # | Decisi├│n | Categor├¡a | Justificaci├│n |
|---|----------|-----------|---------------|
| D01 | Los identificadores internos t├⌐cnicos son distintos de los c├│digos visibles | PROPUESTO | Evita confundir datos internos con c├│digos institucionales |
| D02 | Los correlativos se generan con mecanismo seguro (no MAX+1) | PROPUESTO | MAX+1 falla con registros simult├íneos |
| D03 | Tr├ímite, expediente y asiento son conceptos distintos | PROPUESTO | Cada uno cumple un rol diferenciado |
| D04 | Los asientos anulados no se eliminan f├¡sicamente | PROPUESTO | Conserva historial y evidencia |
| D05 | La anulaci├│n se aplica sobre el asiento (`anulado = true` + `motivo_anulacion`); no se genera asiento nuevo ni se reutiliza el n├║mero | PROPUESTO | Mantiene la inmutabilidad del Libro y alinea an├ílisis, diccionario, modelo y SQL |
| D06 | El solicitante externo sin usuario registrado se representa con registro asistido en el m├│dulo de personas (Grupo 4), sin exigir credenciales | PROPUESTO | Todo administrado puede tramitar sin crear cuenta |

---

## 2. Supuestos

| # | Supuesto | Categor├¡a |
|---|----------|-----------|
| S01 | El expediente se crea a partir de un tr├ímite | PROPUESTO |
| S02 | Un tr├ímite puede generar al menos un asiento de registro | PROPUESTO |
| S03 | La numeraci├│n de asientos es global, monot├│nica y sin duplicados; pueden existir huecos ante ROLLBACK | PROPUESTO |

---

## 3. Preguntas pendientes (para el profesor)

| # | Pregunta |
|---|----------|
| P01 | ┬┐Qu├⌐ diferencia oficial existe entre tr├ímite, expediente, documento presentado y asiento del libro de registro? |
| P02 | ┬┐Un tr├ímite crea siempre un expediente y un ├║nico n├║mero de registro? |
| P03 | ┬┐El c├│digo de tr├ímite y el de expediente son el mismo dato? ┬┐Formato y longitud? |
| P04 | ┬┐El n├║mero de registro se reinicia por a├▒o, libro, sede o ├írea? ┬┐Qui├⌐n lo genera? |
| P05 | ┬┐El destinatario inicial es usuario, ├írea, oficina o combinaci├│n? |
| P06 | ┬┐Qu├⌐ estados oficiales existen y qu├⌐ se permite tras cierre/anulaci├│n/archivamiento? |
| P07 | ┬┐C├│mo se corrige un asiento equivocado sin perder historial ni reutilizar su n├║mero? |
| P08 | ┬┐Qu├⌐ pasa a trazabilidad y qu├⌐ ocurre si faltan documentos/requisitos? |
| P09 | ┬┐El solicitante externo debe registrarse previamente como usuario o basta capturar sus datos al recibir el tr├ímite? |

---

## 4. Observaciones resueltas / pendientes

| Fecha | Responsable | Observaci├│n | Estado |
|-------|-------------|-------------|--------|
| 2026-08-30 | Elmer Ram├¡rez | Sin observaciones externas registradas a la fecha | PENDIENTE |
