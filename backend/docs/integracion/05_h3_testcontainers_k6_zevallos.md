# Hito H3: Suite de Testcontainers y Scripts de Carga k6

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"  
**Grupo:** Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend  
**Responsable:** Zevallos (`B_ZEVALLOS`) — Especialista en QA y Pruebas Automatizadas  
**Ubicación:** `backend/docs/integracion/03_h3_testcontainers_k6_zevallos.md`  
**Fecha:** 30 de agosto de 2026  
**Estado:** `COMPLETADO`  

---

## 1. Arquitectura de la Suite de Pruebas de Integración (Testcontainers)

La estrategia de aseguramiento de calidad automatizada para el backend del SIGD elimina el uso de dobles de prueba (mocks) en la capa de datos. En su lugar, se implementa una infraestructura de pruebas de integración basada en contenedores efímeros.

### 1.1 Ciclo de Vida del Contenedor de Base de Datos
* **Aislamiento Total:** Antes de iniciar la suite de pruebas, el entorno automatizado levanta un contenedor Docker independiente ejecutando PostgreSQL 18 en su versión Alpine.
* **Aprovisionamiento Automático:** Una vez levantado el contenedor, se ejecutan automáticamente las migraciones DDL correspondientes a los 6 esquemas del sistema (`sigd_identi`, `sigd_tramite`, `sigd_docu`, `sigd_organi`, `sigd_ruta` y `sigd_audit`).
* **Limpieza Entre Escenarios:** Al finalizar cada caso de prueba individual, se aplica un procedimiento de vaciado de tablas con cascada (`TRUNCATE ... CASCADE`) para garantizar que las pruebas sean 100% independientes y no exista contaminación de datos entre ejecuciones.
* **Destrucción Efímera:** Finalizada la ejecución global de la suite, el contenedor Docker se destruye automáticamente, liberando los recursos del sistema.

---

## 2. Matriz de 10 Casos de Prueba de Integración E2E Intermodulares

La siguiente matriz especifica los escenarios de prueba de extremo a extremo (E2E) diseñados para verificar la integración entre los distintos módulos, la propagación de contexto con AsyncLocalStorage, el manejo de excepciones RFC 7807 y la generación de auditoría.

* **E2E-01: Radicación Exitosa en Mesa de Partes**
  * **Módulo:** Mesa de Partes
  * **Descripción:** Envío de una solicitud con datos válidos de un ciudadano.
  * **Resultado Esperado:** Retorno de código de éxito HTTP 201 Created y confirmación de persistencia del expediente en la base de datos con un identificador de correlación asignado.
  * **Taxonomía:** `CONFIRMADO`

* **E2E-02: Validación de Entradas de Usuario (Zod a RFC 7807)**
  * **Módulo:** Mesa de Partes / Middleware
  * **Descripción:** Envío de una estructura JSON con campos faltantes o con formato incorrecto (ej. DNI inválido o folios negativos).
  * **Resultado Esperado:** Retorno de estado HTTP 400 Bad Request estructurado estrictamente bajo el estándar RFC 7807, detallando cada campo inválido en una lista de parámetros.
  * **Taxonomía:** `CONFIRMADO`

* **E2E-03: Mapeo de Colisión de Llave Única (PostgreSQL 23505 a HTTP 409)**
  * **Módulo:** Identicore / Middleware
  * **Descripción:** Intento de registro de un usuario utilizando un correo electrónico o DNI previamente registrado.
  * **Resultado Esperado:** Captura de la excepción nativa de PostgreSQL por el interceptor global y mapeo automático a respuesta HTTP 409 Conflict.
  * **Taxonomía:** `CONFIRMADO`

* **E2E-04: Mapeo de Violación de Llave Foránea (PostgreSQL 23503 a HTTP 400/404)**
  * **Módulo:** Tramicore / Middleware
  * **Descripción:** Intentar asignar o derivar un trámite hacia un área organizacional que no existe en el esquema de organización.
  * **Resultado Esperado:** Intercepción del error de integridad referencial de la base de datos y respuesta JSON de error indicando la invalidez del recurso referenciado.
  * **Taxonomía:** `CONFIRMADO`

* **E2E-05: Flujo Completo de Derivación Intermodular**
  * **Módulo:** Tramicore / Organicore
  * **Descripción:** Transición de estado de un expediente desde la Mesa de Partes hacia la jefatura correspondiente.
  * **Resultado Esperado:** Retorno de estado HTTP 200 OK y actualización correcta del estado de ubicación física y digital del documento.
  * **Taxonomía:** `CONFIRMADO`

