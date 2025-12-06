import { useState } from 'react';
import { supabase } from '../supabase.js';
import useClienteSearch from '../hooks/useClienteSearch.js';
import { notificarDocumentoNuevo } from '../utils/notifications.js';
import './AddEquipoModalTypeform.css';
import Icon from './Icon.jsx';

export default function AddDocumentoModal({ onClose, onDocumentoAdded }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    tipo_documento: '',
    cliente_telefono: '',
    cliente_nombre: '',
    cliente_email: '',
    descripcion: '',
    fecha_entrega: ''
  });
  const [loading, setLoading] = useState(false);
  const { clienteEncontrado, buscarCliente, actualizarCliente, obtenerOCrearCliente, verificarDatosCompletos } = useClienteSearch();
  const [datosFaltantes, setDatosFaltantes] = useState([]);

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Si cambia el teléfono, buscar cliente automáticamente
    if (name === 'cliente_telefono') {
      const cliente = await buscarCliente(value);
      if (cliente) {
        // Si se encuentra, verificar qué datos faltan
        const verificacion = verificarDatosCompletos(cliente);
        setDatosFaltantes(verificacion.faltantes);
        setFormData(prev => ({ 
          ...prev, 
          cliente_nombre: cliente.nombre || '',
          cliente_email: cliente.email || ''
        }));
      } else {
        // Limpiar datos si no se encuentra
        setDatosFaltantes(['nombre', 'email']);
        setFormData(prev => ({ ...prev, cliente_nombre: '', cliente_email: '' }));
      }
    }
  };

  const handleFieldComplete = async (field) => {
    if (field === 'tipo_documento' && formData.tipo_documento) {
      setTimeout(() => setCurrentStep(1), 300); // Ir a teléfono
    } else if (field === 'cliente_telefono' && formData.cliente_telefono.trim()) {
      // Buscar cliente y determinar qué falta
      const cliente = await buscarCliente(formData.cliente_telefono);
      if (!cliente) {
        // Cliente no existe, pedir nombre y email
        setDatosFaltantes(['nombre', 'email']);
        setTimeout(() => setCurrentStep(2), 300);
      } else {
        // Cliente existe, verificar qué datos faltan
        const verificacion = verificarDatosCompletos(cliente);
        setDatosFaltantes(verificacion.faltantes);
        if (verificacion.faltantes.length > 0) {
          // Faltan datos, pedir completarlos
          setTimeout(() => setCurrentStep(2), 300);
        } else {
          // Todo completo, ir a descripción
          setTimeout(() => setCurrentStep(3), 300);
        }
      }
    } else if (field === 'cliente_datos') {
      // Verificar que se completaron todos los datos requeridos
      const tieneNombre = formData.cliente_nombre && formData.cliente_nombre.trim() !== '';
      const tieneEmail = formData.cliente_email && formData.cliente_email.trim() !== '';
      
      // Validar formato de email básico
      const emailValido = tieneEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.cliente_email);
      
      if (!tieneNombre || !emailValido) {
        alert('Por favor completa correctamente el nombre y el correo electrónico');
        return;
      }
      
      setTimeout(() => setCurrentStep(3), 300); // Ir a descripción
    }
  };

  const handleNext = () => {
    if (currentStep === 0 && formData.tipo_documento) {
      setCurrentStep(1);
    } else if (currentStep === 1 && formData.cliente_telefono.trim()) {
      handleFieldComplete('cliente_telefono');
    } else if (currentStep === 2 && formData.cliente_nombre.trim()) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar campos requeridos
      if (!formData.tipo_documento || !formData.cliente_telefono) {
        alert('Por favor completa todos los campos requeridos');
        setLoading(false);
        return;
      }

      // Validar datos del cliente
      if (!formData.cliente_nombre || !formData.cliente_email) {
        alert('Por favor completa el nombre y correo del cliente');
        setLoading(false);
        return;
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.cliente_email)) {
        alert('Por favor ingresa un correo electrónico válido');
        setLoading(false);
        return;
      }

      // Obtener o crear/actualizar cliente
      let cliente = await obtenerOCrearCliente(
        formData.cliente_telefono.trim(),
        formData.cliente_nombre.trim(),
        formData.cliente_email.trim()
      );

      // Si el cliente existe pero faltan datos, actualizarlos
      if (cliente && cliente.id) {
        const verificacion = verificarDatosCompletos(cliente);
        if (verificacion.faltantes.length > 0) {
          const updateData = {};
          if (verificacion.faltantes.includes('nombre') && formData.cliente_nombre) {
            updateData.nombre = formData.cliente_nombre.trim();
          }
          if (verificacion.faltantes.includes('email') && formData.cliente_email) {
            updateData.email = formData.cliente_email.trim();
          }
          
          if (Object.keys(updateData).length > 0) {
            cliente = await actualizarCliente(cliente.id, updateData);
          }
        }
      }

      if (!cliente || !cliente.id) {
        throw new Error('No se pudo obtener o crear el cliente');
      }

      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();

      // Insertar documento
      const documentoData = {
        tipo_servicio: formData.tipo_documento,
        estado: 'pendiente',
        cliente_id: cliente.id,
        asignado_a: user?.id || null,
        descripcion: formData.descripcion || null,
        fecha_entrega: formData.fecha_entrega || null
      };

      const { data, error } = await supabase
        .from('servicios_documentos')
        .insert([documentoData])
        .select();

      if (error) {
        throw new Error(`Error al guardar documento: ${error.message}`);
      }

      // Crear notificación
      if (data && data[0]) {
        try {
          await notificarDocumentoNuevo(data[0], cliente.nombre);
        } catch (notifError) {
          console.error('Error creando notificación (no crítico):', notifError);
        }
      }

      console.log('Documento guardado:', data);
      onDocumentoAdded();
      onClose();
    } catch (error) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Calcular progreso basado en los pasos
  // Total: tipo_documento, telefono, datos_cliente (si faltan), descripcion
  let totalSteps = 4; // tipo, telefono, datos, descripcion
  if (clienteEncontrado && datosFaltantes.length === 0) {
    totalSteps = 3; // tipo, telefono, descripcion (cliente completo)
  }
  const currentStepNumber = currentStep + 1;
  const progressPercentage = (currentStepNumber / totalSteps) * 100;

  const handleClose = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="typeform-modal-overlay" onClick={handleClose}>
      <div className="typeform-modal" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="typeform-close-btn">×</button>

        <div className="typeform-progress">
          <div
            className="typeform-progress-bar"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>

        <div className="typeform-step-indicator">
          Paso {currentStepNumber} de {totalSteps}
        </div>

        <div className="typeform-step typeform-single-field">
          {/* Paso 1: Tipo de documento */}
          {currentStep === 0 && (
            <>
              <h2 className="typeform-question">¿Qué tipo de documento es?</h2>
              <p className="typeform-description">Selecciona el tipo de documento o transcripción</p>
              <div className="typeform-field-wrapper">
                <select
                  name="tipo_documento"
                  value={formData.tipo_documento}
                  onChange={handleInputChange}
                  autoFocus
                  className="typeform-large-input typeform-select"
                  required
                >
                  <option value="">Selecciona un tipo...</option>
                  <option value="transcripcion">Transcripción</option>
                  <option value="factura">Factura</option>
                  <option value="cotizacion">Cotización</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              {formData.tipo_documento && (
                <button
                  type="button"
                  onClick={() => handleFieldComplete('tipo_documento')}
                  className="typeform-btn-primary typeform-next-btn"
                >
                  Continuar <Icon name="arrow-right" />
                </button>
              )}
            </>
          )}

          {/* Paso 2: Teléfono del cliente */}
          {currentStep === 1 && (
            <>
              <h2 className="typeform-question">¿Cuál es el número del cliente?</h2>
              <p className="typeform-description">Ingresa el número de teléfono del cliente. Si ya existe en la base de datos, se cargará automáticamente.</p>
              {clienteEncontrado && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#059669',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-4)',
                  textAlign: 'center'
                }}>
                  ✓ Cliente encontrado: {clienteEncontrado.nombre}
                </div>
              )}
              <div className="typeform-field-wrapper">
                <input
                  type="tel"
                  name="cliente_telefono"
                  value={formData.cliente_telefono}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formData.cliente_telefono.trim()) {
                      e.preventDefault();
                      handleFieldComplete('cliente_telefono');
                    }
                  }}
                  placeholder="Ej: 5551234567"
                  required
                  autoFocus
                  className="typeform-large-input"
                />
              </div>
              <div className="typeform-buttons-horizontal">
                <button
                  type="button"
                  onClick={handleBack}
                  className="typeform-btn-secondary"
                >
                  <Icon name="arrow-left" /> Volver
                </button>
                {formData.cliente_telefono && (
                  <button
                    type="button"
                    onClick={() => handleFieldComplete('cliente_telefono')}
                    className="typeform-btn-primary"
                  >
                    Continuar <Icon name="arrow-right" />
                  </button>
                )}
              </div>
            </>
          )}

          {/* Paso 3: Datos del cliente (nombre y email si no existe o faltan datos) */}
          {currentStep === 2 && (
            <>
              <h2 className="typeform-question">
                {!clienteEncontrado 
                  ? 'Información del cliente' 
                  : 'Completa la información del cliente'}
              </h2>
              <p className="typeform-description">
                {!clienteEncontrado
                  ? 'Este cliente no está registrado. Por favor, ingresa su nombre y correo electrónico.'
                  : datosFaltantes.includes('nombre') && datosFaltantes.includes('email')
                    ? 'Faltan el nombre y el correo electrónico del cliente.'
                    : datosFaltantes.includes('nombre')
                      ? 'Falta el nombre del cliente.'
                      : 'Falta el correo electrónico del cliente.'}
              </p>
              
              {datosFaltantes.includes('nombre') && (
                <div className="typeform-field-wrapper">
                  <input
                    type="text"
                    name="cliente_nombre"
                    value={formData.cliente_nombre}
                    onChange={handleInputChange}
                    placeholder="Nombre completo del cliente"
                    required={datosFaltantes.includes('nombre')}
                    autoFocus={datosFaltantes.includes('nombre')}
                    className="typeform-large-input"
                  />
                </div>
              )}
              
              {datosFaltantes.includes('email') && (
                <div className="typeform-field-wrapper">
                  <input
                    type="email"
                    name="cliente_email"
                    value={formData.cliente_email}
                    onChange={handleInputChange}
                    placeholder="correo@ejemplo.com"
                    required={datosFaltantes.includes('email')}
                    autoFocus={!datosFaltantes.includes('nombre')}
                    className="typeform-large-input"
                  />
                </div>
              )}
              
              <div className="typeform-buttons-horizontal">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="typeform-btn-secondary"
                >
                  <Icon name="arrow-left" /> Volver
                </button>
                {(formData.cliente_nombre || !datosFaltantes.includes('nombre')) && 
                 (formData.cliente_email || !datosFaltantes.includes('email')) && (
                  <button
                    type="button"
                    onClick={() => handleFieldComplete('cliente_datos')}
                    className="typeform-btn-primary"
                  >
                    Continuar <Icon name="arrow-right" />
                  </button>
                )}
              </div>
            </>
          )}

          {/* Paso 3 o 4: Descripción y fecha de entrega */}
          {currentStep === 3 && (
            <>
              <h2 className="typeform-question">¿Cuándo debe entregarse?</h2>
              <p className="typeform-description">Fecha límite de entrega y descripción adicional (opcional)</p>
              <div className="typeform-field-wrapper">
                <input
                  type="date"
                  name="fecha_entrega"
                  value={formData.fecha_entrega}
                  onChange={handleInputChange}
                  autoFocus
                  className="typeform-large-input"
                />
              </div>
              <div className="typeform-field-wrapper">
                <textarea
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleInputChange}
                  placeholder="Descripción adicional (opcional)..."
                  className="typeform-large-textarea"
                  rows="4"
                />
              </div>
              <div className="typeform-buttons-horizontal">
                <button
                  type="button"
                  onClick={() => {
                    // Volver al paso anterior según si existe el cliente
                    if (clienteEncontrado) {
                      setCurrentStep(1);
                    } else {
                      setCurrentStep(2);
                    }
                  }}
                  className="typeform-btn-secondary"
                >
                  <Icon name="arrow-left" /> Volver
                </button>
                <form onSubmit={handleSubmit} style={{ display: 'inline' }}>
                  <button
                    type="submit"
                    className="typeform-btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : <><Icon name="check" /> Agregar Documento</>}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

