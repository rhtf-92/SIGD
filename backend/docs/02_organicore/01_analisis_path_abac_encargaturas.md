# An├ílisis Funcional de ├üreas, Roles y Permisos

## Grupo 3 - OrganiCore

**Proyecto:** Sistema Integral de Gesti├│n Documentaria (SIGD)  
**Responsable:** Leonardo  
**Rama:** `B_LEONARDO`  
**Estado:** `PROPUESTO`

---

## 1. Objetivo

Definir c├│mo el SIGD administrar├í ├íreas, jerarqu├¡as, asignaciones, responsables, cargos, roles, permisos y alcance de autorizaciones.

Las reglas no confirmadas se mantienen como `PENDIENTE`.

---

## 2. ├üreas y estructura organizacional

Una ├║nica entidad conceptual `area` representar├í las unidades organizacionales.

La jerarqu├¡a debe permitir varios niveles y evitar ciclos.

```text
├ürea A
ÔööÔöÇÔöÇ ├ürea B
    ÔööÔöÇÔöÇ ├ürea C
```

Ejemplo de ciclo inv├ílido:

```text
A -> B -> C -> A
```

Para la Fase 2, la jerarqu├¡a evoluciona al uso de `parent_id` + Materialized Path.

La jerarqu├¡a utilizar├í una ruta `path` indexada para consultar sub├íreas de forma eficiente y evitar depender de consultas recursivas.

Ver detalle en:

```text
01_analisis_path_abac_encargaturas.md
```

**Clasificaci├│n:** `PROPUESTO`

### Pendiente

- Organigrama institucional.
- Tipos oficiales de ├íreas.

---

## 3. Usuarios, asignaciones y responsables

Un usuario podr├í relacionarse con un ├írea mediante una asignaci├│n con vigencia.

```text
Usuario
   Ôåô
Asignaci├│n
   Ôåô
├ürea
```

Los reemplazos temporales se manejar├ín mediante encargaturas o suplencias, con periodo de vigencia y resoluci├│n.

**Clasificaci├│n:** `PROPUESTO`

### Pendiente

- Si un usuario puede pertenecer a varias ├íreas.
- Tipos oficiales de responsabilidad.
- Reglas institucionales de reemplazo temporal.

---

## 4. Diferencia entre conceptos

| Concepto | Funci├│n |
|---|---|
| ├ürea | Unidad organizacional |
| Cargo | Puesto institucional |
| Rol | Agrupaci├│n de permisos t├®cnicos |
| Permiso | Acci├│n t├®cnica autorizable |
| Responsable | Persona asignada a un ├írea |
| Facultad de despacho | Atribuci├│n institucional para acciones sensibles |

Un cargo no equivale a un rol del sistema.

**Clasificaci├│n:** `PROPUESTO`

---

## 5. Roles y permisos

Un usuario podr├í tener uno o varios roles y cada rol podr├í agrupar varios permisos.

```text
Usuario
   Ôåô
Roles
   Ôåô
Permisos
```

Ejemplo:

```text
Usuario A
Ôö£ÔöÇÔöÇ Rol Operativo
Ôöé   Ôö£ÔöÇÔöÇ tramite.ver
Ôöé   ÔööÔöÇÔöÇ tramite.recibir
ÔööÔöÇÔöÇ Rol Derivador
    ÔööÔöÇÔöÇ tramite.derivar
```

**Clasificaci├│n:** `EJEMPLO`

A nivel de arquitectura backend, se propone utilizar identificadores UUID para las entidades del m├│dulo.

**Clasificaci├│n:** `PROPUESTO`

---

## 6. Alcance de permisos

Se proponen los siguientes alcances:

- `AREA`: solo el ├írea asignada.
- `SUBAREAS`: ├írea asignada y descendientes.
- `GLOBAL`: alcance general autorizado.

No se heredar├ín permisos autom├íticamente.

**Clasificaci├│n:** `PROPUESTO`

El alcance definitivo queda `PENDIENTE`.

---

## 7. Validaci├│n de autorizaci├│n

El backend deber├í validar:

```text
Usuario activo
      Ôåô
Asignaci├│n vigente
      Ôåô
Rol vigente
      Ôåô
Permiso
      Ôåô
Contexto de ├írea
      Ôåô
Permitir / Denegar
```

Para acciones sensibles tambi├®n se validar├í:

- cargo institucional;
- facultad de despacho;
- encargatura vigente;
- ├írea de la operaci├│n.

Ocultar botones en frontend no reemplaza esta validaci├│n.

**Clasificaci├│n:** `PROPUESTO`

---

## 8. RBAC y m├¡nimo privilegio

RBAC controla acciones mediante roles y permisos.

Se aplicar├í m├¡nimo privilegio:

- no conceder permisos por defecto;
- no heredar autom├íticamente a sub├íreas;
- validar alcance;
- validar en backend;
- separar permiso t├®cnico de facultad institucional.

**Clasificaci├│n:** `PROPUESTO`

---

## 9. Inactivaci├│n e historial

Los registros importantes deber├ín conservar historial mediante inactivaci├│n l├│gica o vigencia.

```text
activo = true  -> vigente
activo = false -> inactivo
```

Los registros inactivos no participar├ín en nuevas operaciones.

**Clasificaci├│n:** `PROPUESTO`

---

## 10. Casos excepcionales

El backend deber├í rechazar:

- ├írea o usuario inexistente;
- ├írea o usuario inactivo;
- asignaci├│n vencida;
- rol vencido;
- permiso insuficiente;
- operaci├│n fuera de alcance;
- ciclo jer├írquico;
- acci├│n sensible sin facultad de despacho;
- encargatura vencida.

**Clasificaci├│n:** `PROPUESTO`

---

## 11. Matriz funcional de ejemplo

| Acci├│n | Consulta | Operativo | Administraci├│n |
|---|---:|---:|---:|
| Consultar tr├ímite | S├¡ | S├¡ | S├¡ |
| Recibir tr├ímite | No | S├¡ | S├¡ |
| Derivar tr├ímite | No | S├¡ | S├¡ |
| Administrar ├íreas | No | No | S├¡ |
| Designar responsables | No | No | S├¡ |
| Asignar roles | No | No | S├¡ |

**Clasificaci├│n:** `EJEMPLO`

---

## 12. Informaci├│n pendiente

1. Organigrama institucional.
2. Tipos oficiales de ├íreas.
3. Si un usuario puede pertenecer a varias ├íreas.
4. Cargos oficiales.
5. Roles oficiales.
6. Permisos oficiales.
7. Alcances autorizados.
8. Tipos de responsables.
9. Facultades institucionales por cargo.
10. Reglas de encargaturas y suplencias.
11. Qui├®n administrar├í ├íreas, roles, permisos y responsabilidades.

**Clasificaci├│n:** `PENDIENTE`

---

## 13. Conclusi├│n

OrganiCore mantendr├í separados ├írea, cargo, rol, permiso, responsabilidad y facultad de despacho.

La autorizaci├│n aplicar├í m├¡nimo privilegio, validaci├│n contextual en backend y conservaci├│n de historial.

La Fase 2 se desarrolla en:

```text
01_analisis_path_abac_encargaturas.md
```

---

## 14. Fuentes y referencias

- Plan de trabajo del Grupo 3 - OrganiCore.
- Plan de levantamiento de observaciones del Grupo 3 - OrganiCore.
- Documentaci├│n institucional del IESTP "Suiza", cuando sea validada.
