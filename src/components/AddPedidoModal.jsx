import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import { addPedido as addPedidoDemo } from '../utils/demoStorage.js';
import { notificarPedidoNuevo } from '../utils/notifications.js';
import useClienteSearch from '../hooks/useClienteSearch.js';
import './AddEquipoModalTypeform.css';

export default function AddPedidoModal({ onClose, onPedidoAdded, mode = 'modal', demoMode = false }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    // Proveedor ya no se pide en el formulario, pero dejamos
    // la propiedad para compatibilidad con lógica existente.
    proveedor: '',
    cliente_telefono: '',
    cliente_nombre: '',
    cliente_email: '',
    equipo_nota: '',
    producto: '',
    cantidad: '',
    precio_total: '',
    adelanto: '',
    pago_full: false,
    fecha_esperada: '',
    notas: ''
  });
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [buscandoEquipo, setBuscandoEquipo] = useState(false);
  const [equipoRelacionado, setEquipoRelacionado] = useState(null);
  const { clienteEncontrado, buscarCliente, actualizarCliente, obtenerOCrearCliente, verificarDatosCompletos } = useClienteSearch();
  const [datosFaltantes, setDatosFaltantes] = useState([]);
  const guardadoExitoso = useRef(false);
  const [notasDisponibles, setNotasDisponibles] = useState([]);

  // Cargar notas disponibles al llegar al paso de equipo
  useEffect(() => {
    if (currentStep !== 2 || demoMode) return;
    const cargarNotas = async () => {
      try {
        const { data, error } = await supabase
          .from('equipos')
          .select('nota')
          .not('nota', 'is', null)
          .order('created_at', { ascending: false })
          .limit(100);
        if (!error && data) {
          const notas = [...new Set(data.map((e) => String(e.nota).trim()).filter(Boolean))];
          setNotasDisponibles(notas);
        }
      } catch (err) {
        console.error('Error cargando notas:', err);
      }
    };
    cargarNotas();
  }, [currentStep, demoMode]);

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (mode !== 'modal') return;
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
    
    if (name === 'equipo_nota') {
      setEquipoRelacionado(null);
    }

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

  const buscarEquipoPorNota = async (notaOverride) => {
    const nota = (notaOverride !== undefined ? String(notaOverride || '').trim() : String(formData.equipo_nota || '').trim());
    if (!nota) {
      setEquipoRelacionado(null);
      return;
    }

    setBuscandoEquipo(true);
    try {
      const { data, error } = await supabase
        .from('equipos')
        .select('id, nota, marca, modelo, cliente_id')
        .eq('nota', nota)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        alert(`No se encontró un equipo con la nota #${nota}`);
        setEquipoRelacionado(null);
        return;
      }

      setEquipoRelacionado(data);
    } catch (err) {
      console.error('Error buscando equipo por nota:', err);
      alert('Error buscando el equipo. Intenta de nuevo.');
    } finally {
      setBuscandoEquipo(false);
    }
  };

  // Avanzar al siguiente paso
  const handleFieldComplete = async (field) => {
    if (field === 'cliente_telefono' && formData.cliente_telefono.trim()) {
      // Buscar cliente y determinar qué falta
      const cliente = await buscarCliente(formData.cliente_telefono);
      if (!cliente) {
        // Cliente no existe, pedir nombre y email
        setDatosFaltantes(['nombre', 'email']);
        setTimeout(() => setCurrentStep(1), 300);
      } else {
        // Cliente existe, verificar qué datos faltan
        const verificacion = verificarDatosCompletos(cliente);
        setDatosFaltantes(verificacion.faltantes);
        if (verificacion.faltantes.length > 0) {
          // Faltan datos, pedir completarlos
          setTimeout(() => setCurrentStep(1), 300);
        } else {
          // Todo completo, ir a la nota de equipo (opcional)
          setTimeout(() => setCurrentStep(2), 300);
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
          // Después de completar datos del cliente, ir a la nota de equipo
          setTimeout(() => setCurrentStep(2), 300);
        }
      } catch (error) {
        console.error('Error guardando cliente:', error);
        alert('Error al guardar los datos del cliente. Por favor intenta de nuevo.');
      }
    } else if (field === 'equipo_nota') {
      // Si hay nota escrita y no está ligado, buscar antes de avanzar
      const nota = String(formData.equipo_nota || '').trim();
      if (nota && !equipoRelacionado && !buscandoEquipo) {
        await buscarEquipoPorNota(nota);
      }
      setTimeout(() => setCurrentStep(3), 300);
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

    if (guardadoExitoso.current) return;
    if (isSubmitting || loading) return;

    setIsSubmitting(true);
    setLoading(true);

    try {
      if (demoMode) {
        const cantidad = parseInt(formData.cantidad) || 1;
        addPedidoDemo({
          nombre_pieza: formData.producto || 'Producto',
          cantidad,
          producto: formData.producto,
          proveedor: formData.proveedor || 'Proveedor demo',
          equipos: equipoRelacionado
            ? { ...equipoRelacionado, clientes: equipoRelacionado.clientes || { nombre: formData.cliente_nombre, telefono: formData.cliente_telefono } }
            : null,
          fecha_estimada_llegada: formData.fecha_esperada || null,
        });
        onPedidoAdded();
        onClose();
        setIsSubmitting(false);
        setLoading(false);
        return;
      }

      // Ya no se requiere capturar proveedor, dejamos proveedor_id en null
      let proveedorId = null;

      // Obtener o crear cliente si se proporcionó teléfono (se usa para ligar el pedido al cliente)
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

      // Calcular precio unitario si hay precio total y cantidad
      const precioTotal = parseFloat(formData.precio_total) || 0;
      const cantidad = parseInt(formData.cantidad) || 1;
      const precioUnitario = cantidad > 0 ? precioTotal / cantidad : 0;

      // Insertar pedido (sin cliente_id: la tabla pedidos_piezas en muchos proyectos no tiene esa columna)
      const pedidoData = {
        equipo_id: equipoRelacionado?.id || null,
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

      guardadoExitoso.current = true;

      // Crear notificación
      if (data && data[0]) {
        try {
          await notificarPedidoNuevo(data[0], formData.proveedor);
        } catch (notifError) {
          console.error('Error creando notificación (no crítico):', notifError);
        }

        // Calcular montos para el pedido
        const precioTotal = parseFloat(formData.precio_total) || 0;
        const adelanto = parseFloat(formData.adelanto) || 0;
        const restante = precioTotal - adelanto;

        // Si el pedido está ligado a un equipo, sumar este adelanto al adelanto del equipo
        if (equipoRelacionado?.id && (adelanto > 0)) {
          try {
            const { data: eq } = await supabase
              .from('equipos')
              .select('adelanto')
              .eq('id', equipoRelacionado.id)
              .maybeSingle();
            const adelantoActual = parseFloat(eq?.adelanto || 0);
            const nuevoAdelanto = adelantoActual + adelanto;
            const { error: equipoError } = await supabase
              .from('equipos')
              .update({ adelanto: nuevoAdelanto })
              .eq('id', equipoRelacionado.id);

            if (equipoError) {
              console.error('Error actualizando adelanto del equipo:', equipoError);
            }
          } catch (updateError) {
            console.error('Error sumando adelanto al equipo:', updateError);
          }
        }

        // Navegar a página de nota PDF
        const pedidoParaNota = {
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
          tipo: 'pedido'
        };
        const proveedorParaNota = formData.proveedor ? { nombre: formData.proveedor, telefono: '', email: '' } : null;
        onPedidoAdded?.();
        onClose?.();
        const basePath = demoMode ? '/demo' : '';
        navigate(`${basePath}/nota-pdf`, {
          state: {
            equipo: pedidoParaNota,
            cliente: clienteFinal || null,
            proveedor: proveedorParaNota,
            tipo: 'recepcion',
            returnTo: `${basePath}/logistica`
          }
        });
      } else {
        onPedidoAdded?.();
        onClose?.();
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      // IMPORTANT: siempre liberar estados para que el botón no quede bloqueado
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const steps = [
    {
      title: '👤 Cliente',
      description: 'Ingresa el número de teléfono del cliente'
    },
    {
      title: '📋 Datos del Cliente',
      description: 'Completa los datos del cliente'
    },
    {
      title: '💻 Equipo (opcional)',
      description: 'Si quieres ligar el pedido a una nota de equipo, búscala aquí'
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
      className={mode === 'modal' ? 'typeform-modal-overlay' : 'typeform-page'}
      onClick={mode === 'modal' ? onClose : undefined}
      style={mode === 'modal' ? {
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
      } : undefined}
    >
      <div 
        className={mode === 'modal' ? 'typeform-modal' : 'typeform-modal typeform-page-inner'}
        onClick={mode === 'modal' ? (e) => e.stopPropagation() : undefined}
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

        {/* Step 0: Cliente - Teléfono */}
        {currentStep === 0 && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Cuál es el número de teléfono del cliente?</h2>
            <p className="typeform-description">{steps[0].description}</p>
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
                disabled={loading || isSubmitting}
              >
                Continuar →
              </button>
            )}
          </div>
        )}

        {/* Step 1: Cliente - Datos completos */}
        {currentStep === 1 && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">
              {clienteEncontrado ? 'Completa los datos faltantes del cliente' : 'Ingresa los datos del cliente'}
            </h2>
            <p className="typeform-description">{steps[1].description}</p>
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
                onClick={() => setCurrentStep(0)}
                className="typeform-btn-secondary"
                disabled={loading || isSubmitting}
              >
                ← Volver
              </button>
              <button
                type="button"
                onClick={() => handleFieldComplete('cliente_datos')}
                className="typeform-btn-primary"
                disabled={!formData.cliente_nombre || !formData.cliente_email || loading || isSubmitting}
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Nota de equipo (opcional) */}
        {currentStep === 2 && (
          <div className="typeform-step typeform-single-field">
            <h2 className="typeform-question">¿Quieres ligar este pedido a un equipo? (Opcional)</h2>
            <p className="typeform-description">{steps[2].description}</p>
            <div className="typeform-field-wrapper">
              <datalist id="notas-equipo">
                {notasDisponibles.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <input
                type="text"
                name="equipo_nota"
                value={formData.equipo_nota}
                onChange={handleInputChange}
                onBlur={(e) => {
                  const v = e.target.value?.trim();
                  if (v) buscarEquipoPorNota(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = formData.equipo_nota?.trim();
                    if (v) {
                      buscarEquipoPorNota(v);
                    } else {
                      handleFieldComplete('equipo_nota');
                    }
                  }
                }}
                list="notas-equipo"
                placeholder="Escribe o selecciona el número de nota"
                className="typeform-large-input"
                style={{ marginBottom: '1rem' }}
              />

              <button
                type="button"
                onClick={buscarEquipoPorNota}
                className="typeform-btn-secondary"
                disabled={buscandoEquipo || loading || isSubmitting}
                style={{ marginBottom: '1.25rem' }}
              >
                {buscandoEquipo ? 'Buscando...' : 'Buscar equipo por nota'}
              </button>

              {equipoRelacionado && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.25rem',
                  color: '#059669',
                  textAlign: 'left'
                }}>
                  ✓ Ligado a equipo #{equipoRelacionado.nota}: {equipoRelacionado.marca} {equipoRelacionado.modelo}
                </div>
              )}
            </div>
            <div className="typeform-buttons-horizontal">
              <button
                type="button"
                onClick={() =>
                  setCurrentStep(
                    clienteEncontrado && verificarDatosCompletos(clienteEncontrado).faltantes.length === 0
                      ? 0
                      : 1
                  )
                }
                className="typeform-btn-secondary"
                disabled={loading || isSubmitting}
              >
                ← Volver
              </button>
              <button
                type="button"
                onClick={() => handleFieldComplete('equipo_nota')}
                className="typeform-btn-primary"
                disabled={loading || isSubmitting || buscandoEquipo}
              >
                {formData.equipo_nota ? 'Continuar →' : 'Omitir →'}
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
                onClick={() => setCurrentStep(2)}
                className="typeform-btn-secondary"
                disabled={loading || isSubmitting}
              >
                ← Volver
              </button>
              {formData.producto && (
                <button
                  type="button"
                  onClick={() => handleFieldComplete('producto')}
                  className="typeform-btn-primary"
                  disabled={loading || isSubmitting}
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
                disabled={loading || isSubmitting}
              >
                ← Volver
              </button>
              {formData.cantidad && (
                <button
                  type="button"
                  onClick={() => handleFieldComplete('cantidad')}
                  className="typeform-btn-primary"
                  disabled={loading || isSubmitting}
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
                disabled={loading || isSubmitting}
              >
                ← Volver
              </button>
              <button
                type="button"
                onClick={() => handleFieldComplete('fecha_esperada')}
                className="typeform-btn-primary"
                disabled={loading || isSubmitting}
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
                ) : '✓ Agregar Pedido'}
            </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

