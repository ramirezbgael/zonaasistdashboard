-- Script para configurar notificaciones automáticas por WhatsApp
-- Este script crea las tablas y funciones necesarias para el sistema de recordatorios

-- 1. Tabla para tracking de recordatorios enviados (evitar duplicados)
CREATE TABLE IF NOT EXISTS notificaciones_recordatorios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    horario INTEGER NOT NULL CHECK (horario IN (9, 14, 18)), -- Horarios: 9am, 2pm, 6pm
    items_count INTEGER NOT NULL DEFAULT 0,
    notificacion_id UUID REFERENCES notificaciones(id) ON DELETE SET NULL,
    whatsapp_enviado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(usuario_id, fecha, horario) -- Un recordatorio por usuario, fecha y horario
);

-- 2. Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_recordatorios_usuario_fecha ON notificaciones_recordatorios(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_recordatorios_fecha_horario ON notificaciones_recordatorios(fecha, horario);

-- 3. Agregar campo telefono a profiles si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'telefono'
    ) THEN
        ALTER TABLE profiles ADD COLUMN telefono VARCHAR(20);
        CREATE INDEX IF NOT EXISTS idx_profiles_telefono ON profiles(telefono);
    END IF;
END $$;

-- 4. Agregar campo asignado_a a estado_equipos si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'estado_equipos' AND column_name = 'asignado_a'
    ) THEN
        ALTER TABLE estado_equipos ADD COLUMN asignado_a UUID REFERENCES auth.users(id);
        CREATE INDEX IF NOT EXISTS idx_estado_equipos_asignado ON estado_equipos(asignado_a);
    END IF;
END $$;

-- 5. Agregar campo asignado_a a pedidos_piezas si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pedidos_piezas' AND column_name = 'asignado_a'
    ) THEN
        ALTER TABLE pedidos_piezas ADD COLUMN asignado_a UUID REFERENCES auth.users(id);
        CREATE INDEX IF NOT EXISTS idx_pedidos_asignado ON pedidos_piezas(asignado_a);
    END IF;
END $$;

-- 6. Habilitar RLS en notificaciones_recordatorios
ALTER TABLE notificaciones_recordatorios ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS para notificaciones_recordatorios
DROP POLICY IF EXISTS "Users can view own reminders" ON notificaciones_recordatorios;
CREATE POLICY "Users can view own reminders"
ON notificaciones_recordatorios FOR SELECT
TO authenticated
USING (auth.uid() = usuario_id);

-- 8. Función para obtener usuarios con items pendientes (helper)
CREATE OR REPLACE FUNCTION obtener_usuarios_con_pendientes()
RETURNS TABLE (
    usuario_id UUID,
    equipos_count BIGINT,
    documentos_count BIGINT,
    pedidos_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(e.asignado_a, d.asignado_a, p.asignado_a) as usuario_id,
        COUNT(DISTINCT e.id) FILTER (WHERE e.id IS NOT NULL) as equipos_count,
        COUNT(DISTINCT d.id) FILTER (WHERE d.id IS NOT NULL) as documentos_count,
        COUNT(DISTINCT p.id) FILTER (WHERE p.id IS NOT NULL) as pedidos_count
    FROM estado_equipos e
    FULL OUTER JOIN servicios_documentos d ON e.asignado_a = d.asignado_a AND d.estado = 'pendiente'
    FULL OUTER JOIN pedidos_piezas p ON COALESCE(e.asignado_a, d.asignado_a) = p.asignado_a AND p.estado = 'pendiente'
    WHERE (e.estado = 'en_proceso' OR d.estado = 'pendiente' OR p.estado = 'pendiente')
        AND COALESCE(e.asignado_a, d.asignado_a, p.asignado_a) IS NOT NULL
    GROUP BY COALESCE(e.asignado_a, d.asignado_a, p.asignado_a)
    HAVING COUNT(DISTINCT e.id) + COUNT(DISTINCT d.id) + COUNT(DISTINCT p.id) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Comentarios
COMMENT ON TABLE notificaciones_recordatorios IS 'Tracking de recordatorios diarios enviados para evitar duplicados';
COMMENT ON COLUMN notificaciones_recordatorios.horario IS 'Horario de envío: 9 (9am), 14 (2pm), 18 (6pm)';
COMMENT ON COLUMN profiles.telefono IS 'Número de teléfono para WhatsApp (formato internacional: +521234567890)';

