# Análisis funcional de áreas, roles y permisos

## 1. Objetivo y alcance

**PROPUESTO**

El módulo de organización y autorización del Sistema Integral de Gestión Documentaria (SIGD) tendrá como finalidad representar la estructura organizacional de la institución y controlar las acciones que pueden realizar los usuarios internos.

El análisis considera:

- Áreas, oficinas o unidades organizacionales.
- Jerarquía entre unidades.
- Asignación de usuarios a áreas.
- Responsables y vigencias.
- Roles y permisos.
- Validación de autorizaciones desde el backend.
- Casos excepcionales relacionados con estados, vigencias y accesos.

La autorización no deberá depender únicamente de botones u opciones visibles en el frontend.

**PENDIENTE**

Debe confirmarse con el profesor o mediante información institucional:

- El organigrama oficial.
- Las áreas y cargos oficiales.
- Los niveles jerárquicos.
- Los roles y permisos definitivos.
- Si un usuario puede pertenecer a varias áreas.
- Las reglas sobre responsables principales, alternos o temporales.
- El alcance global o por área de los permisos.

Este análisis no define tablas, endpoints ni scripts SQL.

---

## 2. Actores

Los siguientes actores son preliminares y no representan denominaciones institucionales oficiales.

### 2.1 Usuario interno

**EJEMPLO**

Persona registrada en el SIGD que puede estar asignada a un área y realizar acciones según sus roles y permisos.

### 2.2 Responsable de área

**EJEMPLO**

Usuario al que se le asigna responsabilidad sobre determinada área durante un periodo de vigencia.

### 2.3 Administrador del módulo

**EJEMPLO**

Usuario que podría gestionar áreas, asignaciones, responsables, roles o permisos, siempre que tenga autorización.

### 2.4 Backend

**PROPUESTO**

El backend deberá comprobar antes de una operación protegida:

- Usuario existente y activo.
- Área existente y activa.
- Asignaciones vigentes.
- Roles vigentes.
- Permisos.
- Alcance del permiso.

Si alguna condición necesaria no se cumple, la operación deberá rechazarse.

---

## 3. Conceptos principales

### 3.1 Área

**PROPUESTO**

Unidad perteneciente a la estructura organizacional. Puede depender jerárquicamente de otra unidad.

**EJEMPLO**

```text
Área Superior
    └── Área Dependiente
```

### 3.2 Oficina

**PROPUESTO**

Unidad organizacional cuya relación exacta con áreas, direcciones u otras unidades deberá confirmarse mediante el organigrama oficial.

### 3.3 Cargo

**PROPUESTO**

Puesto institucional que ocupa una persona.

No debe confundirse con un rol del sistema.

```text
Cargo → puesto institucional.
Rol   → agrupación de permisos del sistema.
```

### 3.4 Rol

**PROPUESTO**

Agrupación de permisos utilizada para facilitar la administración del control de acceso.

```text
Usuario
   ↓
Rol
   ↓
Permisos
```

**EJEMPLO**

`Rol: Operador de trámite`

El nombre es únicamente demostrativo.

### 3.5 Permiso

**PROPUESTO**

Autorización específica para ejecutar una acción.

**EJEMPLO**

```text
tramite.ver
tramite.recibir
tramite.derivar
tramite.cerrar
```

Estos nombres no representan permisos oficiales.

### 3.6 Responsable

**PROPUESTO**

Usuario al que se asigna responsabilidad sobre un área durante determinada vigencia.

Responsable, cargo, rol y permiso representan conceptos diferentes.

### 3.7 Resumen

| Concepto | Representa |
|---|---|
| Área | Unidad organizacional |
| Oficina | Unidad cuya posición jerárquica debe confirmarse |
| Cargo | Puesto institucional |
| Rol | Agrupación de permisos |
| Permiso | Autorización específica |
| Responsable | Usuario responsable de un área durante una vigencia |

---

## 4. Jerarquía de áreas

**PROPUESTO**

La estructura deberá permitir varios niveles jerárquicos.

**EJEMPLO**

```text
Unidad A
   ├── Unidad B
   └── Unidad C
         └── Unidad D
```

El backend deberá impedir ciclos jerárquicos.

**EJEMPLO**

Si existe:

```text
Área A → Área B → Área C
```

no deberá permitirse:

```text
Área C → Área A
```

porque produciría:

```text
Área A → Área B → Área C → Área A
```

**PENDIENTE**

Confirmar:

