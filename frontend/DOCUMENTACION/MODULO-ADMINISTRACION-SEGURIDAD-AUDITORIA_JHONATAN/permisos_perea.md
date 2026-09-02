# Módulo de Administración, Seguridad y Auditoría
## Submódulo: Control de Acceso, Roles y Permisos

**Responsable:** Carlos Perea  
**Líder de Módulo:** Jhonatan  

---

### 1. Descripción General
Este componente gestiona el modelo de control de acceso basado en roles (RBAC) dentro del sistema SIGD. Permite restringir y garantizar que cada usuario acceda únicamente a los módulos y acciones asociadas a su puesto institucional.

---

### 2. Matriz de Roles y Permisos

| Rol | Ver Documentos | Crear / Editar | Eliminar | Configurar Maestras | Ver Logs Auditoría |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Administrador del Sistema** |  |  |  |  |  |
| **Jefe de Área / Directivo** |  |  |  |  |  |
| **Operador / Usuario Final** |  |  |  |  |  |
| **Auditor** |  |  |  |  |  |

---

### 3. Requisitos Funcionales

* **RF-01: Asignación Dinámica de Roles**
  * Permitir asociar uno o más roles a una cuenta de usuario activa.
* **RF-02: Gestión Granular de Permisos**
  * Habilitar o deshabilitar permisos específicos por cada vista del sistema (Lectura, Escritura, Eliminación).
* **RF-03: Validación de Sesión y Token**
  * Restringir el acceso a rutas protegidas mediante JWT en el Frontend.
* **RF-04: Registro Inmutable**
  * Enviar cada cambio en la asignación de permisos al log de auditoría.

---

### 4. Estructura de Datos (TypeScript Interface)

```typescript
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Permission {
  id: string;
  module: string;
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE';
}
