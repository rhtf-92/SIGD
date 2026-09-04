# Análisis Funcional de Áreas, Roles y Permisos

## Grupo 3 - OrganiCore

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Responsable:** Leonardo  
**Rama:** `B_LEONARDO`  
**Estado:** `PROPUESTO`

---

## 1. Objetivo

Definir cómo el SIGD administrará áreas, jerarquías, asignaciones, responsables, cargos, roles, permisos y alcance de autorizaciones.

Las reglas no confirmadas se mantienen como `PENDIENTE`.

---

## 2. Áreas y estructura organizacional

Una única entidad conceptual `area` representará las unidades organizacionales.

La jerarquía debe permitir varios niveles y evitar ciclos.

```text
Área A
└── Área B
    └── Área C
```

Ejemplo de ciclo inválido:

```text
A -> B -> C -> A
```

Para la Fase 2, la jerarquía evoluciona al uso de `parent_id` + Materialized Path.

Ver detalle en:

```text
01_analisis_path_abac_encargaturas.md
```

**Clasificación:** `PROPUESTO`

### Pendiente

- Organigrama institucional.
- Tipos oficiales de áreas.

---

## 3. Usuarios, asignaciones y responsables

Un usuario podrá relacionarse con un área mediante una asignación con vigencia.

```text
Usuario
   ↓
Asignación
   ↓
Área
```

Los reemplazos temporales se manejarán mediante encargaturas o suplencias, con periodo de vigencia y resolución.

**Clasificación:** `PROPUESTO`

### Pendiente

- Si un usuario puede pertenecer a varias áreas.
- Tipos oficiales de responsabilidad.
- Reglas institucionales de reemplazo temporal.

---

## 4. Diferencia entre conceptos

| Concepto | Función |
|---|---|
| Área | Unidad organizacional |
| Cargo | Puesto institucional |
| Rol | Agrupación de permisos técnicos |
| Permiso | Acción técnica autorizable |
| Responsable | Persona asignada a un área |
| Facultad de despacho | Atribución institucional para acciones sensibles |

Un cargo no equivale a un rol del sistema.

**Clasificación:** `PROPUESTO`

---

## 5. Roles y permisos

Un usuario podrá tener uno o varios roles y cada rol podrá agrupar varios permisos.

```text
Usuario
   ↓
Roles
   ↓
Permisos
```

Ejemplo:

```text
Usuario A
├── Rol Operativo
│   ├── tramite.ver
│   └── tramite.recibir
└── Rol Derivador
    └── tramite.derivar
```

**Clasificación:** `EJEMPLO`

---

## 6. Alcance de permisos

Se proponen los siguientes alcances:

- `AREA`: solo el área asignada.
- `SUBAREAS`: área asignada y descendientes.
- `GLOBAL`: alcance general autorizado.

No se heredarán permisos automáticamente.

**Clasificación:** `PROPUESTO`

El alcance definitivo queda `PENDIENTE`.

---

## 7. Validación de autorización

El backend deberá validar:

```text
Usuario activo
      ↓
Asignación vigente
      ↓
Rol vigente
      ↓
Permiso
      ↓
Contexto de área
      ↓
Permitir / Denegar
```

Para acciones sensibles también se validará:

- cargo institucional;
- facultad de despacho;
- encargatura vigente;
- área de la operación.

Ocultar botones en frontend no reemplaza esta validación.

**Clasificación:** `PROPUESTO`

---

## 8. RBAC y mínimo privilegio

RBAC controla acciones mediante roles y permisos.

Se aplicará mínimo privilegio:

- no conceder permisos por defecto;
- no heredar automáticamente a subáreas;
- validar alcance;
- validar en backend;
- separar permiso técnico de facultad institucional.

**Clasificación:** `PROPUESTO`

---

## 9. Inactivación e historial

Los registros importantes deberán conservar historial mediante inactivación lógica o vigencia.

```text
activo = true  -> vigente
activo = false -> inactivo
```

Los registros inactivos no participarán en nuevas operaciones.

**Clasificación:** `PROPUESTO`

---

## 10. Casos excepcionales

El backend deberá rechazar:

- área o usuario inexistente;
- área o usuario inactivo;
- asignación vencida;
- rol vencido;
- permiso insuficiente;
- operación fuera de alcance;
- ciclo jerárquico;
- acción sensible sin facultad de despacho;
- encargatura vencida.

**Clasificación:** `PROPUESTO`

---

## 11. Matriz funcional de ejemplo

| Acción | Consulta | Operativo | Administración |
|---|---:|---:|---:|
| Consultar trámite | Sí | Sí | Sí |
| Recibir trámite | No | Sí | Sí |
| Derivar trámite | No | Sí | Sí |
| Administrar áreas | No | No | Sí |
| Designar responsables | No | No | Sí |
| Asignar roles | No | No | Sí |

**Clasificación:** `EJEMPLO`

---

## 12. Información pendiente

1. Organigrama institucional.
2. Tipos oficiales de áreas.
3. Si un usuario puede pertenecer a varias áreas.
4. Cargos oficiales.
5. Roles oficiales.
6. Permisos oficiales.
7. Alcances autorizados.
8. Tipos de responsables.
9. Facultades institucionales por cargo.
10. Reglas de encargaturas y suplencias.
11. Quién administrará áreas, roles, permisos y responsabilidades.

**Clasificación:** `PENDIENTE`

---

## 13. Conclusión

OrganiCore mantendrá separados área, cargo, rol, permiso, responsabilidad y facultad de despacho.

La autorización aplicará mínimo privilegio, validación contextual en backend y conservación de historial.

La Fase 2 se desarrolla en:

```text
01_analisis_path_abac_encargaturas.md
```

---

## 14. Fuentes y referencias

- Plan de trabajo del Grupo 3 - OrganiCore.
- Plan de levantamiento de observaciones del Grupo 3 - OrganiCore.
- Documentación institucional del IESTP "Suiza", cuando sea validada.