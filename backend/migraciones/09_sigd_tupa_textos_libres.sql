-- Amplía los textos transcritos sin modificar migraciones que pudieran estar aplicadas.
-- Estos campos pueden contener el texto original completo o quedar pendientes de definición.
ALTER TABLE sigd_tupa.tramite_version
    ALTER COLUMN derecho_texto TYPE TEXT,
    ALTER COLUMN plazo_texto DROP NOT NULL;
