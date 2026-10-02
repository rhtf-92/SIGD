# Decisiones de arquitectura: firma digital y pasarela Refirma

**Dominio:** DocuCore (Grupo 5)  
**Rama:** `B_VALENTIN`  
**Fecha:** 2026-09-30  
**Estado:** APROBADO

---

## 1. Contexto y problema

El SIGD requiere integrar la firma digital de documentos resolutivos mediante el agente **Refirma** provisto por RENIEC. La integración debe:

- Generar el PDF institucional en hoja A4 exacta (210×297 mm, márgenes 25 mm).
- Entregar el documento al agente de escritorio mediante un protocolo URI.
- Recibir el callback firmado y validar la integridad.
- Exponer una URL temporal de descarga del documento firmado (TTL 300 s).
- Garantizar que un token de sesión solo pueda usarse una vez (consumo atómico).

---

## 2. Protocolo Refirma adoptado

### 2.1 Esquema URI

```
refirma://sign?arguments=[BASE64URL]
```

- `arguments` contiene un **array JSON** con **exactamente un objeto**.
- El objeto tiene **cuatro claves obligatorias** y **ninguna adicional**:

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `urlDocumento` | string (URL absoluta HTTPS) | Endpoint temporal de descarga del PDF original. |
| `hashDocumento` | string (hex, 64 chars, minúsculas) | SHA-256 del PDF original. |
| `idSesion` | string | Identificador opaco de la sesión (prefijo `ses_` + 32 hex). |
| `urlCallback` | string (URL absoluta HTTPS) | Endpoint que Refirma invocará al firmar. |

### 2.2 Codificación

- El array JSON se serializa con `JSON.stringify` (sin espacios).
- Se codifica en **Base64URL** (RFC 4648 §5): alfabeto `A-Z a-z 0-9 - _`, **sin padding** (`=`).
- El resultado va directo en la query; no se aplica `encodeURIComponent` adicional porque Base64URL es seguro en URLs.

### 2.3 Validaciones de seguridad

1. **HTTPS obligatorio** en `urlDocumento` y `urlCallback` (configurable vía `REFIRMA_EXIGIR_HTTPS`).
2. **Lista blanca de hosts** (`REFIRMA_HOSTS_PERMITIDOS`) — ambos URLs deben resolver a hosts permitidos.
3. **SHA-256 canónico** en minúsculas, 64 caracteres hex.
4. **idSesion** con patrón `^ses_[0-9a-f]{32}$` (16–128 chars según especificación).
5. **Claves exactas** — cualquier clave extra o faltante rechaza el payload con detalle por campo.
6. **Array de un solo elemento** — más de un objeto rechaza el payload.

---

## 3. Sesiones de firma (TTL 300 s, consumo atómico)

### 3.1 Token y clave

- Token: 256 bits aleatorios → hex de 64 chars (`crypto.randomBytes(32)`).
- Clave Redis: `sigd:docucore:firma:sesion:<SHA-256(token)[:32]>`.
- El token **nunca** viaja en el payload Refirma; solo el `idSesion` derivado.

### 3.2 Operaciones

| Operación | Redis 7 | Memoria (fallback/tests) |
|-----------|---------|--------------------------|
| Crear | `SET key value EX 300 NX` | `Map.set` + `setTimeout` |
| Existe | `EXISTS key` | `Map.has` + expiración |
| Consumir | `GETDEL key` | `Map.get` + `Map.delete` |

`GETDEL` es atómico en Redis 7: lectura y borrado en un solo comando de red. En memoria, `delete` tras `get` es atómico en el event loop de Node.js.

### 3.3 TTL y expiración

- TTL fijo: **300 segundos** (5 minutos).
- Si el callback llega tras la expiración, la sesión ya no existe → error `SESION_FIRMA_INVALIDA`.
- El TTL se renueva **solo** al crear; no se extiende con accesos.

---

## 4. Generación PDF A4 (T-BE-DC-09)

### 4.1 Especificación geométrica

- Hoja: **A4 = 210 mm × 297 mm** = 595.2756 pt × 841.8898 pt (72 pt/pulgada).
- Márgenes uniformes: **25 mm** (70.866 pt) en los cuatro lados.
- Área útil: 453.54 pt × 699.16 pt.

### 4.2 Reglas tipográficas

