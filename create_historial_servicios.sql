-- Script para crear tabla de historial de servicios/compras del cliente
-- Ejecutar este script en el SQL Editor de Supabase
-- 
-- NOTA: Esta tabla es OPCIONAL. Si solo quieres mostrar los equipos del cliente,
-- puedes usar directamente la tabla 'equipos' con su 'cliente_id'.
-- Esta tabla es útil si quieres registrar servicios adicionales, precios, etc.

-- Tabla principal de historial de servicios
CREATE TABLE IF NOT EXISTS historial_servicios (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  equipo_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL,
  tipo_servicio VARCHAR(50) DEFAULT 'reparacion', -- 'reparacion', 'mantenimiento', 'venta', etc.
  descripcion TEXT,
  estado VARCHAR(50) DEFAULT 'pendiente', -- 'pendiente', 'en_proceso', 'completado', 'entregado'
  fecha_recepcion TIMESTAMP DEFAULT NOW(),
  fecha_entrega TIMESTAMP,
  precio DECIMAL(10, 2),
  costo DECIMAL(10, 2),
  notas TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_historial_servicios_cliente_id ON historial_servicios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_historial_servicios_equipo_id ON historial_servicios(equipo_id);
CREATE INDEX IF NOT EXISTS idx_historial_servicios_estado ON historial_servicios(estado);
CREATE INDEX IF NOT EXISTS idx_historial_servicios_fecha_recepcion ON historial_servicios(fecha_recepcion DESC);

-- Habilitar RLS (Row Level Security)
ALTER TABLE historial_servicios ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura a usuarios autenticados
CREATE POLICY "Permitir lectura de historial a usuarios autenticados"
ON historial_servicios
FOR SELECT
TO authenticated
USING (true);

-- Política para permitir inserción a usuarios autenticados
CREATE POLICY "Permitir inserción de historial a usuarios autenticados"
ON historial_servicios
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política para permitir actualización a usuarios autenticados
CREATE POLICY "Permitir actualización de historial a usuarios autenticados"
ON historial_servicios
FOR UPDATE
TO authenticated
USING (true);

-- Comentarios para documentación
COMMENT ON TABLE historial_servicios IS 'Historial completo de servicios/compras por cliente';
COMMENT ON COLUMN historial_servicios.tipo_servicio IS 'Tipo de servicio: reparacion, mantenimiento, venta, etc.';
COMMENT ON COLUMN historial_servicios.estado IS 'Estado del servicio: pendiente, en_proceso, completado, entregado';
COMMENT ON COLUMN historial_servicios.precio IS 'Precio cobrado al cliente';
COMMENT ON COLUMN historial_servicios.costo IS 'Costo interno del servicio';

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_historial_servicios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_historial_servicios_updated_at
BEFORE UPDATE ON historial_servicios
FOR EACH ROW
EXECUTE FUNCTION update_historial_servicios_updated_at();

-- Vista útil para consultar historial completo con información del cliente y equipo
CREATE OR REPLACE VIEW historial_servicios_completo AS
SELECT 
  hs.id,
  hs.cliente_id,
  c.nombre AS cliente_nombre,
  c.telefono AS cliente_telefono,
  c.email AS cliente_email,
  hs.equipo_id,
  e.marca AS equipo_marca,
  e.modelo AS equipo_modelo,
  e.nota AS equipo_nota,
  e.color AS equipo_color,
  hs.tipo_servicio,
  hs.descripcion,
  hs.estado,
  hs.fecha_recepcion,
  hs.fecha_entrega,
  hs.precio,
  hs.costo,
  hs.notas,
  hs.created_at,
  hs.updated_at
FROM historial_servicios hs
LEFT JOIN clientes c ON hs.cliente_id = c.id
LEFT JOIN equipos e ON hs.equipo_id = e.id
ORDER BY hs.fecha_recepcion DESC;

