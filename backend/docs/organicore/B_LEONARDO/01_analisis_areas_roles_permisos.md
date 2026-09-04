Análisis Funcional de Áreas, Roles y Permisos

Grupo 3 - OrganiCore

Proyecto: Sistema Integral de Gestión Documentaria (SIGD)
Responsable: Leonardo
Rama: B_LEONARDO
Estado: PROPUESTO

1. Objetivo

Definir funcionalmente cómo el SIGD administrará:

áreas institucionales;

jerarquías organizacionales;

asignaciones de usuarios;

responsables;

cargos;

roles;

permisos;

alcance de autorizaciones.

Las reglas institucionales todavía no confirmadas se mantienen como PENDIENTE.

2. Áreas y estructura organizacional

Una única entidad conceptual area representará las unidades organizacionales.

Las denominaciones institucionales como oficina, unidad o dirección podrán diferenciarse mediante atributos de clasificación, sin crear una tabla distinta para cada nivel.

Clasificación: PROPUESTO

La jerarquía debe permitir varios niveles.

Ejemplo:

Área A
└── Área B
    └── Área C

El sistema deberá impedir relaciones circulares como:

A -> B -> C -> A

Clasificación: PROPUESTO

Para la Fase 2, la jerarquía evoluciona hacia el uso combinado de parent_id y Materialized Path.

El análisis detallado se encuentra en:

01_analisis_path_abac_encargaturas.md

Pendiente

Confirmar el organigrama institucional.

Confirmar los tipos oficiales de áreas.

3. Usuarios, asignaciones y responsables

Un usuario interno podrá relacionarse con un área mediante una asignación con periodo de vigencia.

Ejemplo conceptual:

Usuario
   ↓
Asignación
   ↓
Área

La asignación deberá permitir conservar historial mediante fechas de inicio y fin.

Clasificación: PROPUESTO

Un responsable deberá estar vinculado a un área mediante una asignación vigente.

Los reemplazos temporales no deberán eliminar ni sobrescribir al responsable titular.

En la Fase 2, estos reemplazos se formalizan mediante encargaturas y suplencias temporales respaldadas por un periodo de vigencia y una resolución.

Clasificación: PROPUESTO

Pendiente

Confirmar si un usuario puede pertenecer simultáneamente a varias áreas.

Confirmar los tipos oficiales de responsabilidad.

Confirmar las reglas institucionales de reemplazo temporal.

4. Diferencia entre área, cargo, rol, permiso y responsabilidad

Estos conceptos deberán mantenerse separados.

Concepto

Función

Área

Unidad organizacional

Cargo

Puesto institucional

Rol

Agrupación de permisos técnicos del sistema

Permiso

Acción técnica autorizable

Responsable

Persona asignada funcionalmente a un área

Facultad de despacho

Atribución institucional para acciones sensibles

Clasificación: PROPUESTO

Un cargo institucional no equivale a un rol del sistema.

Asimismo, poseer un rol técnico no significa automáticamente tener facultad institucional para firmar, emitir o despachar determinados actos.

5. Roles y permisos

Un usuario podrá tener uno o varios roles.

Cada rol podrá agrupar uno o varios permisos.

Usuario
   ↓
Roles
   ↓
Permisos

Clasificación: PROPUESTO

Ejemplo:

Usuario A
├── Rol Operativo
│   ├── tramite.ver
│   └── tramite.recibir
└── Rol Derivador
    └── tramite.derivar

Clasificación: EJEMPLO

Los nombres utilizados no representan roles oficiales.

6. Alcance de permisos

Los permisos no deberán heredarse automáticamente hacia otras áreas.

Se propone manejar alcances como:

AREA
SUBAREAS
GLOBAL

AREA: únicamente el área asignada.

SUBAREAS: el área asignada y sus áreas descendientes.

GLOBAL: alcance general cuando exista autorización.

Clasificación: PROPUESTO

Ejemplo:

Permiso: tramite.ver
Alcance: AREA
Área: Oficina A

