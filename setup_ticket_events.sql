-- Script para agregar tracking de agentes a historial_procesos
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Agregar columna usuario_id a historial_procesos si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'historial_procesos' AND column_name = 'usuario_id'
    ) THEN
        ALTER TABLE historial_procesos ADD COLUMN usuario_id UUID REFERENCES auth.users(id);
        CREATE INDEX IF NOT EXISTS idx_historial_procesos_usuario_id ON historial_procesos(usuario_id);
    END IF;
END $$;

-- 2. Agregar columna tipo_evento para categorizar eventos
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'historial_procesos' AND column_name = 'tipo_evento'
    ) THEN
        ALTER TABLE historial_procesos ADD COLUMN tipo_evento VARCHAR(50) DEFAULT 'subproceso';
        -- Tipos: 'subproceso', 'nota', 'estado', 'entrega', 'recepcion'
    END IF;
END $$;

-- 3. Comentarios
COMMENT ON COLUMN historial_procesos.usuario_id IS 'ID del usuario/agente que realizó la acción';
COMMENT ON COLUMN historial_procesos.tipo_evento IS 'Tipo de evento: subproceso, nota, estado, entrega, recepcion';

-- 4. Función para obtener eventos de un equipo con información del agente
CREATE OR REPLACE VIEW ticket_events_view AS
SELECT 
    hp.id,
    hp.equipo_id,
    hp.proceso_id,
    hp.subproceso_id,
    hp.usuario_id,
    hp.tipo_evento,
    hp.notas,
    hp.completado,
    hp.fecha_completado,
    hp.created_at,
    p.nombre AS proceso_nombre,
    sp.nombre AS subproceso_nombre,
    pr.id AS profile_id,
    pr.nombre AS agente_nombre,
    pr.foto_url AS agente_avatar
FROM historial_procesos hp
LEFT JOIN procesos p ON hp.proceso_id = p.id
LEFT JOIN subprocesos sp ON hp.subproceso_id = sp.id
LEFT JOIN profiles pr ON hp.usuario_id::text = pr.id::text
ORDER BY hp.created_at DESC;

COMMENT ON VIEW ticket_events_view IS 'Vista de eventos de tickets con información del agente';
