# Backend del SIGD

## Documentación Técnica y Arquitectura

Para consultar la documentación completa de análisis, modelos de datos, esquemas SQL y planes de trabajo de los 6 grupos del backend, consulte:

- 📑 [Portal Maestro de Documentación Técnica](docs/README.md)
- 📄 [Plan de Mejora Integral a Nivel Backend](docs/Plan_de_mejora_nivel_backend_SIGD.md)

## Arquitectura del Backend

El patrón Modelo-Vista-Controlador (MVC) separa las responsabilidades de una aplicación para facilitar su mantenimiento y evolución. En el SIGD, esta separación se adapta a una API: los modelos representan los datos del dominio; los controladores reciben las solicitudes HTTP y coordinan las respuestas; y la Vista no forma parte de este backend. El frontend actuará como Vista y será integrado posteriormente mediante el consumo de la API.

La arquitectura incorpora también servicios y repositorios para separar, respectivamente, la lógica de aplicación y el acceso a PostgreSQL.

### Dominio DocuCore (Grupo 5)

A partir de la rama `B_VALENTIN`, se introduce el dominio `src/domains/docucore` que encapsula la generación institucional de PDF A4, la pasarela de firma digital Refirma y la gestión de sesiones efímeras. Este dominio convive con la estructura MVC clásica y proporciona:

- **A4GeneratorService**: Generador de PDF en hoja A4 exacta (210×297 mm), márgenes 25 mm, membrete institucional, control de viudas/huérfanas, tablas atómicas y bloque de firma atómico.
- **RefirmaGatewayService**: Pasarela del protocolo `refirma://sign?arguments=[BASE64URL]` con validación estricta de payload (cuatro claves obligatorias, HTTPS, lista blanca de hosts, SHA-256 en minúsculas, Base64URL sin padding).
- **FirmaSessionStore**: Tokens de 256 bits, TTL 300 s, clave derivada por SHA-256, consumo atómico (`GETDEL` en Redis / `delete` en memoria).
- **ServicioFirmaService**: Orquestación completa: generación de PDF, emisión de token, construcción de URI, callback con autodestrucción de sesión, URL temporal de descarga.

## Tecnologías previstas

- Node.js 24.19.0 LTS como entorno de ejecución.
- TypeScript 7.0.2 para el desarrollo con tipado estático.
- Express 5.2.1 para la aplicación HTTP y la futura API.
- PostgreSQL 18.6 como sistema gestor de base de datos.
- node-postgres 8.23.0 como cliente de PostgreSQL para Node.js.
- dotenv y tsx como dependencias de apoyo para la configuración del entorno y la ejecución durante el desarrollo.
- **pdf-lib 1.17.1** para generación de PDF.
- **ioredis 5.11.1** para cliente Redis 7.

## Estructura

- `src/config`: configuración técnica de la aplicación y sus conexiones.
- `src/controllers`: controladores encargados de coordinar solicitudes y respuestas HTTP.
- `src/models`: representaciones de los datos y conceptos del dominio, una vez validados.
- `src/routes`: definición y agrupación futura de rutas de la API.
- `src/services`: coordinación de casos de uso y lógica de aplicación.
- `src/repositories`: abstracción futura del acceso y persistencia de datos.
- `src/middlewares`: funciones transversales del ciclo de solicitud y respuesta.
- `src/validators`: validación futura de los datos de entrada.
- `src/types`: tipos e interfaces compartidos de TypeScript.
- `src/utils`: utilidades técnicas reutilizables.
- `src/domains/docucore`: dominio DocuCore (Grupo 5) — PDF A4, Refirma, sesiones de firma.
- `tests`: pruebas automatizadas (Node.js `node:test` + `tsx`).
- `src/app.ts`: creación y configuración de la aplicación Express, cableado de dominios.
- `src/server.ts`: punto de entrada que lee el puerto e inicia el servidor HTTP.

## Endpoints DocuCore (Grupo 5)

Base path: `/api/v1/firma`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/invocar-refirma` | Genera PDF A4, emite token, devuelve URI `refirma://`, URL de documento y callback. |
| `POST` | `/callback-refirma/:sesionId` | Recibe callback del agente Refirma; valida hash, destruye sesión, confirma firma. |
| `GET` | `/documento/:documentoId?token=...` | Descarga temporal del PDF firmado (300 s de vigencia). |

### Ejemplo de invocación

```bash
curl -X POST http://localhost:3000/api/v1/firma/invocar-refirma \
  -H "Content-Type: application/json" \
  -d '{
    "contenido": {
      "titulo": "RESOLUCION DIRECTORAL N.° 001-2026",
      "bloques": [
        { "tipo": "parrafo", "texto": "Considerando que..." },
        { "tipo": "articulo", "numero": "Articulo 1.-", "texto": "Declarar..." },
        { "tipo": "firma", "cargo": "DIRECTOR [EJEMPLO]", "nombre": "APELLIDO NOMBRE [EJEMPLO]" }
      ]
    },
    "firmante": { "id": "usr_001", "nombre": "APELLIDO NOMBRE [EJEMPLO]", "documento": "00000000" },
    "hostPublico": "https://sigd.iestp-suiza.edu.pe"
  }'
```

### Respuesta exitosa

```json
{
  "token": "a1b2c3...",
  "uriProtocolar": "refirma://sign?arguments=[eyJ1cmxEb2N1bWVudG8iOiJodHRwcy...]",
  "urlDocumento": "https://sigd.iestp-suiza.edu.pe/api/v1/firma/documento/doc_abc123?token=a1b2c3...",
  "hashDocumento": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "sesionId": "ses_0123456789abcdef0123456789abcdef",
  "expiraEn": "2026-09-30T10:05:00.000Z",
  "ttlSegundos": 300
}
```

## Pruebas

```bash
npm test
# 102 pruebas en 6 suites: A4, TTL/Redis, Refirma Gateway, Servicio de Firma
```

Cobertura:
- `tests/unit/domains/docucore/a4Generator.spec.ts` — geometría A4, paginación, hash SHA-256.
- `tests/unit/domains/docucore/firmaSession.spec.ts` — TTL 300s, consumo atómico (GETDEL), concurrencia.
- `tests/unit/domains/docucore/refirmaGateway.spec.ts` — URI, Base64URL, validación payload, seguridad.
- `tests/unit/domains/docucore/firma.service.spec.ts` — integración completa, callback, descarga, reuso.

## Configuración local

Copie `.env.example` a `.env` y ajuste:

```bash
cp .env.example .env
```

Variables clave:
- `REDIS_URL` — conexión a Redis 7 (si no está, usa almacen en memoria).
- `HOST_PUBLICO` — host público para URLs en el payload Refirma.
- `REFIRMA_HOSTS_PERMITIDOS` — lista blanca de hosts (coma-separada).
- `REFIRMA_EXIGIR_HTTPS` — `true` en producción.

## Alcance actual

El backend incluye ahora el dominio DocuCore completo (Grupo 5) con generación PDF A4, pasarela Refirma y sesiones de firma. La estructura MVC base permanece para futuros grupos. No incluye autenticación, modelos de negocio generales, tablas ni migraciones.
