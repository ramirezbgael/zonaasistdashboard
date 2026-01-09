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

console.log('✅ Supabase configurado correctamente');
console.log('📍 URL:', SUPABASE_URL);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { SUPABASE_URL, SUPABASE_ANON_KEY };

