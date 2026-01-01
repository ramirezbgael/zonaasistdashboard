-- Script para crear la tabla de inventario general
-- Ejecutar este script en el SQL Editor de Supabase

-- Crear tabla de inventario general
CREATE TABLE IF NOT EXISTS inventario (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
        'equipo_venta',
        'refaccion',
        'consumible',
        'papel',
        'tinta',
        'almohadilla',
        'disco_duro',
        'otro'
    )),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    cantidad INTEGER DEFAULT 1 CHECK (cantidad >= 0),
    precio_unitario DECIMAL(10, 2) NOT NULL DEFAULT 0,
    proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
    equipo_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL,
    estado VARCHAR(20) DEFAULT 'disponible' CHECK (estado IN ('disponible', 'usado', 'agotado')),
    numero_serie VARCHAR(100),
    numero_parte VARCHAR(100),
    ubicacion VARCHAR(255),
    fecha_compra TIMESTAMP DEFAULT NOW(),
    fecha_uso TIMESTAMP,
    notas TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_inventario_tipo ON inventario(tipo);
CREATE INDEX IF NOT EXISTS idx_inventario_estado ON inventario(estado);
CREATE INDEX IF NOT EXISTS idx_inventario_proveedor ON inventario(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_inventario_equipo ON inventario(equipo_id);
CREATE INDEX IF NOT EXISTS idx_inventario_fecha_compra ON inventario(fecha_compra);
CREATE INDEX IF NOT EXISTS idx_inventario_fecha_uso ON inventario(fecha_uso);
CREATE INDEX IF NOT EXISTS idx_inventario_nombre ON inventario(nombre);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_inventario_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_inventario_updated_at ON inventario;
CREATE TRIGGER trigger_update_inventario_updated_at
    BEFORE UPDATE ON inventario
    FOR EACH ROW
    EXECUTE FUNCTION update_inventario_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE inventario IS 'Tabla que almacena el inventario general de productos, refacciones y consumibles';
COMMENT ON COLUMN inventario.tipo IS 'Tipo de producto: equipo_venta, refaccion, consumible, papel, tinta, almohadilla, disco_duro, otro';
COMMENT ON COLUMN inventario.estado IS 'Estado del producto: disponible (en inventario), usado, agotado';
COMMENT ON COLUMN inventario.equipo_id IS 'ID del equipo al que se asoció el producto cuando se usó';

-- RLS Policies
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;

-- Policy para SELECT: Todos los usuarios autenticados pueden leer
CREATE POLICY "Usuarios autenticados pueden leer inventario"
    ON inventario
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy para INSERT: Todos los usuarios autenticados pueden insertar
CREATE POLICY "Usuarios autenticados pueden insertar inventario"
    ON inventario
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy para UPDATE: Todos los usuarios autenticados pueden actualizar
CREATE POLICY "Usuarios autenticados pueden actualizar inventario"
    ON inventario
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy para DELETE: Todos los usuarios autenticados pueden eliminar
CREATE POLICY "Usuarios autenticados pueden eliminar inventario"
    ON inventario
    FOR DELETE
    TO authenticated
    USING (true);

