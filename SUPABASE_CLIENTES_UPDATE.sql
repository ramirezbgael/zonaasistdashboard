-- Script para actualizar la tabla clientes con columna email

-- 1. Agregar columna email si no existe
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 2. Agregar índice para búsquedas por email
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);

-- 3. Opcional: Agregar constraint para validar formato de email
-- Nota: Este constraint es opcional, la validación también se hace en el frontend
ALTER TABLE clientes
DROP CONSTRAINT IF EXISTS check_email_format;

ALTER TABLE clientes
ADD CONSTRAINT check_email_format 
CHECK (
  email IS NULL 
  OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'
);

-- 4. Verificar/Actualizar políticas RLS si es necesario
-- Las políticas existentes deberían seguir funcionando

-- 5. Comentario en la columna (opcional)
COMMENT ON COLUMN clientes.email IS 'Correo electrónico del cliente para envío de comprobantes';

