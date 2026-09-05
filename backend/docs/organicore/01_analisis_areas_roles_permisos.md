# Análisis funcional de áreas, roles y permisos

- Responsable: Leonardo
- Rama: `B_LEONARDO`
- Grupo: Grupo 3 — OrganiCore
- Estado: PROPUESTA PRELIMINAR (Insumo para Modelo de Datos)
- Validación institucional: PENDIENTE

---

## 1. Objetivo

**PROPUESTO**

Definir cómo el SIGD organizará las áreas, usuarios, responsables, roles y permisos, asegurando que el backend controle las acciones autorizadas y mantenga la trazabilidad de la información.

Las reglas institucionales que todavía no hayan sido proporcionadas se mantienen como **PENDIENTE**.

---

## 2. Áreas y estructura organizacional

**PROPUESTO**

En la base de datos se manejará una sola entidad denominada **Área**.

Las denominaciones institucionales como Gerencia, Subgerencia, Oficina u otras se diferenciarán mediante un tipo o nivel organizacional.

**EJEMPLO**

```text
Área
- Gerencia
- Subgerencia
- Oficina
```

La jerarquía permitirá relacionar áreas superiores y dependientes:

```text
Gerencia
   ↓
Subgerencia
   ↓
Oficina
```

El sistema deberá impedir ciclos jerárquicos.

**PENDIENTE**

Confirmar el organigrama y los tipos oficiales de áreas.

---

## 3. Usuarios y responsables

**PROPUESTO**

Un usuario podrá estar relacionado con un área mediante una asignación y podrá conservarse su vigencia para mantener historial.

```text
Usuario → Área → Vigencia
```

Los responsables también tendrán fecha de inicio y fin.

Para reemplazos temporales podrá existir la figura de **Responsable Interino**.

**EJEMPLO**

```text
Área: Oficina A
Responsable: Usuario B
Tipo: INTERINO
Inicio: 01/08/2026
Fin: 15/08/2026
```

Esto permitirá cubrir vacaciones, licencias u otros reemplazos sin eliminar al responsable anterior.

**PENDIENTE**

Confirmar si un usuario puede pertenecer simultáneamente a varias áreas y qué tipos oficiales de responsables existirán.

---

## 4. Roles y permisos

**PROPUESTO**

Un usuario podrá tener **uno o varios roles**, y cada rol podrá contener varios permisos.

```text
Usuario
   ↓
Roles
   ↓
Permisos
```

**EJEMPLO**

```text
Usuario A
├── Rol 1
│   ├── tramite.ver
│   └── tramite.recibir
└── Rol 2
    └── tramite.derivar
```

Los nombres anteriores son ficticios.

### Alcance de permisos

Para aplicar mínimo privilegio, los permisos **no se heredarán automáticamente** hacia las subáreas.

Un permiso podrá definir un alcance:

```text
AREA      → únicamente el área asignada
SUBAREAS  → área asignada y sus áreas dependientes
GLOBAL    → todas las áreas
```

**EJEMPLO**

```text
Permiso: tramite.ver
Alcance: AREA
Área: Oficina A
```

En este caso el usuario no obtiene automáticamente acceso a las oficinas dependientes.

**PENDIENTE**

Confirmar los roles, permisos y alcances oficiales.

---

## 5. Inactivación y conservación del historial

**PROPUESTO**

Las áreas, usuarios, asignaciones y demás registros importantes **no se eliminarán físicamente** cuando dejen de utilizarse.

Se aplicará una inactivación lógica o *soft delete*:

```text
activo = true   → registro vigente
activo = false  → registro inactivo
```

De esta manera se mantiene el historial necesario para conocer qué área, usuario o responsable participó anteriormente en un trámite.

Un registro inactivo no deberá utilizarse para nuevas operaciones, salvo que una regla específica indique lo contrario.

---

## 6. Validación de autorización

**PROPUESTO**

Antes de ejecutar una operación protegida, el backend deberá comprobar:

```text
Usuario activo
      ↓
Asignación vigente
      ↓
Roles vigentes
      ↓
Permisos
      ↓
Alcance
      ↓
Permitir / Denegar
```

Ocultar botones en el frontend no reemplaza esta validación.

Entre los casos que deberán rechazarse se consideran:

- Usuario o área inexistente.
- Usuario o área inactiva.
- Ciclo jerárquico.
- Asignación vencida.
- Rol vencido.
- Permiso insuficiente.
- Permiso fuera de su alcance.

---

## 7. RBAC y mínimo privilegio

**PROPUESTO — BASADO EN INVESTIGACIÓN**

El modelo RBAC organiza las autorizaciones mediante roles:

```text
Usuario → Roles → Permisos
```

El principio de mínimo privilegio establece que cada usuario debe recibir únicamente los permisos necesarios.

Por ello:

- No se conceden permisos por defecto.
- No existe herencia automática hacia subáreas.
- Los permisos deben tener un alcance definido.
- La autorización se comprueba en el backend.

---

## 8. Matriz funcional de ejemplo

**EJEMPLO — PENDIENTE DE VALIDACIÓN**

| Acción | Consulta | Operativo | Administración |
|---|---:|---:|---:|
| Consultar trámite | Sí | Sí | Sí |
| Recibir trámite | No | Sí | Sí |
| Derivar trámite | No | Sí | Sí |
| Administrar áreas | No | No | Sí |
| Designar responsables | No | No | Sí |
| Asignar roles | No | No | Sí |

Esta matriz es únicamente demostrativa.

---

## 9. Información pendiente

**PENDIENTE**

Debe confirmarse con el profesor:

1. Organigrama institucional.
2. Tipos oficiales de áreas.
3. Si un usuario puede pertenecer a varias áreas.
4. Roles oficiales.
5. Permisos oficiales.
6. Alcances permitidos.
7. Tipos oficiales de responsables.
8. Quién administrará áreas, responsables, roles y permisos.

No se utilizará la categoría **CONFIRMADO** hasta contar con una indicación expresa del profesor o información institucional verificada.
---

## 10. Conclusión

El módulo utilizará una estructura única de áreas, permitirá múltiples roles por usuario, controlará el alcance de los permisos, conservará los registros mediante inactivación lógica y permitirá responsables interinos con vigencia.

Estas decisiones se consideran **PROPUESTO** hasta su validación institucional.

---

## 11. Fuentes y Referencias

1. **Documentación Oficial y Manuales Organizacionales de Culper:** Estructura orgánica, organigrama institucional y manual de perfiles de puesto utilizados para la definición de áreas y responsabilidades.
2. **Especificaciones Funcionales del Sistema Culper:** Requisitos de negocio para la gestión de usuarios, asignación de cargos, trazabilidad e historial de responsables.
3. **Estándar de Control de Acceso (RBAC / NIST SP 800-162):** Criterios técnicos de seguridad para el diseño de roles, permisos y mínimos privilegios en la arquitectura del sistema.