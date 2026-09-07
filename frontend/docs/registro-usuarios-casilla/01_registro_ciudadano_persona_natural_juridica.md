# Registro Ciudadano de Persona Natural y Persona Jurídica — Registro de Usuarios y Casilla

| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-REGUSU-01 |
| **Módulo** | registro-usuarios-casilla / Registro Ciudadano de Persona Natural y Persona Jurídica |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Matías Zumaeta, Sergio Serruche Panduro, Ángel Jesús Vásquez, Carito Curto |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

---

## 1. Visión General y Alcance del Módulo

El módulo de **Registro de Usuarios y Casilla** tiene como propósito central proveer un canal de autoservicio digital seguro, moderno e institucional para que la ciudadanía en general (postulantes, apoderados, estudiantes, egresados, empresas y entidades públicas/privadas) pueda registrarse e identificarse formalmente ante el Instituto de Educación Superior Tecnológico Público "Suiza" (IESTP "Suiza" — Pucallpa).

El registro habilita la creación automática de una **Casilla Electrónica Institucional**, canal oficial a través del cual se notificarán los actos administrativos, resoluciones y comunicaciones oficiales vinculadas a sus expedientes, de acuerdo con el marco de interoperabilidad del Estado peruano.

---

## 2. Formalización de la Escisión de Alcance: Transferencia de Gestión Interna a Módulo 5

> 📋 **Acta Formal de Delimitación de Alcance:**  
> Durante la fase de análisis y relevamiento técnico del sub-equipo (Matías Zumaeta, Sergio Serruche y Angel Jesús Vásquez), se identificó una bifurcación conceptual en torno al público objetivo del sistema:
> 1. La propuesta de Angel Vásquez (`Propuesta_Interfaz_VAZQUES.md`) contemplaba un panel de administración de personal interno del instituto, asignación de roles RBAC (`Administrador`, `Mesa de Partes`, `Operador`, `Auditor`), datos laborales (sede, cargo, área) y credenciales de acceso institucional.
> 2. Las propuestas de Matías Zumaeta y Sergio Serruche se orientaban al registro libre de ciudadanos externos sin cuenta previa para seguimiento y Casilla Electrónica.
>
> **Resolución y Dictamen:**  
> Se formaliza que **la administración de usuarios internos y el control de acceso basado en roles (RBAC) pertenecen y han sido transferidos íntegramente al Módulo 5 (`administracion-seguridad-auditoria/`)**, donde se articulan directamente con las 7 pantallas implementadas en React 19. El presente módulo (`registro-usuarios-casilla/`) asume con exclusividad el registro externo ciudadano, la Casilla Electrónica y el consentimiento de protección de datos personales.

---

## 3. Modelo Dual de Registro: Persona Natural vs Persona Jurídica

Para responder a la diversidad de administrados que interactúan con el instituto, la interfaz presenta un selector conmutador (*toggle selector*) para alternar entre dos modelos de datos:

```
┌───────────────────────────────────────────────────────────────────────────┐
│              SELECCIONE EL TIPO DE REGISTRO CIUDADANO                     │
│                                                                           │
│   (●) Persona Natural (Ciudadano / Estudiante)   ( ) Persona Jurídica (Empresa / Entidad)
└───────────────────────────────────────────────────────────────────────────┘
```

### 3.1. Modelo A: Persona Natural (Ciudadanos, Postulantes, Estudiantes)
Diseñado para la identificación personal e individual del solicitante:
- **Tipo de Documento de Identidad:**
  - DNI (Documento Nacional de Identidad): Longitud exacta de 8 dígitos numéricos (regex `^[0-9]{8}$`).
  - Carné de Extranjería (CE) o Pasaporte: Para ciudadanos extranjeros residentes o estudiantes de intercambio.
- **Nombres y Apellidos Completos:**
  - Validación de caracteres alfabéticos, espacios y tildes (regex `^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]{2,80}$`).
- **Fecha de Nacimiento:**
  - Control de fecha adaptativo con validación de edad mínima (16 años para postulantes a educación superior con DNI azul/electrónico o amarillo con apoderado registrado).
- **Canales de Contacto Directo:**
  - Correo electrónico personal o académico (validación RFC 5322).
  - Teléfono celular: Exactamente 9 dígitos, iniciando mandatoriamente con el dígito 9 (regex `^9[0-9]{8}$`).
- **Ubicación Domiciliaria:** Integración obligatoria con el selector en cascada de Ubigeo Ucayali (SIAGIE).

### 3.2. Modelo B: Persona Jurídica (Empresas, Proveedores, Instituciones)
Diseñado para entidades públicas o privadas que celebran convenios, prestan servicios o ejecutan trámites corporativos ante el IESTP Suiza:
- **Razón Social:** Nombre legal completo de la persona jurídica (mínimo 3 caracteres, máximo 150).
- **Registro Único de Contribuyentes (RUC):**
  - Validación de 11 dígitos numéricos que comiencen estrictamente con los dígitos `10` (persona natural con negocio) o `20` (persona jurídica) mediante regex `^(10|20)[0-9]{9}$`.
