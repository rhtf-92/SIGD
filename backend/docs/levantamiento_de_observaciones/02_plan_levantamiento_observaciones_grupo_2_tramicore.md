# PLAN DE TRABAJO: LEVANTAMIENTO DE OBSERVACIONES
## Grupo 2 “TramiCore” · Trámite, Expediente y Libro de Registro

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI  
**Área:** Backend  
**Líder General:** Geric · `B_GERIC` | **Sublíder:** Elmer Ramírez · `B_RAMIREZ`  
**Integrantes:** Elmer Ramírez (`B_RAMIREZ`), Leysglin Riquelmer (`B_RIQUELMER`), Sandy (`B_SANDY`)  
**Fecha:** 30 de agosto de 2026  
**Versión:** 2.0 (Fase 2 — Estandarización MGD, CUT y Foliado Digital)  
**Ubicación:** `backend/docs/levantamiento_de_observaciones/02_plan_levantamiento_observaciones_grupo_2_tramicore.md`

---

## 1. Objetivo del Levantamiento de Observaciones

Subsanar las observaciones arquitecturales identificadas en el diagnóstico senior, reemplazando la relación rígida 1:1 entre trámite y expediente, implementando el generador seguro de Código Único de Trámite (**CUT**) bajo la directiva del Modelo de Gestión Documental (**MGD - PCM**), incorporando la entidad de **Acumulación de Expedientes conexos** (Art. 160 del TUO de la Ley N° 27444) y modelando el **Foliado Digital Progresivo** exigido por el Archivo General de la Nación (AGN).

---

## 2. Alcance Específico de las Mejoras

1. **Generación Atómica de CUT Oficial (MGD - PCM):**
   - Implementar la función transaccional `sigd_tra.generar_cut_expediente(p_anio INT)` que genere códigos con formato `EXP-YYYY-XXXXXX` (ej. `EXP-2026-000104`) mediante secuencias dedicadas por año fiscal sin riesgo de colisiones concurrentes.
2. **Acumulación y Desacumulación de Expedientes (Art. 160 LPAG):**
   - Crear la entidad `sigd_tra.expediente_acumulacion` para soportar la fusión jurídica de expedientes accesorios a un expediente principal mediante acto resolutivo justificado.
3. **Módulo de Foliación Digital Continua (AGN):**
   - Modelar `sigd_tra.expediente_documento_folio` para certificar el rango de folios (`folio_inicio`, `folio_fin`, `total_folios`) asignados a cada documento dentro del expediente, impidiendo duplicidad o vacíos en la foliatura.
4. **Separación Flexible Trámite vs Expediente:**
   - Permitir que un expediente agrupe múltiples solicitudes o actuaciones administrativas secundarias generadas durante el ciclo de vida del trámite principal.

---

## 3. Límites y Criterios de Validación

- Los números del Libro General de Registros (`asiento_registro`) son estrictamente inmutables, correlativos y no reutilizables.
- El CUT generado es el identificador visible público, mientras que las relaciones internas de BD utilizan llaves primarias técnicas UUID (`id_expediente`).
- Toda decisión técnica se etiquetará según la taxonomía oficial: `CONFIRMADO`, `PROPUESTO`, `PENDIENTE` o `EJEMPLO`.

---

## 4. Organización del Equipo y Ramas Git

| Integrante | Rama Personal | Rol / Responsabilidad en Levantamiento | Entregable Principal |
| :--- | :--- | :--- | :--- |
| **Ramírez** | `B_RAMIREZ` | Sublíder e Implementador SQL | DDL de secuencias CUT, foliación progresiva, acumulación y pruebas. |
| **Riquelmer** | `B_RIQUELMER` | Analista Funcional | Análisis de reglas de CUT (MGD-PCM), acumulación LPAG y foliado AGN. |
| **Sandy** | `B_SANDY` | Modeladora de Datos | Modelo lógico v2.0, diccionario de datos y diagramas ER actualizados. |

---

## 5. Responsabilidades Individuales Detalladas

### Riquelmer (`B_RIQUELMER`)
- Redactar `01_analisis_cut_acumulacion_foliado.md` documentando:
  - Estructura y reglas del CUT conforme a la R.S. N° 001-2017-PCM/SEGDI.
  - Flujo procedimental de acumulación y desacumulación (Art. 160 LPAG).
  - Reglas de control de foliación electrónica del Archivo General de la Nación.

### Sandy (`B_SANDY`)
- Diseñar `02_modelo_datos_tramicore_v2.md` y `02_diccionario_datos_tramicore_v2.md` incorporando las entidades `expediente_acumulacion`, `expediente_documento_folio` y `secuencia_anual_cut`.
- Actualizar los diagramas ER editables en Draw.io y exportar la versión PNG.

