-- Script para configurar el módulo de WhatsApp
-- Ejecutar este script en el SQL Editor de Supabase

-- Tabla de configuración de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_config (
    id SERIAL PRIMARY KEY,
    api_key TEXT,
    api_secret TEXT,
    numero_whatsapp TEXT,
    estado VARCHAR(20) DEFAULT 'desconectado',
    qr_code TEXT,
    activo BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de mensajes enviados por WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_mensajes (
    id SERIAL PRIMARY KEY,
    notificacion_id UUID REFERENCES notificaciones(id) ON DELETE SET NULL,
    telefono TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    tipo VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'enviado',
    incluyo_pdf BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Agregar columnas a notificaciones para tracking de WhatsApp
ALTER TABLE notificaciones 
ADD COLUMN IF NOT EXISTS enviado_whatsapp BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS fecha_envio_whatsapp TIMESTAMP;

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_notificaciones_enviado_whatsapp ON notificaciones(enviado_whatsapp);
CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo ON notificaciones(tipo);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_notificacion_id ON whatsapp_mensajes(notificacion_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_created_at ON whatsapp_mensajes(created_at);

-- RLS Policies para whatsapp_config (solo usuarios autenticados pueden leer/escribir)
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden leer configuración de WhatsApp"
    ON whatsapp_config FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden actualizar configuración de WhatsApp"
    ON whatsapp_config FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- RLS Policies para whatsapp_mensajes
ALTER TABLE whatsapp_mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden leer mensajes de WhatsApp"
    ON whatsapp_mensajes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar mensajes de WhatsApp"
    ON whatsapp_mensajes FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE whatsapp_config IS 'Configuración de la API de WhatsApp (Twilio u otro servicio)';
COMMENT ON TABLE whatsapp_mensajes IS 'Registro de todos los mensajes enviados por WhatsApp';
COMMENT ON COLUMN notificaciones.enviado_whatsapp IS 'Indica si la notificación fue enviada por WhatsApp';
COMMENT ON COLUMN notificaciones.fecha_envio_whatsapp IS 'Fecha y hora en que se envió la notificación por WhatsApp';

