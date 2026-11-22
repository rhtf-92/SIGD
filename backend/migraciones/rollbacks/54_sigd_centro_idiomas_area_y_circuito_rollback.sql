-- Rollback de Migración 54
UPDATE sigd_org.area SET vigente = false WHERE codigo = 'CI';
