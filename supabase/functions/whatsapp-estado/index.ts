// Supabase Edge Function para verificar el estado de la sesión de WhatsApp
// Deploy: supabase functions deploy whatsapp-estado

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // Aquí deberías conectar con tu servicio de WhatsApp (whatsapp-web.js, Baileys, etc.)
    // Por ahora, retornamos un estado básico desde la configuración
    
    const { data: config, error: configError } = await supabaseClient
      .from("whatsapp_config")
      .select("*")
      .single()

    if (configError && configError.code !== 'PGRST116') {
      return new Response(
        JSON.stringify({ estado: 'desconectado', activo: false }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    // TODO: Implementar verificación real del estado de WhatsApp
    // Esto requiere un servicio backend que maneje la sesión
    // Ejemplo con whatsapp-web.js o Baileys:
    // const estado = await whatsappService.getEstado()
    
    return new Response(
      JSON.stringify({
        estado: config?.activo ? 'conectado' : 'desconectado',
        numero: config?.numero_whatsapp || null,
        activo: config?.activo || false,
        qr_code: null // Se genera en whatsapp-iniciar
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Error verificando estado:", error)
    return new Response(
      JSON.stringify({ estado: 'desconectado', activo: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

