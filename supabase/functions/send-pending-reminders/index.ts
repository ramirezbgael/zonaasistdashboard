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

    // 4. RECORDATORIOS DE LICENCIAS DE SOFTWARE (para clientes)
    const hoyFecha = new Date().toISOString().split('T')[0]

    const { data: licenciasPorVencer, error: licError } = await supabase
      .from('licencias_software')
      .select('id, cliente_id, equipo_id, producto, clave, fecha_expira, fecha_recordatorio, recordatorio_enviado')
      .eq('recordatorio_enviado', false)
      .lte('fecha_recordatorio', hoyFecha)

    const licenciasResultados: any[] = []

    if (!licError && licenciasPorVencer && licenciasPorVencer.length > 0) {
      for (const lic of licenciasPorVencer) {
        if (!lic.cliente_id) {
          continue
        }

        // Obtener datos del cliente
        const { data: cliente, error: clienteError } = await supabase
          .from('clientes')
          .select('id, nombre, telefono, email')
          .eq('id', lic.cliente_id)
          .maybeSingle()

        if (clienteError || !cliente) {
          continue
        }

        const telefono = cliente.telefono
        const nombreCliente = cliente.nombre || 'cliente'

        if (!telefono) {
          // Sin teléfono no se puede mandar WhatsApp, pero igual marcamos como enviado para no repetir
          await supabase
            .from('licencias_software')
            .update({
              recordatorio_enviado: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', lic.id)

          continue
        }

        // Construir mensaje para el cliente
        const mensajeLicencia = [
          `Hola ${nombreCliente}!`,
          '',
          `Tu licencia de ${lic.producto} está por vencer pronto.`,
          `Fecha de expiración: ${lic.fecha_expira}`,
          '',
          'Si quieres renovarla, contáctanos para mantener tu Office al día.'
        ].join('\n')

        // Crear notificación específica para licencias por vencer
        const { data: notifLic } = await supabase
          .from('notificaciones')
          .insert({
            usuario_id: null, // notificación pensada para consumo externo hacia el cliente
            tipo: 'licencia_por_vencer',
            titulo: `Licencia de ${lic.producto} por vencer`,
            mensaje: mensajeLicencia,
            datos: {
              licencia_id: lic.id,
              cliente_id: cliente.id,
              equipo_id: lic.equipo_id,
              fecha_expira: lic.fecha_expira,
              telefono: telefono,
              nombre_cliente: nombreCliente
            }
          })
          .select()
          .single()

        // Marcar licencia como ya notificada
        await supabase
          .from('licencias_software')
          .update({
            recordatorio_enviado: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', lic.id)

        licenciasResultados.push({
          licencia_id: lic.id,
          notificacion_id: notifLic?.id ?? null,
          cliente_id: cliente.id,
          telefono: telefono
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        horario: horarioActual,
        usuarios_notificados: resultados.length,
        total_notificaciones: resultados.reduce((sum, r) => sum + (r.items_count || 0), 0),
        resultados,
        licencias_notificadas: licenciasResultados.length,
        licencias_detalle: licenciasResultados
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

