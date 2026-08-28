# Análisis funcional de áreas, roles y permisos

## 1. Objetivo

**PROPUESTO**

Analizar cómo el SIGD podría organizar áreas, usuarios, responsables, roles y permisos, permitiendo que el backend controle qué acciones puede realizar cada usuario.

Las reglas institucionales definitivas todavía deben ser confirmadas por el profesor.

---

## 2. Conceptos principales

| Concepto | Definición |
|---|---|
| Área | Unidad de la organización. |
| Oficina | Unidad organizacional cuya relación jerárquica debe confirmarse. |
| Cargo | Puesto institucional de una persona. |
| Rol | Agrupación de permisos del sistema. |
| Permiso | Autorización para realizar una acción. |
| Responsable | Usuario encargado de un área durante una vigencia. |

**EJEMPLO**

```text
Usuario
   ↓
Rol
   ↓
Permisos
```

Un cargo no es lo mismo que un rol, y un responsable no necesariamente obtiene permisos por ser responsable.

---

## 3. Áreas y jerarquía

**PROPUESTO**

El sistema podría permitir:

- Crear, consultar y actualizar áreas.
- Activarlas o desactivarlas.
- Establecer áreas superiores y dependientes.
- Evitar ciclos jerárquicos.

**EJEMPLO**

```text
Área A
   ↓
Área B
   ↓
Área C
```

No debería permitirse:

```text
Área C → Área A
```

porque produciría un ciclo.

**PENDIENTE**

Confirmar el organigrama oficial, los niveles jerárquicos y qué ocurre cuando un área queda inactiva.

---

## 4. Usuarios y responsables

**PROPUESTO**

Un usuario podría ser asignado a un área durante un periodo determinado.

```text
Usuario → Área → Vigencia
```

También podría registrarse quién es responsable de cada área y conservar historial de cambios.

**PENDIENTE**

Confirmar:

- Si un usuario puede pertenecer a varias áreas.
- Si las asignaciones tendrán vigencia.
- Si un área puede tener varios responsables.
- Si existirán responsables temporales o alternos.
- Qué ocurre cuando un usuario o responsable queda inactivo.

---

## 5. Roles y permisos

**PROPUESTO**

El acceso podría controlarse mediante roles y permisos.

**EJEMPLO**

```text
Rol: Operador

Permisos:
- tramite.ver
- tramite.recibir
- tramite.derivar
```

Los nombres anteriores son ficticios.

Un permiso también podría tener alcance limitado.

```text
Permiso: tramite.ver
Área: Área A
```

**PENDIENTE**

Confirmar los roles oficiales, permisos oficiales, vigencias y alcances.

---

## 6. Matriz funcional de ejemplo

**EJEMPLO — PENDIENTE DE VALIDACIÓN**

| Acción | Consulta | Operativo | Administración |
|---|---:|---:|---:|
| Consultar trámite | Sí | Sí | Sí |
| Recibir trámite | No | Sí | Sí |
| Derivar trámite | No | Sí | Sí |
| Crear áreas | No | No | Sí |
| Asignar responsables | No | No | Sí |
| Asignar roles | No | No | Sí |

Esta matriz no representa decisiones oficiales.

---

## 7. Validación del backend

**PROPUESTO**

Antes de ejecutar una operación protegida:

```text
Usuario solicita acción
        ↓
Verificar usuario
        ↓
Verificar área y vigencia
        ↓
Verificar rol
        ↓
Verificar permiso y alcance
        ↓
Permitir / Rechazar
```

Ocultar un botón en el frontend no sustituye la validación del backend.

### Casos excepcionales

El sistema debería considerar:

- Área inexistente o inactiva.
- Usuario inexistente o inactivo.
- Ciclo jerárquico.
- Asignación vencida.
- Responsable duplicado.
- Rol vencido.
- Permiso insuficiente.

Cuando una condición necesaria no se cumpla, la operación deberá rechazarse.

---

## 8. RBAC y mínimo privilegio

**PROPUESTO — BASADO EN INVESTIGACIÓN**

RBAC (*Role-Based Access Control*) organiza los permisos mediante roles:

```text
Usuario → Rol → Permisos
```

El principio de mínimo privilegio establece que cada usuario debe recibir solamente los permisos necesarios para realizar su función.

Por ello, una acción no autorizada deberá denegarse por defecto.

---

## 9. Información pendiente

**PENDIENTE**

Debe confirmarse con el profesor:

1. Organigrama oficial.
2. Áreas y cargos oficiales.
3. Si un usuario puede pertenecer a varias áreas.
4. Reglas de responsables y vigencias.
5. Roles oficiales.
6. Permisos oficiales.
7. Alcance de los permisos.
8. Quién puede administrar áreas, responsables, roles y permisos.
9. Qué ocurre con áreas o usuarios inactivos.

No se utilizará **CONFIRMADO** hasta contar con una indicación expresa del profesor o información institucional verificada.

---

## 10. Fuentes

- NIST — *Role-Based Access Control (RBAC): Features and Motivations*.
- NIST CSRC — *Role-Based Access Control*.
- NIST CSRC — *Least Privilege*.
- OWASP — *Authorization Cheat Sheet*.
- *SIGD | Plan de trabajo backend Grupo 3 · OrganiCore*.

---

## 11. Conclusión

El análisis define de forma preliminar la relación entre áreas, usuarios, responsables, roles y permisos del SIGD.

Las decisiones técnicas se mantienen como **PROPUESTO**, los datos ficticios como **EJEMPLO** y las reglas institucionales aún no confirmadas como **PENDIENTE**.