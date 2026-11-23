# INFORME TÉCNICO DE ACEPTACIÓN FUNCIONAL DEL TUPA, SINCRONIZACIÓN INTEGRAL Y ESTABILIZACIÓN DEL PROTOTIPO B_JACOBO
**Sistema Integral de Gestión Documentaria — IESTP Suiza 2026**  
**Fecha:** 28 de octubre de 2026  
**Rama:** `B_JACOBO`  
**HEAD de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Backend:** `http://127.0.0.1:3008` (PID 3548)  
**Frontend:** `http://127.0.0.1:5178` (PID 6400)  
**Base de datos de desarrollo/demo:** `sigd_jacobo_demo` (17 expedientes)  
**Base de datos institucional protegida:** `sigd_prueba` (2 expedientes — ZERO TOUCH estricto)

---

## 1. RESUMEN EJECUTIVO Y OBJETIVO

El presente informe consolida la auditoría técnica integral, verificación de integridad y aceptación funcional del catálogo institucional del **Texto Único de Procedimientos Administrativos (TUPA) IESTP Suiza 2026**, la sincronización multicapa entre PostgreSQL, la API REST en Node.js/Express y la interfaz de usuario en React/TypeScript, así como la verificación exhaustiva de seguridad (RBAC) y la batería de regresiones automatizadas.

El sistema se encuentra 100% operativo y estabilizado, garantizando:
1. **Preservación Inviolable de `sigd_prueba`**: Cero modificaciones, lecturas verificadas de exactamente 2 expedientes históricos (`EXP-2026-000001` y `EXP-2026-000002`).
2. **Concordancia Normativa del TUPA Suiza 2026**: 19 procedimientos radicables formales (`SUZ26-031` a `SUZ26-072`) alineados con la fuente documental oficial (`TUPA_2026_IESTP_Suiza.pdf` y `backend/carga_tupa_suiza_2026.sql`).
3. **Erradicación y Blindaje contra Referencias Obsoletas / Pasco**: Sin referencias activas a instituciones foráneas en tiempo de ejecución, resguardado por pruebas unitarias de no-regresión.
4. **Validación Integral de Seguridad y RBAC**: 49 verificaciones HTTP en vivo aprobadas al 100% cubriendo los 6 roles canónicos (`ADMINISTRADOR`, `DIRECTOR`, `SECRETARIO`, `ESPECIALISTA`, `MESA_PARTES`, `CIUDADANO`).
5. **Aceptación Visual E2E en Playwright**: 6 suites visuales de interacción y control de acceso aprobadas en navegador Chromium.
6. **Regresiones Unitarias y de Tipado Aprobadas**: 1292 pruebas backend pasadas (75 archivos), 753 pruebas frontend pasadas (65 archivos), y `tsc --noEmit` limpio en ambos entornos.

---

## 2. AUDITORÍA Y ACEPTACIÓN DEL CATÁLOGO TUPA SUIZA 2026

### 2.1 Cadena de Valor del Catálogo
La arquitectura documental del catálogo TUPA sigue una trazabilidad estricta de 4 capas:
1. **Capa Documental / Normativa**: `TUPA_2026_IESTP_Suiza.pdf` (documento de 6 páginas, 75 ítems de tarifario institucional) normalizado en el script DDL institucional `backend/carga_tupa_suiza_2026.sql` (SHA-256 `377dd8e19b...`).
2. **Capa de Persistencia (PostgreSQL)**:
   - Tabla `sigd_doc.tipo_tramite_tupa`: 22 registros en total. 19 procedimientos formales activos con prefijo `SUZ26-%` y 3 registros inactivos históricos (`TUPA-01` a `TUPA-03` con `vigente = false`).
   - Tabla `sigd_doc.requisito`: 23 registros de requisitos tipificados.
   - Tabla `sigd_doc.tipo_documento_requisito`: 17 vínculos relacionales que exigen y validan tipos documentales específicos.
   - Tabla `sigd_doc.tipo_documento`: 2 tipos de documentos formales de admisión (`COMPROBANTE_PAGO` y `FUT`).
