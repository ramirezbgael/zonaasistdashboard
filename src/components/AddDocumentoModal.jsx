import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
import useClienteSearch from '../hooks/useClienteSearch.js';
import { notificarDocumentoNuevo } from '../utils/notifications.js';
import NotaPDF from './NotaPDF.jsx';
import './AddEquipoModalTypeform.css';

export default function AddDocumentoModal({ onClose, onDocumentoAdded }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    tipo_documento: '',
    cliente_telefono: '',
    cliente_nombre: '',
    cliente_email: '',
    precio_total: '',
    adelanto: '',
    pago_full: false,
    descripcion: '',
    fecha_entrega: ''
  });
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { clienteEncontrado, buscarCliente, actualizarCliente, obtenerOCrearCliente, verificarDatosCompletos } = useClienteSearch();
  const [datosFaltantes, setDatosFaltantes] = useState([]);
  const [showNotaPDF, setShowNotaPDF] = useState(false);
  const [documentoGuardado, setDocumentoGuardado] = useState(null);
  const [clienteGuardado, setClienteGuardado] = useState(null);

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalHeight = document.body.style.height;
    
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'relative';
    document.body.style.height = '100vh';
    
    return () => {
      document.body.style.overflow = originalOverflow || '';
      document.body.style.position = originalPosition || '';
      document.body.style.height = originalHeight || '';
    };
  }, []);

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

  // Avanzar al siguiente paso
  const handleFieldComplete = async (field) => {
    if (field === 'tipo_documento' && formData.tipo_documento) {
      setTimeout(() => setCurrentStep(1), 300);
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
          // Todo completo, verificar si es transcripción para pedir precio
          if (formData.tipo_documento === 'transcripcion') {
            setTimeout(() => setCurrentStep(3), 300); // Ir a precio
          } else {
            setTimeout(() => setCurrentStep(4), 300); // Ir a fecha
          }
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
      
      // Si es transcripción, ir a precio, sino a fecha
      if (formData.tipo_documento === 'transcripcion') {
        setTimeout(() => setCurrentStep(3), 300); // Ir a precio
      } else {
        setTimeout(() => setCurrentStep(4), 300); // Ir a fecha
      }
    } else if (field === 'precio_total' && formData.precio_total.trim()) {
      setTimeout(() => setCurrentStep(4), 300); // Ir a adelanto
    } else if (field === 'adelanto') {
      setTimeout(() => setCurrentStep(5), 300); // Ir a fecha
    } else if (field === 'fecha_entrega') {
      setTimeout(() => setCurrentStep(6), 300); // Ir a descripción
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevenir múltiples submits
    if (isSubmitting || loading) {
      return;
    }
    
    setIsSubmitting(true);
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
        fecha_entrega: formData.fecha_entrega || null,
        precio: formData.tipo_documento === 'transcripcion' && formData.precio_total ? parseFloat(formData.precio_total) : null
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

        // Calcular restante si es transcripción
        const precioTotal = formData.tipo_documento === 'transcripcion' ? (parseFloat(formData.precio_total) || 0) : 0;
        const adelanto = formData.tipo_documento === 'transcripcion' ? (parseFloat(formData.adelanto) || 0) : 0;
        const restante = precioTotal - adelanto;

        // Guardar datos para mostrar nota PDF
        setDocumentoGuardado({
          nota: `DOC-${data[0].id}`,
          marca: 'Documento',
          modelo: formData.tipo_documento,
          color: '',
          problema: formData.descripcion || '',
          precio_total: precioTotal > 0 ? precioTotal : null,
          adelanto: adelanto > 0 ? adelanto : null,
          restante: restante > 0 ? restante : null,
          pago_full: formData.pago_full,
          created_at: data[0].created_at,
          tipo: formData.tipo_documento === 'transcripcion' ? 'transcripcion' : 'documento'
        });
        setClienteGuardado(cliente);
        setShowNotaPDF(true);
      } else {
        onDocumentoAdded();
        onClose();
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const esTranscripcion = formData.tipo_documento === 'transcripcion';
  
  const steps = [
    {
      title: '📄 Tipo de documento',
      description: 'Selecciona el tipo de documento que vas a crear'
    },
    {
      title: '📱 Teléfono del cliente',
      description: 'Ingresa el número de teléfono del cliente'
    },
    {
      title: '👤 Información del cliente',
      description: 'Completa los datos del cliente'
    },
    ...(esTranscripcion ? [
      {
        title: '💰 Precio Total',
        description: 'Ingresa el precio total de la transcripción'
      },
      {
        title: '💵 Adelanto',
        description: '¿Se pagó algún adelanto? (opcional)'
      }
    ] : []),
    {
      title: '📅 Fecha de entrega',
      description: 'Selecciona la fecha de entrega (opcional)'
    },
    {
      title: '📝 Descripción',
      description: 'Agrega detalles adicionales (opcional)'
    }
  ];

  const totalSteps = steps.length;
  const getProgress = () => {
    if (currentStep === 2) {
      // Paso 2 puede tener sub-pasos (nombre y email)
      const subSteps = datosFaltantes.length;
      if (subSteps === 0) return ((currentStep + 1) / totalSteps) * 100;
      // Si falta nombre, estamos en 2.1, si falta email en 2.2
      const currentSubStep = datosFaltantes.includes('nombre') && !formData.cliente_nombre ? 1 : 2;
      return ((currentStep + currentSubStep / (subSteps + 1)) / totalSteps) * 100;
    }
    return ((currentStep + 1) / totalSteps) * 100;
  };

  return (
    <div 
      className="typeform-modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: '1rem'
      }}
    >
      <div 
        className="typeform-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 1060,
          display: 'flex',
          flexDirection: 'column',
          opacity: 1,
          visibility: 'visible',
          transform: 'translate(0, 0)'
        }}
      >
        <button onClick={onClose} className="typeform-close-btn">×</button>
        
        {/* Progress Bar */}
        <div className="typeform-progress">
          <div 
            className="typeform-progress-bar" 
            style={{ width: `${getProgress()}%` }}
          ></div>
        </div>

        {/* Step Indicator */}
        <div className="typeform-step-indicator">
          Paso {currentStep + 1} de {totalSteps}
        </div>

        {/* Step 0: Tipo de documento */}
        {currentStep === 0 && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Qué tipo de documento vas a crear?</h2>
            <p className="typeform-description">{steps[0].description}</p>
            <div className="typeform-field-wrapper">
            <select
              name="tipo_documento"
              value={formData.tipo_documento}
                onChange={(e) => {
                  handleInputChange(e);
                  if (e.target.value) {
                    setTimeout(() => handleFieldComplete('tipo_documento'), 300);
                  }
                }}
              required
                autoFocus
                className="typeform-large-input typeform-select"
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
                disabled={loading || isSubmitting}
              >
                Continuar →
              </button>
            )}
          </div>
        )}

        {/* Step 1: Teléfono del cliente */}
        {currentStep === 1 && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Cuál es el número del cliente?</h2>
            <p className="typeform-description">Ingresa el número de teléfono del cliente. Si ya existe en la base de datos, se cargará automáticamente.</p>
            {clienteEncontrado && (
              <div style={{
                background: '#d4edda',
                color: '#155724',
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
                onClick={() => setCurrentStep(0)}
                className="typeform-btn-secondary"
                disabled={loading || isSubmitting}
              >
                ← Volver
              </button>
              {formData.cliente_telefono && (
                <button
                  type="button"
                  onClick={() => handleFieldComplete('cliente_telefono')}
                  className="typeform-btn-primary"
                  disabled={loading || isSubmitting}
                >
                  Continuar →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Datos del cliente (nombre y email si no existe o faltan datos) */}
        {currentStep === 2 && (
          <div className="typeform-step typeform-single-field">
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
                disabled={loading || isSubmitting}
              >
                ← Volver
              </button>
              {(formData.cliente_nombre || !datosFaltantes.includes('nombre')) && 
               (formData.cliente_email || !datosFaltantes.includes('email')) && (
                <button
                  type="button"
                  onClick={() => handleFieldComplete('cliente_datos')}
                  className="typeform-btn-primary"
                  disabled={loading || isSubmitting}
                >
                  Continuar →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Precio Total (solo para transcripción) */}
        {currentStep === 3 && esTranscripcion && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Cuál es el precio total de la transcripción?</h2>
            <p className="typeform-description">{steps[3].description}</p>
            <div className="typeform-field-wrapper">
              <input
                type="number"
                name="precio_total"
                value={formData.precio_total}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formData.precio_total.trim()) {
                    e.preventDefault();
                    handleFieldComplete('precio_total');
                  }
                }}
                placeholder="Ej: 1500.00"
                step="0.01"
                min="0"
              required
                autoFocus
                className="typeform-large-input"
              />
            </div>
            <div className="typeform-buttons-horizontal">
              <button
                type="button"
                onClick={() => {
                  if (datosFaltantes.length > 0 || !clienteEncontrado) {
                    setCurrentStep(2);
                  } else {
                    setCurrentStep(1);
                  }
                }}
                className="typeform-btn-secondary"
                disabled={loading || isSubmitting}
              >
                ← Volver
              </button>
              {formData.precio_total && (
                <button
                  type="button"
                  onClick={() => handleFieldComplete('precio_total')}
                  className="typeform-btn-primary"
                  disabled={loading || isSubmitting}
                >
                  Continuar →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Adelanto (solo para transcripción) */}
        {currentStep === 4 && esTranscripcion && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Se pagó algún adelanto?</h2>
            <p className="typeform-description">{steps[4].description}</p>
            <div className="typeform-field-wrapper">
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="pago_full"
                  checked={formData.pago_full}
                  onChange={(e) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      pago_full: e.target.checked, 
                      adelanto: e.target.checked ? prev.precio_total : prev.adelanto 
                    }));
                  }}
                  style={{ marginRight: '0.5rem', width: '20px', height: '20px' }}
                />
                <span>Pago completo</span>
              </label>
              <input
                type="number"
                name="adelanto"
                value={formData.pago_full ? formData.precio_total : formData.adelanto}
                onChange={(e) => {
                  const value = e.target.value;
                  const precioTotal = parseFloat(formData.precio_total || 0);
                  const adelantoValue = parseFloat(value || 0);
                  setFormData(prev => ({ 
                    ...prev, 
                    adelanto: value,
                    pago_full: adelantoValue === precioTotal && value !== '' && precioTotal > 0
                  }));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFieldComplete('adelanto');
                  }
                }}
                placeholder="Ej: 500.00"
                step="0.01"
                min="0"
                max={formData.precio_total || undefined}
                disabled={formData.pago_full}
                autoFocus={!formData.pago_full}
                className="typeform-large-input"
              />
              {formData.precio_total && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                  Precio total: ${parseFloat(formData.precio_total || 0).toFixed(2)}
                  {formData.adelanto && (
                    <span style={{ display: 'block', marginTop: '0.25rem' }}>
                      Restante: ${(parseFloat(formData.precio_total || 0) - parseFloat(formData.adelanto || 0)).toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="typeform-buttons-horizontal">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="typeform-btn-secondary"
                disabled={loading || isSubmitting}
              >
                ← Volver
              </button>
              <button
                type="button"
                onClick={() => handleFieldComplete('adelanto')}
                className="typeform-btn-primary"
                disabled={loading || isSubmitting}
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* Step 4/5: Fecha de entrega */}
        {((currentStep === 4 && !esTranscripcion) || (currentStep === 5 && esTranscripcion)) && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Cuándo se entregará el documento?</h2>
            <p className="typeform-description">Selecciona la fecha de entrega (opcional). Puedes omitir este paso.</p>
            <div className="typeform-field-wrapper">
            <input
              type="date"
              name="fecha_entrega"
              value={formData.fecha_entrega}
              onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFieldComplete('fecha_entrega');
                  }
                }}
                autoFocus
                className="typeform-large-input"
              />
            </div>
            <div className="typeform-buttons-horizontal">
              <button
                type="button"
                onClick={() => {
                  if (esTranscripcion) {
                    setCurrentStep(4);
                  } else {
                    // Volver al paso anterior según si se mostró el paso 2
                    if (datosFaltantes.length > 0 || !clienteEncontrado) {
                      setCurrentStep(2);
                    } else {
                      setCurrentStep(1);
                    }
                  }
                }}
                className="typeform-btn-secondary"
              >
                ← Volver
              </button>
              <button
                type="button"
                onClick={() => handleFieldComplete('fecha_entrega')}
                className="typeform-btn-primary"
              >
                {formData.fecha_entrega ? 'Continuar →' : 'Omitir →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5/6: Descripción (opcional) */}
        {((currentStep === 5 && !esTranscripcion) || (currentStep === 6 && esTranscripcion)) && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Hay algún detalle adicional? (Opcional)</h2>
            <p className="typeform-description">Describe cualquier información relevante sobre el documento.</p>
            <div className="typeform-field-wrapper">
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleInputChange}
                placeholder="Escribe detalles adicionales sobre el documento..."
                autoFocus
                className="typeform-large-textarea"
                rows="5"
            />
          </div>
            <div className="typeform-buttons-horizontal">
              <button
                type="button"
                onClick={() => {
                  if (esTranscripcion) {
                    setCurrentStep(5);
                  } else {
                    setCurrentStep(4);
                  }
                }}
                className="typeform-btn-secondary"
                disabled={loading || isSubmitting}
              >
                ← Volver
            </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e);
                }}
                className="typeform-btn-primary"
                disabled={loading || isSubmitting}
              >
                {loading ? (
                  <>
                    <span style={{ display: 'inline-block', marginRight: '0.5rem' }}>⏳</span>
                    Guardando...
                  </>
                ) : '✓ Agregar Documento'}
            </button>
            </div>
          </div>
        )}

        {/* Modal de Nota PDF */}
        {showNotaPDF && documentoGuardado && clienteGuardado && (
          <NotaPDF
            equipo={documentoGuardado}
            cliente={clienteGuardado}
            tipo="recepcion"
            onClose={() => {
              setShowNotaPDF(false);
              setDocumentoGuardado(null);
              setClienteGuardado(null);
              onDocumentoAdded();
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

