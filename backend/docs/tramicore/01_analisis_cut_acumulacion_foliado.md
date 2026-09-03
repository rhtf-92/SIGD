# Análisis Funcional: Código Único de Trámite (CUT), Acumulación de Expedientes y Foliado Digital Progresivo

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI  
**Grupo de Trabajo:** Grupo 2 – “TramiCore”  
**Responsable del Análisis:** Leysglin Riquelmer Fachin Rojas (Rama: `B_RIQUELMER`)  
**Sublíder / Integrador:** Elmer Ramírez (`B_RAMIREZ`)  
**Fase:** Fase 2 — Levantamiento de Observaciones (Estandarización MGD, CUT y Foliado Digital)  

---

## 1. Objetivo y Marco Normativo Aplicable

### 1.1 Objetivo
Subsanar las observaciones de arquitectura funcional del núcleo documental del SIGD:
1. Reemplazar el acoplamiento rígido 1:1 entre trámite y expediente por un modelo flexible.
2. Definir las reglas funcionales del Código Único de Trámite (CUT) bajo el estándar de la Presidencia del Consejo de Ministros (MGD - PCM).
3. Establecer el procedimiento de Acumulación y Desacumulación de expedientes según el TUO de la Ley N° 27444.
4. Diseñar la lógica de Foliación Digital Continua conforme al Archivo General de la Nación (AGN).

### 1.2 Base Legal y Normativa
* **R.S. N° 001-2017-PCM/SEGDI `[CONFIRMADO]`:** Modelo de Gestión Documental (MGD) que exige el CUT para interoperabilidad.
* **D.S. N° 004-2019-JUS – TUO Ley N° 27444 `[CONFIRMADO]`:** Arts. 153-156 (intangibilidad del expediente) y Art. 160 (acumulación de procedimientos conexos).
* **R.J. N° 073-2023-AGN/J `[CONFIRMADO]`:** Directiva de foliación cronológica continua e inalterable.

---

## 2. Código Único de Trámite (CUT) según el MGD - PCM

### 2.1 Estructura y Formato Oficial `[CONFIRMADO]`
* **Estructura Estándar:** `EXP-YYYY-XXXXXX`
* **YYYY:** Año fiscal de apertura en Mesa de Partes (ej. `2026`).
* **XXXXXX:** Secuencia numérica correlativa de 6 dígitos.
* **Ejemplo Demostrativo `[EJEMPLO]`:** `EXP-2026-000104`

### 2.2 Reglas de Generación Atómica y Concurrencia
1. **Prohibición de `MAX() + 1` `[CONFIRMADO]`:** Se prohíbe consultar el último registro sumando 1, debido a colisiones en transacciones concurrentes.
2. **Generador Transaccional Dedicado `[CONFIRMADO]`:** Se usará obligatoriamente la función `sigd_tra.generar_cut_expediente(p_anio INT)` con secuencias nativas de base de datos (`SEQUENCE`) particionadas por año fiscal para evitar colisiones concurrentes.

---

## 3. Acumulación y Desacumulación de Expedientes (Art. 160 LPAG)

### 3.1 Flujo Procedimental: Acumulación `[CONFIRMADO]`
1. **Acto Resolutivo:** La autoridad emite un proveído o resolución justificando la conexidad de dos expedientes accesorios o conexos.
2. **Registro en Base de Datos:** Se inserta el registro en la tabla `sigd_tra.expediente_acumulacion` vinculando al Expediente Principal con el Accesorio mediante acto resolutivo justificado.
3. **Bloqueo:** El expediente accesorio cambia a estado `ACUMULADO`. Sus trámites y folios se resuelven fusionados en el principal.

### 3.2 Flujo Procedimental: Desacumulación `[CONFIRMADO]`
Si desaparece la conexidad, un nuevo acto resolutivo ordena la separación. Se marca la desacumulación en la tabla y el expediente accesorio retorna a su trámite individual.

---

## 4. Control de Foliación Digital Continua (Archivo General de la Nación)

### 4.1 Principio Archivístico de Foliatura `[CONFIRMADO]`
* **Prohibición de Solapamientos (`Overlap`):** Un folio no puede estar asignado a dos documentos.
* **Prohibición de Vacíos (`Gaps`):** No pueden existir saltos de folios en la foliación electrónica.

### 4.2 Estructura y Reglas en `expediente_documento_folio` `[CONFIRMADO]`
* **Consistencia de Rango:** Obligatorio cumplir el registro de `folio_inicio`, `folio_fin` y calcular el `total_folios`.
* **Continuidad Estricta:** Para todo documento subsiguiente, el `folio_inicio` es exactamente el `folio_fin` del documento anterior + 1.
* **Inmutabilidad:** Prohibido hacer `DELETE` o vacíos sobre rangos ya emitidos.

---

## 5. Registro de Decisiones Técnicas

| Código | Decisión Adoptada | Categoría |
| :--- | :--- | :--- |
| **DEC-01** | CUT con formato `EXP-YYYY-XXXXXX` y función `generar_cut_expediente` (MGD-PCM). | `[CONFIRMADO]` |
| **DEC-02** | Prohibición absoluta de `MAX() + 1`. | `[CONFIRMADO]` |
| **DEC-03** | Fusión por Acumulación de expedientes conexos (Art. 160 LPAG). | `[CONFIRMADO]` |
| **DEC-04** | Reglas de control de foliado digital continuo. | `[CONFIRMADO]` |