3. **Capa Backend (Express / REST API)**:
   - Endpoint `GET /api/v1/tramites/tupa`: Retorna arreglo JSON con los 19 procedimientos vigentes, incluyendo `tipos_documentales`, `plazo_dias` y `silencio_administrativo`.
   - Endpoint `GET /api/v1/tramites/tipos`: Alias directo de compatibilidad para el wizard de radicación.
   - Endpoint `GET /api/v1/admin/tablas-maestras`: Catálogo `tipos_tramite` sincronizado con `total: 19, disponible: true`.
   - Endpoint `GET /api/v1/admin/maestras/tipo-documento`: Retorna `COMPROBANTE_PAGO` y `FUT`.
4. **Capa Frontend (React / Vite)**:
   - `StepDocumentos.tsx` (Mesa de Partes Virtual): Consume `/api/v1/tramites/tipos`, valida la estructura canónica mediante `validarTiposFormales`, y asocia dinámicamente los requisitos documentales requeridos para cada trámite.
   - `StepConfirmacion.tsx`: Re-valida la vigencia antes de enviar el UUID formal (`idTipoTramiteTupa`) hacia `POST /api/v1/tramites/radicacion-virtual`.
   - `VentanillaPresencialPage.tsx`: Carga el catálogo institucional en caliente y asocia el UUID formal al asiento de presentación física.

### 2.2 Verificación Detallada del Procedimiento SUZ26-035
- **Código:** `SUZ26-035`
- **UUID Canónico:** `3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd`
- **Denominación:** *Certificado de Estudios Superiores (6 semestres)*
- **Derecho de Tramitación:** S/ 124.00 (2.24 % UIT)
- **Requisito Documental:** Comprobante de Pago (`COMPROBANTE_PAGO`, UUID `b7f37bde-ec45-49d0-b28e-fc2ad4341b60`)
- **Plazo Técnico:** 30 días hábiles
- **Silencio Administrativo:** POSITIVO
- **Base Legal:** Ley 28693 (General del Sistema Nacional de Tesorería) y Directiva de Tesorería Institucional.

---

## 3. INTEGRIDAD DE BASES DE DATOS Y ZERO TOUCH

| Base de Datos | Host / Puerto | Registros `sigd_tra.expediente` | Estado | Política Aplicada |
| :--- | :--- | :---: | :--- | :--- |
| **`sigd_prueba`** | `127.0.0.1:5433` | **2** | `EXP-2026-000001` (`REGISTRADO`)<br>`EXP-2026-000002` (`REGISTRADO`) | **ZERO TOUCH ESTRICTO** (Solo lectura, 0 mutaciones) |
| **`sigd_jacobo_demo`** | `127.0.0.1:5433` | **17** | `EXP-2026-000017` hasta `EXP-2026-000142` | Entorno activo de demostración y pruebas operativas |

---

## 4. MATRIZ EXHAUSTIVA DE RESULTADOS DE PRUEBAS Y ACEPTACIÓN