- Membrete institucional en primera hoja; encabezado de continuación y pie con paginación legal en todas.
- Partición de palabras con ancho real de glifo (pdf-lib); ninguna palabra desborda la caja.
- Control de viudas/huérfanas (`MIN_LINEAS_ANTI_VIUDA = 2`, `MIN_LINEAS_COMPANERAS = 2`).
- Conservación del título junto al párrafo que introduce (`conservaConSiguiente`).
- Tablas: repetición de encabezado en salto de hoja, atomicidad de fila.
- Bloque de firma atómico: cargo, nombre, documento; línea de firma entre cargo y nombre.

### 4.3 Salida

- `bytes`: `Uint8Array` del PDF.
- `sha256`: hash hex del PDF final (lo que viaja en `hashDocumento`).
- `paginas`, `tamanoBytes`, `anchoHoja`, `altoHoja`.

---

## 5. Endpoints expuestos

Base: `/api/v1/firma`

| Método | Ruta | Propósito |
|--------|------|-----------|
| `POST` | `/invocar-refirma` | Genera PDF, crea sesión, devuelve `refirma://` URI, `urlDocumento`, `hashDocumento`, `token`, `sesionId`, `expiraEn`, `ttlSegundos`. |
| `POST` | `/callback-refirma/:sesionId` | Valida `token` (body) y `hashDocumento` (body); destruye sesión; responde `documentoModificado`, `hashOrigen`, `firmadoEn`. |
| `GET` | `/documento/:documentoId?token=...` | Entrega PDF si token vigente y coincide; 404/401 en caso contrario. |

### Formato de error unificado

```json
{
  "code": "ERR-FIR-422",
  "message": "La solicitud de invocacion a firma es invalida.",
  "category": "Validation",
  "retryable": false,
  "correlationId": "uuid-v4",
  "details": [
    { "campo": "hostPublico", "problema": "El hostPublico debe ser una URL absoluta HTTPS." }
  ]
}
```

---

## 6. Hallazgos sobre la integración oficial RENIEC

> **Nota importante:** La documentación pública de RENIEC (manual `MU-349-GTI/SGIS/146`) y el repositorio histórico `jumanor/refirmainvoker` (deprecated, migrado a `jumanor/firmaperu-invoker`) describen la integración web oficial como **Refirma Invoker local por REST/ClickOnce** (puerto 9091), **no** mediante el esquema URI `refirma://`.

Los nombres exactos de los parámetros (`urlDocumento`, `hashDocumento`, `idSesion`, `urlCallback`) **no han podido validarse contra la especificación oficial** por falta de acceso al manual vigente. La implementación actual sigue el contrato definido en el issue #35 y centraliza las claves en `CLAVES_PAYLOAD` para facilitar ajustes futuros.

**Acción pendiente:** Validar con el equipo de RENIEC / Mesa de Partes el contrato exacto antes de pasar a producción.

---

## 7. Decisiones derivadas

| ID | Decisión | Justificación |
|----|----------|---------------|
| DC-01 | Dominio `src/domains/docucore` separado del MVC | Aislar la complejidad tipográfica y criptográfica; pruebas independientes. |
| DC-02 | Base64URL sin padding para el payload | Evita ambigüedad con `+`/`/`/`=` en query strings; estándar RFC 4648. |
| DC-03 | Clave Redis = SHA-256(token) | El token en claro nunca persiste; `idSesion` en payload deriva del token. |
| DC-04 | `GETDEL` para consumo atómico | Previene race conditions en callbacks duplicados. |
| DC-05 | TTL 300 s fijo, sin renovación | Ventana operativa acotada; reduce superficie de ataque. |
| DC-06 | Lista blanca de hosts en variable de entorno | Configurable por ambiente; evita hardcoding. |
| DC-07 | Fallback a almacen en memoria si no hay Redis | Permite desarrollo y CI sin infraestructura externa. |
| DC-08 | `correlationId` propagado por `X-Correlation-ID` | Trazabilidad end-to-end conforme a convenciones API. |

---

## 8. Referencias

- Issue #35: "Implementar endpoint POST /api/v1/firma/invocar-refirma"
- `backend/docs/integracion/01_convenciones_api_backend.md`
- `backend/docs/integracion/02_catalogo_errores_backend.md`
- `src/domains/docucore/refirmaGateway.service.ts` — `CLAVES_PAYLOAD`, validaciones.
- `src/domains/docucore/firmaSession.store.ts` — `TTL_SESION_FIRMA_SEGUNDOS`, `claveSesionFirma`.
- `src/domains/docucore/a4Generator.service.ts` — `A4_MM`, `MARGEN_MM`, `PUNTOS_POR_MM`.
- Manual RENIEC `MU-349-GTI/SGIS/146` (pendiente de acceso).
- Repositorio `jumanor/firmaperu-invoker` (referencia de invocador local).

---

*Fin del documento.*