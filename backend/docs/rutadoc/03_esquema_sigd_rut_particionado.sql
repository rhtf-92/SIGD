-- Proyecto SIGD | Grupo 1 — RutaDoc | Fase 2 | Entregable H3
-- Responsable H3: Jhasy | Rama: B_JHASY | PostgreSQL objetivo: versión 18
-- Versión documental: Borrador técnico v0.1
-- BORRADOR TÉCNICO v0.1 — PROTOTIPO EXPERIMENTAL NO APROBADO
-- Base histórica de elaboración: 8fb09da2f1300f5ae75f206938502bcb1e0b06f9.
-- Posteriormente el historial fue reescrito; no es la base vigente.
-- Base vigente de versionado y recuperación oficial de H1/H2:
-- 64a041680fb360103621a83c3750149b3224dbfc.
-- Commit inicial de H3/H4: f3985b99da06c2ab3a0de4fa8e6a0710cb3df0e1.
-- Rama de entrega: B_JHASY. PR actual: #78, B_JHASY hacia B_GERIC,
-- pendiente de revisión e integración.
-- Estado: experimental; no aprobado, no listo para producción; H3 no terminado.
-- Fuentes H1/H2 (rutas relativas a backend/docs/):
--   rutadoc/01_analisis_dominio_transiciones_rutadoc.md
--   rutadoc/02_modelo_datos_rutadoc_v2.md
--   rutadoc/02_diccionario_datos_rutadoc_v2.md
--   rutadoc/05_decisiones_levantamiento_rutadoc.md
--   levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md
--   Plan_de_mejora_nivel_backend_SIGD.md
-- Antecedentes: todos los documentos v1 de rutadoc/, incluido el SQL v1;
-- se conservan intactos y no se asume aprobado su diseño físico.
-- Trazabilidad: H1 8934c54 / integración ade5e03; H2 407d2a6 / 913324d;
-- PR #76: antecedente histórico de integración H1/H2 en la base histórica
-- de elaboración; el PR actual de H3/H4 es #78.
--
-- PENDIENTES: contratos G2 (expediente/CUT), G3 (áreas), G4 (actor/usuario),
-- G5 (documentos/versiones/adjuntos), G6 (Outbox, payload, ownership, despacho);
-- catálogo institucional, rutas paralelas, identidad global, secuencia,
-- idempotencia, concurrencia y escritor definitivo de la proyección.
-- Las decisiones de Geric no se completan mediante suposiciones.
-- Por autorización del alcance v0.1, las referencias externas usan VARCHAR(64),
-- EJEMPLO TÉCNICO NO CONTRACTUAL, en lugar del UUID esperado pero no contratado
-- en H2. id_expediente NO se declara equivalente al CUT; no se inventa su formato.
-- Los UUID internos se suministran explícitamente; no se requieren extensiones.
-- No hay seeds, ENUM, infraestructura externa ni escritor de proyección.
--
-- Instalación controlada: seleccionar previamente una base de laboratorio PG18
-- y ejecutar el archivo completo con un cliente que detenga el proceso al error
-- (por ejemplo psql con ON_ERROR_STOP=1). No crea ni elimina bases de datos.
-- Requiere permiso CREATE en la base; el esquema sigd_rut debe estar ausente.
-- Una segunda instalación falla deliberadamente; no es una migración idempotente.
-- Ante error, efectuar ROLLBACK en la sesión si sigue abierta. El desmontaje
-- posterior a una instalación confirmada está únicamente comentado al final.

BEGIN;

DO $version$
BEGIN
    IF current_setting('server_version_num')::integer / 10000 <> 18 THEN
        RAISE EXCEPTION 'RutaDoc v0.1 requiere PostgreSQL 18 para su evaluación';
    END IF;
END;
$version$;

SET LOCAL TIME ZONE 'UTC';
CREATE SCHEMA sigd_rut;
COMMENT ON SCHEMA sigd_rut IS
    'RutaDoc H3 v0.1: prototipo experimental no aprobado; no listo para producción.';