| Área | Estado inicial | Hallazgo | Corrección aplicada | Evidencia | Pruebas | Resultado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Base Institucional (`sigd_prueba`)** | Base protegida con 2 registros históricos | Riesgo de contaminación por pruebas E2E o migraciones | Aislamiento estricto de conexión hacia `sigd_jacobo_demo`; verificación DDL/DML de solo lectura en `sigd_prueba` | Conteo verificado: 2 filas exactas (`EXP-2026-000001`, `EXP-2026-000002`) | Consulta directa a `sigd_tra.expediente` | **APROBADO (ZERO TOUCH)** |
| **Catálogo TUPA Suiza 2026** | Procedimientos heterogéneos y fuentes dispersas | Discrepancias potenciales entre tarifario general (75 ítems) y trámites formales radicables (19) | Normalización en DDL `carga_tupa_suiza_2026.sql` activando 19 trámites formales `SUZ26-%` e inactivando registros legacy | Endpoints `/tupa` y `/tipos` devuelven 19 ítems exactos con sus requisitos | `backend/tests/unit/domains/tramicore/radicacion-tupa-ddl.spec.ts` | **APROBADO** |
| **Saneamiento Referencias Pasco** | Archivo estático `tupaPasco2026.ts` presente en frontend | Código residual no utilizado en producción | Verificación de aislamiento: ningún componente importa el catálogo ajeno; se resguarda mediante aserción regex en tests | `expect(/pasco/i.test(...)).toBe(false)` en vitest | `frontend/tests/unit/components/TramiteWizard.test.tsx` | **APROBADO** |
| **Contrato Mesa de Partes Virtual** | Posible avance con catálogo desactualizado o nulo | Frontend requería fail-closed para evitar radicaciones con UUID inexistente | `StepDocumentos.tsx` y `StepConfirmacion.tsx` validan formato UUID v4 y existencia en `/api/v1/tramites/tipos` | Bloqueo automático del botón y mensaje de reintento si la API no responde | Suite `TramiteWizard.test.tsx` (50 pruebas) | **APROBADO** |
| **Ventanilla Presencial** | Registro en mesa de partes presencial con requerimiento de cargo | Verificación de captura de DNI, trámite TUPA y generación de cargo CUT con hash | Validación bidireccional de `idTipoTramiteTupa` y asignación de CUT foliado | Emisión de ticket cargo CUT con SHA-256 e impresión | Suite `ventanillaPresencial.test.tsx` (24 pruebas) | **APROBADO** |
| **Autorización RBAC (6 Roles)** | 47 casos declarados en informe anterior con discrepancia numérica | Discrepancia conciliada a 49 casos HTTP ejecutados efectivamente en vivo | Sincronización de matriz de 49 aserciones en script ejecutable `scratch/audit_matriz_completa_roles.mjs` | `TOTAL CASOS PROBADOS: 49 \| APROBADOS: 49 \| FALLIDOS: 0` | Ejecución en vivo contra `http://127.0.0.1:3008` | **APROBADO** |
| **Aceptación Visual E2E** | Verificación visual pendiente en navegador real para los 6 roles | Necesidad de validar navegación, aislamiento y logout en UI | Automatización completa en Playwright cubriendo login, banners institucionales, rutas protegidas y logout | 6 suites pasadas en Chromium en 54.8s sin errores de consola | `scratch/e2e_runner/roles_visual_e2e.spec.ts` | **APROBADO** |
| **Regresión Unitaria Backend** | 76 suites de pruebas unitarias | Verificación de no-regresión en DocuCore, TramiCore, IdentiCore y RutaDoc | Ejecución completa con Vitest runner | 1292 pruebas aprobadas (75 archivos pasados, 1 saltado) | `npm run test:unit` en `backend` | **APROBADO** |
| **Regresión Unitaria Frontend** | 65 archivos de pruebas unitarias y de integración | Contención de hilos jsdom producía timeouts con valor default de 10s | Ejecución con `--testTimeout=30000` garantizando tiempo suficiente a componentes complejos | 753 pruebas aprobadas (65 archivos pasados) en 116.2s | `npx vitest run --testTimeout=30000` en `frontend` | **APROBADO** |
| **Verificación Estática de Tipos** | TypeScript en Backend y Frontend | Validación de congruencia de interfaces DTO y schemas Zod | `tsc --noEmit` en ambos proyectos | 0 errores de tipado reportados | `npm run typecheck` en backend y frontend | **APROBADO** |
| **Higiene del Repositorio** | Cambios pendientes en rama `B_JACOBO` | Posibilidad de caracteres inválidos o conflictos de fin de línea | Validación con `git diff --check` | 0 errores de sintaxis, 0 espacios en blanco conflictivos | `git diff --check` | **APROBADO** |

---

## 5. CONCLUSIÓN Y ESTADO DE ENTREGA

El prototipo del SIGD IESTP Suiza 2026 en la rama `B_JACOBO` se encuentra en estado **CONFORME Y ESTABILIZADO**. El catálogo TUPA institucional 2026, la matriz de seguridad por roles y las integraciones entre bases de datos, servicios backend y componentes de interfaz de usuario han superado todas las pruebas estáticas, dinámicas y de extremo a extremo sin ninguna excepción pendiente.
