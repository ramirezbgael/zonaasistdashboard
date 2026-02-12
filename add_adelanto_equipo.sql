-- Script para agregar campos de pagos a la tabla equipos
-- Ejecutar este script en el SQL Editor de Supabase

DO $$
BEGIN
  -- Agregar columna adelanto si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipos' AND column_name = 'adelanto'
  ) THEN
    ALTER TABLE equipos ADD COLUMN adelanto DECIMAL(10,2) DEFAULT 0;
    COMMENT ON COLUMN equipos.adelanto IS 'Suma de todos los adelantos pagados por el cliente para este equipo (servicio + refacciones)';
  END IF;
END $$;