-- 1. Catálogos vacíos: administrables/versionables, no históricos append-only.
-- 10 estados/13 transiciones: requisito textual del plan específico.
-- 13 estados/16 aristas: inferencia NO CONTRACTUAL del Blueprint.
-- 19 flechas: incluye inicio y terminales. Catálogo institucional PENDIENTE
-- DE RECONCILIACIÓN. No se convierten candidatos H1 ni las 13 acciones v1
-- en seeds, ENUM, CHECK o reglas oficiales. Datos de laboratorio separados en H4.
-- Vigencias permiten extremos abiertos; no prueban ausencia de solapamientos.
-- UNIQUE(codigo) es la propuesta H2 para un código estable, no una implementación
-- completa de versiones del mismo código. No reescribir significado histórico:
-- política de versionado, permisos y preservación semántica pendientes.

CREATE TABLE sigd_rut.accion_tramite (
    accion_tramite_id UUID NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    vigente_desde TIMESTAMPTZ,
    vigente_hasta TIMESTAMPTZ,
    CONSTRAINT pk_accion_tramite PRIMARY KEY (accion_tramite_id),
    CONSTRAINT uq_accion_codigo UNIQUE (codigo),
    CONSTRAINT ck_accion_vigencia CHECK (
        vigente_desde IS NULL OR vigente_hasta IS NULL OR vigente_hasta > vigente_desde
    )
);
COMMENT ON TABLE sigd_rut.accion_tramite IS
    'Catálogo administrable/versionable propuesto; vacío. Política de versionado pendiente; no alterar su significado histórico.';

CREATE TABLE sigd_rut.estado_tramite (
    estado_tramite_id UUID NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    es_terminal BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    vigente_desde TIMESTAMPTZ,
    vigente_hasta TIMESTAMPTZ,
    CONSTRAINT pk_estado_tramite PRIMARY KEY (estado_tramite_id),
    CONSTRAINT uq_estado_codigo UNIQUE (codigo),
    CONSTRAINT ck_estado_vigencia CHECK (
        vigente_desde IS NULL OR vigente_hasta IS NULL OR vigente_hasta > vigente_desde
    )
);
COMMENT ON TABLE sigd_rut.estado_tramite IS
    'Catálogo administrable/versionable propuesto; catálogo institucional pendiente de reconciliación. Sin estados oficiales precargados.';

