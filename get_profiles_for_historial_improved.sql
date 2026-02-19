-- Versión mejorada: Obtiene nombres de usuarios para el historial
-- Incluye email desde auth.users cuando no hay perfil en profiles
-- Ejecutar en el SQL Editor de Supabase

-- Función mejorada que también obtiene email desde auth.users si no hay perfil
CREATE OR REPLACE FUNCTION get_profiles_for_historial(user_ids uuid[])
RETURNS TABLE (id uuid, nombre text, email text, foto_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p.id, au.id)::uuid as id,
    COALESCE(NULLIF(p.nombre, ''), NULLIF(au.raw_user_meta_data->>'nombre', ''), NULLIF(au.raw_user_meta_data->>'full_name', ''), NULLIF(SPLIT_PART(au.email, '@', 1), ''))::text as nombre,
    COALESCE(NULLIF(p.email, ''), au.email)::text as email,
    COALESCE(NULLIF(p.foto_url, ''), NULLIF(au.raw_user_meta_data->>'avatar_url', ''))::text as foto_url
  FROM unnest(user_ids) as uid
  LEFT JOIN profiles p ON p.id = uid
  LEFT JOIN auth.users au ON au.id = uid
  WHERE uid IS NOT NULL;
END;
$$;

-- Cualquier usuario autenticado puede ejecutar esta función
GRANT EXECUTE ON FUNCTION get_profiles_for_historial(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_profiles_for_historial(uuid[]) TO service_role;

COMMENT ON FUNCTION get_profiles_for_historial(uuid[]) IS
'Obtiene id, nombre, email y foto_url de perfiles para mostrar en el historial. Si no hay perfil en profiles, obtiene el email desde auth.users. Necesario para que se vea el nombre real (ej. Gael) en lugar de "Usuario desconocido".';