En este caso, el usuario no recibe automáticamente acceso a otras áreas.

Clasificación: EJEMPLO

El alcance definitivo deberá validarse institucionalmente.

Clasificación: PENDIENTE

7. Validación de autorización

Antes de ejecutar una operación protegida, el backend deberá comprobar como mínimo:

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

Clasificación: PROPUESTO

Para acciones sensibles, la Fase 2 incorpora además la validación de:

cargo institucional;

facultad de despacho;

encargatura vigente;

área sobre la cual se realiza la operación.

Ocultar botones en el frontend no reemplaza la validación del backend.

El análisis detallado se encuentra en:

01_analisis_path_abac_encargaturas.md

8. RBAC y principio de mínimo privilegio

RBAC permite determinar qué acciones técnicas puede ejecutar un usuario según sus roles y permisos.

El principio de mínimo privilegio establece que cada usuario deberá recibir únicamente los permisos necesarios para realizar sus funciones.

Por ello:

no se conceden permisos por defecto;

no existe herencia automática hacia subáreas;

el alcance debe ser evaluado;

las acciones sensibles deben validarse en el backend;

un permiso técnico no implica automáticamente una facultad institucional.

Clasificación: PROPUESTO

9. Inactivación y conservación del historial

Las áreas, asignaciones y demás registros organizacionales importantes no deberán eliminarse físicamente cuando sea necesario conservar trazabilidad.

Se propone utilizar inactivación lógica o periodos de vigencia.

Ejemplo:

activo = true  -> registro disponible
activo = false -> registro inactivo

Clasificación: PROPUESTO

Un registro inactivo no deberá participar en nuevas operaciones.

Los registros históricos deberán conservarse para conocer las asignaciones y responsabilidades anteriores.

10. Casos excepcionales

El backend deberá rechazar, según corresponda:

área inexistente;

área inactiva;

usuario inexistente;

usuario inactivo;

asignación vencida;

rol vencido;

permiso insuficiente;

operación fuera del alcance autorizado;

ciclo jerárquico;

acción sensible sin facultad de despacho;

encargatura vencida.

Clasificación: PROPUESTO

11. Matriz funcional de ejemplo

Acción

Consulta

Operativo

Administración

Consultar trámite

Sí

Sí

Sí

Recibir trámite

No

Sí

Sí

Derivar trámite

No

Sí

Sí

Administrar áreas

No

No

Sí

Designar responsables

No

No

Sí

Asignar roles

No

No

Sí

Clasificación: EJEMPLO

Esta matriz es únicamente demostrativa y no representa roles institucionales definitivos.

12. Información pendiente

Se requiere confirmar:

Organigrama institucional oficial.

Tipos oficiales de áreas.

Posibilidad de pertenencia simultánea a varias áreas.

Cargos institucionales oficiales.

Roles oficiales.

Permisos oficiales.

Alcances autorizados.

Tipos de responsables.

Facultades institucionales asignadas a cada cargo.

Reglas oficiales para encargaturas y suplencias.

Quién administrará áreas, roles, permisos y responsabilidades.

Clasificación: PENDIENTE

13. Conclusión

OrganiCore deberá mantener separados los conceptos de área, cargo, rol, permiso, responsabilidad y facultad de despacho.

La autorización deberá aplicar mínimo privilegio, validar el contexto en el backend y conservar el historial de asignaciones y responsabilidades.

La evolución técnica de jerarquías, ABAC y encargaturas se desarrolla específicamente en:

01_analisis_path_abac_encargaturas.md

Las decisiones institucionales permanecen como PENDIENTE hasta su validación oficial.

14. Fuentes y referencias

Plan de trabajo del Grupo 3 - OrganiCore.

Plan de levantamiento de observaciones del Grupo 3 - OrganiCore.

Documentación institucional del IESTP "Suiza", cuando sea proporcionada y validada.

Referencias técnicas de control de acceso RBAC y ABAC utilizadas por el equipo para sustentar las propuestas.