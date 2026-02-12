-- Script para agregar sistema de cuenta/saldo a clientes
-- Ejecutar este script en el SQL Editor de Supabase

DO $$
BEGIN
  -- Saldo de cuenta del cliente (prepago)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'cuenta_saldo'
  ) THEN
    ALTER TABLE clientes ADD COLUMN cuenta_saldo DECIMAL(10,2) DEFAULT 0;
    COMMENT ON COLUMN clientes.cuenta_saldo IS 'Saldo en cuenta del cliente (prepago para impresiones u otros servicios).';
  END IF;
END $$;

-- Historial de movimientos de cuenta por cliente
CREATE TABLE IF NOT EXISTS cliente_cuentas_movimientos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL, -- 'deposito', 'cargo', 'ajuste'
  monto DECIMAL(10,2) NOT NULL,
  saldo_despues DECIMAL(10,2) NOT NULL,
  descripcion TEXT,
  referencia_modulo VARCHAR(50), -- 'documento', 'equipo', 'pedido', etc.
  referencia_id INTEGER,
  usuario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cliente_cuentas_cliente_id ON cliente_cuentas_movimientos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_cuentas_created_at ON cliente_cuentas_movimientos(created_at DESC);

-- Habilitar RLS
ALTER TABLE cliente_cuentas_movimientos ENABLE ROW LEVEL SECURITY;

-- Permitir a usuarios autenticados leer e insertar movimientos
CREATE POLICY "Users can view cliente_cuentas_movimientos"
  ON cliente_cuentas_movimientos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert cliente_cuentas_movimientos"
  ON cliente_cuentas_movimientos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

