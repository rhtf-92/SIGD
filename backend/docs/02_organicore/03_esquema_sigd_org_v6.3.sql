CREATE EXTENSION IF NOT EXISTS ltree;

CREATE SCHEMA IF NOT EXISTS sigd_org;

CREATE TABLE IF NOT EXISTS sigd_org.unidad_organica (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sigla VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(255) NOT NULL,
    padre_id UUID REFERENCES sigd_org.unidad_organica(id),
    path ltree NOT NULL,
    estado BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT now(),
    actualizado_en TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_org_path ON sigd_org.unidad_organica USING GIST (path);

CREATE OR REPLACE FUNCTION sigd_org.fn_actualizar_path_cascada()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_path ltree;
    v_old_path ltree;
BEGIN
    -- 1. Validar Ciclo Jerárquico
    IF (NEW.padre_id IS NOT NULL) THEN
        SELECT path INTO v_parent_path FROM sigd_org.unidad_organica WHERE id = NEW.padre_id;
        
        -- Si la unidad intenta ser hija de sí misma o de cualquiera de sus descendientes
        IF (NEW.id IS NOT NULL AND NEW.id <> NEW.padre_id) THEN
            IF EXISTS (
                SELECT 1 FROM sigd_org.unidad_organica 
                WHERE path <@ (SELECT path FROM sigd_org.unidad_organica WHERE id = NEW.id)
                AND id = NEW.padre_id
            ) THEN
                RAISE EXCEPTION 'JERARQUIA_CICLO_INVALIDO: No se puede asignar un padre que sea descendiente de la unidad';
            END IF;
        ELSIF (NEW.id = NEW.padre_id) THEN
            RAISE EXCEPTION 'JERARQUIA_CICLO_INVALIDO: Una unidad no puede ser su propio padre';
        END IF;
    END IF;

    -- 2. Calcular Path en Inserciones
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.padre_id IS NULL) THEN
            NEW.path := CAST(NEW.sigla AS ltree);
        ELSE
            SELECT path || CAST(NEW.sigla AS ltree) INTO v_parent_path 
            FROM sigd_org.unidad_organica WHERE id = NEW.padre_id;
            NEW.path := v_parent_path;
        END IF;
    END IF;

    -- 3. Recalcular Path en cascada ante cambios de padre
    IF (TG_OP = 'UPDATE' AND OLD.padre_id IS DISTINCT FROM NEW.padre_id) THEN
        IF (NEW.padre_id IS NULL) THEN
            NEW.path := CAST(NEW.sigla AS ltree);
        ELSE
            SELECT path || CAST(NEW.sigla AS ltree) INTO v_parent_path 
            FROM sigd_org.unidad_organica WHERE id = NEW.padre_id;
            NEW.path := v_parent_path;
        END IF;

        v_old_path := OLD.path;
        
        -- Actualizar todos los descendientes
        UPDATE sigd_org.unidad_organica
        SET path = v_old_path <@> NEW.path || subpath(path, nlevel(v_old_path))
        WHERE path <@ v_old_path AND id <> NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actualizar_path_cascada
BEFORE INSERT OR UPDATE OF padre_id
ON sigd_org.unidad_organica
FOR EACH ROW EXECUTE FUNCTION sigd_org.fn_actualizar_path_cascada();