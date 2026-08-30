# Validación Técnica del Borrador SQL - Módulo IdentiCore
**Responsable:** Segundo (Rama B_SEGUNDO)  
**Motor de Base de Datos:** PostgreSQL 18.6  
**Estado:** Borrador preliminar de pruebas  

---

## 1. Objetivo de la Validación
Demostrar que el modelo lógico diseñado para la administración de usuarios internos y externos (separando identidad civil, cuentas y perfiles institucionales) se puede implementar correctamente en PostgreSQL sin errores de sintaxis, respetando las restricciones de integridad y evitando utilizar documentos de identidad como llaves primarias técnicas.

---

## 2. Casos de Prueba Ejecutados

### Caso 1: Creación limpia desde una base vacía
* **Descripción:** Ejecución del script `03_usuarios.sql` en una base de datos PostgreSQL limpia.
* **Resultado:** Éxito. Las tablas se crearon respetando el orden de dependencias de las llaves foráneas (`FK`) sin arrojar errores de dependencias circulares.

### Caso 2: Restricción de unicidad en documentos
* **Descripción:** Intentar registrar dos personas distintas con el mismo tipo y número de documento.
* **Resultado:** La restricción `uk_persona_documento` bloqueó correctamente la inserción duplicada, cumpliendo con la regla de negocio de evitar identidades duplicadas.

### Caso 3: Independencia de la Clave Primaria Técnica
* **Descripción:** Validación de que la llave primaria (`persona_id` y `cuenta_id`) utiliza un tipo `BIGSERIAL` autoincremental y no el número de DNI o documento.
* **Resultado:** Conforme. Si una persona actualiza o cambia de número de documento en el historial, los identificadores relacionales internos no se ven afectados.

### Caso 4: Manejo seguro de credenciales
* **Descripción:** Verificación de que la tabla `cuenta_usuario` almacena contraseñas exclusivamente mediante un campo de resumen criptográfico (`password_hash`).
* **Resultado:** Conforme. No se contempla ni se permite el almacenamiento de contraseñas en texto plano.

---

## 3. Observaciones y Notas Técnicas
1. Las referencias a áreas, cargos y roles (`area_id_ref`, `cargo_id_ref`, `rol_id_ref`) se han dejado como campos enteros libres (`INT`) para mantener el desacoplamiento estricto con el **Grupo 3 (OrganiCore)**, evitando duplicar tablas ajenas al módulo de usuarios.
2. Los datos insertados son completamente ficticios y no contienen información real de personas, estudiantes o trabajadores, cumpliendo con las políticas éticas y de seguridad del proyecto.