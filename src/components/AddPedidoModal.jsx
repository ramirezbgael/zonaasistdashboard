import { useState } from 'react';
import { supabase } from '../supabase.js';
import { notificarPedidoNuevo } from '../utils/notifications.js';
import './AddEquipoModalTypeform.css';
import Icon from './Icon.jsx';

export default function AddPedidoModal({ onClose, onPedidoAdded }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    proveedor: '',
    producto: '',
    cantidad: '',
    fecha_esperada: '',
    notas: ''
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
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

      // Insertar pedido
      const pedidoData = {
        proveedor_id: proveedorId,
        nombre_pieza: formData.producto,
        cantidad: parseInt(formData.cantidad) || 1,
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

      // Crear notificación
      if (data && data[0]) {
        try {
          await notificarPedidoNuevo(data[0], formData.proveedor);
        } catch (notifError) {
          console.error('Error creando notificación (no crítico):', notifError);
        }
      }

      console.log('Pedido guardado:', data);
      onPedidoAdded();
      onClose();
    } catch (error) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage = ((currentStep + 1) / 5) * 100;

  const steps = [
    { title: '¿A qué proveedor?', description: 'Selecciona o escribe el nombre del proveedor' },
    { title: '¿Qué producto necesitas?', description: 'Describe el producto o pieza' },
    { title: '¿Cuántas unidades?', description: 'Ingresa la cantidad' },
    { title: '¿Cuándo lo necesitas?', description: 'Fecha esperada de entrega' },
    { title: '¿Algún detalle adicional?', description: 'Notas adicionales (opcional)' }
  ];

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
          Paso {currentStep + 1} de 5
        </div>

        <div className="typeform-step typeform-single-field">
          {currentStep === 0 && (
            <>
              <h2 className="typeform-question">{steps[0].title}</h2>
              <p className="typeform-description">{steps[0].description}</p>
              <div className="typeform-field-wrapper">
                <input
                  type="text"
                  name="proveedor"
                  value={formData.proveedor}
                  onChange={handleInputChange}
                  placeholder="Escribe el nombre del proveedor..."
                  required
                  autoFocus
                  className="typeform-large-input"
                />
              </div>
              {formData.proveedor && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="typeform-btn-primary typeform-next-btn"
                >
                  Continuar <Icon name="arrow-right" />
                </button>
              )}
            </>
          )}

          {currentStep === 1 && (
            <>
              <h2 className="typeform-question">{steps[1].title}</h2>
              <p className="typeform-description">{steps[1].description}</p>
              <div className="typeform-field-wrapper">
                <input
                  type="text"
                  name="producto"
                  value={formData.producto}
                  onChange={handleInputChange}
                  placeholder="Ej: Disco SSD 500GB, RAM 8GB..."
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
                {formData.producto && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="typeform-btn-primary"
                  >
                    Continuar <Icon name="arrow-right" />
                  </button>
                )}
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <h2 className="typeform-question">{steps[2].title}</h2>
              <p className="typeform-description">{steps[2].description}</p>
              <div className="typeform-field-wrapper">
                <input
                  type="number"
                  name="cantidad"
                  value={formData.cantidad}
                  onChange={handleInputChange}
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
                  onClick={handleBack}
                  className="typeform-btn-secondary"
                >
                  <Icon name="arrow-left" /> Volver
                </button>
                {formData.cantidad && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="typeform-btn-primary"
                  >
                    Continuar <Icon name="arrow-right" />
                  </button>
                )}
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              <h2 className="typeform-question">{steps[3].title}</h2>
              <p className="typeform-description">{steps[3].description}</p>
              <div className="typeform-field-wrapper">
                <input
                  type="date"
                  name="fecha_esperada"
                  value={formData.fecha_esperada}
                  onChange={handleInputChange}
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
                <button
                  type="button"
                  onClick={handleNext}
                  className="typeform-btn-primary"
                >
                  Continuar <Icon name="arrow-right" />
                </button>
              </div>
            </>
          )}

          {currentStep === 4 && (
            <>
              <h2 className="typeform-question">{steps[4].title}</h2>
              <p className="typeform-description">{steps[4].description}</p>
              <div className="typeform-field-wrapper">
                <textarea
                  name="notas"
                  value={formData.notas}
                  onChange={handleInputChange}
                  placeholder="Notas adicionales..."
                  className="typeform-large-textarea"
                  rows="4"
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
                <form onSubmit={handleSubmit} style={{ display: 'inline' }}>
                  <button
                    type="submit"
                    className="typeform-btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : <><Icon name="check" /> Agregar Pedido</>}
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