* **E2E-06: Verificación de Auditoría Forense Transparente (AsyncLocalStorage)**
  * **Módulo:** Observabilidad / AsyncLocalStorage
  * **Descripción:** Ejecución de una operación de mutación (creación o actualización de datos) verificando la captación de metadatos.
  * **Resultado Esperado:** Comprobación directa en la tabla de bitácora de auditoría (`sigd_audit.bitacora_auditoria`) de que el identificador de usuario, la dirección IP de origen y el identificador de correlación fueron capturados automáticamente sin pasar explícitamente esos parámetros en el código de negocio.
  * **Taxonomía:** `CONFIRMADO`

* **E2E-07: Inserción Transaccional en Tabla Outbox**
  * **Módulo:** Observabilidad / Patrón Outbox
  * **Descripción:** Radicación de un expediente verificando la atomicidad de la transacción.
  * **Resultado Esperado:** Registro en la misma transacción de base de datos de la entidad del expediente y del evento correspondiente dentro de la tabla de eventos salientes (`sigd_audit.evento_outbox`) para su posterior procesamiento asíncrono.
  * **Taxonomía:** `CONFIRMADO`

* **E2E-08: Protección de Endpoints (Falta de Autenticación)**
  * **Módulo:** Seguridad / Middleware
  * **Descripción:** Realizar una petición a una ruta protegida sin adjuntar el token de autenticación.
  * **Resultado Esperado:** Rechazo inmediato en el nivel HTTP 401 Unauthorized en formato RFC 7807, bloqueando cualquier consulta hacia la base de datos.
  * **Taxonomía:** `CONFIRMADO`

* **E2E-09: Restricción de Autorización y Roles**
  * **Módulo:** Seguridad / Middleware
  * **Descripción:** Un usuario con rol de operador intenta ejecutar una acción reservada para el rol de administrador.
  * **Resultado Esperado:** Respuesta HTTP 403 Forbidden indicando que la credencial no posee los privilegios requeridos para la operación.
  * **Taxonomía:** `CONFIRMADO`

* **E2E-10: Enmascaramiento de Errores No Controlados**
  * **Módulo:** Middleware de Errores
  * **Descripción:** Inducción deliberada de una falla crítica no anticipada en el servidor (ej. pérdida momentánea de conexión interna).
  * **Resultado Esperado:** Retorno de error HTTP 500 Internal Server Error estandarizado bajo RFC 7807, con ocultamiento total del detalle de la pila de llamadas (stack trace) para proteger la seguridad del sistema en entornos de producción.
  * **Taxonomía:** `CONFIRMADO`

---

## 3. Especificación de Pruebas de Carga y Rendimiento con k6

Las pruebas de carga están orientadas a evaluar el comportamiento del servidor backend bajo condiciones de uso simultáneo intensivo, asegurando que la arquitectura responda adecuadamente antes de su pase a producción.

### 3.1 Criterios de Aceptación y Umbrales (Thresholds)
* **Latencia Percentil 95 (P95):** El 95% de todas las solicitudes HTTP servidas por el sistema deben responder en un tiempo inferior a **200 milisegundos** (`http_req_duration: ['p(95)<200']`).
* **Tasa de Errores Máxima Permitida:** El porcentaje de peticiones fallidas (códigos HTTP 5xx o caídas de conexión) debe mantenerse por debajo del **0.1%** del total de solicitudes ejecutadas (`http_req_failed: ['rate<0.001']`).

### 3.2 Escenarios de Simulación de Carga
* **Escenario 1: Radicación Masiva en Mesa de Partes (100 Usuarios Virtuales Simultáneos)**
  * **Objetivo:** Simular horas pico de recepción de trámites en la institución.
  * **Perfil de Carga:** Rampa de subida progresiva en 30 segundos hasta alcanzar 100 usuarios virtuales, mantenimiento de la carga pico durante 1 minuto y rampa de descenso gradual de 30 segundos.
  * **Acción Realizada:** Envío coordinado de solicitudes de registro de trámites generando identificadores únicos y datos dinámicos.

* **Escenario 2: Operación Simultánea de Derivación (50 Usuarios Virtuales)**
  * **Objetivo:** Simular a los operadores de las distintas áreas administrativas derivando y respondiendo expedientes al mismo tiempo.
  * **Perfil de Carga:** Mantener de forma constante 50 usuarios virtuales realizando consultas y actualizaciones durante 1 minuto y mediO.