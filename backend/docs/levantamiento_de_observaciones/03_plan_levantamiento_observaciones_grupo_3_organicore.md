# PLAN DE TRABAJO: LEVANTAMIENTO DE OBSERVACIONES
## Grupo 3 “OrganiCore” · Estructura Orgánica, Roles y Permisos

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI  
**Área:** Backend  
**Líder General:** Geric · `B_GERIC` | **Sublíder:** Pool · `B_POOL`  
**Integrantes:** Pool (`B_POOL`), Leonardo (`B_LEONARDO`), Panaifo (`B_PANAIFO`)  
**Fecha:** 30 de agosto de 2026  
**Versión:** 2.0 (Fase 2 — Jerarquía Materialized Path, ABAC y Encargaturas)  
**Ubicación:** `backend/docs/levantamiento_de_observaciones/03_plan_levantamiento_observaciones_grupo_3_organicore.md`

---

## 1. Objetivo del Levantamiento de Observaciones

Subsanar las observaciones arquitecturales identificadas en el diagnóstico senior, sustituyendo la dependencia exclusiva de consultas recursivas lentas en organigramas mediante la implementación del patrón **Materialized Path** indexado, desacoplando estrictamente los **Roles de Sistema (RBAC)** de los **Cargos Institucionales**, creando el modelo de **Facultad Legal de Despacho (ABAC)** y formalizando el módulo de **Suplencias y Encargaturas Temporales** con sustento resolutivo.

---

## 2. Alcance Específico de las Mejoras

1. **Estructura de Organigrama Híbrido (Materialized Path + Parent ID):**
   - Incorporar la columna `path VARCHAR(255)` indexada con B-Tree/GIST (ej. `/1/4/12/`) en `sigd_org.area` para consultar relaciones de subordinación, ancestros y descendientes en $O(1)$ sin recurrir a `WITH RECURSIVE`.
2. **Desacoplamiento: Rol de Sistema vs Cargo vs Facultad de Firma:**
   - *Rol de Sistema (`rol`):* Permisos técnicos de UI y endpoints (ej. `ROLE_OPERADOR_MESA_PARTES`, `ROLE_DOCENTE`).
   - *Cargo Institucional (`cargo`):* Puesto formal en el organigrama (ej. `Director General`, `Jefe de Unidad de Secretaría Académica`).
   - *Facultad de Despacho (`facultad_despacho`):* Atribución jurídica contextual para firmar resoluciones, emitir cargos o derivar expedientes.
3. **Módulo de Encargaturas y Suplencias Temporales:**
   - Crear la entidad `sigd_org.encargatura_despacho` con rango de fechas (`periodo_vigencia TSTZRANGE`), usuario titular, usuario suplente, tipo de delegación y referencia a la Resolución Directoral de designación.
4. **Validación Automática contra Ciclos Jerárquicos:**
   - Implementar trigger y validador de dominio que impida que un área se asigne como hija de sí misma o de alguno de sus descendientes.

---

## 3. Límites y Criterios de Validación

- No se asumirá la estructura del organigrama institucional como final; el diseño debe soportar $N$ niveles de profundidad dinámicos.
- La delegación de firma expira de forma automática cuando la fecha actual queda fuera del `periodo_vigencia`.
- Toda decisión técnica se etiquetará según la taxonomía oficial: `CONFIRMADO`, `PROPUESTO`, `PENDIENTE` o `EJEMPLO`.

---

## 4. Organización del Equipo y Ramas Git

| Integrante | Rama Personal | Rol / Responsabilidad en Levantamiento | Entregable Principal |
| :--- | :--- | :--- | :--- |
| **Pool** | `B_POOL` | Sublíder y Modelador | Modelo lógico v2.0, diccionario de datos y diagramas DBML/PNG. |
| **Leonardo** | `B_LEONARDO` | Analista Funcional | Especificación funcional de Materialized Path, ABAC y encargaturas. |
| **Panaifo** | `B_PANAIFO` | Implementador SQL y QA | Script DDL `sigd_org`, triggers de path, validación y notas técnicas. |

---

## 5. Responsabilidades Individuales Detalladas

### Leonardo (`B_LEONARDO`)
- Redactar `01_analisis_path_abac_encargaturas.md` detallando:
  - Funcionamiento del Materialized Path y cálculo de rutas jerárquicas.
  - Matriz de permisos ABAC vs RBAC y control de acceso por contexto de área.
  - Flujo administrativo de encargaturas de despacho y delegación de firma por ausencia temporal.