- Los niveles jerárquicos oficiales.
- Qué ocurre cuando un área cambia de dependencia.
- Si debe conservarse historial.
- Qué ocurre con las unidades dependientes cuando un área queda inactiva.

---

## 5. Asignación de usuarios a áreas

**PROPUESTO**

El módulo deberá relacionar usuarios internos con áreas sin duplicar innecesariamente la información de identidad.

Conceptualmente:

```text
Usuario
   ↓
Asignación
   ↓
Área
```

Antes de registrar una asignación se debería verificar:

- Usuario existente y activo.
- Área existente y activa.
- Fechas válidas.
- Ausencia de conflictos.
- Autorización del usuario que realiza la operación.

**PENDIENTE**

Debe confirmarse:

- Si un usuario puede pertenecer a varias áreas simultáneamente.
- Si las asignaciones tendrán fechas de inicio y fin.
- Si deberá conservarse historial.
- Qué sucede con permisos y trámites cuando un usuario cambia de área.

El plan interno menciona coordinación con el módulo encargado de usuarios, pero esta regla deberá validarse antes de considerarse institucionalmente confirmada.

---

## 6. Responsables de áreas

**PROPUESTO**

El sistema podría registrar qué usuario es responsable de un área y durante qué periodo.

**EJEMPLO**

```text
Área A

Usuario A
01/01/2026 - 31/07/2026

Usuario B
01/08/2026 - vigente
```

Conservar la vigencia permitiría conocer quién era responsable en una fecha determinada.

**PENDIENTE**

Confirmar:

- Si cada área debe tener un responsable.
- Si puede existir más de uno.
- Si habrá responsables principales, alternos o temporales.
- Si el responsable debe estar previamente asignado al área.
- Qué ocurre cuando el responsable queda inactivo.
- Qué ocurre cuando un área queda sin responsable.

---

## 7. Roles y permisos

**PROPUESTO**

El control de acceso podría organizarse mediante roles y permisos.

```text
Usuario
   ↓
Rol
   ↓
Permisos
   ↓
Acción permitida o denegada
```

Antes de utilizar un rol para autorizar una acción, el backend deberá evaluar su vigencia y los permisos asociados.

Los permisos también podrían tener distintos alcances.

**EJEMPLO**

```text
Permiso: tramite.ver
Alcance: Área A
```

En ese caso, poseer el permiso no significaría necesariamente tener acceso a otras áreas.

**PENDIENTE**

Confirmar:

- Roles oficiales.
- Permisos oficiales.
- Si un usuario puede tener varios roles.
- Si los roles tendrán vigencia.
- Si los permisos serán globales o limitados por área.
- Quién podrá crear, modificar y asignar roles y permisos.

---

## 8. Matriz funcional preliminar

**EJEMPLO — PENDIENTE DE VALIDACIÓN**

| Acción | Consulta | Operativo | Administración |
|---|---:|---:|---:|
| Consultar trámite | Sí | Sí | Sí |
| Recibir trámite | No | Sí | Sí |
| Derivar trámite | No | Sí | Sí |
| Cerrar trámite | No | Pendiente | Sí |
| Crear o actualizar áreas | No | No | Sí |
| Asignar usuarios | No | No | Sí |
| Designar responsables | No | No | Sí |
| Asignar roles | No | No | Sí |

Los nombres de roles y las autorizaciones mostradas son solamente ejemplos.

La matriz definitiva deberá construirse cuando se conozcan los roles y permisos oficiales.

---

## 9. Flujos principales

### 9.1 Registrar o modificar un área

```text
Solicitud
   ↓
Verificar usuario autorizado
   ↓
Validar datos
   ↓
Validar jerarquía
   ↓
Registrar o actualizar
```

### 9.2 Asignar usuario a un área

```text
Usuario + Área
   ↓
Verificar existencia y estado
   ↓
Validar vigencia
   ↓
Validar autorización
   ↓
Registrar asignación
```

### 9.3 Designar responsable

```text
Usuario + Área
   ↓
Validar usuario y área
   ↓
Validar vigencia
   ↓
Verificar conflictos
   ↓
Registrar responsabilidad
```

### 9.4 Verificar autorización

```text
Usuario solicita operación
        ↓
Verificar usuario
        ↓
Obtener roles vigentes
        ↓
Obtener permisos
        ↓
Verificar alcance
        ↓
Permitir / Rechazar
```

---

## 10. Casos excepcionales

El backend deberá considerar, como mínimo:

