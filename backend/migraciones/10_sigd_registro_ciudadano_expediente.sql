-- Registros ciudadanos aceptados también se radican como expedientes visibles
-- en la bandeja de Mesa de Partes.

INSERT INTO sigd_doc.tipo_documento
    (codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente)
VALUES
    ('REGISTRO_CIUDADANO', 'Registro de usuario ciudadano', 'pdf', 'application/pdf', 25, FALSE, TRUE)
ON CONFLICT (codigo) DO UPDATE
    SET vigente = TRUE;

INSERT INTO sigd_org.area (codigo, nombre, path, vigente)
VALUES ('MESA_PARTES', 'Mesa de Partes', 'a.MESA_PARTES'::ltree, TRUE)
ON CONFLICT (codigo) DO UPDATE
    SET vigente = TRUE;