- **Datos del Representante Legal:**
  - Tipo y Número de Documento del Representante (DNI 8 dígitos).
  - Nombres y Apellidos del Apoderado o Gerente General.
  - Cargo o Función en la organización (ej. Gerente General, Administrador, Director).
- **Acreditación Registral:**
  - Número de Asiento y Partida Electrónica de los Registros Públicos (SUNARP).
- **Canales de Contacto Corporativo:**
  - Correo electrónico institucional / corporativo para recepción de notificaciones formales.
  - Teléfono fijo y celular del representante legal.

---

## 4. Diseño Visual Institucional y Experiencia de Usuario (UI/UX)

La interfaz se encuentra construida en **React 19 + TypeScript + Vite + Tailwind CSS 4**, aplicando rigurosamente la guía de estilo institucional del IESTP "Suiza":

### 4.1. Tokens y Paleta de Color Institucional
- **Azul Suiza (Color Primario):** `#006EC7` (empleado en botones principales, cabeceras, bordes de enfoque y acentos visuales).
- **Blanco Puro:** `#FFFFFF` (fondos de tarjetas y contenedores de datos).
- **Gris Claro (Superficie):** `#F3F4F6` (fondo general de la página para descanso visual).
- **Gris Oscuro (Texto Principal):** `#111827` (contraste superior a 7:1 contra blanco).
- **Rojo Semántico (Error):** `#DC2626` (borde de input y texto de alerta bajo el campo).

### 4.2. Validación en Vivo (Live Inline Feedback)
Se erradica por completo el uso de ventanas modales nativas del navegador (`window.alert()` o `window.confirm()`), presentes en borradores preliminares. En su lugar, el sistema provee:
- Validación en tiempo real al desenfocar el campo (*onBlur*).
- Contorno del input en color rojo (`border-red-500 focus:ring-red-500`) ante errores.
- Mensaje explicativo amigable inmediatamente debajo del campo en color rojo (`text-xs text-red-600 font-medium`).
- Indicador visual de campo válido con ícono de verificación verde (`CheckIcon`).

```
┌─────────────────────────────────────────────────────────────┐
│  Número de DNI *                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 478912                                                │  │
│  └───────────────────────────────────────────────────────┘  │
│  ✕ El DNI debe contener exactamente 8 dígitos numéricos.   │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Contrato de Integración de Endpoints

### 5.1. Registro de Ciudadano / Usuario Externo
- **Endpoint:** `POST /api/v1/auth/registro-ciudadano`
- **Cabeceras:** `Content-Type: application/json`, `X-Correlation-ID: <uuidv4>`

#### Request Payload (Persona Natural):
```json
{
  "tipoPersona": "NATURAL",
  "tipoDocumento": "DNI",
  "numeroDocumento": "47891234",
  "nombres": "Juan Carlos",
  "apellidos": "Pérez Huamán",
  "fechaNacimiento": "2004-05-18",
  "correo": "juan.perez@gmail.com",
  "celular": "961234567",
  "domicilio": {
    "departamentoCodigo": "25",
    "provinciaCodigo": "2501",
    "distritoCodigo": "250101",
    "direccionExacta": "Jr. Coronel Portillo N° 450",
    "referencia": "A dos cuadras de la Plaza de Armas"
  },
  "declaracionJuradaAceptada": true,
  "consentimientoDatosPersonales": true
}
```

#### Request Payload (Persona Jurídica):
```json
{
  "tipoPersona": "JURIDICA",
  "ruc": "20601234567",
  "razonSocial": "CONSTRUCTORA AMAZÓNICA S.A.C.",
  "representanteLegal": {
    "tipoDocumento": "DNI",
    "numeroDocumento": "09876543",
    "nombres": "María Elena",
    "apellidos": "Torres Solís",
    "cargo": "Gerente General"
  },
  "partidaSunarp": "11029485",
  "correoCorporativo": "mesadepartes@constructoraamazonica.pe",
  "celularContacto": "987654321",
  "domicilio": {
    "departamentoCodigo": "25",
    "provinciaCodigo": "2501",
    "distritoCodigo": "250107",
    "direccionExacta": "Av. Centenario Km 4.5",
    "referencia": "Frente al Campus Universitario"
  },
  "declaracionJuradaAceptada": true,
  "consentimientoDatosPersonales": true
}
```

#### Response (HTTP 201 Created):
```json
{
  "usuarioId": "usr_9c8b7a6d-5e4f-4321-ba98-76543210fedc",
  "estado": "ACTIVO",
  "casillaElectronica": {
    "casillaId": "CAS-2026-47891234",
    "direccionCasilla": "47891234@casilla.iestpsuiza.edu.pe",
    "fechaCreacion": "2026-09-05T10:55:00-05:00"
  },
  "mensaje": "Registro ciudadano completado exitosamente. Se ha enviado un enlace de activación a su correo electrónico."
}
```

#### Tratamiento de Errores RFC 7807 (Documento Ya Registrado):
```json
{
  "type": "https://sigd.iestpsuiza.edu.pe/errors/duplicate-citizen",
  "title": "Documento ya registrado en el sistema",
  "status": 409,
  "detail": "El DNI 47891234 ya cuenta con una casilla electrónica activa en el SIGD del IESTP Suiza.",
  "instance": "/api/v1/auth/registro-ciudadano"
}
```
