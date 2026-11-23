# INFORME DE CORRECCIÓN DEFINITIVA DE LA PORTADA PÚBLICA Y REPRODUCCIÓN FIEL DEL DISEÑO DE REFERENCIA

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Suiza 2026  
**Rama:** `B_JACOBO`  
**HEAD de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Base de datos de demostración / pruebas:** `sigd_jacobo_demo` (17 expedientes)  
**Base institucional protegida:** `sigd_prueba` (2 expedientes intactos: `EXP-2026-000001` y `EXP-2026-000002` — REGLA CERO TOQUES CUMPLIDA)  
**Servicios activos y validados:**  
- Backend Express: `http://127.0.0.1:3008` (`/health` y `/ready`: HTTP 200 OK)  
- Frontend Vite: `http://127.0.0.1:5178` (HTTP 200 OK)  
- PostgreSQL: `127.0.0.1:5433` (healthy) | Redis: `127.0.0.1:6379` (healthy) | MinIO S3: `127.0.0.1:9000-9001` (healthy)  
**Fecha:** 28 de octubre de 2026  
**Estado:** **APROBADO AL 100% — CORRECCIÓN VISUAL FINAL Y REPRODUCCIÓN FIEL VERIFICADA**

---

## 1. RESOLUCIÓN PUNTUAL DE LOS 6 DEFECTOS VISUALES OBSERVADOS

| # | Defecto Observado en la Evidencia Anterior | Causa Raíz Identificada | Solución Técnica Implementada en Código | Medición Real Verificada en Chromium |
|---|---|---|---|---|
| **1** | **Fotografía en franja central ("isla")** (ocupaba solo del 32% al 85% del ancho) | El contenedor de la foto tenía un ancho fijo de 1344 px y un `left` forzado (`calc(50% - 454px)`), generando bordes vacíos. | Se ancló el contenedor a la derecha absoluta (`right: 0`) con ancho fluido responsivo `w-full sm:w-[max(1080px,70vw)] h-full`. | En 1448 px: `img.right = 1448 px` (toca el borde derecho al 100%). En 1920 px: `img.right = 1920 px` (`w = 1344 px`, 70vw). Cero efecto isla. |
| **2** | **Espacio celeste vacío en los laterales** | Contenedores internos con `max-w-7xl` (1280 px) o márgenes forzados desaprovechaban pantallas anchas. | Hero a ancho completo (`w-full`), foto de fondo expandida hasta el borde derecho y cuadrícula de tarjetas con ancho fluido `w-[92%] max-w-[1600px] mx-auto`. | El contenido aprovecha equilibradamente el 92% del viewport sin franjas desiertas. |
| **3** | **Letrero del instituto oculto tras el encabezado** | El contenedor fotográfico tenía `top: -95px`. El techo iniciaba en `y = 98 px`, proyectando el texto a `y = -5 px` (tapado por el header de 96 px). | Se ajustó el posicionamiento a `top: 0` con `object-position: right 18%` (en desktop `right 16%`). | El vértice del techo se sitúa en `y = 107 px`. Entre el header (`y = 96 px`) y el techo hay **11 px de cielo azul limpio**, garantizando el 100% de visibilidad del letrero monumental «SUIZA». |
| **4** | **9 integrantes del equipo cortados en el torso** | Altura del hero insuficiente (`h = 480 px`) combinada con la curva inferior cortaba a los docentes por la cintura. | Se aumentó la altura del hero a `h-[520px]` y se calibró el encuadre vertical para maximizar la cota inferior. | La cota inferior visible alcanza `y = 616 px`. Los **9 integrantes del equipo** son visibles íntegramente: cabezas, rostros, corbatas/vestimentas, caderas, muslos y piernas completas sobre la vereda. |
| **5** | **Contraste y legibilidad del título** | Riesgo de superposición entre el texto explicativo y los rostros de los docentes o la fachada. | Gradiente calibrado en `#E8F4FE`: `linear-gradient(90deg, #E8F4FE 0%, #E8F4FE 24%, rgba(232, 244, 254, 0.98) 32%, rgba(232, 244, 254, 0.70) 42%, rgba(232, 244, 254, 0.15) 50%, rgba(232, 244, 254, 0) 58%)`. | Cuadrante izquierdo (0 a 368 px) 100% sólido y limpio. La foto inicia su visibilidad plena a partir de `x = 368 px`. Cero interferencia visual. |
| **6** | **Tarjetas demasiado estrechas en el medio** | El grid de tarjetas estaba limitado a un ancho estrecho (~1050 px) con márgenes desproporcionados. | Se aplicó a la sección de servicios un contenedor `w-[92%] max-w-[1600px] mx-auto`, con espaciado uniforme `gap-5 lg:gap-6`. | En 1448 px el bloque de tarjetas mide **1284 px de ancho** (88.7% del viewport). En 1920 px mide **1552 px**. Cada tarjeta tiene 303 px de ancho en 1448 px y 370 px en 1920 px. |

---

## 2. COMPONENTES Y ARCHIVOS MODIFICADOS

