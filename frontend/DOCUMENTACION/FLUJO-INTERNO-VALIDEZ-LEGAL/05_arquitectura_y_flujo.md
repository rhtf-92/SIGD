# 05. Arquitectura y Flujo de Integración

## 1. Tecnologías del Frontend

Tomando como base la estructura técnica del SIGD (React + Vite + TypeScript + Tailwind CSS):

* **React 19 + TypeScript:** componentes de interfaz tipados para la bandeja de trabajo, detalle de trámite, generación de documentos y firma.
* **Vite 6:** empaquetado y servidor de desarrollo.
* **Tailwind CSS 4:** diseño responsive y uniforme.
* **React Router DOM 7:** navegación entre pantallas del módulo y protección de rutas.
* **Axios 1:** peticiones HTTP a la API del backend.
* **TanStack Query 5:** gestión del estado asíncrono (listas de trámites, estados, documentos).

## 2. Arquitectura General

```text
FRONTEND (React)
   │
   │ HTTP / REST API
   ▼
BACKEND (API del SIGD)
   │
   │ Consultas SQL seguras
   ▼
POSTGRESQL

FRONTEND ──integración segura (HTTPS/API)──► PROVEEDOR DE FIRMA DIGITAL
                                              (Refirma RENIEC / componente acreditado INDECOPI)
```

El frontend orquesta la experiencia de usuario; la integración con el proveedor de firma puede ejecutarse desde el backend (recomendado para no exponer credenciales) o desde el frontend siguiendo el SDK del proveedor.

## 3. Endpoints Propuestos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/flujos` | Lista de plantillas/plantillas de flujo. |
| GET | `/api/tramites` | Bandeja de trámites del usuario. |
| GET | `/api/tramites/:id` | Detalle y trazabilidad de un trámite. |
| POST | `/api/tramites` | Crear e iniciar un trámite. |
| POST | `/api/tramites/:id/aprobar` | Aprobar paso actual y derivar. |
| POST | `/api/tramites/:id/observar` | Observar y devolver trámite. |
| GET | `/api/documentos` | Documentos generados del trámite. |
| POST | `/api/documentos` | Generar documento desde plantilla. |
| POST | `/api/documentos/:id/firmar` | Firmar digitalmente un documento. |
| GET | `/api/documentos/:id/verificar` | Verificar validez de la firma. |

## 4. Flujo Integral (Paso 4 → Paso 5)

1. El interesado o el área crea el trámite y adjunta los requisitos.
2. El sistema lo envía a la primera etapa (Secretaría Académica).
3. Cada instancia revisa, aprueba u observa desde su bandeja de trabajo.
4. La Dirección General aprueba el trámite y dispone la emisión.
5. El módulo genera el documento oficial (Resolución, Acta, Certificado).
6. El documento se firma digitalmente mediante el proveedor acreditado.
7. El documento firmado se almacena, se notifica al interesado y queda disponible para descarga/verificación.

## 5. Seguridad

* Comunicación únicamente por HTTPS.
* Credenciales del proveedor de firma gestionadas en el backend y variables de entorno del frontend (`VITE_*`) sin exponer secretos.
* Control de acceso por rol (Secretaría Académica, Administración, Dirección) y protección de rutas.
* Registro de auditoría de toda acción sobre el trámite y el documento.
