-- =====================================================
-- SISTEMA PROFESIONAL DE INVENTARIO - ZONA ASIST
-- Modelo de datos completo con auditoría y lógica de negocio
-- =====================================================

-- =====================================================
-- 1. TABLA DE PRODUCTOS BASE
-- =====================================================
CREATE TABLE IF NOT EXISTS inventario_productos (
    id SERIAL PRIMARY KEY,
    codigo_sku VARCHAR(100) UNIQUE, -- Código interno único
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
        'refaccion',
        'consumible',
        'equipo_venta',
        'papel',
        'tinta',
        'almohadilla',
        'disco_duro',
        'otro'
    )),
    categoria VARCHAR(100), -- Para agrupación: 'impresoras', 'computadoras', 'general'
    unidad_medida VARCHAR(20) DEFAULT 'pieza', -- 'pieza', 'metro', 'litro', 'kg'
    
    -- Control de Stock
    stock_actual INTEGER DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo INTEGER DEFAULT 0 CHECK (stock_minimo >= 0),
    stock_maximo INTEGER CHECK (stock_maximo >= 0),
    
    -- Costos y Precios
    costo_promedio DECIMAL(10, 2) DEFAULT 0,
    precio_venta DECIMAL(10, 2),
    
    -- Relaciones
    proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
    ubicacion VARCHAR(255), -- Estante, caja, etc.
    
    -- Control
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_inventario_productos_sku ON inventario_productos(codigo_sku);
CREATE INDEX IF NOT EXISTS idx_inventario_productos_tipo ON inventario_productos(tipo);
CREATE INDEX IF NOT EXISTS idx_inventario_productos_activo ON inventario_productos(activo);
CREATE INDEX IF NOT EXISTS idx_inventario_productos_stock ON inventario_productos(stock_actual);
CREATE INDEX IF NOT EXISTS idx_inventario_productos_categoria ON inventario_productos(categoria);

-- =====================================================
-- 2. TABLA DE MOVIMIENTOS (AUDITORÍA COMPLETA)
-- =====================================================
CREATE TABLE IF NOT EXISTS inventario_movimientos (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES inventario_productos(id) ON DELETE CASCADE,
    
    -- Tipo de Movimiento
    tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN (
        'entrada',
        'salida',
        'ajuste',
        'reserva',
        'cancelacion'
    )),
    
    -- Cantidad y Costo
    cantidad INTEGER NOT NULL,
    costo_unitario DECIMAL(10, 2),
    
    -- Motivo y Referencia
    motivo VARCHAR(100), -- 'compra', 'uso_equipo', 'ajuste_inventario', 'devolucion', 'pedido'
    referencia_tipo VARCHAR(50), -- 'equipo', 'pedido', 'trabajo', 'documento', 'manual'
    referencia_id INTEGER, -- ID del equipo, pedido, etc.
    
    -- Auditoría
    usuario_id UUID REFERENCES auth.users(id),
    equipo_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL,
    
    -- Notas
    notas TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON inventario_movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON inventario_movimientos(tipo_movimiento);
