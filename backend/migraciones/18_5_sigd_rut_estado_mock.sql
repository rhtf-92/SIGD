-- FIXME: Mock temporal para validación CI/CD.
-- Dependencia bloqueada por el PR #198. El equipo backend debe proveer la tabla real.
CREATE TABLE IF NOT EXISTS sigd_rut.estado_actual_expediente (
    expediente_id UUID PRIMARY KEY,
    estado_nuevo VARCHAR(50),
    area_actual_id VARCHAR(50)
);