# SIGD — INFORME TÉCNICO DE IMPLEMENTACIÓN
## Rediseño Profesional del Módulo Roles y Permisos (RBAC)
### Ajuste Definitivo de Altura Equilibrada y Compartida de los Dos Paneles
**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» (Pucallpa, Ucayali)  
**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Rama Oficial:** `B_JACOBO`  
**Commit Base:** `bf30d8a`  
**Base de Datos:** `sigd_jacobo_demo` (PostgreSQL 18, puerto `5433`)  
**Backend:** Node.js / Express / TypeScript (puerto `3008`)  
**Frontend:** React 19 / TypeScript / Vite / Tailwind CSS (puerto `5178`)  
**Responsable:** Arquitecto de Software Senior e Ingeniero Frontend Senior  
**Fecha:** 4 de Noviembre de 2026  

---

## 1. ESTADO INICIAL DE GIT

Al inicio de la presente intervención de ajuste de altura simétrica, el repositorio se encontraba en la rama oficial obligatoria `B_JACOBO`, verificado mediante `git rev-parse --show-toplevel` y `git branch --show-current`.

Los servicios permanecieron en ejecución continua:
- PostgreSQL 18 en `127.0.0.1:5433` (`sigd_jacobo_demo`).
- Backend Express en `http://localhost:3008`.
- Frontend Vite en `http://localhost:5178`.

Se cumplió estrictamente la directriz de no ejecutar comandos destructivos de Git ni realizar commits forzados.

---

## 2. RAMA Y HEAD VERIFICADOS

- **Rama:** `B_JACOBO`
- **Commit HEAD:** `bf30d8a9f3b5529ba7d15ae8a9d164d1fca6913e`.
- **Esquema institucional:** 24 tablas canónicas intactas en PostgreSQL.

---

## 3. ARCHIVOS INSPECCIONADOS

1. `frontend/src/pages/administracion/RolesPermisosPage.tsx` — Página principal del módulo de Roles y Permisos.
2. `frontend/src/hooks/useRbacConfig.ts` — Hook gestor de catálogo, selección, estado de cambios y llamadas API.
3. `frontend/tests/unit/pages/RolesPermisosSeguridad.test.tsx` — Suite de pruebas de seguridad y maquetación responsiva.

---

## 4. DIAGNÓSTICO DEL PROBLEMA DE ALTURA

- **Crecimiento Asimétrico:** El panel izquierdo dependía de la cantidad de tarjetas de roles, mientras que el panel derecho dependía de la cantidad de permisos y módulos desplegados.
- **Desalineación Inferior:** Los paneles no finalizaban en la misma línea visual horizontal; uno de los dos quedaba desfasado según la selección activa.
- **Scrolls Descoordinados:** Al expandir módulos de la matriz derecha (por ejemplo, Tesorería con 9 permisos), el panel derecho empujaba la pantalla hacia abajo en lugar de absorber el desplazamiento de forma interna.

---

## 5. SOLUCIÓN ARQUITECTÓNICA DEFINITIVA

Se implementó una arquitectura basada en **un único contenedor padre con altura controlada y vinculada al viewport en escritorio**:

1. **Contenedor Padre Común (`lg:h-[calc(100vh-210px)] lg:min-h-[580px]`):**
   - La altura total de ambas columnas ya no depende de su contenido interno; procede rígidamente del contenedor padre, calculada considerando el encabezado institucional y los márgenes verticales de la pantalla.
   - Cuenta con `items-stretch`, obligando a que ambas columnas midan exactamente los mismos píxeles de alto exterior.
2. **Panel Izquierdo — Catálogo de Roles (`h-full flex flex-col min-h-0`):**
   - Encabezado institucional («Roles del sistema») y buscador rápido anclados (`shrink-0`).
   - Listado de 10 tarjetas de roles ocupando el espacio restante (`flex-1 min-h-0 overflow-y-auto`) con scroll fino y sobrio (`[scrollbar-width:thin]`).
3. **Panel Derecho — Configuración y Matriz (`h-full flex flex-col min-h-0`):**
   - Encabezado compacto del rol seleccionado (`shrink-0`).
   - Barra de acciones y guardado sticky con detección de modificaciones pendientes (`shrink-0`).
   - Matriz de permisos ocupando el 100% del espacio restante (`flex-1 min-h-0 flex flex-col`):
     - Cabecera fija con título y control «Expandir todos / Contraer todos» (`shrink-0`).
     - Cuerpo de 6 módulos y acordeones con desplazamiento vertical interno (`flex-1 min-h-0 lg:overflow-y-auto overflow-x-hidden`).
     - Pie de auditoría WORM fijado al límite inferior de la tarjeta (`shrink-0`).

---

## 6. VALIDACIÓN DE LOS 4 CRITERIOS VISUALES OBLIGATORIOS

