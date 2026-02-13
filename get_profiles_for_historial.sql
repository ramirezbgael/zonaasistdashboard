-- Permite obtener nombres de usuarios para el historial del equipo
-- Así cualquier usuario autenticado puede ver quién hizo cada comentario/paso (Brianna, Gael, etc.)
-- Ejecutar en el SQL Editor de Supabase

-- Función que devuelve id, nombre, email, foto_url para una lista de user_ids
-- SECURITY DEFINER = corre con permisos del dueño y puede leer todos los perfiles
CREATE OR REPLACE FUNCTION get_profiles_for_historial(user_ids uuid[])
RETURNS TABLE (id uuid, nombre text, email text, foto_url text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         COALESCE(p.nombre, '')::text,
         COALESCE(p.email, '')::text,
         COALESCE(p.foto_url, '')::text
  FROM profiles p
  WHERE p.id = ANY(user_ids);
$$;

-- Cualquier usuario autenticado puede ejecutar esta función
GRANT EXECUTE ON FUNCTION get_profiles_for_historial(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_profiles_for_historial(uuid[]) TO service_role;

COMMENT ON FUNCTION get_profiles_for_historial(uuid[]) IS
'Obtiene id, nombre, email y foto_url de perfiles para mostrar en el historial de equipos. Necesario para que se vea el nombre real (ej. Brianna) en lugar de "Sistema".';
