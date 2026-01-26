-- Script para agregar campo contraseña a la tabla equipos
-- Ejecutar este script en el SQL Editor de Supabase

-- Agregar columna contraseña si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'equipos' AND column_name = 'contraseña'
    ) THEN
        ALTER TABLE equipos ADD COLUMN contraseña VARCHAR(255);
        CREATE INDEX IF NOT EXISTS idx_equipos_contraseña ON equipos(contraseña);
    END IF;
END $$;

-- Comentario
COMMENT ON COLUMN equipos.contraseña IS 'Contraseña del equipo (opcional)';
