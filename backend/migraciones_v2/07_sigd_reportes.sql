-- =============================================================================
-- Baseline V2, migracion 07: reportes descriptivos de expedientes.
-- Dependencias: 05_sigd_tra.sql y 06_sigd_rut.sql del baseline V2.
-- La transaccion pertenece al migrador; este archivo no la abre ni la cierra.
--
-- Alcance: datos registrados, radicaciones por fecha UTC y distribucion de
-- estados por fuente. No implementa VTEP, TPR, TRO, TEO, SLA ni retencion por
-- area: faltan contratos de cierre efectivo, calendario, plazos y permanencia.
-- No sustituye mv_kpis_mgd_mensual ni mv_tiempos_retencion_area, ni crea
-- refrescar_vistas_mgd(). Sus consumidores requieren adaptacion independiente.
-- =============================================================================

-- Una fila por expediente. La PK de estado_actual_expediente garantiza que el
-- LEFT JOIN no multiplica filas. No se unen asientos ni movimientos historicos.
-- El estado de TramiCore y el proyectado por RutaDoc conservan su propia fuente.
-- La falta de proyeccion no se interpreta como un estado ni como un valor cero.
CREATE VIEW sigd_tra.v_reporte_expedientes_v2 AS
SELECT
    e.expediente_id,
    e.codigo_expediente,
    e.numero,
    e.fecha_radicacion,
    e.fecha_limite,
    e.estado AS estado_tramicore,
    e.area_destino_id,
    (p.expediente_id IS NOT NULL) AS tiene_proyeccion_rutadoc,
    p.estado_nuevo AS estado_rutadoc,
    p.secuencia AS secuencia_ultimo_movimiento,
    p.evento AS evento_ultimo_movimiento,
    p.id_movimiento AS id_ultimo_movimiento,
    p.fecha_hora AS fecha_ultimo_movimiento,
    p.area_actual_id AS referencia_area_rutadoc
FROM sigd_tra.expediente e
LEFT JOIN sigd_rut.estado_actual_expediente p
    ON p.expediente_id = e.expediente_id;

COMMENT ON VIEW sigd_tra.v_reporte_expedientes_v2 IS
    'Una fila por expediente de TramiCore con la proyeccion opcional de RutaDoc; estados separados, sin clasificacion de cierre ni SLA.';
COMMENT ON COLUMN sigd_tra.v_reporte_expedientes_v2.fecha_limite IS
    'Valor registrado por TramiCore; no certifica un plazo legal ni un calendario laboral.';
COMMENT ON COLUMN sigd_tra.v_reporte_expedientes_v2.fecha_ultimo_movimiento IS
    'Instante del ultimo movimiento proyectado, normal o compensatorio; no es una fecha de cierre ni el inicio de permanencia en un area o estado.';
COMMENT ON COLUMN sigd_tra.v_reporte_expedientes_v2.referencia_area_rutadoc IS
    'Referencia TEXT conservada por RutaDoc desde datos.areaId; sin conversion a UUID, resolucion de nombres ni equivalencia con area_destino_id.';

-- UTC es parte explicita del nombre y contrato de esta serie tecnica.
-- No depende de TimeZone de la sesion ni representa el calendario institucional.
-- Incluye todos los expedientes, sin filtrar estados o inferir anulaciones.
-- Solo devuelve fechas con registros; no genera fechas vacias ni rellena ceros.
CREATE VIEW sigd_tra.v_reporte_radicaciones_diarias_utc_v2 AS
SELECT
    (e.fecha_radicacion AT TIME ZONE 'UTC')::date AS fecha_radicacion_utc,
    count(*) AS expedientes_radicados
FROM sigd_tra.expediente e
GROUP BY (e.fecha_radicacion AT TIME ZONE 'UTC')::date;

COMMENT ON VIEW sigd_tra.v_reporte_radicaciones_diarias_utc_v2 IS
    'Conteo BIGINT de expedientes por fecha de radicacion UTC; serie descriptiva sin indicadores de atencion ni calendario laboral.';

-- Distribucion conjunta de los valores registrados en ambas fuentes.
-- No equipara estados de TramiCore con estados de RutaDoc ni define categorias
-- de negocio. NULL en estado_rutadoc conserva la ausencia de proyeccion.
-- Cada expediente participa una sola vez gracias a la cardinalidad de la vista
-- base. No se usa el historial para evitar contar varias veces un expediente.
CREATE VIEW sigd_tra.v_reporte_distribucion_estados_v2 AS
SELECT
    estado_tramicore,
    tiene_proyeccion_rutadoc,
    estado_rutadoc,
    count(*) AS expedientes
FROM sigd_tra.v_reporte_expedientes_v2
GROUP BY estado_tramicore, tiene_proyeccion_rutadoc, estado_rutadoc;

COMMENT ON VIEW sigd_tra.v_reporte_distribucion_estados_v2 IS
    'Conteo BIGINT por estados literales de TramiCore y RutaDoc, distinguiendo expedientes sin proyeccion; sin equivalencias funcionales.';

-- Las tres vistas son normales: se consultan en el snapshot de la sentencia.
-- No requieren REFRESH ni indices de materializacion, y no alteran datos,
-- columnas, indices o triggers de las tablas de los modulos propietarios.
