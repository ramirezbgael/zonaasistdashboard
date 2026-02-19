-- Script para agregar campo precio_extra a la tabla equipos
-- Ejecutar este script en el SQL Editor de Supabase

DO $$
BEGIN
  -- Agregar columna precio_extra si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipos' AND column_name = 'precio_extra'
  ) THEN
    ALTER TABLE equipos ADD COLUMN precio_extra DECIMAL(10,2) DEFAULT 0;
    COMMENT ON COLUMN equipos.precio_extra IS 'Monto extra adicional al precio de servicios y refacciones (para ajustes de precio, servicios adicionales, etc.)';
  END IF;
END $$;
