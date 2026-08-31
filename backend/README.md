# Backend del SIGD

## Documentación Técnica y Arquitectura

Para consultar la documentación completa de análisis, modelos de datos, esquemas SQL y planes de trabajo de los 6 grupos del backend, consulte:

- 📑 [Portal Maestro de Documentación Técnica](docs/README.md)
- 📄 [Plan de Mejora Integral a Nivel Backend](docs/Plan_de_mejora_nivel_backend_SIGD.md)

## Arquitectura del Backend

El patrón Modelo-Vista-Controlador (MVC) separa las responsabilidades de una aplicación para facilitar su mantenimiento y evolución. En el SIGD, esta separación se adapta a una API: los modelos representan los datos del dominio; los controladores reciben las solicitudes HTTP y coordinan las respuestas; y la Vista no forma parte de este backend. El frontend actuará como Vista y será integrado posteriormente mediante el consumo de la API.

La arquitectura incorpora también servicios y repositorios para separar, respectivamente, la lógica de aplicación y el acceso a PostgreSQL. Esta estructura no define todavía el esquema de la base de datos ni implementa funcionalidades de negocio.

## Tecnologías previstas

- Node.js 24.19.0 LTS como entorno de ejecución.
- TypeScript 7.0.2 para el desarrollo con tipado estático.
- Express 5.2.1 para la aplicación HTTP y la futura API.
- PostgreSQL 18.6 como sistema gestor de base de datos.
- node-postgres 8.23.0 como cliente de PostgreSQL para Node.js.
- dotenv y tsx como dependencias de apoyo para la configuración del entorno y la ejecución durante el desarrollo.

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
- `tests`: pruebas automatizadas que se incorporarán durante el desarrollo.
- `src/app.ts`: creación y configuración de la aplicación Express, sin iniciar el servidor.
- `src/server.ts`: punto de entrada que lee el puerto e inicia el servidor HTTP.

## Alcance actual

Esta etapa contiene solamente una base técnica extensible. No incluye endpoints, autenticación, modelos, tablas, migraciones ni módulos de negocio.

La definición de áreas, roles, permisos, módulos y flujos documentarios depende todavía del levantamiento institucional. No se asumirán estas definiciones antes de contar con información validada.

La estructura es preliminar y puede modificarse después de la revisión y validación del profesor responsable del proyecto.

## Configuración local futura

El archivo `.env.example` documenta variables de entorno de ejemplo sin credenciales reales. Cuando se habilite el entorno de desarrollo, deberá copiarse como `.env` y adaptarse localmente. Las dependencias están declaradas en `package.json`, pero no se instalan como parte de esta primera etapa.
