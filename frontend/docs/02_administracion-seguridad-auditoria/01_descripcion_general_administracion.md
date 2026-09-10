| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-01 |
| **Módulo** | administracion-seguridad-auditoria / Administración, Seguridad y Auditoría |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Jhonatan Nijar Gonzales de Souza, Carlos Perea ("Gato"), Leonel Rivera Maxin ("Maxin"), Cristian Macedo |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 01. Descripción General del Hub de Administración, Seguridad y Auditoría

## 1. Misión del Módulo y Contexto Institucional

El Módulo de **Administración, Seguridad y Auditoría** constituye el cerebro de gobernanza y control operativo del Sistema Integral de Gestión Documentaria (SIGD) del Instituto de Educación Superior Tecnológico Público "Suiza" (IESTP "Suiza"). En una entidad pública de educación tecnológica que atiende a miles de estudiantes en la Amazonía peruana (Pucallpa, Coronel Portillo, Ucayali), la integridad de la información institucional, la confidencialidad de los expedientes y la trazabilidad de cada acción administrativa exigen un marco de control centralizado y riguroso.

Este módulo provee al personal directivo y a los administradores de sistemas una consola unificada para gobernar las políticas de acceso, parametrizar la estructura institucional, fiscalizar eventos del sistema mediante pistas de auditoría inmutables y regular el cómputo de términos procesales conforme al TUO de la Ley N° 27444.

---

## 2. Articulación Directa con la Implementación React 19 (`AdministracionPage.tsx`)

La arquitectura de interfaz del frontend se articula directamente a través de la página central de administración (`frontend/src/pages/administracion/AdministracionPage.tsx`), la cual despliega un panel ejecutivo modular estructurado en seis (6) submódulos operativos:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PANEL CENTRAL DE ADMINISTRACIÓN (SIGD)                │
│                        AdministracionPage.tsx (Hub Principal)               │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ 1. USUARIOS (/administracion/usuarios)│ 2. ROLES Y PERMISOS (/roles-permisos)│
│    • Directorio de cuentas oficiales │    • Matriz RBAC dinámica (4 roles)  │
│    • Sede, área, cargo y estado      │    • 7 acciones operativas granulares│
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 3. AUDITORÍA (/auditoria)            │ 4. TABLAS MAESTRAS (/tablas-maestras)│
│    • Pistas inmutables WORM          │    • Parámetros: Sedes y Áreas       │
│    • Registro de eventos y origen IP │    • Catálogo de Tipos Documentales  │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 5. CALENDARIO LABORAL (/calendario)  │ 6. SEGURIDAD (/seguridad)            │
│    • Jornada hábil (08:00 - 17:00)   │    • Bloqueo por intentos fallidos   │
│    • Feriados nacionales y Ucayali   │    • Duración de sesiones JWT        │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

Cada tarjeta operativa del hub central implementa transiciones fluidas de navegación mediante el hook `useNavigate` de React Router DOM 7, garantizando aislamiento de estados y coherencia visual con la paleta gubernamental de Tailwind CSS.

---

## 3. Arquitectura Funcional de los 6 Submódulos

1. **Gestión de Directorio de Usuarios (`UsuariosPage.tsx`):**
   Administra el ciclo de vida de las cuentas del personal docente, administrativo y directivo del instituto. Permite la creación, habilitación, suspensión y reseteo de credenciales de acceso, vinculando a cada funcionario con su DNI verificado y su unidad orgánica de adscripción.

2. **Control de Acceso Basado en Roles - RBAC (`RolesPermisosPage.tsx`):**
   Modela los privilegios de los cuatro roles institucionales (`admin`, `responsable`, `operador`, `consulta`) frente a siete permisos funcionales granulares (`ver`, `crear`, `editar`, `derivar`, `archivar`, `eliminar`, `exportar`).

3. **Visor de Pistas de Auditoría Inmutable (`AuditoriaPage.tsx`):**
   Consulta y exporta los registros de auditoría histórica. Almacena de forma inalterable las operaciones de autenticación, transiciones de expedientes, cambios en parámetros y eliminaciones lógicas, asociando cada registro con la IP de origen, usuario y resultado.

4. **Gestión de Catálogos y Tablas Maestras (`TablasMaestrasPage.tsx`):**
   Configura los catálogos fundamentales del sistema: infraestructura física (Sedes), organigrama jerárquico (Dirección General, Secretaría Académica, Jefaturas de Área, Mesa de Partes) y taxonomía de documentos oficiales (Solicitudes, Oficios, Memorandos, Resoluciones).

5. **Calendario Laboral y Cómputo LPAG (`CalendarioLaboralPage.tsx`):**
   Define los parámetros temporales del cómputo de plazos administrativos conforme a la Ley N° 27444: configuración de días hábiles laborables, jornada oficial de 08:00 a 17:00 horas, hora de corte de recepción (16:30 hrs) y catálogo de feriados nacionales y de la Región Ucayali.

6. **Consola de Políticas de Seguridad de Acceso (`SeguridadPage.tsx`):**
   Fiscaliza los eventos críticos de seguridad perimetral: monitor de intentos fallidos de autenticación, políticas de bloqueo automático tras 5 intentos erróneos consecutivos (con 30 minutos de penalización), expiración de sesión por inactividad (30 minutos) y desbloqueo supervisado de cuentas.

---

## 4. Objetivos y Principios de Gobierno de Información

* **Segregación de Funciones:** Garantizar que ningún usuario concentre atribuciones incompatibles (p. ej., un operador que tramita un expediente no puede auto-aprobarse permisos ni borrar registros del log de auditoría).
* **Trazabilidad Absoluta (Non-Repudiation):** Toda mutación en la base de datos queda inexorablemente vinculada al identificador del operador, fecha/hora oficial y dirección IP.
* **Resiliencia Operativa:** Las tablas maestras garantizan la integridad referencial en toda la base de datos; la desactivación de un tipo documental o área no elimina expedientes históricos, sino que inhabilita su uso para nuevas radicaciones.
