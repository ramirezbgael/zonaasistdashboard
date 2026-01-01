-- ============================================
-- FIX RLS POLICIES - Permitir escritura
-- Ejecutar en el SQL Editor de Supabase
-- ============================================
-- Este script corrige las políticas RLS para permitir INSERT, UPDATE y DELETE

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

-- Verificar que las políticas están activas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('estado_equipos', 'servicios_documentos', 'pedidos_piezas', 'comentarios', 'historial_procesos')
ORDER BY tablename, policyname;

