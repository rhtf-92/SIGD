# Documento de Consolidación
## Formulario de Registro de Usuario Externo — Equipo Frontend

**Sistema Integral de Gestión Documentaria (SIGD)**
Instituto de Educación Superior Tecnológico Público "Suiza" — Pucallpa

---

## 1. Introducción

Este documento consolida las propuestas de trabajo elaboradas por el sub-equipo asignado al desarrollo del Formulario de Registro de Usuario dentro del proyecto SIGD, conformado por Matías Zumaeta (líder del sub-equipo), Sergio y Vazques. Se presenta como entregable formal para revisión del líder del equipo Frontend (Christiam) y, posteriormente, del docente responsable de la unidad didáctica Taller de Software.

El objetivo de este documento es dejar constancia clara de lo que se implementó, lo que aportó cada integrante, y los puntos que requieren definición antes de continuar con el desarrollo.

## 2. Objetivo de la tarea

Según las indicaciones brindadas por el docente, la tarea consiste en diseñar e implementar una interfaz de registro dirigida a usuarios externos (ciudadanos sin credenciales previas en el sistema) que deseen crear una cuenta para dar seguimiento a sus trámites documentarios ante el Instituto Suiza. El diseño debe tomar como referencia los estándares de usabilidad de portales del Estado peruano, como el Poder Judicial.

## 3. Aportes por integrante

| Integrante | Aporte | Observación |
|---|---|---|
| **Matías Zumaeta (líder)** | Implementación base funcional en React + TypeScript + Vite. Formulario con datos personales, contacto y domicilio con listas dependientes (provincia/distrito de Ucayali). Identidad visual con fachada institucional y logo del Instituto Suiza. | Base sobre la que se consolidó la versión final del equipo. |
| **Sergio** | Implementación paralela con arquitectura equivalente. Sumó los campos DNI y fecha de nacimiento, checkbox de declaración jurada, y alineación de campos en fila. Identificó una referencia sin reemplazar al "Poder Judicial" en la cabecera de su prototipo. | Sus mejoras (DNI, fecha de nacimiento, declaración jurada) fueron integradas a la versión final. |
| **Vazques (Angel Jesús)** | Propuesta documentada de una interfaz de administración de usuarios internos: gestión de roles y permisos (Administrador, Mesa de Partes, Operador, Auditor), datos laborales, credenciales de acceso, listado con búsqueda/filtros y control de estado de cuentas. | El alcance corresponde a un panel administrativo interno, distinto al registro externo de ciudadanos solicitado en el encargo original. Se solicitó aclaración (ver sección 5). |

## 4. Especificación técnica de la versión consolidada

La versión final integra la implementación base de Matías con las mejoras propuestas por Sergio.

| Sección | Campos |
|---|---|
| Datos personales | Nombres, apellidos, DNI (8 dígitos), fecha de nacimiento |
| Datos de contacto | Correo electrónico, teléfono (9 dígitos) |
| Domicilio | Departamento (Ucayali, fijo), provincia y distrito (listas dependientes), dirección exacta, referencia (opcional) |
| Declaración jurada | Confirmación obligatoria de veracidad de los datos ingresados |

### 4.1 Stack tecnológico

- React + TypeScript + Vite
- Estructura modular por carpetas: `api`, `assets`, `components`, `config`, `data`, `hooks`, `layouts`, `pages`, `routes`, `types`, `utils`
- Enrutamiento con `react-router-dom`

### 4.2 Identidad visual

- Fondo con fotografía institucional (fachada del Instituto Suiza)
- Logo/insignia oficial del Instituto Suiza en la cabecera
- Diseño minimalista con tarjeta central, bordes redondeados y sombra suave

### 4.3 Validaciones implementadas

- Campos obligatorios: nombres, apellidos, DNI, fecha de nacimiento, correo, teléfono, provincia, distrito, dirección
- DNI: exactamente 8 dígitos numéricos
- Teléfono: exactamente 9 dígitos numéricos
- Correo electrónico: formato válido
- Declaración jurada: aceptación obligatoria mediante checkbox
- Los mensajes de error se muestran directamente debajo del campo correspondiente

### 4.4 Estado del envío de datos

Actualmente el formulario valida los datos y genera la estructura del objeto a enviar (visualizado mediante consola del navegador), a la espera de que el equipo de Backend defina el endpoint correspondiente (`POST /api/usuarios-externos`). Al completar el envío se muestra una confirmación visual de éxito, en lugar de una alerta del navegador.

## 5. Punto pendiente de definición

La propuesta elaborada por Vazques describe una interfaz de administración de usuarios internos del sistema (con gestión de roles, permisos, credenciales de acceso y datos laborales). Este alcance difiere del registro externo de ciudadanos descrito en el encargo original.

Se solicita al líder del equipo Frontend y/o al docente confirmar si:

- **a)** el panel de administración de usuarios internos corresponde a una funcionalidad adicional a desarrollarse en una etapa posterior del proyecto, o
- **b)** hubo una interpretación distinta del encargo que deba corregirse antes de continuar.

Mientras se recibe esta confirmación, el sub-equipo continuará el desarrollo sobre la base del registro externo, por ser la interpretación que coincide con las indicaciones registradas en las sesiones de coordinación del docente.

## 6. Estado general

### 6.1 Implementado

- [x] Arquitectura frontend funcional
- [x] Identidad visual institucional aplicada
- [x] Formulario completo con validaciones
- [x] Listas dependientes de provincia y distrito (región Ucayali)
- [x] Confirmación visual de registro exitoso

### 6.2 Pendiente

- [ ] Definición del alcance del panel de administración de usuarios (ver sección 5)
- [ ] Integración con el endpoint real del backend
- [ ] Persistencia de datos y autenticación de usuarios
- [ ] Revisión final de diseño responsive en dispositivos móviles

## 7. Equipo responsable

- **Líder del sub-equipo:** Matías Zumaeta
- **Integrantes:** Sergio, Vazques (Angel Jesús)
- **Reporta a:** Christiam (líder del equipo Frontend)
- **Docente responsable:** Ing. Renato Henyer Tarazona Flores — Unidad Didáctica Taller de Software / Taller de Base de Datos

---

*Pucallpa, agosto de 2026*