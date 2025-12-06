-- Script para crear las tablas de Documentos y Pedidos en Supabase
-- Ejecutar este script en el SQL Editor de Supabase

-- Tabla de Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    contacto VARCHAR(255),
    telefono VARCHAR(20),
    email VARCHAR(255),
    direccion TEXT,
    sitio_web VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Servicios de Documentos
CREATE TABLE IF NOT EXISTS servicios_documentos (
    id SERIAL PRIMARY KEY,
    tipo_servicio VARCHAR(50) NOT NULL, -- 'transcripcion', 'factura', 'cotizacion', 'otro'
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'completado', 'cancelado')),
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    asignado_a UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    descripcion TEXT,
    archivos JSONB, -- URLs de archivos subidos
    fecha_inicio TIMESTAMP DEFAULT NOW(),
    fecha_entrega TIMESTAMP,
    precio DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Pedidos de Piezas
CREATE TABLE IF NOT EXISTS pedidos_piezas (
    id SERIAL PRIMARY KEY,
    equipo_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL,
    proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
    nombre_pieza VARCHAR(255) NOT NULL,
    numero_parte VARCHAR(100),
    cantidad INTEGER DEFAULT 1,
    precio_unitario DECIMAL(10,2),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_transito', 'recibido', 'completado', 'cancelado')),
    fecha_pedido TIMESTAMP DEFAULT NOW(),
    fecha_estimada_llegada TIMESTAMP,
    fecha_recibido TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_servicios_documentos_estado ON servicios_documentos(estado);
CREATE INDEX IF NOT EXISTS idx_servicios_documentos_cliente ON servicios_documentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_servicios_documentos_asignado ON servicios_documentos(asignado_a);

CREATE INDEX IF NOT EXISTS idx_pedidos_piezas_estado ON pedidos_piezas(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_piezas_proveedor ON pedidos_piezas(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_piezas_equipo ON pedidos_piezas(equipo_id);

-- Habilitar RLS
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_piezas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para proveedores (todos los usuarios autenticados pueden ver/crear)
CREATE POLICY "Users can view proveedores"
    ON proveedores FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert proveedores"
    ON proveedores FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update proveedores"
    ON proveedores FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Políticas RLS para servicios_documentos
CREATE POLICY "Users can view servicios_documentos"
    ON servicios_documentos FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert servicios_documentos"
    ON servicios_documentos FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update servicios_documentos"
    ON servicios_documentos FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Políticas RLS para pedidos_piezas
CREATE POLICY "Users can view pedidos_piezas"
    ON pedidos_piezas FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert pedidos_piezas"
    ON pedidos_piezas FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update pedidos_piezas"
    ON pedidos_piezas FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at
CREATE TRIGGER set_updated_at_servicios_documentos
    BEFORE UPDATE ON servicios_documentos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_pedidos_piezas
    BEFORE UPDATE ON pedidos_piezas
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE servicios_documentos IS 'Tabla que almacena los servicios de documentos y transcripciones';
COMMENT ON TABLE pedidos_piezas IS 'Tabla que almacena los pedidos de piezas a proveedores';
COMMENT ON TABLE proveedores IS 'Tabla que almacena información de proveedores';