| Caso | Resultado esperado |
|---|---|
| Área inexistente | Rechazar operación |
| Área inactiva | Evaluar reglas y rechazar cuando corresponda |
| Ciclo jerárquico | Rechazar relación |
| Usuario inexistente | Rechazar asignación |
| Usuario inactivo | Rechazar nuevas operaciones protegidas |
| Asignación vencida | No considerarla vigente |
| Responsable duplicado | Rechazar si existe conflicto según la regla aprobada |
| Rol vencido | No utilizar sus permisos |
| Permiso insuficiente | Acceso denegado |
| Alcance incorrecto | Acceso denegado |

**PENDIENTE**

Las reglas exactas de algunos de estos casos deberán confirmarse institucionalmente.

---

## 11. RBAC y mínimo privilegio

### 11.1 RBAC

**PROPUESTO — BASADO EN INVESTIGACIÓN**

RBAC (*Role-Based Access Control*) organiza las autorizaciones mediante roles.

```text
Usuario → Rol → Permisos
```

Esto permite reutilizar conjuntos de permisos entre usuarios que tengan necesidades similares.

RBAC no reemplaza otras validaciones como estado, vigencia o alcance.

### 11.2 Principio de mínimo privilegio

**PROPUESTO — BASADO EN INVESTIGACIÓN**

Cada usuario deberá recibir únicamente los permisos necesarios para realizar sus funciones.

**EJEMPLO**

Si un usuario solamente necesita consultar:

```text
tramite.ver
```

no debería recibir automáticamente:

```text
tramite.derivar
tramite.cerrar
administrar_roles
```

Una acción no autorizada deberá denegarse por defecto.

La autorización deberá validarse en el backend; ocultar botones en el frontend no constituye por sí solo una medida suficiente de seguridad.

---

## 12. Decisiones y pendientes

### 12.1 Propuestas del análisis

**PROPUESTO**

Se plantea:

- Evitar ciclos jerárquicos.
- Conservar historial cuando sea necesario.
- Evaluar vigencias.
- Validar usuarios y áreas antes de relacionarlos.
- Utilizar roles como agrupaciones de permisos.
- Evaluar el alcance de los permisos.
- Denegar acciones no autorizadas.
- Comprobar la autorización en el backend.

### 12.2 Información pendiente de validación

**PENDIENTE**

Todavía debe confirmarse:

1. Organigrama y unidades oficiales.
2. Cantidad de niveles jerárquicos.
3. Cargos y funciones oficiales.
4. Si un usuario puede pertenecer a varias áreas.
5. Reglas de vigencia e historial.
6. Reglas para responsables principales, alternos o temporales.
7. Roles oficiales.
8. Permisos oficiales.
9. Alcance global o por área.
10. Usuarios autorizados para administrar áreas, responsables, roles y permisos.
11. Qué ocurre con áreas inactivas y sus trámites pendientes.
12. Qué ocurre con usuarios o responsables inactivos.

Los elementos provenientes del plan interno no deberán clasificarse como **CONFIRMADO** hasta contar con una indicación expresa del profesor o información institucional verificada.

---

## 13. Fuentes consultadas

### NIST

- *Role-Based Access Control (RBAC): Features and Motivations*.
- NIST CSRC Glossary — *Role-Based Access Control (RBAC)*.
- NIST CSRC Glossary — *Least Privilege*.

Se utilizaron para comprender RBAC y el principio de mínimo privilegio.

### OWASP Foundation

- *Authorization Cheat Sheet*.

Se utilizó como referencia para mínimo privilegio, denegación por defecto y validación de autorización.

### Documento interno

- *SIGD | Plan de trabajo backend Grupo 3 · OrganiCore*.
- Fecha: 27 de agosto de 2026.

Se utilizó para identificar el alcance preliminar, los conceptos que deben analizarse y las preguntas pendientes.

---

## 14. Conclusión

El análisis define de manera preliminar cómo podrían relacionarse áreas, usuarios, responsables, roles y permisos dentro del SIGD.

También identifica las principales validaciones y situaciones excepcionales que deberá considerar el backend.

Las reglas institucionales que todavía no han sido proporcionadas permanecen marcadas como **PENDIENTE**, mientras que las decisiones técnicas del análisis se identifican como **PROPUESTO** y los datos ficticios como **EJEMPLO**.

Esta información servirá como base para el posterior diseño del modelo de datos y deberá actualizarse cuando el profesor o la institución confirmen las reglas definitivas.