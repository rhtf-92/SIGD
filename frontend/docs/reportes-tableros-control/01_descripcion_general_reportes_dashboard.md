| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-REPORTES-TABLEROS-CONTROL-01 |
| **Módulo** | reportes-tableros-control / Reportes y Tableros de Control |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Clider Urquia, Jhuel, Lloner |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 01. Descripción General y Objetivos — Tablero Ejecutivo de Control (Dashboard)

## 1. Misión Institucional y Propósito Ejecutivo

El Módulo de **Reportes y Tableros de Control (Dashboard)** del Sistema Integral de Gestión Documentaria (SIGD) tiene como propósito central dotar a la Dirección General, a las Jefaturas de Área y a los órganos de supervisión del IESTP "Suiza" de una plataforma de inteligencia operativa en tiempo real. En el ámbito de la educación superior tecnológica pública, la oportunidad en la atención de las solicitudes de títulos, convalidaciones, certificados y requerimientos de la comunidad educativa es un factor determinante para la acreditación institucional y la satisfacción del administrado.

El enfoque prioritario del tablero de control es proporcionar una **"vista de pájaro" (bird's-eye view)** ejecutiva que permita a la alta dirección detectar anomalías operativas, retrasos procesales y cuellos de botella en **menos de cinco (5) segundos** desde el acceso a la pantalla principal.

---

## 2. Erradicación de Sesgos Comerciales y Alineamiento de Dominio

En concordancia con la auditoría forense del proyecto, este módulo está concebido con un enfoque 100% institucional y de servicio público de educación superior técnica. El SIGD del IESTP "Suiza" opera exclusivamente sobre entidades de la gestión pública documentaria:
* **Expedientes y Trámites:** Solicitudes de Título, Certificados Modulares, Actas Semestrales, Resoluciones y Oficios.
* **Actores Institucionales:** Administrados (estudiantes, egresados, postulantes), Personal Docente, Especialistas Administrativos y Autoridades.
* **Métricas Clave:** Volúmenes de despacho, tiempos de respuesta en horas hábiles (SLA), tasas de completitud de trámites y alertas por estancamiento de expedientes.

---

## 3. Objetivo General

Desarrollar una interfaz ejecutiva moderna, responsiva y de alto rendimiento en React 19, TypeScript y Tailwind CSS 4 que consolide, calcule y visualice los indicadores clave de rendimiento (KPIs), tendencias temporales y distribución del trabajo documentario del IESTP "Suiza", facilitando la toma de decisiones basada en evidencia y el cumplimiento de los plazos de la Ley N° 27444.

---

## 4. Objetivos Específicos

1. **Visualización Ejecutiva de Alta Eficacia:** Proyectar en la cabecera del sistema cuatro tarjetas maestras de KPIs con indicadores semafóricos (verde, ámbar y rojo) y mini-gráficos de tendencia (*sparklines*) de los últimos siete días.
2. **Detección Automática de Cuellos de Botella:** Identificar de forma inmediata qué unidades orgánicas (Secretaría Académica, Mesa de Partes, Administración, etc.) o coordinaciones acumulan expedientes con plazos en riesgo de vencimiento.
3. **Análisis de Series Temporales:** Mostrar la evolución mensual y semanal del volumen de trámites radicados frente a los resueltos mediante gráficos interactivos de líneas y áreas.
4. **Distribución de Carga por Estados:** Representar la proporción de expedientes completados, en trámite, observados y desestimados mediante gráficos de dona (*doughnut charts*).
5. **Gobernanza y Aislamiento por RBAC:** Proveer una experiencia de navegación adaptada al perfil del usuario autenticado: acceso global institucional para la Dirección General y Administradores versus acceso restringido a la propia oficina para los Jefes de Área.
6. **Diseño Universal y Accesibilidad (WCAG 2.1 AA):** Garantizar contrastes cromáticos legibles para personas con daltonismo, navegación completa asistida por teclado y compatibilidad con lectores de pantalla.

---

## 5. Alcance Operativo por Dispositivo (Responsive Design)

La interfaz del Dashboard se adapta fluidamente a las distintas resoluciones operativas del personal directivo y docente:

* **Estaciones de Trabajo Desktop (> 1024px):** Cuadrícula integral (Grid) simultánea de KPIs maestros (4 columnas), gráfico comparativo de tendencias de tiempo de respuesta, gráfico de dona de estados y tabla de clasificación de cuellos de botella por oficina.
* **Tablets y Portátiles (768px a 1024px):** Reorganización en bloques de dos columnas (2x2 para KPIs) y gráficos apilados con navegación vertical optimizada para paneles táctiles.
* **Dispositivos Móviles (< 768px):** Disposición en una sola columna con tarjetas métricas en carrusel deslizable, priorizando el conteo de expedientes retrasados y el acceso de emergencia al listado de trámites críticos.
