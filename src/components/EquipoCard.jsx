import PendienteItem from './PendienteItem.jsx';
import './EquipoCard.css';

export default function EquipoCard({ equipo, reload, onClick, activeTab }) {
  const nota = equipo.nota.toString();
  
  // Función para convertir nombre de color a valor hexadecimal
  const getColorFromName = (colorName) => {
    const colorMap = {
      // Colores básicos
      'negro': '#2c2c2c',
      'blanco': '#f8f9fa',
      'gris': '#6c757d',
      'azul': '#007bff',
      'rojo': '#dc3545',
      'verde': '#28a745',
      'amarillo': '#ffc107',
      'naranja': '#fd7e14',
      'morado': '#6f42c1',
      'rosa': '#e83e8c',
      'celeste': '#17a2b8',
      'plata': '#6c757d',
      'dorado': '#ffc107',
      // Variaciones
      'azul marino': '#001f3f',
      'azul claro': '#87ceeb',
      'verde claro': '#90ee90',
      'gris claro': '#d3d3d3',
      'gris oscuro': '#495057',
      'rojo oscuro': '#8b0000',
      'negro mate': '#1a1a1a',
      'blanco perla': '#faf0e6'
    };
    
    const normalizedColor = colorName.toLowerCase().trim();
    return colorMap[normalizedColor] || '#3498db'; // Color por defecto si no se encuentra
  };

  // Usar el color del equipo
  const cardColor = getColorFromName(equipo.color);

  // Funciones para botones de equipos listos
  const handleLlamarCliente = (e) => {
    e.stopPropagation(); // Evitar que abra el modal
    
    // Solicitar número de teléfono si no está guardado
    const telefono = prompt(`Ingresa el número de teléfono del cliente (Equipo #${equipo.nota}):`);
    
    if (!telefono) return;
    
    // Limpiar el número (solo dígitos)
    const numeroLimpio = telefono.replace(/\D/g, '');
    
    const opcion = window.confirm('¿Cómo deseas contactar al cliente?\n\nOK = Llamar por teléfono\nCancelar = Enviar WhatsApp');
    
    if (opcion) {
      // Abrir marcador de teléfono
      window.open(`tel:${numeroLimpio}`, '_self');
    } else {
      // Abrir WhatsApp con mensaje predefinido
      const mensaje = encodeURIComponent(`Hola! Te escribo de Zona Asist. Tu equipo #${equipo.nota} (${equipo.marca} ${equipo.modelo}) ya está listo para recoger. ¡Saludos!`);
      window.open(`https://wa.me/52${numeroLimpio}?text=${mensaje}`, '_blank');
    }
  };

  const handleMarcarEntregado = async (e) => {
    e.stopPropagation(); // Evitar que abra el modal
    
    if (!confirm(`¿Confirmas que el cliente ya recogió el equipo #${equipo.nota}?`)) {
      return;
    }

    try {
      // Importar supabase
      const { supabase } = await import('../supabase.js');
      
      console.log(`Marcando equipo #${equipo.nota} como finalizado...`);
      console.log('Estado actual del equipo:', equipo.estado_equipos);
      
      // Verificar si existe un registro en estado_equipos
      const { data: estadoExistente, error: consultaError } = await supabase
        .from('estado_equipos')
        .select('*')
        .eq('equipo_id', equipo.id)
        .maybeSingle();

      if (consultaError) {
        console.error('Error al consultar estado:', consultaError);
        alert('Error al consultar el estado del equipo');
        return;
      }

      console.log('Estado existente:', estadoExistente);

      let updateResult;
      if (estadoExistente) {
        // Actualizar estado existente
        updateResult = await supabase
          .from('estado_equipos')
          .update({
            estado: 'finalizado',
            updated_at: new Date().toISOString()
          })
          .eq('equipo_id', equipo.id)
          .select();
      } else {
        // Crear nuevo estado si no existe
        updateResult = await supabase
          .from('estado_equipos')
          .insert({
            equipo_id: equipo.id,
            estado: 'finalizado',
            proceso_actual_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select();
      }

      if (updateResult.error) {
        console.error('Error al actualizar/crear estado:', updateResult.error);
        alert('Error al marcar el equipo como entregado: ' + updateResult.error.message);
        return;
      }

      console.log('Estado actualizado/creado:', updateResult.data);

      // Agregar registro al historial
      const { error: historialError } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: equipo.id,
          proceso_id: equipo.estado_equipos?.[0]?.proceso_actual_id,
          notas: 'Equipo entregado al cliente',
          completado: true,
          fecha_completado: new Date().toISOString()
        });

      if (historialError) {
        console.error('Error al crear historial:', historialError);
      }

      alert(`✅ Equipo #${equipo.nota} marcado como entregado`);
      console.log('Recargando datos...');
      reload(); // Recargar la lista
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Error al procesar la entrega: ' + error.message);
    }
  };

  return (
    <div 
      className="card" 
      onClick={onClick} 
      style={{ 
        cursor: 'pointer',
        '--card-bg-color': cardColor
      }}
    >
      <ul className="card_list">
        <div className="card_number">
          #<span style={{ fontSize: '.4em' }}>{nota.slice(0, -1)}</span>
          <span style={{ fontSize: '3em' }}>{nota.slice(-1)}</span>
        </div>
        <div className="card_title">
          <span style={{ fontSize: '2.6em' }}>{equipo.marca}</span>
          <br />
          <span style={{ fontSize: '1em' }}>{equipo.modelo}</span>
          <br />
          <span style={{ color: 'var(--primary)', fontSize: '0.9em' }}>{equipo.color}</span>
        </div>
        
        {/* Mostrar siguiente subproceso o botones según la pestaña */}
        {activeTab === 'listos' ? (
          <div className="card-actions-listos">
            <button 
              className="btn-contactar"
              onClick={handleLlamarCliente}
              title="Contactar cliente"
            >
              📞 Contactar
            </button>
            <button 
              className="btn-entregado"
              onClick={handleMarcarEntregado}
              title="Marcar como entregado"
            >
              ✅ Entregado
            </button>
          </div>
        ) : (
          <li className="card__list_item siguiente-paso">
            {equipo.siguienteSubproceso ? (
              <>
                <span className="paso-icon">📋</span>
                <span className="paso-texto">{equipo.siguienteSubproceso.nombre}</span>
              </>
            ) : (
              <>
                <span className="paso-icon">✅</span>
                <span className="paso-texto">Proceso completado</span>
              </>
            )}
          </li>
        )}
      </ul>
    </div>
  );
}
