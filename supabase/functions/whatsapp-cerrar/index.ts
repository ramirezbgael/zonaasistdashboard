// Supabase Edge Function para cerrar sesión de WhatsApp
// Deploy: supabase functions deploy whatsapp-cerrar

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // TODO: Implementar cierre de sesión real
    // await whatsappService.logout()
    // await deleteSession()

    // Actualizar configuración
    await supabaseClient
      .from("whatsapp_config")
      .update({ activo: false })
      .eq("id", 1)

    return new Response(
      JSON.stringify({ success: true, estado: 'desconectado' }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Error cerrando sesión:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

