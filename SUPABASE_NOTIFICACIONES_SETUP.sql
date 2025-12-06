-- Script para crear tabla de notificaciones y configurar sistema de notificaciones

-- 1. Crear tabla de notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT NOT NULL,
    datos JSONB, -- Datos adicionales (equipo_id, documento_id, etc.)
    leida BOOLEAN DEFAULT FALSE,
    fecha_leida TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(usuario_id, leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_created_at ON notificaciones(created_at DESC);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- 4. Política: Usuarios solo pueden ver sus propias notificaciones
DROP POLICY IF EXISTS "Users can view own notifications" ON notificaciones;
CREATE POLICY "Users can view own notifications"
ON notificaciones FOR SELECT
TO authenticated
USING (auth.uid() = usuario_id);

-- 5. Política: Usuarios solo pueden actualizar sus propias notificaciones
DROP POLICY IF EXISTS "Users can update own notifications" ON notificaciones;
CREATE POLICY "Users can update own notifications"
ON notificaciones FOR UPDATE
TO authenticated
USING (auth.uid() = usuario_id)
WITH CHECK (auth.uid() = usuario_id);

-- 6. Política: Usuarios solo pueden eliminar sus propias notificaciones
DROP POLICY IF EXISTS "Users can delete own notifications" ON notificaciones;
CREATE POLICY "Users can delete own notifications"
ON notificaciones FOR DELETE
TO authenticated
USING (auth.uid() = usuario_id);

-- 7. Política: El sistema puede insertar notificaciones para cualquier usuario
-- Nota: Esto requiere usar service_role key en Edge Functions o triggers
DROP POLICY IF EXISTS "System can insert notifications" ON notificaciones;
CREATE POLICY "System can insert notifications"
ON notificaciones FOR INSERT
TO authenticated
WITH CHECK (true); -- Permitir a usuarios autenticados crear notificaciones

-- 8. Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_notificaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_notificaciones_updated_at ON notificaciones;
CREATE TRIGGER trigger_update_notificaciones_updated_at
BEFORE UPDATE ON notificaciones
FOR EACH ROW
EXECUTE FUNCTION update_notificaciones_updated_at();

-- 10. Función helper para crear notificaciones (opcional, para usar desde Edge Functions o triggers)
CREATE OR REPLACE FUNCTION crear_notificacion(
    p_usuario_id UUID,
    p_tipo VARCHAR,
    p_titulo VARCHAR,
    p_mensaje TEXT,
    p_datos JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notificacion_id UUID;
BEGIN
    INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    VALUES (p_usuario_id, p_tipo, p_titulo, p_mensaje, p_datos)
    RETURNING id INTO v_notificacion_id;
    
    RETURN v_notificacion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Trigger para crear notificación cuando se crea un equipo
CREATE OR REPLACE FUNCTION notificar_equipo_nuevo()
RETURNS TRIGGER AS $$
DECLARE
    v_titulo TEXT;
    v_mensaje TEXT;
BEGIN
    -- Solo notificar si hay un usuario asignado o el creador del equipo
    IF NEW.cliente_id IS NOT NULL THEN
        v_titulo := 'Nuevo Equipo Recibido';
        v_mensaje := 'Se recibió un nuevo equipo: ' || NEW.marca || ' ' || NEW.modelo || ' (#' || NEW.nota || ')';
        
        -- Notificar al usuario actual (o podrías notificar a todos los usuarios)
        -- Por ahora, notificamos al usuario que creó el equipo (si hay forma de obtenerlo)
        -- En una implementación real, podrías tener un campo 'creado_por' en equipos
        
        -- Ejemplo: notificar a todos los usuarios autenticados
        -- Esto requeriría un bucle o una función más compleja
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Nota: Comentar el trigger de arriba si no tienes campo creado_por en equipos
-- En su lugar, las notificaciones se crearán desde el frontend cuando se cree un equipo

-- 12. Comentarios útiles
COMMENT ON TABLE notificaciones IS 'Sistema de notificaciones para usuarios';
COMMENT ON COLUMN notificaciones.tipo IS 'Tipo de notificación: equipo_nuevo, equipo_listo, equipo_finalizado, documento_nuevo, pedido_nuevo, etc.';
COMMENT ON COLUMN notificaciones.datos IS 'JSON con datos adicionales relacionados con la notificación';
COMMENT ON COLUMN notificaciones.leida IS 'Indica si la notificación ha sido leída por el usuario';