CREATE TABLE sigd_rut.transicion_estado_tramite (
    transicion_estado_tramite_id UUID NOT NULL,
    estado_anterior_id UUID,
    accion_tramite_id UUID NOT NULL,
    estado_resultante_id UUID NOT NULL,
    condicion_descriptiva TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    vigente_desde TIMESTAMPTZ,
    vigente_hasta TIMESTAMPTZ,
    CONSTRAINT pk_transicion_estado_tramite PRIMARY KEY (transicion_estado_tramite_id),
    CONSTRAINT fk_transicion_anterior FOREIGN KEY (estado_anterior_id)
        REFERENCES sigd_rut.estado_tramite (estado_tramite_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_transicion_accion FOREIGN KEY (accion_tramite_id)
        REFERENCES sigd_rut.accion_tramite (accion_tramite_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_transicion_resultante FOREIGN KEY (estado_resultante_id)
        REFERENCES sigd_rut.estado_tramite (estado_tramite_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_transicion_vigencia CHECK (
        vigente_desde IS NULL OR vigente_hasta IS NULL OR vigente_hasta > vigente_desde
    )
);
COMMENT ON TABLE sigd_rut.transicion_estado_tramite IS
    'Catálogo administrable/versionable REVISABLE. Persistencia, nulabilidad de inicio, reglas y no solapamiento pendientes; no ejecuta condiciones descriptivas.';

CREATE TABLE sigd_rut.tipo_relacion_movimiento (
    tipo_relacion_movimiento_id UUID NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_tipo_relacion_movimiento PRIMARY KEY (tipo_relacion_movimiento_id),
    CONSTRAINT uq_tipo_relacion_codigo UNIQUE (codigo)
);
COMMENT ON TABLE sigd_rut.tipo_relacion_movimiento IS
    'Catálogo administrable/versionable propuesto. Tipos, dirección semántica y mecanismo de versionado pendientes; sin seeds.';

-- 2. Historial particionado. Año calendario UTC EXPERIMENTAL, no año fiscal
-- institucional ni definición final del instante del hecho. Límites semiabiertos
-- con offset explícito; se exige suministrar fecha_hora y UUID al insertar.
-- PostgreSQL 18 exige incluir la clave de partición en PK/UNIQUE del padre.
-- PK(fecha_hora, movimiento_id) NO garantiza movimiento_id globalmente único.
-- UNIQUE(id_expediente, secuencia, fecha_hora) NO garantiza secuencia única global
-- por expediente: admite la misma secuencia en instantes distintos, incluso
-- dentro del mismo año. Agregar fecha_hora a idempotencia tampoco la hace global.
-- No se crean esas UNIQUE engañosas. El mismo expediente puede cruzar 2026–2027.

CREATE TABLE sigd_rut.movimiento_tramite (
    movimiento_id UUID NOT NULL,
    fecha_hora TIMESTAMPTZ NOT NULL,
    id_expediente VARCHAR(64) NOT NULL,
    secuencia BIGINT NOT NULL,
    accion_tramite_id UUID NOT NULL,
    transicion_estado_tramite_id UUID,
    estado_anterior_id UUID,
    estado_resultante_id UUID NOT NULL,
    id_usuario_actor VARCHAR(64),
    id_area_contexto VARCHAR(64),
    observacion TEXT,
    clave_idempotencia VARCHAR(128),
    correlation_id UUID,
    CONSTRAINT pk_movimiento_tramite PRIMARY KEY (fecha_hora, movimiento_id),
    CONSTRAINT ck_movimiento_secuencia CHECK (secuencia > 0),
    CONSTRAINT fk_movimiento_accion FOREIGN KEY (accion_tramite_id)
        REFERENCES sigd_rut.accion_tramite (accion_tramite_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_movimiento_transicion FOREIGN KEY (transicion_estado_tramite_id)
        REFERENCES sigd_rut.transicion_estado_tramite (transicion_estado_tramite_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_movimiento_anterior FOREIGN KEY (estado_anterior_id)
        REFERENCES sigd_rut.estado_tramite (estado_tramite_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_movimiento_resultante FOREIGN KEY (estado_resultante_id)
        REFERENCES sigd_rut.estado_tramite (estado_tramite_id) ON DELETE RESTRICT ON UPDATE RESTRICT
) PARTITION BY RANGE (fecha_hora);
COMMENT ON TABLE sigd_rut.movimiento_tramite IS
    'Histórico append-only particionado anual UTC experimental. Identidad global, secuencia, idempotencia y concurrencia NO garantizadas por este DDL.';
COMMENT ON COLUMN sigd_rut.movimiento_tramite.id_expediente IS
    'EJEMPLO TÉCNICO NO CONTRACTUAL — tipo, identificador y validación pendientes del contrato con el grupo propietario: Grupo 2; tratamiento del CUT pendiente.';
COMMENT ON COLUMN sigd_rut.movimiento_tramite.id_usuario_actor IS
    'EJEMPLO TÉCNICO NO CONTRACTUAL — tipo, identificador y validación pendientes del contrato con el grupo propietario: Grupo 4.';
COMMENT ON COLUMN sigd_rut.movimiento_tramite.id_area_contexto IS
    'EJEMPLO TÉCNICO NO CONTRACTUAL — tipo, identificador y validación pendientes del contrato con el grupo propietario: Grupo 3.';
COMMENT ON COLUMN sigd_rut.movimiento_tramite.clave_idempotencia IS
    'VARCHAR(128) nullable experimental, no contractual; tipo, origen, alcance, nulabilidad y deduplicación global pendientes. No hay UNIQUE de idempotencia.';
COMMENT ON COLUMN sigd_rut.movimiento_tramite.correlation_id IS
    'UUID experimental propuesto en H2; contrato Grupo 6 pendiente. Correlación no equivale a idempotencia ni implementa Outbox.';
COMMENT ON COLUMN sigd_rut.movimiento_tramite.secuencia IS
    'BIGINT positivo experimental; no genera secuencias ni garantiza exclusividad, monotonía o continuidad por expediente.';
COMMENT ON COLUMN sigd_rut.movimiento_tramite.transicion_estado_tramite_id IS
    'FK de existencia solamente: no comprueba correspondencia entre acción, estados, vigencia y transición; reglas institucionales pendientes.';

CREATE TABLE sigd_rut.movimiento_tramite_2026
    PARTITION OF sigd_rut.movimiento_tramite
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
CREATE TABLE sigd_rut.movimiento_tramite_2027
    PARTITION OF sigd_rut.movimiento_tramite
    FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');
COMMENT ON TABLE sigd_rut.movimiento_tramite_2026 IS
    'Partición física del histórico append-only: año 2026 UTC experimental; no es una entidad funcional adicional.';
COMMENT ON TABLE sigd_rut.movimiento_tramite_2027 IS
    'Partición física del histórico append-only: año 2027 UTC experimental; no es una entidad funcional adicional.';
-- Sin partición DEFAULT: un instante fuera de cobertura debe fallar visiblemente.
-- Crear futuras particiones antes del límite, mediante cambio revisado y probado:
-- comprobar límites UTC, ausencia de solapamientos, índices y triggers clonados,
-- bloqueos de mantenimiento y FK existentes. No se automatiza retención/desmonte.

-- 3. Detalles: referencias completas a la PK física; sin exigir el mismo año
-- entre movimientos relacionados. La PK de cada detalle limita ese detalle a
-- una fila por movimiento, pero no impone exclusividad entre tablas detalle,
-- tipo de acción correcto ni obligatoriedad de un detalle: validación pendiente.

CREATE TABLE sigd_rut.derivacion_tramite (
    movimiento_fecha_hora TIMESTAMPTZ NOT NULL,
    movimiento_id UUID NOT NULL,
    id_area_origen VARCHAR(64) NOT NULL,
    id_area_destino VARCHAR(64) NOT NULL,
    motivo TEXT NOT NULL,
    CONSTRAINT pk_derivacion_tramite PRIMARY KEY (movimiento_fecha_hora, movimiento_id),
    CONSTRAINT fk_derivacion_movimiento FOREIGN KEY (movimiento_fecha_hora, movimiento_id)
        REFERENCES sigd_rut.movimiento_tramite (fecha_hora, movimiento_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
COMMENT ON TABLE sigd_rut.derivacion_tramite IS
    'Histórico append-only, detalle REVISABLE. Áreas distintas y reglas de derivación/rutas paralelas pendientes; no se impone desigualdad de referencias externas.';
COMMENT ON COLUMN sigd_rut.derivacion_tramite.id_area_origen IS
    'EJEMPLO TÉCNICO NO CONTRACTUAL — tipo, identificador y validación pendientes del contrato con el grupo propietario: Grupo 3.';
COMMENT ON COLUMN sigd_rut.derivacion_tramite.id_area_destino IS
    'EJEMPLO TÉCNICO NO CONTRACTUAL — tipo, identificador y validación pendientes del contrato con el grupo propietario: Grupo 3.';

CREATE TABLE sigd_rut.recepcion_tramite (
    movimiento_fecha_hora TIMESTAMPTZ NOT NULL,
    movimiento_id UUID NOT NULL,
    derivacion_fecha_hora TIMESTAMPTZ,
    derivacion_movimiento_id UUID,
    id_area_receptora VARCHAR(64),
    observacion_recepcion TEXT,
    CONSTRAINT pk_recepcion_tramite PRIMARY KEY (movimiento_fecha_hora, movimiento_id),
    CONSTRAINT fk_recepcion_movimiento FOREIGN KEY (movimiento_fecha_hora, movimiento_id)
        REFERENCES sigd_rut.movimiento_tramite (fecha_hora, movimiento_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_recepcion_derivacion FOREIGN KEY (derivacion_fecha_hora, derivacion_movimiento_id)
        REFERENCES sigd_rut.derivacion_tramite (movimiento_fecha_hora, movimiento_id)
        MATCH FULL ON DELETE RESTRICT ON UPDATE RESTRICT
);
COMMENT ON TABLE sigd_rut.recepcion_tramite IS
    'Histórico append-only, detalle REVISABLE. MATCH FULL exige referencia a derivación completa o enteramente nula; cardinalidad y recepción manual pendientes, sin UNIQUE de confirmación.';
COMMENT ON COLUMN sigd_rut.recepcion_tramite.id_area_receptora IS
    'EJEMPLO TÉCNICO NO CONTRACTUAL — tipo, identificador y validación pendientes del contrato con el grupo propietario: Grupo 3.';

CREATE TABLE sigd_rut.observacion_tramite (
    movimiento_fecha_hora TIMESTAMPTZ NOT NULL,
    movimiento_id UUID NOT NULL,
    motivo VARCHAR(200) NOT NULL,
    detalle TEXT,
    CONSTRAINT pk_observacion_tramite PRIMARY KEY (movimiento_fecha_hora, movimiento_id),
    CONSTRAINT fk_observacion_movimiento FOREIGN KEY (movimiento_fecha_hora, movimiento_id)
        REFERENCES sigd_rut.movimiento_tramite (fecha_hora, movimiento_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
COMMENT ON TABLE sigd_rut.observacion_tramite IS
    'Histórico append-only, detalle REVISABLE; contenido, obligatoriedad y minimización pendientes.';

CREATE TABLE sigd_rut.atencion_tramite (
    movimiento_fecha_hora TIMESTAMPTZ NOT NULL,
    movimiento_id UUID NOT NULL,
    resultado_resumen TEXT NOT NULL,
    CONSTRAINT pk_atencion_tramite PRIMARY KEY (movimiento_fecha_hora, movimiento_id),
    CONSTRAINT fk_atencion_movimiento FOREIGN KEY (movimiento_fecha_hora, movimiento_id)
        REFERENCES sigd_rut.movimiento_tramite (fecha_hora, movimiento_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
COMMENT ON TABLE sigd_rut.atencion_tramite IS
    'Histórico append-only, detalle REVISABLE; contenido y vínculo documental pendientes.';

CREATE TABLE sigd_rut.relacion_movimiento (
    relacion_movimiento_id UUID NOT NULL,
    origen_fecha_hora TIMESTAMPTZ NOT NULL,
    movimiento_origen_id UUID NOT NULL,
    destino_fecha_hora TIMESTAMPTZ NOT NULL,
    movimiento_destino_id UUID NOT NULL,
    tipo_relacion_movimiento_id UUID NOT NULL,
    motivo TEXT,
    registrado_en TIMESTAMPTZ NOT NULL,
    CONSTRAINT pk_relacion_movimiento PRIMARY KEY (relacion_movimiento_id),
    CONSTRAINT fk_relacion_origen FOREIGN KEY (origen_fecha_hora, movimiento_origen_id)
        REFERENCES sigd_rut.movimiento_tramite (fecha_hora, movimiento_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_relacion_destino FOREIGN KEY (destino_fecha_hora, movimiento_destino_id)
        REFERENCES sigd_rut.movimiento_tramite (fecha_hora, movimiento_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_relacion_tipo FOREIGN KEY (tipo_relacion_movimiento_id)
        REFERENCES sigd_rut.tipo_relacion_movimiento (tipo_relacion_movimiento_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_relacion_distinta CHECK (
        (origen_fecha_hora, movimiento_origen_id) <> (destino_fecha_hora, movimiento_destino_id)
    )
);
COMMENT ON TABLE sigd_rut.relacion_movimiento IS
    'Histórico append-only propuesto. Admite origen/destino en años distintos; CHECK excluye solo la misma identidad física. Semántica, expediente común, dirección y unicidad del vínculo pendientes.';

CREATE TABLE sigd_rut.movimiento_documento (
    movimiento_fecha_hora TIMESTAMPTZ NOT NULL,
    movimiento_id UUID NOT NULL,
    documento_id VARCHAR(64) NOT NULL,
    version_documento_id VARCHAR(64),
    finalidad VARCHAR(50) NOT NULL,
    CONSTRAINT fk_documento_movimiento FOREIGN KEY (movimiento_fecha_hora, movimiento_id)
        REFERENCES sigd_rut.movimiento_tramite (fecha_hora, movimiento_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
COMMENT ON TABLE sigd_rut.movimiento_documento IS
    'Histórico append-only REVISABLE, dependiente del Grupo 5. Sin PK/UNIQUE documental en v0.1: H2 deja pendiente la clave y la semántica de versión nula; admite duplicados, no inventa identidad ni cardinalidad.';
COMMENT ON COLUMN sigd_rut.movimiento_documento.documento_id IS
    'EJEMPLO TÉCNICO NO CONTRACTUAL — tipo, identificador y validación pendientes del contrato con el grupo propietario: Grupo 5.';
COMMENT ON COLUMN sigd_rut.movimiento_documento.version_documento_id IS
    'EJEMPLO TÉCNICO NO CONTRACTUAL — tipo, identificador y validación pendientes del contrato con el grupo propietario: Grupo 5; significado de NULL pendiente.';
COMMENT ON COLUMN sigd_rut.movimiento_documento.finalidad IS
    'Texto experimental sin catálogo, ENUM ni CHECK institucional; valores y reglas pendientes.';

-- 4. Proyección: solo estructura, sin escritor automático en v0.1.
CREATE TABLE sigd_rut.estado_actual_tramite (
    id_expediente VARCHAR(64) NOT NULL,
    movimiento_fecha_hora TIMESTAMPTZ NOT NULL,
    movimiento_actual_id UUID NOT NULL,
    estado_actual_id UUID NOT NULL,
    secuencia_actual BIGINT NOT NULL,
    actualizado_en TIMESTAMPTZ NOT NULL,
    version_proyeccion BIGINT NOT NULL,
    CONSTRAINT pk_estado_actual_tramite PRIMARY KEY (id_expediente),
    CONSTRAINT fk_actual_movimiento FOREIGN KEY (movimiento_fecha_hora, movimiento_actual_id)
        REFERENCES sigd_rut.movimiento_tramite (fecha_hora, movimiento_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_actual_estado FOREIGN KEY (estado_actual_id)
        REFERENCES sigd_rut.estado_tramite (estado_tramite_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_actual_secuencia CHECK (secuencia_actual > 0),
    CONSTRAINT ck_actual_version CHECK (version_proyeccion > 0)
);
COMMENT ON TABLE sigd_rut.estado_actual_tramite IS
    'Proyección mutable y reconstruible, REVISABLE. Requiere un solo escritor físico síncrono: movimiento, detalle y proyección deben confirmar o revertir juntos. Mecanismo pendiente; v0.1 no instala escritor. Consumo asíncrono no puede ser fuente oficial.';
COMMENT ON COLUMN sigd_rut.estado_actual_tramite.id_expediente IS
    'EJEMPLO TÉCNICO NO CONTRACTUAL — tipo, identificador y validación pendientes del contrato con el grupo propietario: Grupo 2; tratamiento del CUT pendiente.';
COMMENT ON COLUMN sigd_rut.estado_actual_tramite.movimiento_actual_id IS
    'La FK física comprueba existencia del par fecha/UUID, no coincidencia de expediente, estado o secuencia ni ausencia de retroceso; consistencia transaccional pendiente.';
COMMENT ON COLUMN sigd_rut.estado_actual_tramite.version_proyeccion IS
    'Contador positivo experimental; sin incremento automático ni garantía de control optimista hasta implementar y probar el único escritor.';
-- Evaluar primero una función explícita en laboratorio por facilitar la prueba
-- de unidad transaccional; comparar trigger mínimo y operación de aplicación.
-- Esta prioridad no aprueba un mecanismo. No habilitar escritores simultáneos.
-- Reconstrucción futura: reproducir historial por expediente y orden validado,
-- contrastar estado/secuencia/movimiento con la proyección; definir coordinación
-- con escrituras activas y política de sustitución antes de ejecutarla.

-- 5. Defensa mínima append-only, reutilizable y sin reglas institucionales.
-- El plan rector cita trg_inmutabilidad_movimiento; H3 implementa realmente
-- tr_movimiento_append_only. Tienen una finalidad funcional relacionada,
-- pero no son el mismo identificador; esta aclaración no renombra el trigger.
-- PostgreSQL 18 clona los triggers de fila del padre en sus particiones,
-- incluidas las que se creen/adjunten después. Verificarlo en H4 también
-- accediendo directamente a cada partición; no duplicar triggers manualmente.
-- No protege contra propietario/administrador, deshabilitación de triggers,
-- TRUNCATE ni DDL. Permisos y política de administración quedan pendientes.
CREATE FUNCTION sigd_rut.fn_rechazar_mutacion_historica()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $append_only$
BEGIN
    RAISE EXCEPTION 'RutaDoc: % rechazado sobre histórico %.%; registre un nuevo hecho',
        TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
        USING ERRCODE = '23001';
END;
$append_only$;
COMMENT ON FUNCTION sigd_rut.fn_rechazar_mutacion_historica() IS
    'Defensa mínima UPDATE/DELETE de históricos. Permite INSERT; no es protección contra propietario o administrador.';

CREATE TRIGGER tr_movimiento_append_only
    BEFORE UPDATE OR DELETE ON sigd_rut.movimiento_tramite
    FOR EACH ROW EXECUTE FUNCTION sigd_rut.fn_rechazar_mutacion_historica();
CREATE TRIGGER tr_derivacion_append_only
    BEFORE UPDATE OR DELETE ON sigd_rut.derivacion_tramite
    FOR EACH ROW EXECUTE FUNCTION sigd_rut.fn_rechazar_mutacion_historica();
CREATE TRIGGER tr_recepcion_append_only
    BEFORE UPDATE OR DELETE ON sigd_rut.recepcion_tramite
    FOR EACH ROW EXECUTE FUNCTION sigd_rut.fn_rechazar_mutacion_historica();
CREATE TRIGGER tr_observacion_append_only
    BEFORE UPDATE OR DELETE ON sigd_rut.observacion_tramite
    FOR EACH ROW EXECUTE FUNCTION sigd_rut.fn_rechazar_mutacion_historica();
CREATE TRIGGER tr_atencion_append_only
    BEFORE UPDATE OR DELETE ON sigd_rut.atencion_tramite
    FOR EACH ROW EXECUTE FUNCTION sigd_rut.fn_rechazar_mutacion_historica();
CREATE TRIGGER tr_relacion_append_only
    BEFORE UPDATE OR DELETE ON sigd_rut.relacion_movimiento
    FOR EACH ROW EXECUTE FUNCTION sigd_rut.fn_rechazar_mutacion_historica();
CREATE TRIGGER tr_documento_append_only
    BEFORE UPDATE OR DELETE ON sigd_rut.movimiento_documento
    FOR EACH ROW EXECUTE FUNCTION sigd_rut.fn_rechazar_mutacion_historica();

-- 6. Alternativas pendientes; NO se crean tablas guardianas ni auxiliares.
-- A) Guardiana local no particionada: evaluar identidad global y serialización
-- por expediente; coste de contención, orden de locks y transacción completa.
-- B) Registro auxiliar de idempotencia: definir alcance/clave, resultado y
-- manejo de reintento concurrente; registrar comando y movimiento atómicamente.
-- C) pg_advisory_xact_lock derivado del expediente: fijar función de mapeo,
-- colisiones y participación de todos los escritores; no garantiza UNIQUE solo.
-- D) Fila propia de RutaDoc y control optimista por versión: estudiar primera
-- escritura sin fila, comparación e incremento atómicos y reintentos completos.
-- E) Cambiar clave/estrategia de partición; medir coste y consecuencias de FK.
-- Garantía por partición no sustituye invariancia global con cruce de años.
-- No bloquear tablas ni filas de TramiCore; RutaDoc no tiene esa autorización.
-- H4 requiere sesiones reales: movimientos/derivaciones simultáneos, secuencia
-- repetida, misma idempotencia, cruce 2026–2027 y contención por expediente.
-- Comparar READ COMMITTED y SERIALIZABLE, intercalados y errores 23505/40001/
-- 40P01; reintentar transacción completa con política acotada por definir.
-- Bloqueo o aislamiento no resuelven solos identidad ni alcance de idempotencia.
-- No se fija nivel de aislamiento de operaciones futuras en este instalador.

-- 7. Índices: solo los automáticos de las 11 PK y 3 UNIQUE declaradas;
-- el padre particionado tiene índice particionado y sus hijos índices físicos.
-- Las FK no crean automáticamente índices en el lado referenciante; su ausencia
-- no invalida integridad, pero puede encarecer comprobaciones y bloqueos.
-- No duplicar índices cubiertos por PK; medir antes de añadir otros de FK.
-- CANDIDATOS APLAZADOS, NO EJECUTADOS NI APROBADOS:
-- Historial: WHERE id_expediente = :e ORDER BY secuencia DESC LIMIT :n.
-- CREATE INDEX ix_mov_exp_seq ON sigd_rut.movimiento_tramite (id_expediente, secuencia DESC);
-- Historial temporal: WHERE id_expediente = :e AND fecha_hora >= :desde
-- AND fecha_hora < :hasta ORDER BY fecha_hora DESC.
-- CREATE INDEX ix_mov_exp_fecha ON sigd_rut.movimiento_tramite (id_expediente, fecha_hora DESC);
-- Área/actor: igualdad y rango temporal; selectividad depende de distribución.
-- CREATE INDEX ix_mov_area_fecha ON sigd_rut.movimiento_tramite (id_area_contexto, fecha_hora);
-- CREATE INDEX ix_mov_actor_fecha ON sigd_rut.movimiento_tramite (id_usuario_actor, fecha_hora);
-- Correlación: WHERE correlation_id = :c; valorar dispersión y tasa de NULL.
-- CREATE INDEX ix_mov_correlacion ON sigd_rut.movimiento_tramite (correlation_id);
-- Rango temporal amplio en partición voluminosa y físicamente correlacionada:
-- CREATE INDEX ix_mov_2026_fecha_brin ON sigd_rut.movimiento_tramite_2026 USING BRIN (fecha_hora);
-- Comparar BRIN con escaneo y B-Tree existente por fecha de la PK; no añadir
-- automáticamente un B-Tree de fecha redundante. Evaluar también 2027.
-- Proyección: WHERE id_expediente = :e ya dispone de la PK.
-- EXPLAIN (ANALYZE, BUFFERS) en H4 con volumen/distribución representativos,
-- dentro/fuera de un año, filtros selectivos y amplios. Conservar candidatos
-- solo si mejora medida compensa almacenamiento/coste de INSERT; descartar
-- redundantes o ineficaces. No hay evidencia de rendimiento en este borrador.

-- 8. Validación pendiente H4: instalación limpia/reinstalación rechazada,
-- rollback de instalación fallida y desmontaje, inventario de objetos,
-- PK/FK/CHECK positivos/negativos, MATCH FULL, UPDATE/DELETE/INSERT en históricos,
-- catálogos y proyección mutables, acceso directo a particiones, límites UTC,
-- enlaces 2026–2027 y referencias inválidas. Demostrar explícitamente que
-- UUID/secuencia/idempotencia repetidos en instantes distintos NO se rechazan
-- por esta estructura. Atomicidad y reconstrucción requieren escritor posterior.
-- Probar concurrencia y rendimiento después; no se inventan resultados.

COMMIT;

-- DESMONTAJE MANUAL EXCLUSIVAMENTE COMENTADO, SOLO PARA LABORATORIO AUTORIZADO.
-- Es destructivo tras COMMIT; no sustituye ROLLBACK de una instalación fallida.
-- Aplicable solo a este borrador sin dependencias posteriores. Revisarlas antes;
-- si aparecen, detenerse, no forzar su eliminación. Triggers se eliminan junto
-- con su tabla. Orden inverso de dependencias, sin eliminar bases de datos.
-- BEGIN;
-- DROP TABLE sigd_rut.estado_actual_tramite;
-- DROP TABLE sigd_rut.movimiento_documento;
-- DROP TABLE sigd_rut.relacion_movimiento;
-- DROP TABLE sigd_rut.atencion_tramite;
-- DROP TABLE sigd_rut.observacion_tramite;
-- DROP TABLE sigd_rut.recepcion_tramite;
-- DROP TABLE sigd_rut.derivacion_tramite;
-- DROP TABLE sigd_rut.movimiento_tramite_2027;
-- DROP TABLE sigd_rut.movimiento_tramite_2026;
-- DROP TABLE sigd_rut.movimiento_tramite;
-- DROP TABLE sigd_rut.tipo_relacion_movimiento;
-- DROP TABLE sigd_rut.transicion_estado_tramite;
-- DROP TABLE sigd_rut.estado_tramite;
-- DROP TABLE sigd_rut.accion_tramite;
-- DROP FUNCTION sigd_rut.fn_rechazar_mutacion_historica();
-- DROP SCHEMA sigd_rut;
-- COMMIT;
