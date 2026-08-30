# Decisiones, Supuestos y Preguntas Pendientes - Módulo IdentiCore

- **Grupo:** Grupo 4 — IdentiCore · Responsable del modelo: Segundo (B_SEGUNDO)
- **Estado:** BORRADOR — PENDIENTE DE VALIDACIÓN INSTITUCIONAL Y DEL PROFESOR
- **Fecha:** 30 de agosto de 2026
- **Convención de niveles:** CONFIRMADO / PROPUESTO / PENDIENTE / EJEMPLO.

> Este documento registra las decisiones técnicas tomadas por el grupo y aquello que todavía debe confirmarse. **No presenta como oficiales** las reglas, campos o vínculos que dependen de la institución o del profesor.

---

## 1. Decisiones Arquitectónicas Propuestas

### 1.1 Separación de persona · cuenta · perfil
* **Decisión:** se modelan como entidades independientes `personas` (identidad civil), `cuenta_usuario` (credenciales) y `perfil_usuario` (rol institucional).
* **Justificación:** evita duplicar datos personales en cada cuenta o vínculo, permite que un externo intervenga **sin** cuenta permanente (`tipo_usuario = EXTERNO`, `condicion_registro = SIN_CUENTA`) y desacopla la autenticación de la identidad.
* **Nivel:** PROPUESTO (pendiente de validación grupal).

### 1.2 El documento de identidad NO es clave primaria técnica
* **Decisión:** `personas.id` (BIGSERIAL) es el identificador interno; el `numero_documento` solo se usa para identificación y búsqueda.
* **Justificación:** el DNI/CE puede cambiar, no se debe exponer como identificador de trazabilidad y evita problemas de privacidad.
* **Nivel:** CONFIRMADO (buena práctica + plan de trabajo).

### 1.3 Unicidad del documento
* **Decisión:** se propone `UNIQUE(tipo_documento_id, numero_documento)` en `personas` para prevenir identidades duplicadas.
* **Justificación:** la restricción solo debe aplicarse si el análisis y las reglas institucionales lo justifican.
* **Nivel:** PROPUESTO — PENDIENTE de confirmar si el documento es obligatorio para todos los tipos de usuario.

### 1.4 Vínculo con OrganiCore (Grupo 3)
* **Decisión:** IdentiCore **no** crea tablas de áreas, cargos, roles ni permisos; `perfil_usuario` referencia conceptualmente `areas`, `cargos` y `roles` de OrganiCore.
* **Justificación:** evitar duplicar el módulo RBAC de OrganiCore y respetar la propiedad de cada módulo.
* **Nivel:** PROPUESTO — depende del diseño definitivo del Grupo 3.

### 1.5 Cardinalidad persona–cuenta (1:N)
* **Decisión:** una persona puede tener más de una cuenta (`cuenta_usuario.persona_id` 1:N).
* **Justificación:** flexibilidad ante recuperación de acceso o múltiples medios; sujeto a confirmación si la institución exige una sola cuenta por persona.
* **Nivel:** PROPUESTO.

### 1.6 Seguridad de credenciales
* **Decisión:** solo se almacena `password_hash` (ej. bcrypt); nunca contraseñas en texto plano.
* **Justificación:** requisito técnico mínimo de seguridad.
* **Nivel:** CONFIRMADO.

### 1.7 Integración mediante identificadores internos
* **Decisión:** IdentiCore expone `personas.id` / `perfil_usuario.id` como referencias estables para RutaDoc, TramiCore y otros módulos (nunca el documento visible).
* **Justificación:** preserva la trazabilidad sin fuga de datos personales y sin duplicar entidades.
* **Nivel:** PROPUESTO (coordinar con Grupo 6).

---

## 2. Supuestos del Grupo

