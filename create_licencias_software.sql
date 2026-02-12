-- Script para crear tabla de licencias de software con recordatorios
-- Ejecutar este script en el SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS licencias_software (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  equipo_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL,
  proceso_id INTEGER REFERENCES procesos(id) ON DELETE SET NULL,
  producto VARCHAR(255) NOT NULL, -- Ej: Office barato, Office caro, etc.
  clave VARCHAR(255) NOT NULL,    -- Clave / licencia
  meses_vigencia INTEGER NOT NULL, -- 6 meses, 12 meses, etc.
  fecha_activacion DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_expira DATE NOT NULL,
  fecha_recordatorio DATE NOT NULL, -- Fecha en la que se debe disparar el recordatorio
  recordatorio_enviado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_licencias_equipo_id ON licencias_software(equipo_id);
CREATE INDEX IF NOT EXISTS idx_licencias_cliente_id ON licencias_software(cliente_id);
CREATE INDEX IF NOT EXISTS idx_licencias_fecha_recordatorio ON licencias_software(fecha_recordatorio);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_licencias_software_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_licencias_software_updated_at ON licencias_software;
CREATE TRIGGER trigger_update_licencias_software_updated_at
  BEFORE UPDATE ON licencias_software
  FOR EACH ROW
  EXECUTE FUNCTION update_licencias_software_updated_at();

-- Habilitar RLS
ALTER TABLE licencias_software ENABLE ROW LEVEL SECURITY;

-- Políticas básicas: todos los usuarios autenticados pueden leer y escribir
CREATE POLICY "Usuarios autenticados pueden leer licencias"
  ON licencias_software
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar licencias"
  ON licencias_software
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar licencias"
  ON licencias_software
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

