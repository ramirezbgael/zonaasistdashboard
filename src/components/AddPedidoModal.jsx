import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
import { notificarPedidoNuevo } from '../utils/notifications.js';
import useClienteSearch from '../hooks/useClienteSearch.js';
import NotaPDF from './NotaPDF.jsx';
import './AddEquipoModalTypeform.css';

export default function AddPedidoModal({ onClose, onPedidoAdded }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    proveedor: '',
    cliente_telefono: '',
    cliente_nombre: '',
    cliente_email: '',
    producto: '',
    cantidad: '',
    precio_total: '',
    adelanto: '',
    pago_full: false,
    fecha_esperada: '',
    notas: ''
  });
  const [loading, setLoading] = useState(false);
  const [showNotaPDF, setShowNotaPDF] = useState(false);
  const [pedidoGuardado, setPedidoGuardado] = useState(null);
  const [proveedorGuardado, setProveedorGuardado] = useState(null);
  const [clienteGuardado, setClienteGuardado] = useState(null);
  const { clienteEncontrado, buscarCliente, actualizarCliente, obtenerOCrearCliente, verificarDatosCompletos } = useClienteSearch();
  const [datosFaltantes, setDatosFaltantes] = useState([]);

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
    if (field === 'proveedor' && formData.proveedor.trim()) {
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
          // Todo completo, ir a producto
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
      
      // Guardar o actualizar cliente
      try {
        const cliente = await obtenerOCrearCliente(
          formData.cliente_telefono,
          formData.cliente_nombre,
          formData.cliente_email
        );
        if (cliente) {
          setTimeout(() => setCurrentStep(3), 300);
        }
      } catch (error) {
        console.error('Error guardando cliente:', error);
        alert('Error al guardar los datos del cliente. Por favor intenta de nuevo.');
      }
    } else if (field === 'producto' && formData.producto.trim()) {
      setTimeout(() => setCurrentStep(4), 300);
    } else if (field === 'cantidad' && formData.cantidad.trim()) {
      setTimeout(() => setCurrentStep(5), 300);
    } else if (field === 'precio_total' && formData.precio_total.trim()) {
      setTimeout(() => setCurrentStep(6), 300);
    } else if (field === 'adelanto') {
      setTimeout(() => setCurrentStep(7), 300);
    } else if (field === 'fecha_esperada') {
      setTimeout(() => setCurrentStep(8), 300);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Buscar o crear proveedor
      let proveedorId = null;
      if (formData.proveedor) {
        const { data: proveedorExistente } = await supabase
          .from('proveedores')
          .select('id')
          .eq('nombre', formData.proveedor.trim())
          .single();

        if (proveedorExistente) {
          proveedorId = proveedorExistente.id;
        } else {
          // Crear nuevo proveedor
          const { data: nuevoProveedor, error: proveedorError } = await supabase
            .from('proveedores')
            .insert({
              nombre: formData.proveedor.trim()
            })
            .select()
            .single();

          if (proveedorError) {
            throw new Error(`Error al crear proveedor: ${proveedorError.message}`);
          }
          proveedorId = nuevoProveedor.id;
        }
      }

      // Calcular precio unitario si hay precio total y cantidad
      const precioTotal = parseFloat(formData.precio_total) || 0;
      const cantidad = parseInt(formData.cantidad) || 1;
      const precioUnitario = cantidad > 0 ? precioTotal / cantidad : 0;

      // Insertar pedido
      const pedidoData = {
        proveedor_id: proveedorId,
        nombre_pieza: formData.producto,
        cantidad: cantidad,
        precio_unitario: precioUnitario > 0 ? precioUnitario : null,
        estado: 'pendiente',
        fecha_pedido: new Date().toISOString(),
        fecha_estimada_llegada: formData.fecha_esperada || null
      };

      const { data, error } = await supabase
        .from('pedidos_piezas')
        .insert([pedidoData])
        .select();

      if (error) {
        throw new Error(`Error al guardar pedido: ${error.message}`);
      }

      // Obtener o crear cliente si se proporcionó teléfono
      let clienteFinal = null;
      if (formData.cliente_telefono && formData.cliente_telefono.trim()) {
        try {
          clienteFinal = await obtenerOCrearCliente(
            formData.cliente_telefono,
            formData.cliente_nombre || null,
            formData.cliente_email || null
          );
        } catch (clienteError) {
          console.error('Error obteniendo/creando cliente:', clienteError);
          // Continuar sin cliente si hay error
        }
      }

      // Crear notificación
      if (data && data[0]) {
        try {
          await notificarPedidoNuevo(data[0], formData.proveedor);
        } catch (notifError) {
          console.error('Error creando notificación (no crítico):', notifError);
        }

        // Calcular restante
        const precioTotal = parseFloat(formData.precio_total) || 0;
        const adelanto = parseFloat(formData.adelanto) || 0;
        const restante = precioTotal - adelanto;

        // Guardar datos para mostrar nota PDF
        setPedidoGuardado({
          nota: `PED-${data[0].id}`,
          marca: 'Pedido',
          modelo: formData.producto,
          color: '',
          problema: formData.notas || '',
          cantidad: formData.cantidad,
          precio_total: precioTotal,
          adelanto: adelanto,
          restante: restante,
          pago_full: formData.pago_full,
          created_at: data[0].created_at,
          tipo: 'pedido' // Marcar como pedido
        });
        setProveedorGuardado({
          nombre: formData.proveedor,
          telefono: '',
          email: ''
        });
        // Guardar cliente si existe
        if (clienteFinal) {
          setClienteGuardado(clienteFinal);
        } else {
          setClienteGuardado(null);
        }
        setShowNotaPDF(true);
      } else {
      onPedidoAdded();
      onClose();
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: '🏢 Proveedor',
      description: 'Ingresa el nombre del proveedor'
    },
    {
      title: '👤 Cliente',
      description: 'Ingresa el número de teléfono del cliente'
    },
    {
      title: '📋 Datos del Cliente',
      description: 'Completa los datos del cliente'
    },
    {
      title: '📦 Producto/Pieza',
      description: 'Describe el producto o pieza que vas a pedir'
    },
    {
      title: '🔢 Cantidad',
      description: '¿Cuántas unidades necesitas?'
    },
    {
      title: '💰 Precio Total',
      description: 'Ingresa el precio total del pedido'
    },
    {
      title: '💵 Adelanto',
      description: '¿Se pagó algún adelanto? (opcional)'
    },
    {
      title: '📅 Fecha esperada',
      description: '¿Cuándo esperas recibir el pedido? (opcional)'
    },
    {
      title: '📝 Notas',
      description: 'Agrega notas adicionales (opcional)'
    }
  ];

  const totalSteps = steps.length;
  const getProgress = () => {
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

        {/* Step 0: Proveedor */}
        {currentStep === 0 && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿De qué proveedor es el pedido?</h2>
            <p className="typeform-description">{steps[0].description}</p>
            <div className="typeform-field-wrapper">
            <input
              type="text"
              name="proveedor"
              value={formData.proveedor}
              onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formData.proveedor.trim()) {
                    e.preventDefault();
                    handleFieldComplete('proveedor');
                  }
                }}
              placeholder="Nombre del proveedor"
              required
                autoFocus
                className="typeform-large-input"
              />
            </div>
            {formData.proveedor && (
              <button
                type="button"
                onClick={() => handleFieldComplete('proveedor')}
                className="typeform-btn-primary typeform-next-btn"
              >
                Continuar →
              </button>
            )}
          </div>
        )}

        {/* Step 1: Cliente - Teléfono */}
        {currentStep === 1 && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Cuál es el número de teléfono del cliente?</h2>
            <p className="typeform-description">{steps[1].description}</p>
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
            {clienteEncontrado && (
              <div className="typeform-cliente-info" style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(40, 167, 69, 0.1)', borderRadius: '8px', color: '#28a745' }}>
                ✓ Cliente encontrado: {clienteEncontrado.nombre || 'Sin nombre'}
              </div>
            )}
            {formData.cliente_telefono && (
              <button
                type="button"
                onClick={() => handleFieldComplete('cliente_telefono')}
                className="typeform-btn-primary typeform-next-btn"
              >
                Continuar →
              </button>
            )}
            <div className="typeform-buttons-horizontal" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(0)}
                className="typeform-btn-secondary"
              >
                ← Volver
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Cliente - Datos completos */}
        {currentStep === 2 && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">
              {clienteEncontrado ? 'Completa los datos faltantes del cliente' : 'Ingresa los datos del cliente'}
            </h2>
            <p className="typeform-description">{steps[2].description}</p>
            <div className="typeform-field-wrapper">
              <input
                type="text"
                name="cliente_nombre"
                value={formData.cliente_nombre}
                onChange={handleInputChange}
                placeholder="Nombre completo del cliente"
                required
                autoFocus
                className="typeform-large-input"
                style={{ marginBottom: '1rem' }}
              />
              <input
                type="email"
                name="cliente_email"
                value={formData.cliente_email}
                onChange={handleInputChange}
                placeholder="Correo electrónico del cliente"
                required
                className="typeform-large-input"
              />
            </div>
            <div className="typeform-buttons-horizontal">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="typeform-btn-secondary"
              >
                ← Volver
              </button>
              <button
                type="button"
                onClick={() => handleFieldComplete('cliente_datos')}
                className="typeform-btn-primary"
                disabled={!formData.cliente_nombre || !formData.cliente_email}
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Producto/Pieza */}
        {currentStep === 3 && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Qué producto o pieza vas a pedir?</h2>
            <p className="typeform-description">{steps[3].description}</p>
            <div className="typeform-field-wrapper">
            <input
              type="text"
              name="producto"
              value={formData.producto}
              onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formData.producto.trim()) {
                    e.preventDefault();
                    handleFieldComplete('producto');
                  }
                }}
              placeholder="Ej: Disco SSD 500GB, RAM 8GB..."
              required
                autoFocus
                className="typeform-large-input"
              />
            </div>
            <div className="typeform-buttons-horizontal">
              <button
                type="button"
                onClick={() => setCurrentStep(clienteEncontrado && verificarDatosCompletos(clienteEncontrado).faltantes.length === 0 ? 1 : 2)}
                className="typeform-btn-secondary"
              >
                ← Volver
              </button>
              {formData.producto && (
                <button
                  type="button"
                  onClick={() => handleFieldComplete('producto')}
                  className="typeform-btn-primary"
                >
                  Continuar →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Cantidad */}
        {currentStep === 4 && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Cuántas unidades necesitas?</h2>
            <p className="typeform-description">{steps[4].description}</p>
            <div className="typeform-field-wrapper">
            <input
              type="number"
              name="cantidad"
              value={formData.cantidad}
              onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formData.cantidad.trim()) {
                    e.preventDefault();
                    handleFieldComplete('cantidad');
                  }
                }}
              placeholder="Ej: 5"
              min="1"
              required
                autoFocus
                className="typeform-large-input"
              />
            </div>
            <div className="typeform-buttons-horizontal">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="typeform-btn-secondary"
              >
                ← Volver
              </button>
              {formData.cantidad && (
                <button
                  type="button"
                  onClick={() => handleFieldComplete('cantidad')}
                  className="typeform-btn-primary"
                >
                  Continuar →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Precio Total */}
        {currentStep === 5 && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Cuál es el precio total del pedido?</h2>
            <p className="typeform-description">{steps[5].description}</p>
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
                onClick={() => setCurrentStep(4)}
                className="typeform-btn-secondary"
              >
                ← Volver
              </button>
              {formData.precio_total && (
                <button
                  type="button"
                  onClick={() => handleFieldComplete('precio_total')}
                  className="typeform-btn-primary"
                >
                  Continuar →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 6: Adelanto */}
        {currentStep === 6 && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Se pagó algún adelanto?</h2>
            <p className="typeform-description">{steps[6].description}</p>
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
                onClick={() => setCurrentStep(5)}
                className="typeform-btn-secondary"
              >
                ← Volver
              </button>
              <button
                type="button"
                onClick={() => handleFieldComplete('adelanto')}
                className="typeform-btn-primary"
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* Step 7: Fecha esperada */}
        {currentStep === 7 && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Cuándo esperas recibir el pedido?</h2>
            <p className="typeform-description">{steps[7].description}</p>
            <div className="typeform-field-wrapper">
            <input
              type="date"
              name="fecha_esperada"
              value={formData.fecha_esperada}
              onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFieldComplete('fecha_esperada');
                  }
                }}
                autoFocus
                className="typeform-large-input"
              />
            </div>
            <div className="typeform-buttons-horizontal">
              <button
                type="button"
                onClick={() => setCurrentStep(6)}
                className="typeform-btn-secondary"
              >
                ← Volver
              </button>
              <button
                type="button"
                onClick={() => handleFieldComplete('fecha_esperada')}
                className="typeform-btn-primary"
              >
                {formData.fecha_esperada ? 'Continuar →' : 'Omitir →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 8: Notas */}
        {currentStep === 8 && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Hay alguna nota adicional? (Opcional)</h2>
            <p className="typeform-description">{steps[8].description}</p>
            <div className="typeform-field-wrapper">
            <textarea
              name="notas"
              value={formData.notas}
              onChange={handleInputChange}
                placeholder="Escribe notas adicionales sobre el pedido..."
                autoFocus
                className="typeform-large-textarea"
                rows="5"
            />
          </div>
            <div className="typeform-buttons-horizontal">
              <button
                type="button"
                onClick={() => setCurrentStep(7)}
                className="typeform-btn-secondary"
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
                disabled={loading}
              >
                {loading ? 'Guardando...' : '✓ Agregar Pedido'}
            </button>
            </div>
          </div>
        )}

        {/* Modal de Nota PDF */}
        {showNotaPDF && pedidoGuardado && proveedorGuardado && (
          <NotaPDF
            equipo={pedidoGuardado}
            cliente={clienteGuardado}
            proveedor={proveedorGuardado}
            tipo="recepcion"
            onClose={() => {
              setShowNotaPDF(false);
              setPedidoGuardado(null);
              setProveedorGuardado(null);
              setClienteGuardado(null);
              onPedidoAdded();
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