| ID | Supuesto | Nivel |
| :--- | :--- | :--- |
| SU-01 | Existirá al menos un catálogo de tipos de documento (`tipos_documento`), cuyos valores se confirmarán con la institución. | SUPUESTO / PENDIENTE |
| SU-02 | Un usuario externo puede intervenir **sin** cuenta (como remitente/solicitante) cuando la institución lo permita. | SUPUESTO / PENDIENTE |
| SU-03 | Las áreas, cargos, roles y permisos permanecen en OrganiCore y serán referenciados, no duplicados. | SUPUESTO / PENDIENTE |
| SU-04 | Los datos de prueba serán ficticios y no incluirán DNI, nombres, correos ni contraseñas reales. | CONFIRMADO |
| SU-05 | PostgreSQL 18.6 es la referencia del equipo para el borrador SQL (responsable: Jair, B_JAIR). | CONFIRMADO |

---

## 3. Preguntas Pendientes

### 3.1 Para el profesor
1. ¿Todo usuario interno tendrá obligatoriamente una cuenta registrada en el SIGD?
2. ¿En qué casos un usuario externo deberá registrarse y en cuáles podrá presentar un trámite sin cuenta?
3. ¿El DNI será obligatorio para todos o se admitirán otros documentos de identidad?
4. ¿Qué datos personales y de contacto son obligatorios para cada tipo de usuario (interno / externo)?
5. ¿Se debe conservar el historial de cambios de datos, estados y vínculos institucionales?
6. ¿Quién puede registrar, validar, actualizar, activar o desactivar a un usuario?

### 3.2 Para la institución (Grupo 3 / OrganiCore)
1. ¿Cuáles son los tipos de documento de identidad oficialmente admitidos?
2. ¿Qué campos son obligatorios para un usuario interno y para un usuario externo?
3. ¿Cómo se demostrará el vínculo de un usuario interno con un área, cargo o dependencia (tablas y nombres exactos de OrganiCore)?
4. ¿Existen códigos oficiales de áreas, cargos y roles que debamos referenciar?

### 3.3 Para la integración (Grupo 6 / CoreLink)
1. ¿Cómo validarán los demás módulos la existencia y vigencia del usuario **sin** duplicar sus datos?
2. ¿Qué identificador interno se consumirá como referencia estable (`personas.id` vs `perfil_usuario.id`)?

---

## 4. Estado de Decisiones

| Decisión | Estado | Nivel |
| :--- | :--- | :--- |
| Separación persona / cuenta / perfil | PROPUESTO — pendiente de validación grupal | PROPUESTO |
| Documento NO como PK técnica | Aplicado | CONFIRMADO |
| Unicidad compuesta del documento | Propuesto; requiere confirmación normativa | PENDIENTE |
| Referencia a OrganiCore sin duplicar | Propuesto; depende del Grupo 3 | PENDIENTE |
| Cardinalidad persona–cuenta 1:N | Propuesto | PENDIENTE |
| Hash de contraseña | Aplicado | CONFIRMADO |
| Integración por identificadores internos | Propuesto; coordinar con Grupo 6 | PENDIENTE |

---

## 5. Registro de Revisiones

| Versión | Fecha | Responsable | Cambio | Estado |
| :--- | :--- | :--- | :--- | :--- |
| 0.1 | 2026-08-30 | Segundo (B_SEGUNDO) | Creación del modelo de datos, diccionario y registro de decisiones de IdentiCore sobre la base del plan de trabajo del grupo | **BORRADOR — PENDIENTE DE VALIDACIÓN** |

---

## 6. Fuentes Consultadas

- Plan de trabajo del Grupo 4 (IdentiCore): `backend/docs/planes_trabajo/04_plan_trabajo_grupo_4_identicore.md`.
- Convenciones del módulo OrganiCore (estructura de referencia): `backend/docs/organicore/02_modelo_datos_organizacion.md`, `02_diccionario_datos_organizacion.md`, `05_decisiones_y_preguntas_pendientes.md`.
- Contratos y decisiones de integración (Grupo 6): `backend/docs/integracion/04_contratos_y_decisiones_pendientes.md`.
