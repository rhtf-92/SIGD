| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-03 |
| **Módulo** | administracion-seguridad-auditoria / Administración, Seguridad y Auditoría |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Carlos Perea ("Gato"), Jhonatan Nijar Gonzales de Souza, Leonel Rivera Maxin ("Maxin"), Cristian Macedo |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 03. Control de Acceso Basado en Roles (RBAC) y Matriz de Permisos

## 1. Introducción y Modelo de Seguridad RBAC

El Sistema Integral de Gestión Documentaria (SIGD) del IESTP "Suiza" adopta un modelo estricto de **Control de Acceso Basado en Roles (RBAC - Role-Based Access Control)**. La finalidad es asegurar que cada funcionario, directivo u operador acceda únicamente a los expedientes, bandejas y funcionalidades indispensables para el cumplimiento de sus deberes funcionales, en estricta consonancia con el principio de reserva y seguridad de la información pública.

Este submódulo se encuentra completamente implementado en el frontend a través del componente `frontend/src/pages/administracion/RolesPermisosPage.tsx`, el cual provee un panel interactivo donde los administradores pueden visualizar y modificar la matriz de privilegios en tiempo real.

---

## 2. Taxonomía de Roles Institucionales

El sistema tipifica cuatro (4) roles canónicos:

1. **`admin` (Administrador del Sistema):** Control integral de configuración del SIGD, gobernanza de seguridad, administración de tablas maestras, desbloqueo de usuarios y auditoría forense.
2. **`responsable` (Responsable de Área / Directivo):** Jefes de departamento académico, secretarios académicos o administradores. Poseen atribuciones de visación, aprobación, derivación, observación y archivado formal de expedientes en su área y subáreas dependientes.
3. **`operador` (Operador / Asistente Administrativo):** Personal técnico de mesa de partes o asistentes de despacho que registran trámites, folian documentos y ejecutan derivaciones operativas ordinarias.
4. **`consulta` (Usuario de Consulta / Auditor Externo):** Perfil de solo lectura asignado a órganos de control institucional (OCI), fiscalizadores de DREU o personal en inducción, facultado para auditar expedientes sin capacidad de alteración.

---

## 3. Matriz Exhaustiva de Permisos por Módulo y Rol

A diferencia de versiones preliminares no completadas, la siguiente matriz documenta la asignación real y efectiva implementada en el código fuente de `RolesPermisosPage.tsx`:

### 3.1. Rol: Administrador (`admin`)
*Alcance: Toda la Institución.*

| Módulo Funcional | Ver | Crear | Editar | Derivar | Archivar | Eliminar (Lógico) | Exportar |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Expedientes** | `SI` | `SI` | `SI` | `SI` | `SI` | `SI` | `SI` |
| **Documentos** | `SI` | `SI` | `SI` | `SI` | `SI` | `SI` | `SI` |
| **Administración** | `SI` | `SI` | `SI` | `NO` | `NO` | `SI` | `SI` |
| **Auditoría** | `SI` | `NO` | `NO` | `NO` | `NO` | `NO` | `SI` |

*Nota de seguridad:* El módulo de Auditoría tiene deshabilitadas las opciones de crear, editar, derivar y eliminar incluso para el Administrador, garantizando la inmutabilidad de los registros.

### 3.2. Rol: Responsable de Área (`responsable`)
*Alcance: Área adscrita y subáreas dependientes.*

| Módulo Funcional | Ver | Crear | Editar | Derivar | Archivar | Eliminar (Lógico) | Exportar |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Expedientes** | `SI` | `SI` | `SI` | `SI` | `SI` | `NO` | `SI` |
| **Documentos** | `SI` | `SI` | `SI` | `SI` | `SI` | `NO` | `SI` |
| **Administración** | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` |
| **Auditoría** | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` |

### 3.3. Rol: Operador (`operador`)
*Alcance: Área asignada.*

| Módulo Funcional | Ver | Crear | Editar | Derivar | Archivar | Eliminar (Lógico) | Exportar |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Expedientes** | `SI` | `SI` | `SI` | `SI` | `NO` | `NO` | `NO` |
| **Documentos** | `SI` | `SI` | `SI` | `NO` | `NO` | `NO` | `NO` |
| **Administración** | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` |
| **Auditoría** | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` |

### 3.4. Rol: Consulta (`consulta`)
*Alcance: Asignado estrictamente.*

| Módulo Funcional | Ver | Crear | Editar | Derivar | Archivar | Eliminar (Lógico) | Exportar |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Expedientes** | `SI` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` |
| **Documentos** | `SI` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` |
| **Administración** | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` |
| **Auditoría** | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` |

---

## 4. Contratos de Datos en TypeScript

Modelos sincronizados entre `RolesPermisosPage.tsx` y la capa de servicios de seguridad:

```typescript
export interface Rol {
  id: string; // 'admin' | 'responsable' | 'operador' | 'consulta'
  nombre: string;
  descripcion: string;
  alcance: string;
  usuarios: number;
}

export interface PermisoModulo {
  modulo: string; // 'Expedientes' | 'Documentos' | 'Administración' | 'Auditoría'
  ver: boolean;
  crear: boolean;
  editar: boolean;
  derivar: boolean;
  archivar: boolean;
  eliminar: boolean;
  exportar: boolean;
}

export type ClavePermiso = Exclude<keyof PermisoModulo, "modulo">;

export interface RoleRBACPayload {
  roleId: string;
  permissions: Record<string, PermisoModulo>;
}
```

---

## 5. Implementación en Frontend: Route Guards y Hook de Autorización

Para proteger las rutas del cliente y evitar accesos no autorizados mediante manipulación directa de la URL:

1. **Guardia de Rutas (`ProtectedRoute.tsx`):**
   Intercepta la navegación en React Router DOM 7. Si el token JWT ha expirado o el rol del usuario no cuenta con el permiso requerido para la ruta destino, redirige automáticamente a `/login` o a una vista de acceso denegado (`403 Forbidden`).
2. **Hook de Autorización (`usePermission`):**
   ```typescript
   export function usePermission(modulo: string, accion: ClavePermiso): boolean {
     const { user } = useAuth();
     if (!user || !user.permisos) return false;
     const perm = user.permisos.find(p => p.modulo.toLowerCase() === modulo.toLowerCase());
     return perm ? Boolean(perm[accion]) : false;
   }
   ```
   Permite condicionar la visibilidad y habilitación de botones de acción en la interfaz (`[Derivar]`, `[Archivar]`, `[Eliminar]`).
