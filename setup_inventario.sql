-- Script para crear la tabla de inventario de refacciones
-- Ejecutar este script en el SQL Editor de Supabase

-- Crear tabla de inventario de refacciones
CREATE TABLE IF NOT EXISTS inventario_refacciones (
    id SERIAL PRIMARY KEY,
    nombre_pieza VARCHAR(255) NOT NULL,
    numero_parte VARCHAR(100),
    cantidad INTEGER DEFAULT 1,
    costo_unitario DECIMAL(10, 2) NOT NULL,
    proveedor_id INTEGER REFERENCES proveedores(id),
    equipo_id INTEGER REFERENCES equipos(id),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'usada')),
    fecha_compra TIMESTAMP DEFAULT NOW(),
    fecha_uso TIMESTAMP,
    notas TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_inventario_estado ON inventario_refacciones(estado);
CREATE INDEX IF NOT EXISTS idx_inventario_proveedor ON inventario_refacciones(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_inventario_equipo ON inventario_refacciones(equipo_id);
CREATE INDEX IF NOT EXISTS idx_inventario_fecha_compra ON inventario_refacciones(fecha_compra);
CREATE INDEX IF NOT EXISTS idx_inventario_fecha_uso ON inventario_refacciones(fecha_uso);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_inventario_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_inventario_updated_at ON inventario_refacciones;
CREATE TRIGGER trigger_update_inventario_updated_at
    BEFORE UPDATE ON inventario_refacciones
    FOR EACH ROW
    EXECUTE FUNCTION update_inventario_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE inventario_refacciones IS 'Tabla que almacena el inventario de refacciones (pendientes y usadas)';
COMMENT ON COLUMN inventario_refacciones.estado IS 'Estado de la refacción: pendiente (en inventario) o usada';
COMMENT ON COLUMN inventario_refacciones.equipo_id IS 'ID del equipo al que se asoció la refacción cuando se usó';

-- RLS Policies
ALTER TABLE inventario_refacciones ENABLE ROW LEVEL SECURITY;

-- Policy para SELECT: Todos los usuarios autenticados pueden leer
CREATE POLICY "Usuarios autenticados pueden leer inventario"
    ON inventario_refacciones
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy para INSERT: Todos los usuarios autenticados pueden insertar
CREATE POLICY "Usuarios autenticados pueden insertar inventario"
    ON inventario_refacciones
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy para UPDATE: Todos los usuarios autenticados pueden actualizar
CREATE POLICY "Usuarios autenticados pueden actualizar inventario"
    ON inventario_refacciones
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy para DELETE: Todos los usuarios autenticados pueden eliminar
CREATE POLICY "Usuarios autenticados pueden eliminar inventario"
    ON inventario_refacciones
    FOR DELETE
    TO authenticated
    USING (true);

