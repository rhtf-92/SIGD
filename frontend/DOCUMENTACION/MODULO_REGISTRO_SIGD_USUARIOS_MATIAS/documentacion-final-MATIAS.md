# Análisis del Módulo de Registro de Usuario Externo

## Equipo Frontend — Proyecto SIGD

**Sistema Integral de Gestión Documentaria (SIGD)**
Instituto de Educación Superior Tecnológico Público "Suiza" — Pucallpa

---

## 1. Introducción y contexto

Este documento presenta el análisis realizado por el sub-equipo conformado por Matías Zumaeta (líder del sub-equipo), Sergio y Vazques (Angel Jesús), en torno al módulo de **Registro de Usuario Externo** del proyecto SIGD.

El propósito de este análisis es identificar los requerimientos funcionales, investigar referentes existentes en sistemas del Estado peruano, y proponer un diseño de solución justificado, antes de iniciar cualquier etapa de programación. Se presenta como entregable formal para revisión del líder del equipo Frontend (Christiam) y del docente responsable.

## 2. Definición del problema

Según las indicaciones registradas en las sesiones de coordinación del docente, el Instituto Suiza requiere que ciudadanos sin credenciales previas en el sistema (postulantes, apoderados, público en general) puedan:

1. Iniciar un trámite documentario sin necesidad de una cuenta previa, o
2. Registrarse para obtener credenciales y dar seguimiento a sus trámites en el tiempo.

El reto de diseño consiste en definir qué información es estrictamente necesaria solicitar a este tipo de usuario, y cómo estructurarla para que sea consistente con las buenas prácticas de sistemas documentarios del sector público peruano.

## 3. Metodología de análisis

El análisis se elaboró a partir de tres fuentes:

1. **Indicaciones directas del docente**, registradas en sesiones de coordinación, donde se sugirió explícitamente tomar como referencia el portal del Poder Judicial del Perú.
2. **Investigación de sistemas gubernamentales existentes**, específicamente el módulo de datos de domicilio del Sistema de Información de Apoyo a la Gestión de la Institución Educativa (SIAGIE) del Ministerio de Educación, por ser un sistema público de uso masivo con una estructura de datos de ubicación validada institucionalmente.
3. **Comparación de las propuestas individuales** elaboradas por los tres integrantes del sub-equipo.

## 4. Análisis de referentes externos

### 4.1 Estructura de domicilio en SIAGIE (MINEDU)

La investigación de la documentación pública de SIAGIE confirma que el sistema estructura los datos de domicilio mediante **selección en cascada**:

Esta estructura evita que el usuario escriba libremente el nombre de su ubicación (lo cual genera inconsistencias como errores de tipeo o variantes de un mismo nombre), y en su lugar lo obliga a elegir de una lista controlada. Esto es relevante para el diseño del SIGD porque:

- Reduce errores de calidad de datos en la base de datos del backend.
- Es coherente con el estándar ya validado por una entidad pública peruana de escala nacional.

### 4.2 Referencia al Poder Judicial del Perú

El docente indicó explícitamente guiarse de sistemas de ingreso de trámites de organismos del Estado, mencionando como ejemplo el Poder Judicial. Del análisis de portales de este tipo se identifican patrones comunes:

- Formularios con secciones claramente separadas (datos personales, contacto, domicilio).
- Uso de una identidad visual institucional (logo, colores, cabecera) que genera confianza en el usuario.
- Declaración jurada o aceptación de veracidad de los datos como paso obligatorio antes de completar el registro, dado el carácter oficial de la información.

## 5. Análisis comparativo de las propuestas del sub-equipo

Cada integrante analizó el requerimiento de forma independiente. La siguiente tabla compara los tres enfoques:

