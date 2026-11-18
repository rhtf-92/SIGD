# Guía Técnica del Frontend (React + TypeScript) — SIGD

**Versión base:** rama `B_GERIC`, commit `3e652ead`.

---

## 1. Arquitectura General

El frontend está construido con **React**, **TypeScript**, **Vite** y **React Query** (`@tanstack/react-query`).

- **Entrada principal:** [App.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/App.tsx) renderiza `MainLayout`, `ScrollToTop`, `SplashScreen`, `AppRouter` y el widget diferido `ChatbotWidget`.
- **Enrutamiento y guardas:** [AppRouter.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/routes/AppRouter.tsx) separa rutas públicas (sin autenticación) de rutas protegidas por [ProtectedRoute.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/routes/ProtectedRoute.tsx), que valida token JWT, contexto operativo (`PERSONAL` vs `INSTITUCIONAL`) mediante `canAccessRoute`, y roles permitidos (`requiredRoles`).
- **Estado de sesión:** [authStore.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/stores/authStore.ts) implementa un store reactivo con `useSyncExternalStore` persistido en `localStorage` bajo la clave `sigd_auth`. Mantiene `accessToken`, `refreshToken`, `usuario`, `contextoActivo` y `contextosDisponibles`.
- **Cliente HTTP:** [client.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/api/client.ts) (`apiClient`, instancia Axios) inyecta automáticamente `X-Correlation-ID`, `Authorization: Bearer <token>` y el header de contexto operativo, y normaliza errores RFC 7807 / RFC 9457 en la clase tipada `ApiHttpError`.

---

## 2. Rutas y Componentes Principales

### Módulos Públicos (sin sesión)
- `/` → `HomePage`
- `/login` → `LoginPage`
- `/registro` → `RegistroCiudadanoPage`
- `/tupa` → `CatalogoTupaPage`
- `/mesa-partes` → [MesaPartesDigitalPage](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/pages/tramite/MesaPartesDigitalPage.tsx) (radicación pública con asistente por pasos y carga PDF)
- `/consulta` y `/consulta/:cut` → `ConsultaPublicaPage` (seguimiento público por CUT + documento sin exponer rutas S3 ni notas internas)
- `/validador-cvd` → [ValidadorPublicoCvdPage.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/pages/validador/ValidadorPublicoCvdPage.tsx) + [CvdIntegrityReport.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/components/cvd/CvdIntegrityReport.tsx)

### Módulos Autenticados (Ciudadanos e Institucionales)
- **Ciudadano (`ROLES_CIUDADANO`):** `/mis-expedientes`, `/mi-perfil`, `/casilla` (`CasillaElectronicaPage` + `NotificacionDetailModal`).
- **Mesa de Partes (`ROLES_VENTANILLA`):** `/tramite/ventanilla-presencial` (`VentanillaPresencialPage`).
- **Expedientes (`ROLES_INSTITUCIONALES`):**
  - `/expedientes` → `BandejaExpedientesPage` (bandeja de área en custodia y `Mi Bandeja` asignada).
  - `/expedientes/:id` → [ExpedienteDetallePage.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/pages/expedientes/ExpedienteDetallePage.tsx) (ficha integral, Live Tracking, foliación, anexos, pagos y modales operativos).
- **Tesorería (`ROLES_TESORERIA`):** `/tesoreria` → [TesoreriaPage.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/pages/tesoreria/TesoreriaPage.tsx) (órdenes de cobro, recibos imprimibles, devoluciones y QR Sandbox).
- **Reportes Directivos (`ROLES_REPORTES`):** `/reportes/dashboard` → [DashboardEjecutivoPage.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/pages/reportes/DashboardEjecutivoPage.tsx).
- **Administración (`ROLES_ADMIN`):** `/administracion/*` (`AdminRoutes`) y `/calendarizacion-institucional`.

---

## 3. Hooks, Servicios API y Control de Estado Operativo

### 3.1 Acciones FSM sobre Expedientes
1. **Capa de contratos API:** [expedienteActions.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/api/expedienteActions.ts) define `crearServicioExpedienteActions(...)`, conectando las operaciones reales hacia Express:
   - `POST /api/v1/expedientes/:id/movimientos/{derivar|recepcionar|atender|observar|subsanar|archivar}`
   - `POST /api/v1/expedientes/:id/enviar-a-firma`
   - `POST /api/v1/expedientes/:id/resolver`
   - `POST /api/v1/expedientes/:id/acumular`
