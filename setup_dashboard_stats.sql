-- ============================================
-- SCRIPT DE CONFIGURACIÓN PARA DASHBOARD STATS
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- 1. VERIFICAR/CREAR TABLA estado_equipos
-- Esta tabla es CRÍTICA para las estadísticas de equipos
CREATE TABLE IF NOT EXISTS estado_equipos (
  id SERIAL PRIMARY KEY,
  equipo_id INTEGER UNIQUE NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'listo', 'finalizado')),
  proceso_actual_id INTEGER REFERENCES procesos(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_estado_equipos_equipo_id ON estado_equipos(equipo_id);
CREATE INDEX IF NOT EXISTS idx_estado_equipos_estado ON estado_equipos(estado);
CREATE INDEX IF NOT EXISTS idx_estado_equipos_updated_at ON estado_equipos(updated_at);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_estado_equipos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_estado_equipos_updated_at ON estado_equipos;
CREATE TRIGGER trigger_update_estado_equipos_updated_at
  BEFORE UPDATE ON estado_equipos
  FOR EACH ROW
  EXECUTE FUNCTION update_estado_equipos_updated_at();

-- 2. VERIFICAR/CREAR TABLA servicios_documentos
-- Necesita los campos: precio_total, fecha_entrega
CREATE TABLE IF NOT EXISTS servicios_documentos (
  id SERIAL PRIMARY KEY,
  tipo_servicio VARCHAR(50), -- 'transcripcion', 'factura', 'cotizacion'
  estado VARCHAR(20) DEFAULT 'pendiente',
  cliente_id INTEGER REFERENCES clientes(id),
  asignado_a UUID REFERENCES auth.users(id),
  descripcion TEXT,
  archivos JSONB,
  fecha_inicio TIMESTAMP DEFAULT NOW(),
  fecha_entrega TIMESTAMP,
  precio DECIMAL(10,2),
  precio_total DECIMAL(10,2), -- Campo adicional para transcripciones
  adelanto DECIMAL(10,2),
  pago_full BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agregar precio_total si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'servicios_documentos' AND column_name = 'precio_total'
  ) THEN
    ALTER TABLE servicios_documentos ADD COLUMN precio_total DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'servicios_documentos' AND column_name = 'adelanto'
  ) THEN
    ALTER TABLE servicios_documentos ADD COLUMN adelanto DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'servicios_documentos' AND column_name = 'pago_full'
  ) THEN
    ALTER TABLE servicios_documentos ADD COLUMN pago_full BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Índices para servicios_documentos