| Criterio | Propuesta de Matías / Sergio | Propuesta de Vazques |
|---|---|---|
| **Tipo de usuario objetivo** | Ciudadano externo sin cuenta previa | Usuario interno del sistema (personal del instituto) |
| **Alcance funcional** | Registro simple para trámites | Panel de administración completo con roles y permisos |
| **Campos propuestos** | Datos personales, DNI, fecha de nacimiento, contacto, domicilio en cascada, declaración jurada | Datos personales, DNI, fecha de nacimiento, domicilio, datos laborales (área, cargo), credenciales de acceso, rol asignado |
| **Gestión de acceso** | No requiere contraseña (registro público) | Requiere usuario, contraseña y rol (Administrador, Mesa de Partes, Operador, Auditor) |
| **Funcionalidades adicionales** | Ninguna (formulario único) | Listado con búsqueda/filtros, activación/desactivación de cuentas |

### 5.1 Evaluación de ambos enfoques

**A favor del enfoque de registro externo (Matías/Sergio):**
- Coincide directamente con la descripción textual del encargo registrada en las sesiones del docente ("un usuario externo que no tiene el acceso... lo haga directamente desde acá").
- Es un requerimiento más acotado, apto para una primera entrega.

**A favor del enfoque de panel administrativo (Vazques):**
- Es un requerimiento real y necesario para el sistema completo, ya que en algún momento el SIGD deberá gestionar también a los usuarios internos (secretarias, jefes de área) mencionados en el mapeo de la estructura jerárquica del instituto.
- Está bien fundamentado en términos de seguridad (roles, permisos, ocultamiento de contraseñas).

**Conclusión del análisis:** ambos enfoques responden a necesidades reales del sistema, pero corresponden a **módulos distintos**. No se trata de una propuesta correcta y una incorrecta, sino de dos funcionalidades independientes que probablemente deban desarrollarse en etapas distintas del proyecto.

## 6. Propuesta de diseño recomendada

En base al análisis anterior, se recomienda que el módulo de **Registro de Usuario Externo** contemple la siguiente estructura de datos:

| Sección | Campos propuestos | Justificación |
|---|---|---|
| Datos personales | Nombres, apellidos, DNI (8 dígitos), fecha de nacimiento | Identificación única del ciudadano, necesaria para cualquier trámite oficial |
| Datos de contacto | Correo electrónico, teléfono (9 dígitos) | Canal de notificación sobre el estado del trámite |
| Domicilio | Departamento, provincia y distrito (selección en cascada, según modelo SIAGIE), dirección exacta, referencia | Consistencia de datos geográficos y trazabilidad del ciudadano |
| Declaración jurada | Aceptación obligatoria de veracidad de los datos | Respaldo legal del trámite, siguiendo el estándar de portales gubernamentales |

Se recomienda, además, limitar el catálogo de provincias y distritos a la región Ucayali en una primera etapa, dado que corresponde al ámbito geográfico real del Instituto Suiza, evaluando la ampliación a nivel nacional según se defina con el equipo de Backend.

## 7. Punto pendiente de definición

Se solicita al líder del equipo Frontend y/o al docente confirmar si el panel de administración de usuarios internos (propuesta de Vazques) corresponde a:

- **a)** una funcionalidad adicional a desarrollarse en una etapa posterior del proyecto, como módulo independiente, o
- **b)** un requerimiento que deba integrarse desde ya en el diseño del registro externo.

## 8. Conclusiones y siguientes pasos

El análisis realizado permite concluir que:

1. Existe un requerimiento claro y bien definido de registro externo, respaldado por referentes gubernamentales reales (SIAGIE, Poder Judicial).
2. Existe un segundo requerimiento (gestión de usuarios internos) identificado por el equipo, que debe ser confirmado y priorizado por el docente antes de avanzar.
3. Una vez aprobado el enfoque, el sub-equipo procederá a la etapa de diseño funcional detallado y, posteriormente, a la implementación técnica.

## 9. Equipo responsable

- **Líder del sub-equipo:** Matías Zumaeta
- **Integrantes:** Sergio, Vazques (Angel Jesús)
- **Reporta a:** Christiam (líder del equipo Frontend)
- **Docente responsable:** Ing. Renato Henyer Tarazona Flores — Unidad Didáctica Taller de Software / Taller de Base de Datos

---

*Pucallpa, agosto de 2026*