CREATE INDEX IF NOT EXISTS idx_movimientos_referencia ON inventario_movimientos(referencia_tipo, referencia_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_equipo ON inventario_movimientos(equipo_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON inventario_movimientos(created_at DESC);

-- =====================================================
-- 3. TABLA DE RESERVAS (STOCK RESERVADO)
-- =====================================================
CREATE TABLE IF NOT EXISTS inventario_reservas (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES inventario_productos(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    
    -- Relación con Equipo
    equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    
    -- Estado de la Reserva
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN (
        'pendiente',
        'confirmada',
        'usada',
        'cancelada'
    )),
    
    -- Auditoría
    usuario_id UUID REFERENCES auth.users(id),
    
    -- Fechas
    fecha_reserva TIMESTAMP DEFAULT NOW(),
    fecha_vencimiento TIMESTAMP, -- Auto-cancelar si pasa mucho tiempo
    fecha_uso TIMESTAMP, -- Cuando se convierte en movimiento
    
    -- Notas
    notas TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reservas_producto ON inventario_reservas(producto_id);
CREATE INDEX IF NOT EXISTS idx_reservas_equipo ON inventario_reservas(equipo_id);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON inventario_reservas(estado);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON inventario_reservas(fecha_reserva DESC);

-- =====================================================
-- 4. TABLA DE AJUSTES (CONTEOS FÍSICOS)
-- =====================================================
CREATE TABLE IF NOT EXISTS inventario_ajustes (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES inventario_productos(id) ON DELETE CASCADE,
    
    -- Valores
    cantidad_anterior INTEGER NOT NULL,
    cantidad_nueva INTEGER NOT NULL,
    diferencia INTEGER GENERATED ALWAYS AS (cantidad_nueva - cantidad_anterior) STORED,
    
    -- Motivo
    motivo VARCHAR(100) NOT NULL, -- 'conteo_fisico', 'perdida', 'robo', 'deterioro', 'sobrante'
    
    -- Auditoría
    usuario_id UUID REFERENCES auth.users(id),
    notas TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ajustes_producto ON inventario_ajustes(producto_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_fecha ON inventario_ajustes(created_at DESC);

-- =====================================================
-- 5. FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_inventario_productos_updated_at
    BEFORE UPDATE ON inventario_productos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventario_reservas_updated_at
    BEFORE UPDATE ON inventario_reservas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Función para recalcular costo promedio
CREATE OR REPLACE FUNCTION recalcular_costo_promedio(p_producto_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_costo_promedio DECIMAL(10, 2);
    v_stock_total INTEGER;
BEGIN
    -- Calcular costo promedio ponderado basado en entradas
    SELECT 
        COALESCE(SUM(cantidad * costo_unitario) / NULLIF(SUM(cantidad), 0), 0),
        SUM(cantidad)
    INTO v_costo_promedio, v_stock_total
    FROM inventario_movimientos
    WHERE producto_id = p_producto_id
    AND tipo_movimiento = 'entrada'
    AND costo_unitario IS NOT NULL
    AND costo_unitario > 0;
    
    -- Actualizar producto
    UPDATE inventario_productos
    SET costo_promedio = COALESCE(v_costo_promedio, costo_promedio)
    WHERE id = p_producto_id;
END;
$$ LANGUAGE plpgsql;

-- Función para validar stock antes de reservar
CREATE OR REPLACE FUNCTION validar_stock_disponible(
    p_producto_id INTEGER,
    p_cantidad INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_stock_actual INTEGER;
    v_stock_reservado INTEGER;
    v_stock_disponible INTEGER;
BEGIN
    -- Obtener stock actual
    SELECT stock_actual INTO v_stock_actual
    FROM inventario_productos
    WHERE id = p_producto_id AND activo = true;
    
    -- Calcular stock reservado (pendiente o confirmada)
    SELECT COALESCE(SUM(cantidad), 0) INTO v_stock_reservado
    FROM inventario_reservas
    WHERE producto_id = p_producto_id
    AND estado IN ('pendiente', 'confirmada');
    
    -- Stock disponible = actual - reservado
    v_stock_disponible := v_stock_actual - v_stock_reservado;
    
    RETURN v_stock_disponible >= p_cantidad;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. VISTAS ÚTILES
-- =====================================================

-- Vista: Productos con estado calculado
CREATE OR REPLACE VIEW inventario_productos_estado AS
SELECT 
    p.*,
    COALESCE(SUM(CASE WHEN r.estado IN ('pendiente', 'confirmada') THEN r.cantidad ELSE 0 END), 0) as stock_reservado,
    (p.stock_actual - COALESCE(SUM(CASE WHEN r.estado IN ('pendiente', 'confirmada') THEN r.cantidad ELSE 0 END), 0)) as stock_disponible,
    CASE 
        WHEN p.stock_actual = 0 THEN 'agotado'
        WHEN p.stock_actual < p.stock_minimo THEN 'bajo_minimo'
        WHEN EXISTS (
            SELECT 1 FROM inventario_reservas r2 
            WHERE r2.producto_id = p.id 
            AND r2.estado IN ('pendiente', 'confirmada')
        ) THEN 'reservado'
        ELSE 'disponible'
    END as estado_producto,
    (p.stock_actual * p.costo_promedio) as valor_total
FROM inventario_productos p
LEFT JOIN inventario_reservas r ON r.producto_id = p.id
WHERE p.activo = true
GROUP BY p.id;

-- Vista: Alertas de inventario
CREATE OR REPLACE VIEW inventario_alertas AS
SELECT 
    p.id,
    p.nombre,
    p.codigo_sku,
    p.stock_actual,
    p.stock_minimo,
    p.tipo,
    CASE 
        WHEN p.stock_actual = 0 THEN 'agotado'
        WHEN p.stock_actual < p.stock_minimo THEN 'bajo_minimo'
    END as tipo_alerta,
    (p.stock_minimo - p.stock_actual) as cantidad_faltante
FROM inventario_productos p
WHERE p.activo = true
AND (p.stock_actual = 0 OR p.stock_actual < p.stock_minimo)
ORDER BY 
    CASE WHEN p.stock_actual = 0 THEN 1 ELSE 2 END,
    cantidad_faltante DESC;

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================

-- Habilitar RLS
ALTER TABLE inventario_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_ajustes ENABLE ROW LEVEL SECURITY;

-- Policies para inventario_productos
CREATE POLICY "Usuarios autenticados pueden leer productos"
    ON inventario_productos FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar productos"
    ON inventario_productos FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar productos"
    ON inventario_productos FOR UPDATE
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar productos"
    ON inventario_productos FOR DELETE
    TO authenticated USING (true);

-- Policies para inventario_movimientos
CREATE POLICY "Usuarios autenticados pueden leer movimientos"
    ON inventario_movimientos FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar movimientos"
    ON inventario_movimientos FOR INSERT
    TO authenticated WITH CHECK (true);

-- Policies para inventario_reservas
CREATE POLICY "Usuarios autenticados pueden leer reservas"
    ON inventario_reservas FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar reservas"
    ON inventario_reservas FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar reservas"
    ON inventario_reservas FOR UPDATE
    TO authenticated USING (true) WITH CHECK (true);

-- Policies para inventario_ajustes
CREATE POLICY "Usuarios autenticados pueden leer ajustes"
    ON inventario_ajustes FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar ajustes"
    ON inventario_ajustes FOR INSERT
    TO authenticated WITH CHECK (true);

-- =====================================================
-- 8. COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE inventario_productos IS 'Productos base del inventario con control de stock';
COMMENT ON TABLE inventario_movimientos IS 'Auditoría completa de todas las entradas y salidas';
COMMENT ON TABLE inventario_reservas IS 'Stock reservado para trabajos pendientes';
COMMENT ON TABLE inventario_ajustes IS 'Ajustes de inventario (conteos físicos, pérdidas)';

COMMENT ON COLUMN inventario_productos.codigo_sku IS 'Código único interno del producto';
COMMENT ON COLUMN inventario_movimientos.tipo_movimiento IS 'Tipo: entrada, salida, ajuste, reserva, cancelacion';
COMMENT ON COLUMN inventario_reservas.estado IS 'Estado: pendiente, confirmada, usada, cancelada';

