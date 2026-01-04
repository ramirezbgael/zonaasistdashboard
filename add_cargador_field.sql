-- Script para agregar el campo 'cargador' a la tabla equipos
-- Ejecutar este script en el SQL Editor de Supabase

-- Agregar columna 'cargador' si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'equipos' 
        AND column_name = 'cargador'
    ) THEN
        ALTER TABLE equipos ADD COLUMN cargador BOOLEAN DEFAULT FALSE;
        
        -- Agregar comentario para documentación
        COMMENT ON COLUMN equipos.cargador IS 'Indica si el cargador se queda con el equipo: true = sí se queda, false = no se queda';
    END IF;
END $$;

