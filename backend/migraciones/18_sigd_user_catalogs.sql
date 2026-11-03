-- Catálogos iniciales para que el alta de personal sea utilizable en una
-- instalación nueva. Los administradores pueden añadir sus unidades y cargos.
-- ON CONFLICT conserva cualquier configuración institucional ya existente.

INSERT INTO sigd_org.area (codigo, nombre, area_padre_id, path)
VALUES
  ('DIR', 'Dirección General', NULL, 'temporal'::ltree),
  ('SEC_ACAD', 'Secretaría Académica', NULL, 'temporal'::ltree),
  ('MESA_PARTES', 'Mesa de Partes', NULL, 'temporal'::ltree)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sigd_org.cargo (codigo, nombre, descripcion)
VALUES
  ('DIRECTOR_GENERAL', 'Director General', 'Titular de la Dirección General.'),
  ('SECRETARIO_ACADEMICO', 'Secretario Académico', 'Responsable de la Secretaría Académica.'),
  ('ESPECIALISTA', 'Especialista', 'Personal especialista de la institución.'),
  ('RESPONSABLE_MESA_PARTES', 'Responsable de Mesa de Partes', 'Personal de recepción y registro documental.'),
  ('ADMINISTRADOR_SISTEMA', 'Administrador del Sistema', 'Responsable técnico de la plataforma SIGD.')
ON CONFLICT (codigo) DO NOTHING;