### Pool (`B_POOL`)
- Diseñar `02_modelo_datos_organicore_v2.md` y `02_diccionario_datos_organicore_v2.md` con las tablas `area`, `cargo`, `asignacion_personal`, `facultad_despacho`, `encargatura_despacho`, `rol` y `permiso`.
- Actualizar el archivo `diagrama_er_organizacion.dbml` y generar la imagen PNG.
- Redactar `05_decisiones_levantamiento_organicore.md` y consolidar en `B_POOL`.

### Panaifo (`B_PANAIFO`)
- Implementar `03_esquema_sigd_org_v2.sql` en PostgreSQL 18 con:
  - Generación y actualización automática del `path` jerárquico mediante trigger.
  - Restricción de exclusión GiST sobre `encargatura_despacho` para evitar suplencias solapadas para un mismo cargo.
- Ejecutar la suite `04_validacion_organicore_v2.md` demostrando:
  - Consulta instantánea de áreas dependientes vía `WHERE path LIKE '/1/4/%'`.
  - Rechazo de asignación cíclica de áreas.
  - Validación de delegación de firma en fecha válida y rechazo post-vencimiento.

---

## 6. Cronograma de Trabajo (Sprint de 2 Semanas)

| Hito | Actividad | Responsable | Plazo |
| :---: | :--- | :---: | :---: |
| **H1** | Análisis Funcional de Path, ABAC y Encargaturas | Leonardo | Días 1 - 4 |
| **H2** | Modelo Lógico v2.0, Diccionario y DBML | Pool | Días 5 - 7 |
| **H3** | DDL SQL con Trigger de Path y Exclusión GiST | Panaifo | Días 8 - 10 |
| **H4** | Validación Técnica de Consultas y Restricciones | Panaifo | Días 11 - 12 |
| **H5** | Integración en `B_POOL` y PR hacia `B_GERIC` | Pool | Días 13 - 14 |

---

## 7. Dependencias y Contratos con Otros Grupos

- **Grupo 1 (RutaDoc):** RutaDoc consulta a OrganiCore si el usuario tiene permiso y pertenencia al área de destino para autorizar la recepción/derivación.
- **Grupo 4 (IdentiCore):** OrganiCore vincula las asignaciones de personal y encargaturas a `sigd_auth.cuenta_usuario`.

---

## 8. LISTA DE VERIFICACIÓN PARA LA ENTREGA DEL LEVANTAMIENTO DE OBSERVACIONES

| Estado | Criterio de Verificación Técnico y Metodológico | Responsable | Evidencia Requerida |
| :---: | :--- | :---: | :--- |
| ☐ | La entidad `area` incorpora la columna `path` indexada y soporta consultas jerárquicas en $O(1)$. | Leonardo / Panaifo | `01_analisis...md` y DDL SQL |
| ☐ | Se previene automáticamente la creación de ciclos en el árbol organizacional (un área no puede ser ancestro de sí misma). | Panaifo | Trigger y caso de prueba en `04_validacion...md` |
| ☐ | Roles de Sistema (RBAC) y Cargos Institucionales están claramente desacoplados en entidades independientes. | Pool | `02_modelo_datos...md` y diccionario |
| ☐ | La entidad `facultad_despacho` permite controlar qué cargos tienen potestad jurídica de firma de documentos. | Leonardo / Pool | Matriz ABAC en `01_analisis...md` |
| ☐ | La tabla `encargatura_despacho` maneja rangos temporales con `TSTZRANGE` e impide solapamientos mediante `EXCLUDE GiST`. | Panaifo | DDL y prueba en `04_validacion...md` |
| ☐ | Diagrama ER actualizado en formato DBML y exportado a imagen PNG. | Pool | Archivos `.dbml` y `.png` |
| ☐ | Registro de decisiones técnicas y justificación de Materialized Path vs Closure Tables. | Pool | `05_decisiones_levantamiento_organicore.md` |
| ☐ | Commits individuales verificables en `B_LEONARDO`, `B_PANAIFO` y `B_POOL`. | Todos | Historial de Git |
| ☐ | Sublíder integró formalmente mediante Pull Request hacia `B_GERIC`. | Pool | PR en GitHub |

---

## 9. Resultado Esperado

Al finalizar este plan, el Grupo 3 entregará una estructura organizacional escalable, consultas de jerarquía inmediatas sin recursión pesada y un sistema de control de acceso y delegación de firma юридически inobjetable.

| Líder General Backend | Sublíder Responsable OrganiCore | Fecha de Conformidad |
| :---: | :---: | :---: |
| **Geric** · `B_GERIC` | **Pool** · `B_POOL` | Pendiente de Revisión |
