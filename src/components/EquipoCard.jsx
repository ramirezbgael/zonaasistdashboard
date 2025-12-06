import { useState } from 'react';
import { createPortal } from 'react-dom';
import PendienteItem from './PendienteItem.jsx';
import Icon from './Icon.jsx';
import './EquipoCard.css';

export default function EquipoCard({ equipo, reload, onClick, activeTab }) {
  const nota = equipo.nota.toString();
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactData, setContactData] = useState({ telefono: null, nombreCliente: 'el cliente' });
  
  // Función para convertir nombre de color a valor hexadecimal
  const getColorFromName = (colorName) => {
    const colorMap = {
      // Colores básicos
      'negro': '#2c2c2c',
      'blanco': '#f8f9fa',
      'gris': '#6c757d',
      'azul': '#10b981',
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
  const handleLlamarCliente = async (e) => {
    e.stopPropagation(); // Evitar que abra el modal
    
    let telefono = null;
    let nombreCliente = 'el cliente';
    
    // Intentar obtener el teléfono del cliente desde la base de datos
    if (equipo.clientes && equipo.clientes.telefono) {
      telefono = equipo.clientes.telefono;
      nombreCliente = equipo.clientes.nombre || nombreCliente;
    } else if (equipo.cliente_id) {
      // Si hay cliente_id pero no se cargó la relación, obtenerlo
      try {
        const { supabase } = await import('../supabase.js');
        const { data: clienteData, error: clienteError } = await supabase
          .from('clientes')
          .select('nombre, telefono')
          .eq('id', equipo.cliente_id)
          .single();
        
        if (!clienteError && clienteData) {
          telefono = clienteData.telefono;
          nombreCliente = clienteData.nombre || nombreCliente;
        }
      } catch (error) {
        console.error('Error obteniendo datos del cliente:', error);
      }
    }
    
    // Si no hay teléfono en la base de datos, mostrar modal para pedirlo
    if (!telefono) {
      setContactData({ telefono: null, nombreCliente, necesitaTelefono: true });
      setShowContactModal(true);
      return;
    }
    
    // Limpiar el número (solo dígitos)
    const numeroLimpio = telefono.replace(/\D/g, '');
    
    if (!numeroLimpio) {
      setContactData({ telefono: null, nombreCliente, error: 'Número de teléfono inválido' });
      setShowContactModal(true);
      return;
    }
    
    // Mostrar modal para elegir método de contacto
    setContactData({ telefono: numeroLimpio, nombreCliente });
    setShowContactModal(true);
  };

  const handleContactarTelefono = () => {
    if (!contactData.telefono) return;
    window.open(`tel:${contactData.telefono}`, '_self');
    setShowContactModal(false);
  };

  const handleContactarWhatsApp = () => {
    if (!contactData.telefono) return;
    const mensaje = encodeURIComponent(`Hola ${contactData.nombreCliente}! Te escribo de Zona Asist. Tu equipo #${equipo.nota} (${equipo.marca} ${equipo.modelo}) ya está listo para recoger. ¡Saludos!`);
    window.open(`https://wa.me/52${contactData.telefono}?text=${mensaje}`, '_blank');
    setShowContactModal(false);
  };

  const handleGuardarTelefono = () => {
    const telefonoInput = document.getElementById('telefono-input');
    if (!telefonoInput || !telefonoInput.value.trim()) {
      setContactData(prev => ({ ...prev, error: 'Por favor ingresa un número de teléfono' }));
      return;
    }
    
    const numeroLimpio = telefonoInput.value.replace(/\D/g, '');
    if (!numeroLimpio) {
      setContactData(prev => ({ ...prev, error: 'Número de teléfono inválido' }));
      return;
    }
    
    setContactData(prev => ({ ...prev, telefono: numeroLimpio, necesitaTelefono: false, error: null }));
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
          <span className="card-number-prefix">{nota.slice(0, -1)}</span>
          <span className="card-number-suffix">{nota.slice(-1)}</span>
        </div>
        <div className="card_title">
          <span className="card-marca">{equipo.marca}</span>
          <span className="card-modelo">{equipo.modelo}</span>
        </div>
        
        {/* Mostrar siguiente subproceso o botones según la pestaña */}
        {activeTab === 'listos' ? (
          <div className="card-actions-listos">
            <button 
              className="btn-contactar"
              onClick={handleLlamarCliente}
              title="Contactar cliente"
            >
              <Icon name="phone" />
              <span>Contactar</span>
            </button>
            <button 
              className="btn-entregado"
              onClick={handleMarcarEntregado}
              title="Marcar como entregado"
            >
              <Icon name="check-circle" />
              <span>Entregado</span>
            </button>
          </div>
        ) : (
          <li className="card__list_item siguiente-paso">
            {equipo.siguienteSubproceso ? (
              <>
                <Icon name="clipboard-list" className="paso-icon" />
                <span className="paso-texto">{equipo.siguienteSubproceso.nombre}</span>
              </>
            ) : equipo.tieneProcesoValido && equipo.totalSubprocesos > 0 ? (
              <>
                <Icon name="check-circle" className="paso-icon" />
                <span className="paso-texto">Proceso completado</span>
              </>
            ) : (
              <>
                <Icon name="clock" className="paso-icon" />
                <span className="paso-texto">En proceso</span>
              </>
            )}
          </li>
        )}
      </ul>

      {/* Modal de Contacto - Renderizado fuera del card usando Portal */}
      {showContactModal && createPortal(
        <div className="contact-modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="contact-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="contact-modal-close" 
              onClick={() => setShowContactModal(false)}
            >
              <Icon name="times" />
            </button>
            
            {contactData.necesitaTelefono ? (
              <div className="contact-modal-content">
                <div className="contact-modal-icon">
                  <Icon name="phone" />
                </div>
                <h2 className="contact-modal-title">Número de Teléfono</h2>
                <p className="contact-modal-description">
                  No se encontró el número de teléfono del cliente para el equipo #{equipo.nota}.
                  <br />
                  Por favor ingresa el número:
                </p>
                
                {contactData.error && (
                  <div className="contact-modal-error">
                    <Icon name="exclamation-circle" />
                    <span>{contactData.error}</span>
                  </div>
                )}
                
                <div className="contact-modal-input-wrapper">
                  <Icon name="phone" className="contact-input-icon" />
                  <input
                    id="telefono-input"
                    type="tel"
                    className="contact-modal-input"
                    placeholder="Número de teléfono"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleGuardarTelefono();
                      }
                    }}
                  />
                </div>
                
                <div className="contact-modal-actions">
                  <button 
                    className="contact-btn contact-btn-secondary"
                    onClick={() => setShowContactModal(false)}
                  >
                    Cancelar
                  </button>
                  <button 
                    className="contact-btn contact-btn-primary"
                    onClick={handleGuardarTelefono}
                  >
                    <Icon name="check" />
                    Continuar
                  </button>
                </div>
              </div>
            ) : (
              <div className="contact-modal-content">
                <div className="contact-modal-icon">
                  <Icon name="user-circle" />
                </div>
                <h2 className="contact-modal-title">
                  ¿Cómo deseas contactar a {contactData.nombreCliente}?
                </h2>
                <p className="contact-modal-description">
                  Elige el método de contacto preferido
                </p>
                
                <div className="contact-modal-options">
                  <button 
                    className="contact-option-btn"
                    onClick={handleContactarTelefono}
                  >
                    <div className="contact-option-icon phone">
                      <Icon name="phone" />
                    </div>
                    <div className="contact-option-content">
                      <h3>Llamar por teléfono</h3>
                      <p>{contactData.telefono}</p>
                    </div>
                  </button>
                  
                  <button 
                    className="contact-option-btn"
                    onClick={handleContactarWhatsApp}
                  >
                    <div className="contact-option-icon whatsapp">
                      <Icon name="comment" />
                    </div>
                    <div className="contact-option-content">
                      <h3>Enviar WhatsApp</h3>
                      <p>{contactData.telefono}</p>
                    </div>
                  </button>
                </div>
                
                <button 
                  className="contact-btn contact-btn-secondary contact-btn-full"
                  onClick={() => setShowContactModal(false)}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