CREATE INDEX IF NOT EXISTS idx_servicios_documentos_estado ON servicios_documentos(estado);
CREATE INDEX IF NOT EXISTS idx_servicios_documentos_fecha_entrega ON servicios_documentos(fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_servicios_documentos_cliente_id ON servicios_documentos(cliente_id);

-- 3. VERIFICAR/CREAR TABLA pedidos_piezas
CREATE TABLE IF NOT EXISTS pedidos_piezas (
  id SERIAL PRIMARY KEY,
  equipo_id INTEGER REFERENCES equipos(id),
  proveedor_id INTEGER REFERENCES proveedores(id),
  nombre_pieza VARCHAR(255),
  numero_parte VARCHAR(100),
  cantidad INTEGER,
  precio_unitario DECIMAL(10,2),
  estado VARCHAR(20) DEFAULT 'pendiente',
  fecha_pedido TIMESTAMP,
  fecha_estimada_llegada TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para pedidos_piezas
CREATE INDEX IF NOT EXISTS idx_pedidos_piezas_estado ON pedidos_piezas(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_piezas_fecha_estimada ON pedidos_piezas(fecha_estimada_llegada);

-- 4. VERIFICAR/CREAR TABLA comentarios (para actividad reciente)
CREATE TABLE IF NOT EXISTS comentarios (
  id SERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES auth.users(id),
  modulo VARCHAR(50), -- 'equipos', 'documentos', 'logistica'
  referencia_id INTEGER,
  mensaje TEXT,
  archivos JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para comentarios
CREATE INDEX IF NOT EXISTS idx_comentarios_modulo_referencia ON comentarios(modulo, referencia_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_created_at ON comentarios(created_at DESC);

-- 5. VERIFICAR/CREAR TABLA historial_procesos (para actividad reciente)
CREATE TABLE IF NOT EXISTS historial_procesos (
  id SERIAL PRIMARY KEY,
  equipo_id INTEGER REFERENCES equipos(id) ON DELETE CASCADE,
  proceso_id INTEGER REFERENCES procesos(id),
  subproceso_id INTEGER REFERENCES subprocesos(id),
  notas TEXT,
  completado BOOLEAN,
  fecha_completado TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para historial_procesos
CREATE INDEX IF NOT EXISTS idx_historial_procesos_equipo_id ON historial_procesos(equipo_id);
CREATE INDEX IF NOT EXISTS idx_historial_procesos_created_at ON historial_procesos(created_at DESC);

-- 6. POLÍTICAS RLS (Row Level Security)
-- Asegurar que los usuarios puedan leer sus datos

-- Habilitar RLS en las tablas
ALTER TABLE estado_equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_piezas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_procesos ENABLE ROW LEVEL SECURITY;

-- Políticas para estado_equipos (lectura y escritura para usuarios autenticados)
DROP POLICY IF EXISTS "Permitir lectura de estado_equipos" ON estado_equipos;
CREATE POLICY "Permitir lectura de estado_equipos" ON estado_equipos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escritura de estado_equipos" ON estado_equipos;
CREATE POLICY "Permitir escritura de estado_equipos" ON estado_equipos
  FOR ALL USING (auth.role() = 'authenticated');

-- Políticas para servicios_documentos (lectura y escritura para usuarios autenticados)
DROP POLICY IF EXISTS "Permitir lectura de servicios_documentos" ON servicios_documentos;
CREATE POLICY "Permitir lectura de servicios_documentos" ON servicios_documentos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escritura de servicios_documentos" ON servicios_documentos;
CREATE POLICY "Permitir escritura de servicios_documentos" ON servicios_documentos
  FOR ALL USING (auth.role() = 'authenticated');

-- Políticas para pedidos_piezas (lectura y escritura para usuarios autenticados)
DROP POLICY IF EXISTS "Permitir lectura de pedidos_piezas" ON pedidos_piezas;
CREATE POLICY "Permitir lectura de pedidos_piezas" ON pedidos_piezas
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escritura de pedidos_piezas" ON pedidos_piezas;
CREATE POLICY "Permitir escritura de pedidos_piezas" ON pedidos_piezas
  FOR ALL USING (auth.role() = 'authenticated');

-- Políticas para comentarios (lectura y escritura para usuarios autenticados)
DROP POLICY IF EXISTS "Permitir lectura de comentarios" ON comentarios;
CREATE POLICY "Permitir lectura de comentarios" ON comentarios
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escritura de comentarios" ON comentarios;
CREATE POLICY "Permitir escritura de comentarios" ON comentarios
  FOR ALL USING (auth.role() = 'authenticated');

-- Políticas para historial_procesos (lectura y escritura para usuarios autenticados)
DROP POLICY IF EXISTS "Permitir lectura de historial_procesos" ON historial_procesos;
CREATE POLICY "Permitir lectura de historial_procesos" ON historial_procesos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escritura de historial_procesos" ON historial_procesos;
CREATE POLICY "Permitir escritura de historial_procesos" ON historial_procesos
  FOR ALL USING (auth.role() = 'authenticated');

-- 7. VERIFICAR RELACIONES NECESARIAS
-- Asegurar que equipos tiene relación con clientes
DO $$
BEGIN
  -- Verificar si existe la columna cliente_id en equipos
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'equipos' AND column_name = 'cliente_id'
  ) THEN
    ALTER TABLE equipos ADD COLUMN cliente_id INTEGER REFERENCES clientes(id);
  END IF;
END $$;

-- 8. COMENTARIOS PARA DOCUMENTACIÓN
COMMENT ON TABLE estado_equipos IS 'Tabla que almacena el estado actual de cada equipo. Estados: pendiente, en_proceso, listo, finalizado';
COMMENT ON COLUMN estado_equipos.estado IS 'Estado del equipo: pendiente, en_proceso, listo, finalizado';
COMMENT ON COLUMN estado_equipos.updated_at IS 'Última actualización del estado. Usado para calcular días sin movimiento';
COMMENT ON TABLE servicios_documentos IS 'Tabla de documentos y servicios (transcripciones, facturas, cotizaciones)';
COMMENT ON COLUMN servicios_documentos.precio_total IS 'Precio total del servicio (usado para transcripciones)';
COMMENT ON COLUMN servicios_documentos.fecha_entrega IS 'Fecha programada de entrega del documento';
COMMENT ON TABLE pedidos_piezas IS 'Tabla de pedidos de piezas a proveedores';
COMMENT ON COLUMN pedidos_piezas.fecha_estimada_llegada IS 'Fecha estimada de llegada del pedido';
COMMENT ON TABLE comentarios IS 'Comentarios internos para actividad reciente en el dashboard';
COMMENT ON TABLE historial_procesos IS 'Historial de procesos y cambios de estado para actividad reciente';

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================
-- Ejecuta esto para verificar que todo está correcto:

SELECT 
  'estado_equipos' as tabla,
  COUNT(*) as registros,
  (SELECT COUNT(*) FROM estado_equipos WHERE estado = 'listo') as equipos_listos,
  (SELECT COUNT(*) FROM estado_equipos WHERE estado = 'finalizado') as equipos_finalizados
FROM estado_equipos
UNION ALL
SELECT 
  'servicios_documentos' as tabla,
  COUNT(*) as registros,
  (SELECT COUNT(*) FROM servicios_documentos WHERE estado = 'pendiente') as pendientes,
  NULL
FROM servicios_documentos
UNION ALL
SELECT 
  'pedidos_piezas' as tabla,
  COUNT(*) as registros,
  (SELECT COUNT(*) FROM pedidos_piezas WHERE estado = 'pendiente') as pendientes,
  NULL
FROM pedidos_piezas;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. El estado 'listo' debe existir en estado_equipos para que funcionen las alertas de entregas
-- 2. Los campos precio_total y fecha_entrega son opcionales pero recomendados
-- 3. El campo updated_at en estado_equipos se actualiza automáticamente con el trigger
-- 4. Las políticas RLS permiten lectura a todos los usuarios autenticados
-- 5. Los índices mejoran el rendimiento de las consultas del dashboard

