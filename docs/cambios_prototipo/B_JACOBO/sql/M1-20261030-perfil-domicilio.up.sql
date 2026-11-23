-- PROPUESTA. No ejecutar en bases compartidas sin autorización.
-- El domicilio de cuenta se separa de los datos identificatorios de la persona.
BEGIN;
ALTER TABLE sigd_auth.perfil_usuario
  ADD COLUMN direccion VARCHAR(250),
  ADD COLUMN ubigeo_distrito CHAR(6),
  ADD COLUMN referencia VARCHAR(200);
ALTER TABLE sigd_auth.perfil_usuario ADD CONSTRAINT ck_perfil_domicilio_completo
  CHECK ((direccion IS NULL AND ubigeo_distrito IS NULL AND referencia IS NULL)
    OR (direccion IS NOT NULL AND ubigeo_distrito IS NOT NULL
      AND length(trim(direccion)) BETWEEN 5 AND 250 AND ubigeo_distrito ~ '^25[0-9]{4}$'));
-- El catálogo Ucayali se valida por UbigeoService; no se inventa una FK a otra tabla.
COMMIT;