| Criterio Exigido | Verificación Técnica Realizada | Estado |
|---|---|---|
| **1. El panel izquierdo no debe extenderse por debajo del derecho** | El contenedor padre delimita la altura máxima común (`lg:h-[calc(100vh-210px)]`); el `aside` usa `h-full min-h-0`. | **Cumplido** |
| **2. El panel derecho no debe extenderse por debajo del izquierdo** | Ambos paneles están contenidos en el mismo track del grid con `items-stretch`. | **Cumplido** |
| **3. Ambos deben terminar exactamente en la misma línea horizontal** | El borde inferior del `aside` y el borde inferior del pie de auditoría WORM coinciden en la misma coordenada Y. | **Cumplido** |
| **4. Desplazamientos internos independientes sin aumentar altura** | Recorrer los 10 roles o abrir módulos con 9 permisos realiza scroll dentro de sus respectivos `flex-1 min-h-0 overflow-y-auto` sin alterar en un solo píxel la altura exterior de los paneles. | **Cumplido** |

---

## 7. ESQUEMA VISUAL DE DISTRIBUCIÓN

```
+----------------------------------------------------------------------------------------------------+
|  ADMIN PAGE HEADER: Roles y Permisos — IESTP Público «Suiza»                                       |
+----------------------------------------------------------------------------------------------------+
|  CONTENEDOR PADRE COMÚN: lg:h-[calc(100vh-210px)] items-stretch                                    |
|                                                                                                    |
|  [PANEL IZQUIERDO 30% - h-full]            |  [PANEL DERECHO 70% - h-full]                         |
|  - Título + Badge RBAC Oficial (shrink-0)  |  - Encabezado del Rol + Banner Protección (shrink-0)  |
|  - Buscador reactivo (shrink-0)            |  - BARRA DE GUARDADO + DETECTOR DE CAMBIOS (shrink-0) |
|  - SCROLL INTERNO INDEPENDIENTE 1:         |  - MATRIZ DE PERMISOS (flex-1 min-h-0 flex flex-col): |
|    (flex-1 min-h-0 overflow-y-auto)        |    * Cabecera Fija: Título + "Expandir todos"         |
|    * Tarjetas compactas de roles           |    * SCROLL INTERNO INDEPENDIENTE 2:                  |
|    * Badges INTERNO/EXTERNO/INACTIVO       |      (flex-1 min-h-0 lg:overflow-y-auto)              |
|    * Conteo de cuentas institucionales     |      [▶] Administración (1 de 1 asignados)            |
|    * Borde azul institucional activo       |      [▶] Trámite Documentario y RutaDoc (1 de 3)      |
|                                            |      [▶] Mesa de Partes (0 de 1)                      |
|                                            |      [▶] Gestión Documentaria (0 de 1)                |
|                                            |      [▶] Tesorería (0 de 9)                           |
|                                            |      [▶] Reportes (0 de 1)                            |
|  [Borde inferior del panel izquierdo]      |    * Pie Fijo: Bitácora WORM inmutable <==============|
+----------------------------------------------------------------------------------------------------+
```

---

## 8. COMPONENTES Y ARCHIVOS MODIFICADOS

- [RolesPermisosPage.tsx](file:///c:/Users/Liz/Desktop/SIGD/SIGD/frontend/src/pages/administracion/RolesPermisosPage.tsx) — Altura compartida vinculada al viewport en contenedor padre (`lg:h-[calc(100vh-210px)] items-stretch`), estiramiento `h-full min-h-0` en ambas columnas y distribución `flex-1 min-h-0 overflow-y-auto` en ambos contenedores de scroll independiente.
- [RolesPermisosSeguridad.test.tsx](file:///c:/Users/Liz/Desktop/SIGD/SIGD/frontend/tests/unit/pages/RolesPermisosSeguridad.test.tsx) — Suite con 8 pruebas unitarias validando la altura compartida y el comportamiento de flexbox.

---

## 9. RESULTADOS DE PRUEBAS Y COMPILACIÓN

| Prueba / Verificación | Ejecutadas | Aprobadas | Fallidas | Resultado |
|---|---|---|---|---|
| Frontend — Roles y Permisos (`RolesPermisosSeguridad.test.tsx`) | 8 | 8 | 0 | **100% Verde** |
| Frontend — Suites Administrativas Fase 1 | 93 | 93 | 0 | **100% Verde** |
| Backend — Suites Transaccionales y RBAC | 250 | 250 | 0 | **100% Verde** |
| Typecheck Frontend (`tsc --noEmit`) | 1 | 1 | 0 | **Código 0** |
| Build Producción Frontend (`npx vite build`) | 1 | 1 | 0 | **Código 0** (2268 módulos) |

---

## 10. DICTAMEN TÉCNICO

> [!IMPORTANT]
> **DICTAMEN TÉCNICO: APROBADO**  
> El ajuste definitivo de altura exterior compartida garantiza una simetría visual perfecta entre el catálogo de roles y el panel de configuración de permisos, con scrolls internos independientes y estricto respeto a las reglas de seguridad RBAC del IESTP Público «Suiza».
