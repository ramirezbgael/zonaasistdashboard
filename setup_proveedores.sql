-- Script para crear la tabla proveedores y sus políticas RLS
-- Ejecutar este script en el SQL Editor de Supabase

-- Crear tabla proveedores si no existe
CREATE TABLE IF NOT EXISTS proveedores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    contacto VARCHAR(255),
    telefono VARCHAR(20),
    email VARCHAR(255),
    direccion TEXT,
    sitio_web VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Habilitar RLS en la tabla
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen (para evitar errores al re-ejecutar)
DROP POLICY IF EXISTS "Usuarios autenticados pueden leer proveedores" ON proveedores;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar proveedores" ON proveedores;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar proveedores" ON proveedores;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar proveedores" ON proveedores;

-- Política para lectura: todos los usuarios autenticados pueden leer proveedores
CREATE POLICY "Usuarios autenticados pueden leer proveedores"
ON proveedores
FOR SELECT
TO authenticated
USING (true);

-- Política para inserción: todos los usuarios autenticados pueden insertar proveedores
CREATE POLICY "Usuarios autenticados pueden insertar proveedores"
ON proveedores
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política para actualización: todos los usuarios autenticados pueden actualizar proveedores
CREATE POLICY "Usuarios autenticados pueden actualizar proveedores"
ON proveedores
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Política para eliminación: todos los usuarios autenticados pueden eliminar proveedores
CREATE POLICY "Usuarios autenticados pueden eliminar proveedores"
ON proveedores
FOR DELETE
TO authenticated
USING (true);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre);
CREATE INDEX IF NOT EXISTS idx_proveedores_created_at ON proveedores(created_at);

-- Comentarios para documentación
COMMENT ON TABLE proveedores IS 'Tabla que almacena información de proveedores';
COMMENT ON COLUMN proveedores.nombre IS 'Nombre del proveedor (requerido)';
COMMENT ON COLUMN proveedores.contacto IS 'Nombre de la persona de contacto';
COMMENT ON COLUMN proveedores.telefono IS 'Número de teléfono del proveedor';
COMMENT ON COLUMN proveedores.email IS 'Correo electrónico del proveedor';
COMMENT ON COLUMN proveedores.direccion IS 'Dirección física del proveedor';
COMMENT ON COLUMN proveedores.sitio_web IS 'URL del sitio web del proveedor';

