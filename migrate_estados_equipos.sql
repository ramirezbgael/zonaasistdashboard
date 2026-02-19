-- Migración: Actualizar sistema de estados de equipos
-- Objetivo: Reemplazar "finalizado" por "ready_for_pickup" y "delivered"
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Agregar columnas ready_at y delivered_at a estado_equipos
DO $$
BEGIN
  -- Agregar ready_at si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estado_equipos' AND column_name = 'ready_at'
  ) THEN
    ALTER TABLE estado_equipos ADD COLUMN ready_at TIMESTAMP;
    COMMENT ON COLUMN estado_equipos.ready_at IS 'Fecha y hora cuando el equipo fue marcado como listo para recoger';
  END IF;

  -- Agregar delivered_at si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estado_equipos' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE estado_equipos ADD COLUMN delivered_at TIMESTAMP;
    COMMENT ON COLUMN estado_equipos.delivered_at IS 'Fecha y hora cuando el equipo fue entregado al cliente';
  END IF;
END $$;

-- 2. Migrar estados existentes: "finalizado" -> "delivered"
-- Si hay estado "finalizado", cambiarlo a "delivered" y establecer delivered_at
UPDATE estado_equipos
SET 
  estado = 'delivered',
  delivered_at = COALESCE(updated_at, created_at)
WHERE estado = 'finalizado';

-- 3. Migrar estados "listo" -> "ready_for_pickup"
-- Si hay estado "listo", cambiarlo a "ready_for_pickup" y establecer ready_at
UPDATE estado_equipos
SET 
  estado = 'ready_for_pickup',
  ready_at = COALESCE(updated_at, created_at)
WHERE estado = 'listo';

-- 4. Actualizar el CHECK constraint para permitir los nuevos estados
-- Primero eliminar el constraint existente si existe
DO $$
BEGIN
  -- Intentar eliminar constraint si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'estado_equipos_estado_check'
    AND table_name = 'estado_equipos'
  ) THEN
    ALTER TABLE estado_equipos DROP CONSTRAINT estado_equipos_estado_check;
  END IF;
END $$;

-- Crear nuevo constraint con los estados correctos
ALTER TABLE estado_equipos 
ADD CONSTRAINT estado_equipos_estado_check 
CHECK (estado IN ('pendiente', 'en_proceso', 'ready_for_pickup', 'delivered', 'cancelled'));

-- 5. Crear índices para mejor rendimiento en queries
CREATE INDEX IF NOT EXISTS idx_estado_equipos_ready_at ON estado_equipos(ready_at);
CREATE INDEX IF NOT EXISTS idx_estado_equipos_delivered_at ON estado_equipos(delivered_at);
CREATE INDEX IF NOT EXISTS idx_estado_equipos_estado_new ON estado_equipos(estado);

-- 6. Comentarios para documentación
COMMENT ON COLUMN estado_equipos.estado IS 'Estado del equipo: pendiente, en_proceso, ready_for_pickup (listo para recoger), delivered (entregado), cancelled';
COMMENT ON COLUMN estado_equipos.ready_at IS 'Timestamp cuando el equipo fue marcado como listo para recoger';
COMMENT ON COLUMN estado_equipos.delivered_at IS 'Timestamp cuando el equipo fue entregado al cliente';
