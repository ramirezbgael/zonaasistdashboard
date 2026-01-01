// Supabase Edge Function para enviar mensajes por WhatsApp usando Twilio
// Deploy: supabase functions deploy enviar-whatsapp

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TWILIO_API_URL = "https://api.twilio.com/2010-04-01"

serve(async (req) => {
  try {
    const { telefono, mensaje, api_key, api_secret, numero_whatsapp, notificacion_id, incluir_pdf, equipo_id } = await req.json()

    if (!telefono || !mensaje) {
      return new Response(
        JSON.stringify({ error: "Teléfono y mensaje son requeridos" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Validar credenciales
    if (!api_key || !api_secret || !numero_whatsapp) {
      return new Response(
        JSON.stringify({ error: "Credenciales de Twilio no configuradas" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Formatear teléfono (asegurar formato whatsapp:+521234567890)
    const telefonoFormateado = telefono.startsWith('whatsapp:') 
      ? telefono 
      : `whatsapp:${telefono}`

    // Crear mensaje para Twilio
    const formData = new FormData()
    formData.append("From", numero_whatsapp)
    formData.append("To", telefonoFormateado)
    formData.append("Body", mensaje)

    // Si se requiere enviar PDF, agregar media URL
    if (incluir_pdf && equipo_id) {
      // Aquí deberías generar la URL del PDF desde tu storage
      // Por ahora, solo enviamos el mensaje
      // const pdfUrl = await generarPDFUrl(equipo_id)
      // if (pdfUrl) {
      //   formData.append("MediaUrl", pdfUrl)
      // }
    }

    // Enviar mensaje a Twilio
    const auth = btoa(`${api_key}:${api_secret}`)
    const twilioResponse = await fetch(
      `${TWILIO_API_URL}/Accounts/${api_key}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
        },
        body: formData,
      }
    )

    if (!twilioResponse.ok) {
      const errorData = await twilioResponse.text()
      console.error("Error de Twilio:", errorData)
      return new Response(
        JSON.stringify({ error: "Error al enviar mensaje", details: errorData }),
        { status: twilioResponse.status, headers: { "Content-Type": "application/json" } }
      )
    }

    const twilioData = await twilioResponse.json()

    // Actualizar notificación en la base de datos
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

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
          tipo: "equipo_recepcion", // Ajustar según el tipo
          estado: "enviado",
          incluyo_pdf: incluir_pdf || false
        })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_sid: twilioData.sid,
        status: twilioData.status 
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Error en función:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

