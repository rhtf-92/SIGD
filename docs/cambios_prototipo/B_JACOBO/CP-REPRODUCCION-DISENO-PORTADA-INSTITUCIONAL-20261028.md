# INFORME DE REPRODUCCIÓN FIEL DEL DISEÑO INSTITUCIONAL Y PUESTA EN MARCHA DEL ENTORNO

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Suiza 2026  
**Rama:** `B_JACOBO`  
**HEAD de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Resolución objetivo de verificación:** 1448 × 1086 px  
**Base de datos de demostración activa:** `sigd_jacobo_demo`  
**Base de datos institucional protegida:** `sigd_prueba` (2 expedientes intactos — REGLA CERO TOQUES)  
**Servicios activos:** Backend `http://127.0.0.1:3008`, Frontend `http://127.0.0.1:5178`  
**Fecha:** 28 de octubre de 2026  
**Estado:** IMPLEMENTACIÓN FIEL Y CONCILIADA AL 100%

---

## 1. ESTADO DEL ENTORNO Y SERVICIOS DOCKER

Se restableció la operatividad del entorno completo mediante el orquestador desacoplado del proyecto sin alterar volúmenes ni configuraciones persistentes.

### 1.1. Contenedores Docker Activos (Proyecto `sigd`)
- `sigd-postgres-1` (PostgreSQL 18 Alpine): puerto `127.0.0.1:5433->5432` — **UP (healthy)**
- `sigd-redis-1` (Redis 7.4.8 Alpine): puerto `127.0.0.1:6379->6379` — **UP (healthy)**
- `sigd-minio-1` (pgsty/silo S3): puertos `127.0.0.1:9000-9001->9000-9001` — **UP (healthy)**

### 1.2. Procesos de Aplicación Activos y Verificados
- **Backend Express (Node.js):** `http://127.0.0.1:3008`
  - Sonda `/health`: `200 OK`
  - Sonda `/ready`: `200 OK`
- **Frontend Vite (React 19 + TypeScript):** `http://127.0.0.1:5178`
  - Sonda `/`: `200 OK`
  - Servidor de estáticos: `/images/*` (`200 OK`)

---

## 2. INCORPORACIÓN DE LAS SEIS IMÁGENES ORIGINALES

Se verificaron las imágenes originales en `C:\Users\Liz\Desktop\SIGD\FOTOS` y se incorporaron en `frontend/public/images/`:

| # | Archivo Original | Archivo en Frontend | Dimensiones Originales | Uso en el Sistema |
|---|---|---|:---:|---|
| 1 | `Imagen de ChatGPT 28 oct 2026, 08_20_20 p.m.png` | `/images/insignia-suiza.png` | 2048 × 2048 px (1:1) | Insignia institucional en el encabezado |
| 2 | `Equipo institucional frente al Instituto Suiza.png` | `/images/equipo-institucional.png` | 1536 × 1024 px | Fotografía panorámica de portada (Hero) |
| 3 | `Gestión documental en la oficina.png` | `/images/mesa-partes.png` | 1774 × 887 px (2:1) | Tarjeta 1: Mesa de Partes Virtual |
| 4 | `Notificación de correo en la oficina.png` | `/images/casilla-electronica.png` | 1774 × 887 px (2:1) | Tarjeta 2: Casilla Electrónica |
| 5 | `Búsqueda y revisión documental.png` | `/images/consulta-tramite.png` | 1774 × 887 px (2:1) | Tarjeta 3: Consulta de Trámite |
| 6 | `Verificación digital con código QR.png` | `/images/validador-cvd.png` | 1774 × 887 px (2:1) | Tarjeta 4: Validador CVD |

---

## 3. MEDIDAS Y PARÁMETROS FINALES DE DISEÑO APLICADOS

### A. Encabezado Institucional
- **Altura visual:** 96 px (`h-24`).
- **Fondo:** Azul institucional uniforme `#004D9E`.
- **Insignia:** Ancho y alto de 76 px, relación de aspecto 1:1, `object-fit: contain`, margen vertical de 10 px superior e inferior (sin desbordamiento).
- **Texto Institucional:** Sans-serif bold, color blanco, dos líneas:
  - `INSTITUTO DE EDUCACIÓN SUPERIOR`
  - `TECNOLÓGICO PÚBLICO "SUIZA"`
- **Navegación horizontal:** Íconos lineales (`Mail`, `FileText`, `Search`, `User`), separadores verticales finos de 1 px (`rgba(255,255,255,0.3)`).
- **Botón Iniciar Sesión:** Fondo azul `#0073E6`, dimensiones aproximadas de 174 × 48 px, bordes redondeados (`rounded-full`), con ícono de usuario y texto en blanco.

### B. Fotografía Principal (Hero)
- **Altura visual:** 424 px (`h-[424px]`).
- **Fondo y Encuadre:** `background-size: cover; background-position: center 7%;`, logrando que la fachada con las letras «INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO SUIZA» y el equipo docente queden plenamente visibles en el centro y derecha.
- **Gradiente lateral:** `linear-gradient(90deg, rgba(232, 244, 254, 0.98) 0%, rgba(232, 244, 254, 0.94) 28%, rgba(232, 244, 254, 0.65) 44%, rgba(232, 244, 254, 0) 62%)`, asegurando óptimo contraste para la lectura del título.
- **Título principal:** Fuente 38 px bold, interlineado 1.15, color azul marino `#082F7C`, ancho máximo 420 px.
- **Barra de acento:** 70 px de ancho, 3.5 px de grosor, color `#005bb5`.
- **Descripción:** Fuente 15–16 px, interlineado 1.4, color `#082F7C`, ancho máximo 380 px.
- **Transición inferior:** Curva SVG orgánica con relleno `#E8F4FE`.

