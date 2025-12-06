import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PendingItem {
  id: string;
  tipo: 'equipo' | 'documento' | 'pedido';
  asignado_a: string | null;
  detalles: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Obtener la hora actual para determinar si ya se enviaron notificaciones hoy
    const ahora = new Date()
    const horaActual = ahora.getHours()
    
    // Definir horarios: 9:00, 14:00, 18:00 (3 veces al día)
    const horarios = [9, 14, 18]
    const horarioActual = horarios.find(h => Math.abs(horaActual - h) < 2) // Margen de 2 horas
    
    if (!horarioActual) {
      return new Response(
        JSON.stringify({ message: 'No es hora de enviar recordatorios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Obtener todos los items pendientes
    const pendientes: PendingItem[] = []

    // 1. EQUIPOS PENDIENTES
    const { data: estadoEquiposPendientes, error: equiposError } = await supabase
      .from('estado_equipos')
      .select(`
        equipo_id,
        estado,
        asignado_a,
        equipos!inner(id, marca, modelo, nota, cliente_id)
      `)
      .eq('estado', 'en_proceso')
      .not('asignado_a', 'is', null)

    if (!equiposError && estadoEquiposPendientes) {
      estadoEquiposPendientes.forEach((estadoEquipo: any) => {
        const equipo = estadoEquipo.equipos
        if (estadoEquipo.asignado_a && equipo) {
          pendientes.push({
            id: equipo.id,
            tipo: 'equipo',
            asignado_a: estadoEquipo.asignado_a,
            detalles: {
              marca: equipo.marca,
              modelo: equipo.modelo,
              nota: equipo.nota,
              cliente_id: equipo.cliente_id
            }
          })
        }
      })
    }

    // 2. DOCUMENTOS PENDIENTES
    const { data: documentosPendientes, error: documentosError } = await supabase
      .from('servicios_documentos')
      .select('id, tipo_servicio, cliente_id, asignado_a')
      .eq('estado', 'pendiente')
      .not('asignado_a', 'is', null)

    if (!documentosError && documentosPendientes) {
      documentosPendientes.forEach((doc: any) => {
        pendientes.push({
          id: doc.id,
          tipo: 'documento',
          asignado_a: doc.asignado_a,
          detalles: {
            tipo_servicio: doc.tipo_servicio,
            cliente_id: doc.cliente_id
          }
        })
      })
    }

    // 3. PEDIDOS PENDIENTES
    const { data: pedidosPendientes, error: pedidosError } = await supabase
      .from('pedidos_piezas')
      .select('id, nombre_pieza, proveedor_id, asignado_a')
      .eq('estado', 'pendiente')
      .not('asignado_a', 'is', null)

    if (!pedidosError && pedidosPendientes) {
      pedidosPendientes.forEach((pedido: any) => {
        pendientes.push({
          id: pedido.id,
          tipo: 'pedido',
          asignado_a: pedido.asignado_a,
          detalles: pedido
        })
      })
    }

    // Agrupar por usuario asignado
    const porUsuario = new Map<string, PendingItem[]>()
    pendientes.forEach(item => {
      if (item.asignado_a) {
        if (!porUsuario.has(item.asignado_a)) {
          porUsuario.set(item.asignado_a, [])
        }
        porUsuario.get(item.asignado_a)!.push(item)
      }
    })

    // Verificar si ya se enviaron notificaciones hoy para evitar duplicados
    const hoy = new Date().toISOString().split('T')[0]
    
    // Enviar notificaciones
    const resultados = []
    
    for (const [usuarioId, items] of porUsuario.entries()) {
      // Verificar si ya se envió notificación hoy a este usuario
      const { data: notificacionesHoy } = await supabase
        .from('notificaciones_recordatorios')
        .select('id')
        .eq('usuario_id', usuarioId)
        .eq('fecha', hoy)
        .eq('horario', horarioActual)
        .maybeSingle()

      if (notificacionesHoy) {
        console.log(`Ya se envió recordatorio hoy a usuario ${usuarioId} en horario ${horarioActual}`)
        continue
      }

      // Obtener datos del usuario
      const { data: usuario } = await supabase.auth.admin.getUserById(usuarioId)
      
      if (!usuario?.user) continue

      // Obtener perfil del usuario (teléfono para WhatsApp)
      const { data: perfil } = await supabase
        .from('profiles')
        .select('telefono, nombre, apodo')
        .eq('id', usuarioId)
        .maybeSingle()

      const telefono = perfil?.telefono
      const nombreUsuario = perfil?.apodo || perfil?.nombre || usuario.user.email?.split('@')[0] || 'Usuario'

      // Construir mensaje
      let mensaje = `🔔 *Recordatorio Diario*\n\n`
      mensaje += `Hola ${nombreUsuario}, tienes *${items.length}* elemento${items.length > 1 ? 's' : ''} pendiente${items.length > 1 ? 's' : ''}:\n\n`

      items.forEach(item => {
        if (item.tipo === 'equipo') {
          mensaje += `🔧 *Equipo*: ${item.detalles.marca} ${item.detalles.modelo} (#${item.detalles.nota})\n`
        } else if (item.tipo === 'documento') {
          mensaje += `📄 *Documento*: ${item.detalles.tipo_servicio}\n`
        } else if (item.tipo === 'pedido') {
          mensaje += `📦 *Pedido*: ${item.detalles.nombre_pieza}\n`
        }
      })

      mensaje += `\nRevisa la plataforma para más detalles.`

      // Enviar notificación en la base de datos
      const { data: notificacion } = await supabase
        .from('notificaciones')
        .insert({
          usuario_id: usuarioId,
          tipo: 'recordatorio_diario',
          titulo: `Recordatorio: ${items.length} pendiente${items.length > 1 ? 's' : ''}`,
          mensaje: mensaje.replace(/\*/g, ''), // Sin markdown para la BD
          datos: { items: items.map(i => ({ tipo: i.tipo, id: i.id })) }
        })
        .select()
        .single()

      // Registrar en tabla de tracking
      await supabase
        .from('notificaciones_recordatorios')
        .insert({
          usuario_id: usuarioId,
          fecha: hoy,
          horario: horarioActual,
          items_count: items.length,
          notificacion_id: notificacion?.id
        })

      // Agregar información de teléfono a los datos de la notificación para que el servicio externo lo use
      if (telefono) {
        await supabase
          .from('notificaciones')
          .update({
            datos: {
              ...notificacion?.datos,
              telefono: telefono,
              nombre_usuario: nombreUsuario
            }
          })
          .eq('id', notificacion?.id)
      }

      resultados.push({
        usuario: usuarioId,
        notificacion_creada: true,
        notificacion_id: notificacion?.id,
        items_count: items.length,
        tiene_telefono: !!telefono
      })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        horario: horarioActual,
        usuarios_notificados: resultados.length,
        total_notificaciones: resultados.reduce((sum, r) => sum + (r.items_count || 0), 0),
        resultados 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

