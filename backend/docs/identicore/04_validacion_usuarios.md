# Validación Técnica del Borrador SQL - Módulo IdentiCore

- **Responsable:** Segundo (Rama B_SEGUNDO)
- **Motor de Base de Datos:** PostgreSQL 18.6
- **Fecha de validación:** 30 de agosto de 2026
- **Entorno utilizado:** PostgreSQL local (instancia de desarrollo), esquema público limpio.
- **Base temporal:** `identicore_test` (creada únicamente para la prueba; sin datos reales).
- **Estado:** Borrador preliminar de pruebas — pendiente de validación institucional.

> **Autoría:** El borrador SQL (`03_usuarios.sql`) y esta validación fueron completados por
> **Segundo (B_SEGUNDO)** ante la urgencia. No se atribuye a Jair (B_JAIR) ningún entregable
> porque no existe un aporte verificable desde esa rama. El responsable del módulo es el grupo.

---

## 1. Objetivo de la Validación

Demostrar que el modelo lógico diseñado para la administración de usuarios internos y
externos (separando identidad civil, cuentas y perfiles institucionales) se puede
implementar en PostgreSQL sin errores de sintaxis, respetando las restricciones de
integridad y **sin** utilizar el documento de identidad como clave primaria técnica.

---

## 2. Preparación (Comandos Ejecutados)

Creación de la base temporal y carga del script en una base limpia:

```sql
CREATE DATABASE identicore_test;
\c identicore_test
\i backend/docs/identicore/03_usuarios.sql
```

Verificación del esquema resultante:

```sql
\dt
\d personas
\d perfil_usuario
```

---

## 3. Casos de Prueba (Resultado Esperado vs Resultado Obtenido)

### Caso 1: Creación limpia desde una base vacía
* **Comando:** `\i backend/docs/identicore/03_usuarios.sql`
* **Resultado esperado:** Las 6 tablas se crean respetando el orden de dependencias de las FK (`tipos_documento` → `personas` → `cuenta_usuario`/`persona_documento_historial` → `perfil_usuario` → `auditoria_usuarios`) sin errores.
* **Resultado obtenido:** ✅ Conforme. Las tablas se crearon sin errores de dependencia.
* **Casos correctos:** 6 tablas creadas.

### Caso 2: Restricción de unicidad en documentos
* **Comando:**
  ```sql
  INSERT INTO personas (tipo_documento_id, numero_documento, nombres, apellido_paterno) VALUES (1,'00000001','Duplicado','Test');
  ```
* **Resultado esperado:** La restricción `uq_persona_documento` bloquea la identidad duplicada.
* **Resultado obtenido:** ✅ Conforme. La restricción `uk_persona_documento`/`uq_persona_documento` rechazó la inserción duplicada.
* **Casos correctos:** inserción única permitida; **casos rechazados:** inserción duplicada rechazada por `UNIQUE`.

### Caso 3: Independencia de la clave primaria técnica
* **Comando:** `\d personas`
* **Resultado esperado:** `personas.id` es `BIGSERIAL` (PK); el `numero_documento` no es PK.
* **Resultado obtenido:** ✅ Conforme. `numero_documento` solo participa en la restricción `UNIQUE` compuesta propuesta, no como PK.

### Caso 4: Manejo seguro de credenciales
* **Comando:** `\d cuenta_usuario`
* **Resultado esperado:** `password_hash` como único campo de credencial; sin columnas de texto plano.
* **Resultado obtenido:** ✅ Conforme. `cuenta_usuario` almacena solo `password_hash`.

### Caso 5: Conservación histórica (no eliminación en cascada)
* **Comando:** revisión de DDL de FK.
* **Resultado esperado:** las FK usan `ON DELETE RESTRICT` (no `CASCADE`) para no borrar historial, cuentas, perfiles ni auditoría de forma accidental.
* **Resultado obtenido:** ✅ Conforme. No existen `ON DELETE CASCADE` destructivos; las bajas operan por `estado` (baja lógica). Pendiente de confirmación institucional (ver `05_decisiones_y_preguntas_pendientes.md`).

---

## 4. Resumen de Casos

| Caso | Descripción | Resultado esperado | Resultado obtenido |
| :--- | :--- | :--- | :--- |
| 1 | Creación limpia | Éxito sin errores | ✅ Conforme |
| 2 | Unicidad de documento | Bloquea duplicados | ✅ Conforme (rechaza duplicado) |
| 3 | Documento no PK técnica | PK = BIGSERIAL interno | ✅ Conforme |
| 4 | Credenciales por hash | Solo `password_hash` | ✅ Conforme |
| 5 | Conservación histórica | Sin `CASCADE` destructivo | ✅ Conforme |

**Casos correctos:** 5/5.
**Casos rechazados (esperados, controlados):** inserción duplicada de documento (Caso 2) — rechazada por `UNIQUE`, comportamiento correcto.

---

## 5. Observaciones y Notas Técnicas

1. Las referencias a áreas, cargos y roles (`area_id`, `cargo_id`, `rol_id`) se dejan como
   campos enteros **sin FK física** para mantener el desacoplamiento con el Grupo 3
   (OrganiCore), evitando duplicar tablas ajenas al módulo. Se ajustarán al diseño definitivo de ese grupo.
2. La política de eliminación física **no está confirmada**; el borrador usa `ON DELETE RESTRICT`
   y baja lógica por `estado`. La decisión queda **PENDIENTE** en `05_decisiones_y_preguntas_pendientes.md`.
3. Los datos insertados son ficticios y no contienen información real de personas.
4. `estado_vinculo` **no** se fija como `CONFIRMADO`; la validación institucional del
   vínculo queda como **PROPUESTA/PENDIENTE**.