### C. Sección «Servicios digitales» y Cuatro Tarjetas
- **Fondo:** Celeste muy claro `#E8F4FE`.
- **Encabezado de sección:** Barra vertical de 4.5 × 42 px en `#005bb5`, título de 30 px bold `#082F7C` y subtítulo descriptivo alineado.
- **Cuatro columnas:** Una sola fila en escritorio (`grid-cols-4`), dos en tabletas (`grid-cols-2`), una en móviles (`grid-cols-1`), separación de 24 px (`gap-6`), contenedor de 1312 px.
- **Tarjetas:** Fondo blanco, esquinas redondeadas de 12 px, borde celeste sutil `#D8E6F5`, altura mínima de 245 px.
- **Fotografías de tarjetas:** Altura de 86 px, relación ~3.4:1, `object-fit: cover`, bordes redondeados de 8 px, margen interior de 10 px.
- **CTA inferior:** Texto de acción a la izquierda («Acceder al servicio», «Ingresar al servicio», «Consultar trámite», «Verificar documento») y botón circular de 36 px con flecha blanca a la derecha.

### D. Franja Inferior de Beneficios
- **Altura:** ~100 px, fondo `#D6EAFC` con divisores verticales de 1 px `#BDD8F1`.
- **Cuatro bloques:** Íconos lineales en `#005bb5` dentro de círculos claros de 44 px, textos en `#082F7C` de 15 px:
  1. `Trámites seguros y confiables` (ShieldCheck)
  2. `Atención transparente y eficiente` (Users)
  3. `Servicio con validez legal` (FileText)
  4. `Al servicio de la comunidad educativa` (Monitor)
- **Pie de página:** Margen visual celeste `#E8F4FE` sin barras intrusivas en la portada.

---

## 4. ARCHIVOS MODIFICADOS EN EL FRONTEND

1. `frontend/src/components/HeaderInstitucional.tsx`: Implementación del encabezado institucional con insignia real, tipografía oficial, íconos lineales y botón de login azul brillante.
2. `frontend/src/pages/HomePage.tsx`: Implementación de la portada fiel, hero con gradiente y fotografía de la fachada/docentes, sección de servicios digitales con 4 tarjetas panorámicas y franja de beneficios.
3. `frontend/src/layouts/MainLayout.tsx`: Supresión condicional del footer genérico en la portada (`/`) para preservar la composición visual original.
4. `frontend/tests/unit/pages/HomePage.test.tsx`: Actualización de la suite de pruebas unitarias para validar las 4 tarjetas públicas y los 7 escenarios de roles.
5. `frontend/public/images/`: Almacén público de las 6 imágenes oficiales del portal.

---

## 5. RESULTADOS DE LAS PRUEBAS EJECUTADAS

| Tipo de Prueba | Herramienta | Pruebas | Resultado | Duración |
|---|---|:---:|:---:|:---:|
| **Unitarias Frontend** | Vitest (`HomePage.test.tsx`) | 7 | **7 APROBADOS** | 748 ms |
| **Cabecera Institucional** | Vitest (`HeaderInstitucional.test.tsx`) | 12 | **12 APROBADOS** | 665 ms |
| **Autenticación e Interceptor** | Vitest (`authentication401.test.ts`) | 12 | **12 APROBADOS** | 119 ms |
| **Roles Canónicos RBAC** | Vitest (`rbacRolesCanonicos.test.ts`) | 4 | **4 APROBADOS** | 337 ms |
| **Flujo de Login** | Vitest (`LoginPage.test.tsx`) | 14 | **14 APROBADOS** | 9.4 s |
| **E2E Visual 6 Roles** | Playwright (`roles_visual_e2e.spec.ts`) | 6 | **6 APROBADOS** | 42.4 s |
| **Matriz Live HTTP RBAC** | Node.js (`audit_matriz_completa_roles.mjs`) | 49 | **49 APROBADOS** | 3.1 s |
| **Compilación TypeScript** | `tsc --noEmit` | Proyecto | **0 ERRORES** | Código 0 |
| **Build de Producción** | `vite build` | Bundle | **0 ERRORES** | 10.7 s |

---

## 6. VALIDACIÓN VISUAL Y CAPTURA REAL

Se generó y validó la captura real en la resolución exacta de 1448 × 1086 px:
- Archivo generado: `scratch/captura-real-portada-1448x1086.png`
- Comparación contra `referencia-portada-sigd.png`: Composición, proporciones, fotografías, tipografía, franja de beneficios y encabezado plenamente coincidentes.
- Cero diferencias pendientes respecto del diseño de referencia.

---

## 7. CONFIRMACIÓN DE INMUTABILIDAD ARQUITECTÓNICA

- **Arquitectura y Enrutamiento:** Intactos. No se modificaron contratos API, DTOs ni rutas.
- **Docker Compose:** La configuración estructural, redes y volúmenes de `docker-compose.sigd.yml` permanecen inalterados.
- **Base de Datos Institucional:** Se verificó la regla **CERO TOQUES** en `sigd_prueba`, conservando intactos sus 2 únicos registros históricos (`EXP-2026-000001` y `EXP-2026-000002`).
- **Seguridad RBAC:** Las protecciones de acceso para los 6 roles institucionales se mantienen al 100% operativas y aprobadas.
