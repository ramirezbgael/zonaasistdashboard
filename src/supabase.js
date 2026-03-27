import { createClient } from '@supabase/supabase-js';

// Usar variables de entorno VITE_ para frontend seguro
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validar que las variables de entorno estén definidas
if (!SUPABASE_URL || SUPABASE_URL === 'tu_url_de_supabase_aqui') {
  console.error('❌ ERROR: VITE_SUPABASE_URL no está configurada.');
  console.error('📝 Por favor, crea un archivo .env en la raíz del proyecto con:');
  console.error('   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co');
  throw new Error('VITE_SUPABASE_URL no está configurada. Revisa tu archivo .env');
}

if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'tu_anon_key_aqui') {
  console.error('❌ ERROR: VITE_SUPABASE_ANON_KEY no está configurada.');
  console.error('📝 Por favor, crea un archivo .env en la raíz del proyecto con:');
  console.error('   VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui');
  throw new Error('VITE_SUPABASE_ANON_KEY no está configurada. Revisa tu archivo .env');
}

// Validación silenciosa en producción
if (import.meta.env.DEV) {
  console.log('✅ Supabase configurado correctamente');
}

// fetch con timeout de 15 s para evitar que las queries queden colgadas
function fetchWithTimeout(input, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: fetchWithTimeout },
  auth: { persistSession: true, autoRefreshToken: true },
});

/**
 * Devuelve el usuario actual leyendo la sesión cacheada localmente.
 * Misma firma que supabase.auth.getUser() pero sin petición de red.
 * Usar siempre este helper en lugar de supabase.auth.getUser().
 */
export async function getCurrentUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { data: { user: session?.user ?? null }, error };
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };

