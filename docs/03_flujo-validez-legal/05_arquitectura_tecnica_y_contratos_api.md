| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-FLUJO-VALIDEZ-LEGAL-05 |
| **Módulo** | flujo-validez-legal / Flujo Interno de Trabajo y Validez Legal |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Adriano David Espinoza Ramírez, Isaí, Mayra |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 05. Arquitectura Técnica y Contratos API

## 1. Stack Tecnológico del Frontend

El desarrollo del módulo se fundamenta en las versiones más modernas del ecosistema web para garantizar rendimiento, tipado estricto y alta disponibilidad:

* **React 19:** Biblioteca base utilizando las nuevas primitivas de concurrencia, `useTransition` para transiciones de estado en la bandeja de trámites y Server/Client Components optimizados.
* **TypeScript 5.9:** Tipado estático riguroso para todos los modelos de dominio, previniendo discrepancias de tipos en tiempo de compilación.
* **Vite 6:** Motor de construcción ultrarrápido con Hot Module Replacement (HMR) y empaquetado optimizado por rutas (*route splitting*).
* **Tailwind CSS 4:** Motor de estilos basado en CSS moderno y tokens institucionales (azul gubernamental `#1E40AF`, verde éxito `#10B981`, ámbar advertencia `#F59E0B` y rojo alerta `#EF4444`).
* **TanStack Query 5 (React Query):** Gestión de estado asíncrono en caché, invalidación inteligente tras mutaciones de derivación o firma y reintentos exponenciales.
* **Axios 1.x:** Cliente HTTP con interceptores globales para inyección de cabeceras de correlación (`X-Correlation-ID`), gestión de tokens JWT Bearer y normalización de errores conforme al estándar **RFC 7807 (Problem Details for HTTP APIs)**.

---

## 2. Contratos de Datos en TypeScript

```typescript
// ==========================================
// MODELOS DE DOMINIO: TRÁMITES Y WORKFLOW
// ==========================================

export type EstadoTramite = 
  | 'BORRADOR'
  | 'REGISTRADO'
  | 'EN_TRAMITE'
  | 'EN_REVISION'
  | 'OBSERVADO'
  | 'SUBSANADO'
  | 'APROBADO'
  | 'PARA_FIRMA'
  | 'RESUELTO'
  | 'ANULADO';

export interface EtapaFlujo {
  idEtapa: number;
  orden: number;
  nombreEtapa: string;
  unidadOrganica: string;
  rolResponsable: 'admin' | 'responsable' | 'operador' | 'consulta';
  esObligatoria: boolean;
  plazoHorasSla: number;
}

export interface Tramite {
  idTramite: number;
  cut: string; // EXP-YYYY-XXXXXX
  tipoTramiteId: number;
  nombreTipoTramite: string;
  solicitante: {
    idPersona: number;
    numeroDocumento: string;
    nombres: string;
    apellidos: string;
    correoElectronico: string;
  };
  estado: EstadoTramite;
  etapaActualId: number;
  etapaActualNombre: string;
  fechaRegistro: string;
  fechaLimiteSla: string;
  observacionesActivas?: string;
}

// ==========================================
// MODELOS DE DOCUMENTO Y FIRMA DIGITAL
// ==========================================

export type TipoActoAdministrativo = 'RD' | 'ACTA' | 'CERTIFICADO' | 'OFICIO' | 'CONSTANCIA';

export interface DocumentoOficial {
  idDocumento: number;
  idTramite: number;
  tipoActo: TipoActoAdministrativo;
  numeroCorrelativo: string; // RD N.° 0412-2026-DG-IESTP-SUIZA
  anio: number;
  asunto: string;
  urlPdfOriginal: string;
  urlPdfFirmado?: string;
  hashSha256: string;
  cvd: string; // CVD-YYYY-TIP-XXXXXX-HASH
  estadoFirma: 'PENDIENTE' | 'FIRMADO' | 'OBSERVADO';
  fechaGeneracion: string;
}

export interface FirmaDigitalRegistro {
  idFirma: number;
  idDocumento: number;
  firmanteDni: string;
  firmanteNombre: string;
  cargo: string;
  proveedorFirma: 'REFIRMA_RENIEC' | 'IOFE_INDECOPI';
  selloTiempoTimestamp: string;
  estado: 'VALIDO' | 'REVOCADO' | 'INVALIDO';
}

export interface ValidacionCVDResult {
  esValido: boolean;
  cvd: string;
  documento: {
    numeroDocumento: string;
    tipo: string;
    asunto: string;
    fechaEmision: string;
    firmantes: Array<{
      nombre: string;
      cargo: string;
      fechaFirma: string;
      entidadCertificadora: string;
    }>;
    hashIntegridadSha256: string;
    urlDescargaAutentica: string;
  };
  mensajeSeguridad: string;
}
```

---

## 3. Catálogo de Endpoints REST (/api/v1/...)

Todos los endpoints exigen comunicación segura sobre HTTPS, autenticación vía encabezado `Authorization: Bearer <JWT>` (a excepción de la consulta pública del validador CVD) y tratamiento de errores tipados RFC 7807.

| Método | Endpoint | Descripción Técnica | Roles Autorizados |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/tramites/inbox` | Retorna los trámites asignados a la unidad del usuario según filtros de estado y paginación. | `responsable`, `operador`, `admin` |
| `GET` | `/api/v1/tramites/:id/expediente` | Detalle integral del expediente, requisitos adjuntos e historial de trazabilidad. | Todos autenticados con permiso `ver` |
| `POST` | `/api/v1/tramites/:id/derivar` | Transiciona el trámite a la siguiente etapa o unidad con asignación formal. | `responsable`, `operador` |
| `POST` | `/api/v1/tramites/:id/observar` | Emite pliego de observaciones, transiciona a `OBSERVADO` y congela SLA. | `responsable` |
| `POST` | `/api/v1/tramites/:id/subsanar` | Registra los descargos del administrado y transiciona a `SUBSANADO`. | `operador`, mesa de partes |
| `POST` | `/api/v1/documentos/generar` | Genera el borrador PDF/A combinando los datos del expediente con la plantilla oficial. | `responsable`, `admin` |
| `POST` | `/api/v1/documentos/:id/firmar/preparar` | Calcula el hash SHA-256 del PDF y emite el token de sesión para Refirma. | `admin`, `responsable` (Dirección) |
| `POST` | `/api/v1/documentos/:id/firmar/completar` | Recibe la firma PAdES, valida contra TSA y sella el CVD definitivo. | Agente de Firma / Dirección |
| `GET` | `/api/v1/validador/cvd/:codigoCvd` | **Público (Sin JWT):** Retorna la ficha de validación de autenticidad e integridad del documento. | Público abierto |

---

## 4. Estructura Relacional de Base de Datos (DBML)

El modelo relacional que soporta la persistencia del flujo de trabajo, documentos y firmas digitales se encuentra formalizado en el archivo `diagrama_flujo_validez_legal.dbml` en este mismo directorio. Sus entidades nucleares son:

* `tramite`: Registra el expediente principal, su estado actual en la FSM y tiempos de atención.
* `etapa_tramite`: Configuración paramétrica de cada nodo del workflow por tipo de procedimiento.
* `historial_tramite`: Log inmutable que almacena quién, cuándo y qué acción ejecutó en cada etapa.
* `documento`: Acto administrativo emitido enlazado a su número correlativo y su ruta en almacenamiento seguro.
* `firma`: Registro criptográfico de cada firma digital estampada sobre el documento.