### Ramírez (`B_RAMIREZ`)
- Implementar `03_esquema_sigd_tra_cut_foliado.sql` en PostgreSQL 18 con:
  - Función atómica `generar_cut_expediente(anio)`.
  - Tabla de control de folios con restricción `CHECK (folio_fin >= folio_inicio)`.
  - Tabla de acumulación de expedientes con clave foránea compuesta.
- Ejecutar la suite `04_validacion_tramicore_v2.md` con 10 pruebas de estrés (generación concurrente de 500 CUTs, validación de foliado continuo y acumulación de 3 expedientes).
- Redactar `05_decisiones_levantamiento_tramicore.md` y consolidar en `B_RAMIREZ`.

---

## 6. Cronograma de Trabajo (Sprint de 2 Semanas)

| Hito | Actividad | Responsable | Plazo |
| :---: | :--- | :---: | :---: |
| **H1** | Análisis Normativo de CUT, Acumulación y Foliado | Riquelmer | Días 1 - 4 |
| **H2** | Modelo Lógico v2.0 y Diagrama Draw.io | Sandy | Días 5 - 7 |
| **H3** | DDL SQL con Función CUT y Tablas de Foliado | Ramírez | Días 8 - 10 |
| **H4** | Pruebas de Concurrencia de CUT y Validación de Foliación | Ramírez | Días 11 - 12 |
| **H5** | Integración en `B_RAMIREZ` y PR hacia `B_GERIC` | Ramírez | Días 13 - 14 |

---

## 7. Dependencias y Contratos con Otros Grupos

- **Grupo 1 (RutaDoc):** TramiCore emite el evento de creación de expediente con su `id_expediente` (UUID) y CUT para el primer movimiento `REGISTRADO`.
- **Grupo 4 (IdentiCore):** TramiCore recibe `id_persona` / `id_usuario` para asociar el administrado titular del expediente.
- **Grupo 5 (DocuCore):** TramiCore recibe los documentos adjuntos y sus hashes SHA-256 para asignarles foliatura oficial en `expediente_documento_folio`.

---

## 8. LISTA DE VERIFICACIÓN PARA LA ENTREGA DEL LEVANTAMIENTO DE OBSERVACIONES

| Estado | Criterio de Verificación Técnico y Metodológico | Responsable | Evidencia Requerida |
| :---: | :--- | :---: | :--- |
| ☐ | El formato del CUT cumple con el estándar `EXP-YYYY-XXXXXX` del MGD-PCM y no usa `MAX()+1`. | Riquelmer / Ramírez | `01_analisis...md` y `03_esquema...sql` |
| ☐ | La función de generación de CUT soporta ejecución concurrente sin duplicados ni bloqueos muertos. | Ramírez | Prueba de estrés en `04_validacion...md` |
| ☐ | La entidad `expediente_acumulacion` modela correctamente la relación N:M entre expedientes conexos (Art. 160 LPAG). | Sandy | `02_modelo_datos...md` y DDL SQL |
| ☐ | La foliación electrónica registra rangos de páginas continuas y rechaza solapamientos de folios. | Sandy / Ramírez | Restricciones en `03_esquema...sql` |
| ☐ | Se mantiene la inmutabilidad y no reutilización de números en `sigd_tra.asiento_registro`. | Ramírez | Verificación en `04_validacion...md` |
| ☐ | Diagrama ER actualizado en Draw.io y exportado a imagen PNG en alta resolución. | Sandy | Archivos `.drawio` y `.png` |
| ☐ | El log de decisiones fundamenta la adopción de las directivas del MGD-PCM y AGN. | Ramírez | `05_decisiones_levantamiento_tramicore.md` |
| ☐ | Commits individuales verificables en `B_RIQUELMER`, `B_SANDY` y `B_RAMIREZ`. | Todos | Historial de Git |
| ☐ | Sublíder integró formalmente mediante Pull Request hacia `B_GERIC`. | Ramírez | PR en GitHub |

---

## 9. Resultado Esperado

Al finalizar este plan, el Grupo 2 entregará el núcleo documental de expedientes y registros plenamente alineado al marco normativo peruano, con generación robusta de CUT y control estricto de folios digitales.

| Líder General Backend | Sublíder Responsable TramiCore | Fecha de Conformidad |
| :---: | :---: | :---: |
| **Geric** · `B_GERIC` | **Elmer Ramírez** · `B_RAMIREZ` | Pendiente de Revisión |
