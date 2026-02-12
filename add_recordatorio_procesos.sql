-- Script para agregar campos de recordatorio a la tabla procesos
-- Ejecutar este script en el SQL Editor de Supabase

DO $$
BEGIN
  -- Campo booleano para indicar si el proceso genera recordatorios (por ejemplo, venta de licencias)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'procesos' AND column_name = 'requiere_recordatorio'
  ) THEN
    ALTER TABLE procesos ADD COLUMN requiere_recordatorio BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN procesos.requiere_recordatorio IS 'Indica si este proceso genera recordatorios automáticos (ej. licencias de software).';
  END IF;

  -- Meses de vigencia de la licencia / servicio asociado al proceso
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'procesos' AND column_name = 'meses_vigencia'
  ) THEN
    ALTER TABLE procesos ADD COLUMN meses_vigencia INTEGER;
    COMMENT ON COLUMN procesos.meses_vigencia IS 'Meses de vigencia para recordatorios (ej. 6 para Office barato, 12 para Office caro).';
  END IF;
END $$;

