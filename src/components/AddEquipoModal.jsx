import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
import { notificarEquipoNuevo } from '../utils/notifications.js';
import './AddEquipoModal.css';

export default function AddEquipoModal({ onClose, onEquipoAdded }) {
  const [formData, setFormData] = useState({
    marca: '',
    modelo: '',
    color: '',
    nota: '',
    problema: '',
    proceso_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [existingData, setExistingData] = useState({
    colores: []
  });
  const [suggestions, setSuggestions] = useState({
    color: []
  });
  const [procesos, setProcesos] = useState([]);
  const [modelosDisponibles, setModelosDisponibles] = useState([]);

  // Marcas predefinidas
  const marcasPredefinidas = [
    // PCs
    'Dell', 'HP', 'Lenovo', 'Acer', 'ASUS', 'Toshiba', 'Sony', 'Samsung', 'Apple', 'MSI',
    // Impresoras Epson
    'Epson'
  ];

  // Modelos por marca
  const modelosPorMarca = {
    // Dell
    'Dell': [
      'Inspiron 15 3000', 'Inspiron 15 5000', 'Inspiron 15 7000',
      'Latitude 3420', 'Latitude 5420', 'Latitude 7420',
      'XPS 13', 'XPS 15', 'Vostro 3500', 'OptiPlex 3080'
    ],
    // HP
    'HP': [
      'Pavilion 15', 'Pavilion x360', 'EliteBook 840', 'EliteBook 850',
      'ProBook 450', 'ProBook 650', 'Spectre x360', 'Envy 13',
      'Omen 15', 'ZBook 15'
    ],
    // Lenovo
    'Lenovo': [
      'ThinkPad E14', 'ThinkPad E15', 'ThinkPad T14', 'ThinkPad T15',
      'IdeaPad 3', 'IdeaPad 5', 'Yoga 7i', 'Legion 5',
      'ThinkCentre M720', 'ThinkStation P330'
    ],
    // Acer
    'Acer': [
      'Aspire 3', 'Aspire 5', 'Aspire 7', 'Swift 3', 'Swift 5',
      'Nitro 5', 'Predator Helios', 'TravelMate P2', 'Spin 3',
      'Veriton X2660G'
    ],
    // ASUS
    'ASUS': [
      'VivoBook 15', 'VivoBook S15', 'ZenBook 13', 'ZenBook 14',
      'ROG Strix G15', 'TUF Gaming F15', 'ExpertBook B1',
      'ProArt StudioBook', 'Chromebook Flip'
    ],
    // Toshiba
    'Toshiba': [
      'Satellite C55', 'Satellite L50', 'Portégé X30',
      'Tecra A50', 'dynabook Portégé X40'
    ],
    // Sony
    'Sony': [
      'VAIO Z', 'VAIO S', 'VAIO Pro', 'VAIO Fit'
    ],
    // Samsung
    'Samsung': [
      'Galaxy Book Pro', 'Galaxy Book2', 'Notebook 9',
      'Chromebook 4', 'ATIV Book'
    ],
    // Apple
    'Apple': [
      'MacBook Air M1', 'MacBook Air M2', 'MacBook Pro 13"',
      'MacBook Pro 14"', 'MacBook Pro 16"', 'iMac 24"',
      'Mac mini', 'Mac Studio', 'iMac Pro'
    ],
    // MSI
    'MSI': [
      'Modern 14', 'Modern 15', 'Prestige 14', 'Prestige 15',
      'GF63 Thin', 'GL65 Leopard', 'GS66 Stealth', 'Creator 15'
    ],
    // Epson
    'Epson': [
      'L3150', 'L3250', 'L4150', 'L4260', 'L5190', 'L6160', 'L6170', 'L6190',
      'EcoTank L3110', 'EcoTank L3210', 'EcoTank L5590',
      'WorkForce WF-2830', 'WorkForce WF-2850', 'WorkForce Pro WF-3720',
      'Expression Home XP-2100', 'Expression Home XP-4100',
      'SureColor P400', 'SureColor T3170'
    ]
  };

  // Cargar datos existentes al abrir el modal
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const { data, error } = await supabase
          .from('equipos')
          .select('color, nota')
          .order('nota', { ascending: false });

        if (error) {
          console.error('Error al cargar datos:', error);
          return;
        }

        if (data && data.length > 0) {
          // Obtener colores únicos
          const colores = [...new Set(data.map(item => item.color))];

          setExistingData({
            colores
          });

          // Calcular la siguiente nota
          const ultimaNota = data[0].nota;
          const siguienteNota = parseInt(ultimaNota) + 1;
          
          setFormData(prev => ({
            ...prev,
            nota: siguienteNota.toString()
          }));
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    const loadProcesos = async () => {
      try {
        const { data, error } = await supabase
          .from('procesos')
          .select('*')
          .order('id');
        
        if (error) throw error;
        setProcesos(data || []);
      } catch (error) {
        console.error('Error al cargar procesos:', error);
      }
    };

    loadExistingData();
    loadProcesos();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia la marca, actualizar modelos disponibles y resetear modelo
    if (name === 'marca') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        modelo: '' // Resetear modelo cuando cambia la marca
      }));
      
      // Actualizar modelos disponibles
      if (value && modelosPorMarca[value]) {
        setModelosDisponibles(modelosPorMarca[value]);
      } else {
        setModelosDisponibles([]);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Mostrar sugerencias solo para color
    if (name === 'color' && value.trim()) {
      const filtered = existingData.colores.filter(color => 
        color.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(prev => ({ ...prev, color: filtered }));
    } else {
      setSuggestions(prev => ({ ...prev, [name]: [] }));
    }
  };

  const handleSuggestionClick = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setSuggestions(prev => ({ ...prev, [field]: [] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar que los campos requeridos no estén vacíos
      if (!formData.marca.trim() || !formData.modelo.trim() || !formData.color.trim() || !formData.nota.trim() || !formData.proceso_id) {
        alert('Por favor completa todos los campos requeridos (Marca, Modelo, Color, Nota y Proceso)');
        setLoading(false);
        return;
      }

      // Preparar los datos para inserción
      const equipoData = {
        marca: formData.marca.trim(),
        modelo: formData.modelo.trim(),
        color: formData.color.trim(),
        nota: formData.nota.trim(),
        problema: formData.problema.trim() || null
      };

      console.log('Datos a insertar:', equipoData);
      
      // Verificar permisos de lectura primero
      const { data: testData, error: testError } = await supabase
        .from('equipos')
        .select('id')
        .limit(1);

      if (testError) {
        console.error('Error de permisos:', testError);
        alert(`Error de permisos: ${testError.message}`);
        setLoading(false);
        return;
      }

      // Intentar insertar el equipo
      const { data, error } = await supabase
        .from('equipos')
        .insert([equipoData])
        .select();

      if (error) {
        console.error('Error al agregar equipo:', error);
        alert(`Error al agregar el equipo: ${error.message}`);
      } else {
        console.log('Equipo agregado exitosamente:', data);
        
        // Crear estado inicial del equipo con el proceso seleccionado
        if (data && data[0]) {
          const { error: estadoError } = await supabase
            .from('estado_equipos')
            .insert({
              equipo_id: data[0].id,
              estado: 'en_proceso',
              proceso_actual_id: parseInt(formData.proceso_id),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (estadoError) {
            console.error('Error al crear estado del equipo:', estadoError);
          }

          // Registrar inicio del proceso en historial
          const procesoSeleccionado = procesos.find(p => p.id === parseInt(formData.proceso_id));
          const { error: historialError } = await supabase
            .from('historial_procesos')
            .insert({
              equipo_id: data[0].id,
              proceso_id: parseInt(formData.proceso_id),
              notas: `Proceso iniciado: ${procesoSeleccionado?.nombre}`,
              fecha_inicio: new Date().toISOString()
            });

          if (historialError) {
            console.error('Error al crear historial:', historialError);
          }

          // Crear notificación de recepción (para enviar nota de recepción por correo)
          try {
            // Obtener información del cliente si existe
            let clienteInfo = null;
            if (data[0].cliente_id) {
              const { data: clienteData, error: clienteError } = await supabase
                .from('clientes')
                .select('id, nombre, telefono, email')
                .eq('id', data[0].cliente_id)
                .single();
              
              if (!clienteError && clienteData) {
                clienteInfo = clienteData;
              }
            }

            await notificarEquipoNuevo(data[0], clienteInfo);
          } catch (notifError) {
            console.error('Error creando notificación de recepción (no crítico):', notifError);
          }
        }
        
        onEquipoAdded(); // Recargar la lista
        onClose(); // Cerrar el modal
      }
    } catch (error) {
      console.error('Error inesperado:', error);
      alert(`Error inesperado: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <button onClick={onClose} className="close-btn">×</button>
        <h2>Agregar Nuevo Equipo</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="marca">Marca:</label>
            <select
              id="marca"
              name="marca"
              value={formData.marca}
              onChange={handleInputChange}
              required
            >
              <option value="">Seleccionar marca...</option>
              {marcasPredefinidas.map(marca => (
                <option key={marca} value={marca}>
                  {marca}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="modelo">Modelo:</label>
            <select
              id="modelo"
              name="modelo"
              value={formData.modelo}
              onChange={handleInputChange}
              required
              disabled={!formData.marca}
            >
              <option value="">
                {!formData.marca ? 'Primero selecciona una marca...' : 'Seleccionar modelo...'}
              </option>
              {modelosDisponibles.map(modelo => (
                <option key={modelo} value={modelo}>
                  {modelo}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="color">Color:</label>
            <div className="color-selector-container">
              <div className="color-options-grid">
                {[
                  { name: 'Negro', value: '#2c2c2c' },
                  { name: 'Blanco', value: '#f8f9fa' },
                  { name: 'Gris', value: '#6c757d' },
                  { name: 'Rojo', value: '#dc3545' },
                  { name: 'Verde', value: '#28a745' },
                  { name: 'Azul', value: '#0d6efd' },
                  { name: 'Amarillo', value: '#ffc107' },
                  { name: 'Naranja', value: '#fd7e14' },
                  { name: 'Morado', value: '#6f42c1' },
                  { name: 'Rosa', value: '#e83e8c' },
                  { name: 'Celeste', value: '#17a2b8' },
                  { name: 'Plata', value: '#c0c0c0' },
                  { name: 'Dorado', value: '#ffd700' },
                  { name: 'Azul marino', value: '#001f3f' },
                  { name: 'Verde claro', value: '#90ee90' },
                  { name: 'Gris oscuro', value: '#495057' }
                ].map((colorOption) => (
                  <button
                    key={colorOption.name}
                    type="button"
                    className={`color-option-circle ${formData.color.toLowerCase() === colorOption.name.toLowerCase() ? 'selected' : ''}`}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, color: colorOption.name }));
                      setSuggestions(prev => ({ ...prev, color: [] }));
                    }}
                    title={colorOption.name}
                    style={{ backgroundColor: colorOption.value }}
                  >
                    {formData.color.toLowerCase() === colorOption.name.toLowerCase() && (
                      <span className="color-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
              <input
                type="text"
                id="color"
                name="color"
                value={formData.color}
                onChange={handleInputChange}
                required
                autoComplete="off"
                placeholder="O escribe un color personalizado..."
                className="color-text-input"
              />
              {suggestions.color.length > 0 && (
                <div className="suggestions">
                  {suggestions.color.map((color, index) => (
                    <div
                      key={index}
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick('color', color)}
                    >
                      {color}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="nota">Nota:</label>
            <input
              type="text"
              id="nota"
              name="nota"
              value={formData.nota}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="proceso_id">Proceso a realizar:</label>
            <select
              id="proceso_id"
              name="proceso_id"
              value={formData.proceso_id}
              onChange={handleInputChange}
              required
            >
              <option value="">Seleccionar proceso...</option>
              {procesos.map(proceso => (
                <option key={proceso.id} value={proceso.id}>
                  {proceso.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="problema">Detalle:</label>
            <textarea
              id="problema"
              name="problema"
              value={formData.problema}
              onChange={handleInputChange}
              rows="2"
              placeholder="Detalles adicionales (opcional)"
              className="detalle-textarea"
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Agregando...' : 'Agregar Equipo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