2. **Hook coordinador:** [useExpedienteActions.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/hooks/useExpedienteActions.ts) encapsula cada operación en `useMutation`, adapta errores con `adaptarErrorAccion`, evita dobles envíos concurrentes por expediente mediante un `WeakMap` (`bloqueos`), e invalida exactamente las claves React Query afectadas (`resumen`, `detalle`, `asignacion`, `trazabilidad`, `foliacion`, `sla`, `bandeja`).

```ts
// Ejemplo real: frontend/src/hooks/useExpedienteActions.ts
const mutacion = useMutation<Salida, ErrorAccionExpediente, Entrada>({
  retry: false,
  mutationFn: async (entrada) => {
    try { return await operacion(entrada); } catch (error) { throw adaptarErrorAccion(error); }
  },
  onSuccess: async (_resultado, entrada) => {
    const claves = opciones.obtenerClavesAfectadas(ids(entrada));
    await Promise.all(
      claves.filter((clave) => clave.length > 0)
            .map((queryKey) => cliente.invalidateQueries({ queryKey, exact: true }, { throwOnError: true }))
    );
    notificar({ tipo: "success", mensaje: mensajeExito });
  },
});
```

### 3.2 Permisos en Botones y Autoridad del Backend
En [ExpedienteDetallePage.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/pages/expedientes/ExpedienteDetallePage.tsx), la vista consume `GET /api/v1/expedientes/:id/resumen`, el cual incluye `accionesPermitidas` (`capacidadesBackend`) calculado por el backend según rol, contexto, custodia, asignación, pago, requisitos y estado FSM:

```ts
// Ejemplo real: frontend/src/pages/expedientes/ExpedienteDetallePage.tsx
const capacidadesBackend = resumen.data?.accionesPermitidas ?? null;
const puedeDerivar = capacidadesBackend?.derivar
  ? capacidadesBackend.derivar.habilitado
  : puedeDerivarFallback;
const puedeObservar = capacidadesBackend?.observar
  ? capacidadesBackend.observar.habilitado
  : puedeObservarFallback;
```

Cada modal operativo (`DerivacionModal`, `AsignacionModal`, [AtencionModal.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/components/expedientes/AtencionModal.tsx), `EnviarAFirmaModal`, [ResolverModal.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/components/expedientes/ResolverModal.tsx), `ArchivadoModal`) solo abre cuando `modal === "<accion>" && puede<Accion>` es verdadero; de lo contrario, el botón se deshabilita con el motivo devuelto o permanece oculto si el usuario carece de facultad.

### 3.3 Firma DNIe en Modo Laboratorio, Validador CVD, Tesorería y Dashboard
- **Firma DNIe ([ResolverModal.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/components/expedientes/ResolverModal.tsx)):** Al abrirse dispara `obtenerAdaptadorDnie()` (en desarrollo `MockDniProvider`), solicita `POST /api/v1/firma/dnie/preparar` (que genera el A4 PDF y su hash SHA-256), firma el hash con el certificado de laboratorio (`CARLOS ALBERTO SANCHEZ`, DNI `99000005`), registra evidencia mediante `POST /api/v1/firma/dnie/verificar-y-registrar` y habilita `POST /api/v1/expedientes/:id/resolver`.
- **Validador Público CVD ([cvdValidator.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/utils/cvdValidator.ts), [useCvdPublicVerification.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/hooks/useCvdPublicVerification.ts)):** Normaliza códigos sin deformar formatos reales (`CVD-YYYY-<16HEX>` ni `CVD-YYYY-MOD-...`), mapea `ApiHttpError` (incluyendo `404 CVD no encontrado`) y en `CvdIntegrityReport` distingue visualmente `"Firma de laboratorio verificada (pruebas / demo)"` de una firma oficial RENIEC/INDECOPI.
- **Tesorería ([tesoreria.service.ts](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/services/tesoreria.service.ts)):** Consulta el endpoint canónico `GET /api/v1/tesoreria/demo-qr/config` para estado de QR Sandbox junto con `/api/v1/tesoreria/dashboard` y `/api/v1/tesoreria/ordenes`.
- **Dashboard ([DashboardEjecutivoPage.tsx](file:///c:/Users/Geric/Desktop/WorkSpace/SIGD/frontend/src/pages/reportes/DashboardEjecutivoPage.tsx)):** Consume `/api/v1/reportes/dashboard/resumen` y redondea la suma de distribución porcentual (`Math.round(... * 10) / 10`) evitando artefactos de punto flotante (`99.8999...`).
