# Análisis Funcional de Materialized Path, ABAC y Encargaturas

## Grupo 3 - OrganiCore

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Responsable:** Leonardo  
**Rama:** `B_LEONARDO`  
**Estado:** `PROPUESTO`

---

## 1. Objetivo

Definir funcionalmente las mejoras de la Fase 2 de OrganiCore relacionadas con jerarquía organizacional, control de acceso contextual y encargaturas temporales.

Las reglas institucionales no confirmadas se mantienen como `PENDIENTE`.

---

## 2. Jerarquía de áreas

Cada área podrá depender de otra mediante `parent_id`.

Además, se utilizará un `path` jerárquico para representar su ubicación dentro del organigrama.

Ejemplo:

```text
Dirección General
└── Administración
    └── Tesorería
```

```text
direccion_general
direccion_general.administracion
direccion_general.administracion.tesoreria
```

Esto permitirá consultar áreas superiores y subáreas de forma eficiente.

**Clasificación:** `PROPUESTO`

---

## 3. Prevención de ciclos

El sistema deberá impedir relaciones jerárquicas inválidas.

Ejemplo:

```text
A → B → C → A
```

Antes de cambiar el área superior, deberá verificarse que el nuevo padre no sea la propia área ni uno de sus descendientes.

**Clasificación:** `PROPUESTO`

---

## 4. Diferencia entre conceptos

| Concepto | Función |
|---|---|
| Área | Unidad organizacional |
| Cargo | Puesto institucional |
| Rol | Agrupación de permisos técnicos |
| Permiso | Acción autorizable |
| Facultad de despacho | Atribución institucional |
| Encargatura | Delegación temporal de funciones |

Un cargo no equivale a un rol del sistema.

---

## 5. RBAC y ABAC

RBAC determinará si el usuario posee un permiso.

```text
Usuario → Rol → Permiso
```

ABAC evaluará si ese permiso puede utilizarse según el contexto:

- área;
- cargo;
- asignación vigente;
- alcance;
- facultad de despacho;
- encargatura vigente.

```text
Permiso RBAC
      +
Contexto ABAC
      ↓
Permitir / Denegar
```

**Clasificación:** `PROPUESTO`

---

## 6. Alcance de permisos

Se proponen:

- `AREA`: solo el área asignada.
- `SUBAREAS`: área y descendientes.
- `GLOBAL`: alcance general autorizado.

Los permisos no se heredarán automáticamente.

**Clasificación:** `PROPUESTO`

---

## 7. Matriz RBAC vs ABAC

**EJEMPLO**

| Acción | RBAC | ABAC | Resultado |
|---|---|---|---|
| Consultar trámite | `tramite.ver` | Área válida | Permitir |
| Derivar trámite | `tramite.derivar` | Área dentro del alcance | Permitir |
| Firmar documento | Permiso de firma | Facultad vigente | Permitir |
| Firmar por suplencia | Permiso técnico | Encargatura vigente | Permitir |
| Firmar con encargatura vencida | Permiso técnico | Vigencia vencida | Denegar |

---

## 8. Encargaturas y suplencias

Las encargaturas permitirán reemplazos temporales por vacaciones, licencia u otras ausencias.

Deberán registrar:

- área;
- cargo;
- usuario titular;
- usuario suplente;
- fecha de inicio y fin;
- resolución o documento de autorización.

Flujo:

```text
Ausencia del titular
      ↓
Resolución o autorización
      ↓
Registro del suplente
      ↓
Periodo de vigencia
      ↓
Validación de facultad
      ↓
Encargatura activa
```

Cuando finalice el periodo, la delegación deberá dejar de ser válida automáticamente.

**Clasificación:** `PROPUESTO`

---

## 9. Validación de autorización

Antes de una operación protegida, el backend deberá comprobar:

```text
Usuario activo
      ↓
Asignación vigente
      ↓
Rol y permiso
      ↓
Alcance
      ↓
Contexto de área
      ↓
Facultad o encargatura, si corresponde
      ↓
Permitir / Denegar
```

El frontend no sustituye estas validaciones.

---

## 10. Casos que deben rechazarse

- usuario o área inactiva;
- asignación vencida;
- permiso insuficiente;
- operación fuera de alcance;
- ciclo jerárquico;
- acción sensible sin facultad;
- encargatura inexistente o vencida.

---

## 11. Información pendiente

1. Organigrama oficial.
2. Cargos oficiales.
3. Roles y permisos oficiales.
4. Alcances permitidos.
5. Facultades institucionales por cargo.
6. Reglas de encargaturas y suplencias.
7. Quién administrará estas configuraciones.

**Clasificación:** `PENDIENTE`

---

## 12. Conclusión

OrganiCore combinará:

```text
parent_id
+
Materialized Path
+
RBAC
+
ABAC
+
Encargaturas
```

La jerarquía permitirá organizar áreas de varios niveles, RBAC controlará permisos técnicos y ABAC validará el contexto de uso.

Las encargaturas permitirán delegaciones temporales conservando vigencia e historial.

---

## 13. Fuentes

- Plan de Trabajo del Grupo 3 — OrganiCore.
- Plan de Levantamiento de Observaciones del Grupo 3 — OrganiCore.
- Documentación institucional del IESTP "Suiza", cuando sea validada.