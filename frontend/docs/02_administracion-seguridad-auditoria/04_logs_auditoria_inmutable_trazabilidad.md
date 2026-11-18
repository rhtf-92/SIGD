| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-04 |
| **Módulo** | administracion-seguridad-auditoria / Administración, Seguridad y Auditoría |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Leonel Rivera Maxin ("Maxin"), Jhonatan Nijar Gonzales de Souza, Carlos Perea ("Gato"), Cristian Macedo |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 04. Pistas de Auditoría Inmutable y Trazabilidad Forense

## 1. Misión de la Auditoría en el SIGD

En el marco del Sistema Nacional de Control y las disposiciones de la Contraloría General de la República (CGR) para entidades del Estado, la trazabilidad de las actuaciones administrativas electrónicas es obligatoria. El submódulo de **Auditoría y Trazabilidad** del SIGD proporciona un mecanismo de registro inmutable que captura cronológicamente cada acción relevante realizada por los usuarios dentro de la plataforma.

Este submódulo se encuentra completamente integrado y operativo en el frontend mediante el componente `frontend/src/pages/administracion/AuditoriaPage.tsx`, permitiendo a los directivos y auditores gubernamentales consultar, filtrar e inspeccionar la cadena de custodia documental.

---

## 2. Arquitectura de Almacenamiento Inmutable (WORM)

Para garantizar que los registros no puedan ser adulterados, eliminados o sobreescritos por ningún usuario —incluidos los propios administradores del sistema—, el SIGD implementa un esquema **WORM (Write Once, Read Many)**:

1. **Persistencia Append-Only:** La tabla `sigd_audit.registro_auditoria` en PostgreSQL posee restricciones a nivel de motor (triggers y revocación de privilegios `UPDATE` y `DELETE`), impidiendo cualquier mutación retroactiva.
2. **Encadenamiento Criptográfico de Bloques:** Cada bloque de logs incorpora un hash criptográfico concatenado del registro previo, asegurando la detección inmediata de cualquier borrado físico en base de datos.
3. **Correlación de Peticiones (`X-Correlation-ID`):** Cada transacción iniciada en el frontend mediante Axios inyecta un identificador UUIDv4 único (`X-Correlation-ID`) que viaja a través del backend y se estampa en el log, permitiendo reconstruir la secuencia completa de una operación distribuida.

---

## 3. Tipología de Eventos Auditados

El sistema captura siete (7) categorías de eventos operacionales:

* **Autenticación y Sesión:** Inicio de sesión exitoso, intentos fallidos con contraseña errónea, cierre de sesión voluntario y expiración de sesión por inactividad.
* **Ciclo de Vida de Expedientes:** Creación de expediente, registro de CUT, foliado, adjunción de anexos y visualización de expedientes reservados.
* **Flujo de Trabajo y Derivaciones:** Transferencia de expedientes entre áreas, aceptación en despacho, devolución con pliego de observaciones y visto bueno favorable.
* **Suscripción Criptográfica:** Invocación del componente Refirma, sellado de tiempo (TSA) y emisión de Código de Verificación Digital (CVD).
* **Mantenimiento de Parámetros:** Modificaciones en tablas maestras (creación o inactivación de sedes, áreas y tipos documentales).
* **Seguridad y Accesos:** Cambios en la matriz de roles y permisos, bloqueo automático de cuentas de usuario y reseteo de claves.
* **Incidentes y Errores:** Excepciones no controladas y respuestas con estructura RFC 7807 (Problem Details).

---

## 4. Esquema de Datos e Interfaces en TypeScript

Definición formal sincronizada con `AuditoriaPage.tsx`:

```typescript
export type ResultadoAuditoria = "Exitoso" | "Denegado" | "Error";

export interface RegistroAuditoria {
  id: string; // Ej: 'AUD-000145'
  fecha: string; // Formato: 'DD/MM/AAAA HH:mm:ss'
  usuario: string; // Nombres y Apellidos del operador
  rol: string; // Rol institucional asignado
  area: string; // Unidad orgánica de adscripción
  accion: string; // Descripción sintética del verbo ejecutado
  modulo: string; // 'Expedientes' | 'Documentos' | 'Autenticación' | 'Administración' | 'Seguridad'
  registro: string; // Identificador del recurso (Ej: 'EXP-2026-000184')
  resultado: ResultadoAuditoria;
  ip: string; // Dirección IPv4 o IPv6 del cliente
  correlationId?: string; // UUID de trazabilidad distribuida
  detallesTecnicos?: Record<string, unknown>; // Payload y RFC 7807
}
```

---

## 5. Especificaciones del Visor Interactivo de Auditoría (`AuditoriaPage.tsx`)

La página provee una experiencia de inspección avanzada con los siguientes elementos funcionales:

* **Barra de Búsqueda Universal:** Filtra instantáneamente por nombre de usuario, código de expediente, dirección IP o verbo de acción.
* **Filtros Selectores:** Segmentación por módulo (`Todos`, `Expedientes`, `Documentos`, `Autenticación`, `Administración`) y resultado (`Todos`, `Exitoso`, `Denegado`, `Error`).
* **Tarjetas Semafóricas de Resumen:**
  - *Eventos Exitosos:* Fondo esmeralda con totalizador numérico.
  - *Acciones Denegadas (403):* Fondo ámbar alertando violaciones de permisos RBAC.
  - *Errores de Sistema (500 / RFC 7807):* Fondo rojo para atención inmediata de soporte de TI.
* **Exportación Forense:** Botón de exportación oficial que genera un reporte en formato CSV o PDF autenticado para remitir al Órgano de Control Institucional (OCI).
