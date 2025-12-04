-- Script para corregir la tabla estado_equipos
-- Ejecutar este script en el SQL Editor de Supabase

-- Verificar si la tabla existe y crearla si no existe
CREATE TABLE IF NOT EXISTS estado_equipos (
  id SERIAL PRIMARY KEY,
  equipo_id INTEGER UNIQUE NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'finalizado')),
  proceso_actual_id INTEGER REFERENCES procesos(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear índice para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_estado_equipos_equipo_id ON estado_equipos(equipo_id);
CREATE INDEX IF NOT EXISTS idx_estado_equipos_estado ON estado_equipos(estado);

-- Asegurar que la restricción única existe
DO $$
BEGIN
    -- Verificar si la restricción única ya existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'estado_equipos_equipo_id_key' 
        AND table_name = 'estado_equipos'
    ) THEN
        -- Si no existe, agregarla
        ALTER TABLE estado_equipos ADD CONSTRAINT estado_equipos_equipo_id_key UNIQUE (equipo_id);
    END IF;
END $$;

-- Comentarios para documentación
COMMENT ON TABLE estado_equipos IS 'Tabla que almacena el estado actual de cada equipo';
COMMENT ON COLUMN estado_equipos.estado IS 'Estado del equipo: pendiente, en_proceso, finalizado';
COMMENT ON COLUMN estado_equipos.proceso_actual_id IS 'ID del proceso que se está ejecutando actualmente';
