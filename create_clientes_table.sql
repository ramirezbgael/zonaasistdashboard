-- Script para crear la tabla de clientes en Supabase
-- Ejecutar este script en el SQL Editor de Supabase

-- Crear tabla de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  telefono VARCHAR(20),
  email VARCHAR(255),
  direccion TEXT,
  notas TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(telefono) -- Evitar duplicados por teléfono
);

-- Crear índice para búsquedas rápidas por teléfono
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes(telefono);
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre);

-- Agregar columna cliente_id a la tabla equipos
ALTER TABLE equipos 
ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL;

-- Crear índice para la relación
CREATE INDEX IF NOT EXISTS idx_equipos_cliente_id ON equipos(cliente_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura a usuarios autenticados
CREATE POLICY "Permitir lectura de clientes a usuarios autenticados"
ON clientes
FOR SELECT
TO authenticated
USING (true);

-- Política para permitir inserción a usuarios autenticados
CREATE POLICY "Permitir inserción de clientes a usuarios autenticados"
ON clientes
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política para permitir actualización a usuarios autenticados
CREATE POLICY "Permitir actualización de clientes a usuarios autenticados"
ON clientes
FOR UPDATE
TO authenticated
USING (true);

-- Comentarios para documentación
COMMENT ON TABLE clientes IS 'Tabla que almacena información de clientes';
COMMENT ON COLUMN clientes.telefono IS 'Número de teléfono del cliente (único)';
COMMENT ON COLUMN equipos.cliente_id IS 'Referencia al cliente propietario del equipo';

