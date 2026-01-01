// Supabase Edge Function para enviar mensajes por WhatsApp
// Deploy: supabase functions deploy whatsapp-enviar

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { telefono, mensaje, notificacion_id, tipo, incluir_pdf, equipo_id } = await req.json()

    if (!telefono || !mensaje) {
      return new Response(
        JSON.stringify({ error: "Teléfono y mensaje son requeridos" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // TODO: Implementar envío real de mensaje
    // Esto requiere conectar con tu servicio de WhatsApp (whatsapp-web.js, Baileys, etc.)
    // 
    // Ejemplo:
    // const whatsapp = await getWhatsAppClient()
    // await whatsapp.sendMessage(telefono, mensaje)
    // 
    // Si incluir_pdf es true, también enviar el PDF:
    // if (incluir_pdf && equipo_id) {
    //   const pdfUrl = await generarPDFUrl(equipo_id)
    //   await whatsapp.sendMessage(telefono, { document: pdfUrl, mimetype: 'application/pdf' })
    // }

    // Por ahora, simulamos el envío exitoso
    console.log(`Enviando mensaje a ${telefono}: ${mensaje}`)

    // Actualizar notificación en la base de datos
    if (notificacion_id) {
      await supabaseClient
        .from("notificaciones")
        .update({ 
          enviado_whatsapp: true, 
          fecha_envio_whatsapp: new Date().toISOString() 
        })
        .eq("id", notificacion_id)

      // Guardar registro del mensaje
      await supabaseClient
        .from("whatsapp_mensajes")
        .insert({
          notificacion_id,
          telefono,
          mensaje,
          tipo: tipo || 'equipo_recepcion',
          estado: "enviado",
          incluyo_pdf: incluir_pdf || false
        })
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Mensaje enviado correctamente"
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Error enviando mensaje:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

