-- Script para permitir leer perfiles de otros usuarios en el contexto del historial
-- Esto es necesario para mostrar el nombre del agente en los eventos del historial

-- Si la política anterior ya existe, eliminarla primero
DROP POLICY IF EXISTS "Users can view profiles for historial" ON public.profiles;

-- Política: Permitir leer perfiles de otros usuarios (necesario para historial)
-- Solo para SELECT, no para INSERT/UPDATE/DELETE
-- Requiere que el usuario esté autenticado
CREATE POLICY "Users can view profiles for historial"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true); -- Permitir leer todos los perfiles para mostrar en historial

COMMENT ON POLICY "Users can view profiles for historial" ON public.profiles IS 
'Permite a todos los usuarios autenticados leer perfiles de otros usuarios, necesario para mostrar nombres en el historial de eventos';