| Archivo | Ruta | Modificaciones Realizadas |
|---|---|---|
| **HeaderInstitucional** | `frontend/src/components/HeaderInstitucional.tsx` | Contenedor expandido a `w-[92%] max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6`. Mantiene insignia 76×76 px (1:1), título institucional, navegación con Validador CVD y botón azul `#0073E6`. |
| **HomePage** | `frontend/src/pages/HomePage.tsx` | Hero ampliado a `h-[520px]`. Foto anclada a `right: 0` con `w-[max(1080px,70vw)]`, `top: 0` y `object-[right_18%]`. Gradiente suave de 0% a 58%. Bloque de tarjetas y franja de beneficios expandidos a `w-[92%] max-w-[1600px]`. |
| **Script E2E de Captura** | `scratch/e2e_runner/capture_portada.cjs` | Configuración multi-resolución en Chromium con canal Chrome para generar las 4 capturas requeridas (1448×1086, 1440×900, 1920×1080, 390×844). |

---

## 3. MEDICIONES MORFOMÉTRICAS REALES EN NAVEGADOR CHROMIUM

Pruebas automatizadas ejecutadas directamente contra el servidor frontend activo (`http://127.0.0.1:5178/`):

```text
RESOLUCIÓN    HERO (W × H, Top)    FOTO (W × H, X .. Right)    GRID TARJETAS (W × H, X .. Right)    ANCHO TARJETA
1448 × 1086   1448 × 520 px, Y=96  1080 × 520 px, 368 .. 1448   1284 × 309 px, 81.9 .. 1366.1        303 × 309 px
1440 × 900    1440 × 520 px, Y=96  1080 × 520 px, 360 .. 1440   1277 × 309 px, 81.6 .. 1358.4        301 × 309 px
1920 × 1080   1920 × 520 px, Y=96  1344 × 520 px, 576 .. 1920   1552 × 309 px, 184.0 .. 1736.0       370 × 309 px
 390 × 844     390 × 520 px, Y=96   390 × 520 px,   0 ..  390    343 × 1196 px, 23.6 .. 366.4        343 × 273 px (1 col)
```

---

## 4. RESULTADOS DE LA SUITE COMPLETA DE PRUEBAS

| Categoría | Suite / Script | Casos | Estado | Tiempo |
|---|---|:---:|:---:|:---:|
| **Componentes UI** | `HeaderInstitucional.test.tsx` + `HomePage.test.tsx` | 19 | **19 APROBADOS** | 1.84 s |
| **Autenticación & RBAC** | `LoginPage.test.tsx` + `rbacRolesCanonicos.test.ts` + `authentication401.test.ts` | 30 | **30 APROBADOS** | 9.58 s |
| **Total Suite Vitest** | Todas las suites unitarias frontend | 49 | **49 APROBADOS** | 12.94 s |
| **E2E Visual Chromium** | `roles_visual_e2e.spec.ts` (Playwright) | 6 | **6 APROBADOS** | 49.1 s |
| **Matriz HTTP RBAC en Vivo** | `scratch/audit_matriz_completa_roles.mjs` (Axios / Backend 3008) | 49 | **49 APROBADOS** | 3.1 s |
| **Chequeo TypeScript** | `tsc --noEmit` | Proyecto | **0 ERRORES** | Exitoso |
| **Build Vite Producción** | `vite build` | Bundle | **0 ERRORES** | 8.40 s |

---

## 5. AUDITORÍA DE INTEGRIDAD DE LA BASE DE DATOS INSTITUCIONAL

Verificación ejecutada mediante consulta directa de solo lectura en el contenedor `sigd-postgres-1`:

```sql
SELECT codigo_expediente, numero, estado, fecha_radicacion 
FROM sigd_tra.expediente 
ORDER BY fecha_radicacion;
```

**Resultado verificado en `sigd_prueba`:**
```text
 codigo_expediente |     numero      |   estado   |    fecha_radicacion    
-------------------+-----------------+------------+------------------------
 EXP-2026-000001   | EXP-2026-000001 | REGISTRADO | 2026-10-19 13:00:00+00
 EXP-2026-000002   | EXP-2026-000002 | REGISTRADO | 2026-10-19 13:00:00+00
(2 rows)
```

- **Aislamiento comprobado:** `sigd_prueba` contiene única y estrictamente los 2 expedientes históricos de referencia. Cero escrituras, cero eliminaciones, cero alteraciones de DDL.
- **Base de Demostración:** `sigd_jacobo_demo` contiene 17 expedientes para validaciones funcionales.

---

## 6. CAPTURAS REALES DISPONIBLES EN EL PROYECTO

Las capturas generadas por Chromium en el entorno en vivo se encuentran archivadas en:
1. `C:/Users/Liz/Desktop/SIGD/SIGD/scratch/captura-real-portada-1448x1086.png` (Resolución de referencia)
2. `C:/Users/Liz/Desktop/SIGD/SIGD/scratch/captura-real-portada-1440x900.png` (Escritorio estándar)
3. `C:/Users/Liz/Desktop/SIGD/SIGD/scratch/captura-real-portada-1920x1080.png` (Pantalla panorámica)
4. `C:/Users/Liz/Desktop/SIGD/SIGD/scratch/captura-real-portada-390x844.png` (Móvil)
