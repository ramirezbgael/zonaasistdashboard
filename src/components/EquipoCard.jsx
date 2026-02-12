import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import PendienteItem from './PendienteItem.jsx';
import Icon from './Icon.jsx';
import './EquipoCard.css';

export default function EquipoCard({ equipo, reload, onClick, activeTab, demoMode = false }) {
  const navigate = useNavigate();
  const nota = equipo.nota.toString();
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactData, setContactData] = useState({ telefono: null, nombreCliente: 'el cliente' });
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [entregaLoading, setEntregaLoading] = useState(false);
  
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
    return colorMap[normalizedColor] || '#10b981'; // Color por defecto verde esmeralda
  };

  // Usar el color del equipo
  const cardColor = getColorFromName(equipo.color);
  
  // Detectar si el color es blanco o muy claro para ajustar el contraste del avatar
  const isColorClaro = equipo.color && (
    equipo.color.toLowerCase().includes('blanco') || 
    equipo.color.toLowerCase().includes('perla') ||
    cardColor === '#f8f9fa' ||
    cardColor === '#faf0e6' ||
    cardColor === '#ffffff' ||
    cardColor === '#fff'
  );

  // Funciones para botones de equipos listos
  const handleLlamarCliente = async (e) => {
    e.stopPropagation(); // Evitar que abra el modal
    if (demoMode) {
      // En modo demo no se consulta Supabase ni se registran cambios reales
      setContactData({ telefono: '5551234567', nombreCliente: 'Cliente demo' });
      setShowContactModal(true);
      return;
    }
    
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
    setShowEntregaModal(true);
  };

  const confirmarEntrega = async () => {
    if (demoMode) {
      // Solo mostrar un mensaje en modo demo, sin tocar Supabase
      alert('En el modo demo no se marcan equipos como entregados. Esto es solo una vista de ejemplo.');
      setShowEntregaModal(false);
      return;
    }
    setEntregaLoading(true);
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
        setEntregaLoading(false);
        setShowEntregaModal(false);
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

      // Crear notificación de entrega
      try {
        const { notificarEquipoFinalizado } = await import('../utils/notifications.js');
        const clienteInfo = equipo.clientes || null;
        await notificarEquipoFinalizado(equipo, clienteInfo);
      } catch (notifError) {
        console.error('Error creando notificación (no crítico):', notifError);
      }

      console.log('Recargando datos...');
      setShowEntregaModal(false);
      setEntregaLoading(false);
      reload(); // Recargar la lista
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Error al procesar la entrega: ' + error.message);
      setEntregaLoading(false);
      setShowEntregaModal(false);
    }
  };

  const getInitials = (marca) => {
    if (!marca) return '?';
    return marca.substring(0, 2).toUpperCase();
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/equipos/${equipo.id}`);
    }
  };

  return (
    <div 
      className="card equipo-card" 
      onClick={handleCardClick} 
      style={{ 
        cursor: 'pointer',
        '--card-bg-color': cardColor
      }}
    >
      <div className="equipo-card-header">
        <div 
          className={`equipo-avatar ${isColorClaro ? 'avatar-color-claro' : ''}`} 
          style={{ background: `linear-gradient(135deg, ${cardColor}, ${cardColor}80)` }}
        >
          {getInitials(equipo.marca)}
        </div>
        <div className="equipo-info">
          <div className="equipo-title-row">
            <h3 className="equipo-marca">{equipo.marca}</h3>
            <span className="equipo-nota-badge">#{equipo.nota}</span>
          </div>
          <p className="equipo-modelo">{equipo.modelo}</p>
          {equipo.color && (
            <div className={`equipo-color-info ${equipo.color.toLowerCase().includes('blanco') ? 'color-claro' : ''}`}>
              <span 
                className={`equipo-color-dot ${equipo.color.toLowerCase().includes('blanco') ? 'color-claro' : ''}`}
                style={{ backgroundColor: cardColor }}
              />
              <span>{equipo.color}</span>
            </div>
          )}
        </div>
      </div>

      <div className="equipo-card-content">
        {activeTab === 'listos' ? (
          <div className="equipo-actions" onClick={(e) => e.stopPropagation()}>
            <button 
              className="equipo-action-btn contactar"
              onClick={handleLlamarCliente}
              title="Contactar cliente"
            >
              <Icon name="phone" />
              <span>Contactar</span>
            </button>
            <button 
              className="equipo-action-btn entregado"
              onClick={handleMarcarEntregado}
              title="Marcar como entregado"
            >
              <Icon name="check-circle" />
              <span>Entregado</span>
            </button>
          </div>
        ) : (
          <div className="equipo-paso-info">
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
            ) : equipo.procesoNombre ? (
              <>
                <Icon name="clipboard-list" className="paso-icon" />
                <span className="paso-texto">{equipo.procesoNombre}</span>
              </>
            ) : (
              <>
                <Icon name="hourglass-half" className="paso-icon" />
                <span className="paso-texto">Sin proceso asignado</span>
              </>
            )}
          </div>
        )}
      </div>

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

      {/* Modal de Confirmación de Entrega - Renderizado fuera del card usando Portal */}
      {showEntregaModal && createPortal(
        <div className="contact-modal-overlay" onClick={() => !entregaLoading && setShowEntregaModal(false)}>
          <div className="contact-modal entrega-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="contact-modal-close" 
              onClick={() => !entregaLoading && setShowEntregaModal(false)}
              disabled={entregaLoading}
            >
              <Icon name="times" />
            </button>
            
            <div className="contact-modal-content">
              <div className="contact-modal-icon entrega-modal-icon">
                <Icon name="check-circle" />
              </div>
              <h2 className="contact-modal-title">Confirmar Entrega</h2>
              <p className="contact-modal-description">
                ¿Confirmas que el cliente ya recogió el equipo <strong>#{equipo.nota}</strong>?
                <br />
                <span style={{ fontSize: 'var(--font-sm)', opacity: 0.8, marginTop: 'var(--space-2)', display: 'block' }}>
                  Esta acción marcará el equipo como finalizado.
                </span>
              </p>
              
              <div className="contact-modal-actions">
                <button 
                  className="contact-btn contact-btn-secondary"
                  onClick={() => setShowEntregaModal(false)}
                  disabled={entregaLoading}
                >
                  Cancelar
                </button>
                <button 
                  className="contact-btn contact-btn-primary entrega-confirm-btn"
                  onClick={confirmarEntrega}
                  disabled={entregaLoading}
                >
                  {entregaLoading ? (
                    <>
                      <span style={{ 
                        display: 'inline-block',
                        animation: 'spin 1s linear infinite',
                        transformOrigin: 'center'
                      }}>
                        <Icon name="sync" />
                      </span>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Icon name="check" />
                      Confirmar Entrega
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
