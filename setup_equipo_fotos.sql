-- Script para crear tabla de fotos de equipos y configurar Storage
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Crear tabla equipo_fotos
CREATE TABLE IF NOT EXISTS equipo_fotos (
  id SERIAL PRIMARY KEY,
  equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id)
);

-- 2. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_equipo_fotos_equipo_id ON equipo_fotos(equipo_id);
CREATE INDEX IF NOT EXISTS idx_equipo_fotos_created_at ON equipo_fotos(created_at DESC);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE equipo_fotos ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para equipo_fotos
-- Permitir lectura a usuarios autenticados
DROP POLICY IF EXISTS "Permitir lectura de equipo_fotos" ON equipo_fotos;
CREATE POLICY "Permitir lectura de equipo_fotos" ON equipo_fotos
  FOR SELECT
  TO authenticated
  USING (true);

-- Permitir inserción a usuarios autenticados
DROP POLICY IF EXISTS "Permitir inserción de equipo_fotos" ON equipo_fotos;
CREATE POLICY "Permitir inserción de equipo_fotos" ON equipo_fotos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Permitir eliminación a usuarios autenticados (opcional, para permitir borrar fotos)
DROP POLICY IF EXISTS "Permitir eliminación de equipo_fotos" ON equipo_fotos;
CREATE POLICY "Permitir eliminación de equipo_fotos" ON equipo_fotos
  FOR DELETE
  TO authenticated
  USING (true);

-- 5. Comentarios
COMMENT ON TABLE equipo_fotos IS 'Fotos de equipos almacenadas en Supabase Storage';
COMMENT ON COLUMN equipo_fotos.url IS 'URL pública de la foto en Supabase Storage';
COMMENT ON COLUMN equipo_fotos.uploaded_by IS 'ID del usuario que subió la foto';

-- NOTA: El bucket "equipos" debe crearse manualmente en Supabase Storage:
-- 1. Ve a Storage en el dashboard de Supabase
-- 2. Crea un nuevo bucket llamado "equipos"
-- 3. Configura como público (Public bucket: ✅)
-- 4. Configura las políticas de Storage (ver más abajo)

-- 6. Políticas de Storage para el bucket "equipos"
-- Ejecutar estas políticas después de crear el bucket en Storage

-- Política: Permitir subir archivos (usuarios autenticados)
DROP POLICY IF EXISTS "Users can upload equipo photos" ON storage.objects;
CREATE POLICY "Users can upload equipo photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'equipos'
);

-- Política: Permitir leer archivos públicos
DROP POLICY IF EXISTS "Equipo photos are publicly accessible" ON storage.objects;
CREATE POLICY "Equipo photos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'equipos');

-- Política: Permitir actualizar archivos propios (opcional)
DROP POLICY IF EXISTS "Users can update own equipo photos" ON storage.objects;
CREATE POLICY "Users can update own equipo photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'equipos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política: Permitir eliminar archivos propios (opcional)
DROP POLICY IF EXISTS "Users can delete own equipo photos" ON storage.objects;
CREATE POLICY "Users can delete own equipo photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'equipos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
