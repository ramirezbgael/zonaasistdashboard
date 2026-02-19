-- Script para agregar campo descripcion_extra a la tabla equipos
-- Ejecutar este script en el SQL Editor de Supabase

DO $$
BEGIN
  -- Agregar columna descripcion_extra si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipos' AND column_name = 'descripcion_extra'
  ) THEN
    ALTER TABLE equipos ADD COLUMN descripcion_extra TEXT;
    COMMENT ON COLUMN equipos.descripcion_extra IS 'Descripción detallada del monto extra adicional (ej: "Cambio de precio por urgencia", "Servicio adicional de limpieza", etc.)';
  END IF;
END $$;
