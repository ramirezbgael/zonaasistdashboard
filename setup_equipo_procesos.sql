-- Script para crear tabla de relación muchos-a-muchos entre equipos y procesos
-- Esto permite que un equipo tenga múltiples procesos asignados

-- Crear tabla equipo_procesos
CREATE TABLE IF NOT EXISTS equipo_procesos (
  id SERIAL PRIMARY KEY,
  equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  proceso_id INTEGER NOT NULL REFERENCES procesos(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(equipo_id, proceso_id)
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_equipo_procesos_equipo_id ON equipo_procesos(equipo_id);
CREATE INDEX IF NOT EXISTS idx_equipo_procesos_proceso_id ON equipo_procesos(proceso_id);

-- Agregar columna precio a procesos si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'procesos' AND column_name = 'precio'
  ) THEN
    ALTER TABLE procesos ADD COLUMN precio DECIMAL(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Comentarios para documentación
COMMENT ON TABLE equipo_procesos IS 'Tabla de relación muchos-a-muchos entre equipos y procesos. Permite que un equipo tenga múltiples procesos asignados.';
COMMENT ON COLUMN equipo_procesos.equipo_id IS 'ID del equipo';
COMMENT ON COLUMN equipo_procesos.proceso_id IS 'ID del proceso asignado';
COMMENT ON COLUMN procesos.precio IS 'Precio del proceso en pesos mexicanos';

-- Habilitar RLS (Row Level Security)
ALTER TABLE equipo_procesos ENABLE ROW LEVEL SECURITY;

-- Política: Permitir a usuarios autenticados leer y escribir
CREATE POLICY "Users can manage equipo_procesos"
  ON equipo_procesos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
