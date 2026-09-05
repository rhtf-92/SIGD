| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-05 |
| **Módulo** | administracion-seguridad-auditoria / Administración, Seguridad y Auditoría |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Jhonatan Nijar Gonzales De Souza, Angel Vásquez, Carlos Perea |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 05. Directorio de Usuarios y Políticas de Seguridad de Acceso

## 1. Introducción y Enfoque Institucional

La salvaguarda de la información administrativa y académica del IESTP "Suiza" exige una estricta disciplina en la administración del directorio de personal y en las políticas de seguridad perimetral de acceso. Toda persona que interactúe con el SIGD debe poseer una identidad digital verificada, adscrita a una unidad orgánica específica y regida por parámetros estrictos de autenticación.

Este ámbito se encuentra plenamente articulado en el frontend mediante dos componentes especializados:
1. **Directorio de Cuentas Institucionales (`UsuariosPage.tsx`):** Consola para el alta, categorización, asignación orgánica y control de ciclo de vida de las cuentas del personal.
2. **Monitor de Políticas de Seguridad (`SeguridadPage.tsx`):** Panel para supervisar intentos de acceso, gestionar bloqueos por fuerza bruta y calibrar parámetros de sesión.

---

## 2. Directorio Institucional de Usuarios (`UsuariosPage.tsx`)

### 2.1. Estructura de Datos e Interfaz en TypeScript
```typescript
export type EstadoUsuario = "Activo" | "Inactivo" | "Bloqueado";

export interface Usuario {
  id: number;
  nombre: string; // Nombres y Apellidos completos
  dni: string; // Documento Nacional de Identidad (8 dígitos numéricos)
  correo: string; // Correo corporativo (@institutosuiza.edu.pe)
  sede: string; // Campus o local asignado (Ej: 'Sede Principal')
  area: string; // Unidad orgánica (Ej: 'Mesa de Partes', 'Secretaría Académica')
  cargo: string; // Cargo institucional (Ej: 'Asistente Administrativo', 'Secretaria')
  rol: string; // 'Administrador' | 'Responsable de Área' | 'Operador' | 'Consulta'
  estado: EstadoUsuario;
  ultimoAcceso: string; // Timestamp 'DD/MM/AAAA HH:mm'
}
```

### 2.2. Reglas Operativas del Directorio
* **Unicidad de Documento de Identidad:** El DNI debe ser único en la base de datos y validado contra el servicio de RENIEC para garantizar que los nombres y apellidos coincidan fielmente con el registro civil oficial.
* **Correo Institucional Obligatorio:** Toda cuenta de personal debe asociarse obligatoriamente a un buzón bajo el dominio oficial `@institutosuiza.edu.pe` para notificaciones fehacientes.
* **Cambio de Estado:**
  - *Activo:* Usuario facultado para iniciar sesión y operar el sistema.
  - *Inactivo:* Usuario cesado o en licencia temporal. Sus accesos quedan revocados inmediatamente, pero sus firmas históricas y trazabilidad se preservan intactas.
  - *Bloqueado:* Cuenta suspendida preventivamente por el motor de seguridad tras vulnerar las políticas de acceso.

---

## 3. Políticas y Parámetros de Seguridad de Acceso (`SeguridadPage.tsx`)

El componente `SeguridadPage.tsx` implementa y monitorea activamente tres directivas nucleares de ciberseguridad institucional:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PARÁMETROS ACTIVOS DE SEGURIDAD (SIGD)                   │
├───────────────────────────────┬───────────────────────────────┬─────────────┤
│ 1. LÍMITE DE INTENTOS FALLIDOS│ 2. TIEMPO DE BLOQUEO CUENTA   │ 3. TIMEOUT  │
│    5 Intentos Consecutivos    │    30 Minutos de Suspensión   │ 30 Minutos  │
└───────────────────────────────┴───────────────────────────────┴─────────────┘
```

1. **Defensa contra Ataques de Fuerza Bruta (Máx. 5 Intentos):**
   Si un usuario introduce credenciales erróneas en cinco (5) oportunidades consecutivas desde una misma IP o hacia una misma cuenta, el sistema bloquea inmediatamente la cuenta y conmuta su estado a `"Bloqueado"`.
2. **Período de Bloqueo Temporal (30 Minutos):**
   La cuenta suspendida no podrá reintentar autenticación hasta cumplidos los treinta (30) minutos de penalización automática, a menos que un Administrador del Sistema ejecute un desbloqueo manual supervisado.
3. **Expiración de Sesión por Inactividad (30 Minutos):**
   Si el operador mantiene la sesión abierta sin interacción en el navegador (movimiento de mouse, pulsaciones de teclas o llamadas API) durante 30 minutos, el token JWT local se destruye y la vista retorna a la pantalla de login.

---

## 4. Modelos de Monitoreo de Intentos y Bloqueos

Sincronizados con el código en `SeguridadPage.tsx`:

```typescript
export interface CuentaBloqueada {
  id: number;
  usuario: string; // Nombre completo
  correo: string;
  motivo: string; // Ej: 'Exceso de intentos fallidos'
  fecha: string; // Timestamp de bloqueo
}

export interface IntentoAcceso {
  id: number;
  fecha: string;
  usuario: string;
  ip: string;
  resultado: "Correcto" | "Fallido";
}
```

---

## 5. Procedimiento de Desbloqueo Supervisado

Cuando una cuenta es suspendida por incidentes de seguridad, el procedimiento exige:
1. **Verificación de Identidad:** El titular debe comunicarse con el área de soporte de TI o presentar solicitud desde su correo institucional.
2. **Acción en Panel de Seguridad:** El Administrador accede a `SeguridadPage.tsx`, localiza la tarjeta de la cuenta en la lista de `Cuentas Bloqueadas` y pulsa `[Desbloquear Cuenta]`.
3. **Registro Forzoso en Auditoría:** La acción gatilla automáticamente un evento en el log de auditoría con la IP del administrador actuante y el motivo del desbloqueo.
4. **Reseteo Obligatorio de Contraseña:** Al siguiente inicio de sesión, el usuario es forzado a cambiar su contraseña antes de poder acceder a los módulos de trámite.
