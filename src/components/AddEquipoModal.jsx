import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
import { notificarEquipoNuevo } from '../utils/notifications.js';

export default function AddEquipoModal({ onClose, onEquipoAdded }) {
  const [formData, setFormData] = useState({
    marca: '',
    modelo: '',
    color: '',
    cargador: null, // null = no seleccionado, true = sí se queda, false = no se queda
    nota: '',
    problema: '',
    proceso_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [existingData, setExistingData] = useState({
    colores: []
  });
  const [suggestions, setSuggestions] = useState({
    color: []
  });
  const [procesos, setProcesos] = useState([]);
  const [modelosDisponibles, setModelosDisponibles] = useState([]);

  const marcasPredefinidas = [
    'Dell', 'HP', 'Lenovo', 'Acer', 'ASUS', 'Toshiba', 'Sony', 'Samsung', 'Apple', 'MSI',
    'Epson'
  ];

  const modelosPorMarca = {
    'Dell': [
      'Inspiron 15 3000', 'Inspiron 15 5000', 'Inspiron 15 7000',
      'Latitude 3420', 'Latitude 5420', 'Latitude 7420',
      'XPS 13', 'XPS 15', 'Vostro 3500', 'OptiPlex 3080'
    ],
    'HP': [
      'Pavilion 15', 'Pavilion x360', 'EliteBook 840', 'EliteBook 850',
      'ProBook 450', 'ProBook 650', 'Spectre x360', 'Envy 13',
      'Omen 15', 'ZBook 15'
    ],
    'Lenovo': [
      'ThinkPad E14', 'ThinkPad E15', 'ThinkPad T14', 'ThinkPad T15',
      'IdeaPad 3', 'IdeaPad 5', 'Yoga 7i', 'Legion 5',
      'ThinkCentre M720', 'ThinkStation P330'
    ],
    'Acer': [
      'Aspire 3', 'Aspire 5', 'Aspire 7', 'Swift 3', 'Swift 5',
      'Nitro 5', 'Predator Helios', 'TravelMate P2', 'Spin 3',
      'Veriton X2660G'
    ],
    'ASUS': [
      'VivoBook 15', 'VivoBook S15', 'ZenBook 13', 'ZenBook 14',
      'ROG Strix G15', 'TUF Gaming F15', 'ExpertBook B1',
      'ProArt StudioBook', 'Chromebook Flip'
    ],
    'Toshiba': [
      'Satellite C55', 'Satellite L50', 'Portégé X30',
      'Tecra A50', 'dynabook Portégé X40'
    ],
    'Sony': [
      'VAIO Z', 'VAIO S', 'VAIO Pro', 'VAIO Fit'
    ],
    'Samsung': [
      'Galaxy Book Pro', 'Galaxy Book2', 'Notebook 9',
      'Chromebook 4', 'ATIV Book'
    ],
    'Apple': [
      'MacBook Air M1', 'MacBook Air M2', 'MacBook Pro 13"',
      'MacBook Pro 14"', 'MacBook Pro 16"', 'iMac 24"',
      'Mac mini', 'Mac Studio', 'iMac Pro'
    ],
    'MSI': [
      'Modern 14', 'Modern 15', 'Prestige 14', 'Prestige 15',
      'GF63 Thin', 'GL65 Leopard', 'GS66 Stealth', 'Creator 15'
    ],
    'Epson': [
      'L3150', 'L3250', 'L4150', 'L4260', 'L5190', 'L6160', 'L6170', 'L6190',
      'EcoTank L3110', 'EcoTank L3210', 'EcoTank L5590',
      'WorkForce WF-2830', 'WorkForce WF-2850', 'WorkForce Pro WF-3720',
      'Expression Home XP-2100', 'Expression Home XP-4100',
      'SureColor P400', 'SureColor T3170'
    ]
  };

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
          const colores = [...new Set(data.map(item => item.color))];

          setExistingData({
            colores
          });

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
        
        if (error) {
          console.error('Error al cargar procesos:', error);
          alert(`Error al cargar procesos: ${error.message}`);
          return;
        }
        
        console.log('Procesos cargados:', data);
        setProcesos(data || []);
      } catch (error) {
        console.error('Error inesperado al cargar procesos:', error);
        alert(`Error inesperado al cargar procesos: ${error.message}`);
      }
    };

    loadExistingData();
    loadProcesos();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'marca') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        modelo: ''
      }));
      
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
    
    if (isSubmitting || loading) {
      return;
    }
    
    setIsSubmitting(true);
    setLoading(true);

    try {
      if (!formData.marca.trim() || !formData.modelo.trim() || !formData.color.trim() || !formData.nota.trim() || !formData.proceso_id || formData.cargador === null) {
        alert('Por favor completa todos los campos requeridos (Marca, Modelo, Color, Cargador, Nota y Proceso)');
        setIsSubmitting(false);
        setLoading(false);
        return;
      }

      // Verificar si la nota ya existe (con retry para evitar race conditions)
      let notaExistente = null;
      let intentos = 0;
      const maxIntentos = 3;
      
      while (intentos < maxIntentos) {
        const { data, error: checkError } = await supabase
          .from('equipos')
          .select('id, nota')
          .eq('nota', formData.nota.trim())
          .maybeSingle();

        if (checkError) {
          console.error('Error al verificar nota:', checkError);
          if (intentos < maxIntentos - 1) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Esperar 500ms antes de reintentar
            intentos++;
            continue;
          }
        }

        notaExistente = data;
        break;
      }

      if (notaExistente) {
        setLoading(false);
        setIsSubmitting(false);
        alert(`La nota #${formData.nota.trim()} ya está en uso. Por favor usa otra nota.`);
        return;
      }

      const equipoData = {
        marca: formData.marca.trim(),
        modelo: formData.modelo.trim(),
        color: formData.color.trim(),
        nota: formData.nota.trim(),
        problema: formData.problema.trim() || null,
        cargador: formData.cargador !== null ? formData.cargador : false
      };

      console.log('Datos a insertar:', equipoData);
      
      const { data: testData, error: testError } = await supabase
        .from('equipos')
        .select('id')
        .limit(1);

      if (testError) {
        console.error('Error de permisos:', testError);
        alert(`Error de permisos: ${testError.message}`);
        setIsSubmitting(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('equipos')
        .insert([equipoData])
        .select();

      if (error) {
        console.error('Error al agregar equipo:', error);
        setIsSubmitting(false);
        setLoading(false);
        
        // Manejo específico de errores comunes
        if (error.code === '23505' || error.message.includes('duplicate key') || error.message.includes('equipos_nota_key')) {
          // Calcular siguiente nota disponible
          const { data: ultimaNota } = await supabase
            .from('equipos')
            .select('nota')
            .order('nota', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          const siguienteNota = ultimaNota ? (parseInt(ultimaNota.nota) + 1).toString() : '1';
          
          const usarNuevaNota = confirm(
            `La nota #${formData.nota.trim()} ya está en uso.\n\n` +
            `¿Deseas usar la nota #${siguienteNota} en su lugar?`
          );
          
          if (usarNuevaNota) {
            setFormData(prev => ({ ...prev, nota: siguienteNota }));
            // No retornar, permitir que el usuario intente de nuevo con la nueva nota
            return;
          } else {
            alert(`Por favor cambia la nota a otro número. La nota #${siguienteNota} está disponible.`);
            return;
          }
        } else if (error.message.includes('permission denied') || error.message.includes('RLS')) {
          alert('No tienes permisos para agregar equipos. Contacta al administrador.');
        } else {
          alert(`Error al agregar el equipo: ${error.message || 'Error desconocido'}`);
        }
        return;
      }
      
      console.log('Equipo agregado exitosamente:', data);
      
      // El equipo se guardó correctamente, ahora hacer operaciones adicionales (no críticas)
      if (data && data[0]) {
        // Crear estado del equipo (no crítico si falla)
        try {
          await supabase
            .from('estado_equipos')
            .insert({
              equipo_id: data[0].id,
              estado: 'en_proceso',
              proceso_actual_id: parseInt(formData.proceso_id),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
        } catch (estadoError) {
          console.error('Error al crear estado del equipo (no crítico):', estadoError);
        }

        // Crear historial (no crítico si falla)
        try {
          const procesoSeleccionado = procesos.find(p => p.id === parseInt(formData.proceso_id));
          await supabase
            .from('historial_procesos')
            .insert({
              equipo_id: data[0].id,
              proceso_id: parseInt(formData.proceso_id),
              notas: `Proceso iniciado: ${procesoSeleccionado?.nombre}`,
              fecha_inicio: new Date().toISOString()
            });
        } catch (historialError) {
          console.error('Error al crear historial (no crítico):', historialError);
        }

        // Crear notificación (no crítico si falla)
        try {
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
      
      // Limpiar el formulario inmediatamente para evitar doble envío
      setFormData({
        marca: '',
        modelo: '',
        color: '',
        problema: '',
        nota: '',
        proceso_id: '',
        cargador: null
      });
      
      // Deshabilitar el botón de envío inmediatamente
      setIsSubmitting(false);
      setLoading(false);
      
      // Mostrar confirmación visual
      setShowSuccess(true);
      
      // Notificar al componente padre para actualizar la lista
      if (onEquipoAdded) {
        try {
          onEquipoAdded();
        } catch (updateError) {
          console.error('Error actualizando lista (no crítico):', updateError);
        }
      }
      
      // Cerrar el modal después de 1.5 segundos
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error inesperado:', error);
      setIsSubmitting(false);
      setLoading(false);
      
      // Manejo de errores más amigable
      if (error.message.includes('duplicate key') || error.message.includes('23505')) {
        alert(`La nota #${formData.nota.trim()} ya está en uso. Por favor usa otra nota.`);
      } else {
        alert(`Error inesperado: ${error.message || 'Por favor intenta de nuevo'}`);
      }
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Debug: verificar que el campo cargador esté en el estado
  console.log('FormData cargador:', formData.cargador);
  console.log('Procesos disponibles:', procesos);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="w-full max-w-4xl bg-slate-900 rounded-xl shadow-2xl flex border border-slate-700">
        <div className="hidden md:flex flex-col justify-center items-center w-1/3 bg-slate-800 rounded-l-xl border-r border-slate-700 p-8">
          <div className="mb-4 text-blue-500 font-bold text-xs tracking-widest px-3 py-1 rounded bg-blue-700">PASO EN EJECUCIÓN</div>
          <h2 className="text-2xl font-bold text-white mb-2 text-center">Agregar Nuevo Equipo</h2>
          <p className="text-slate-300 text-sm text-center">Completa los datos del equipo a ingresar. Todos los campos marcados son obligatorios para el registro técnico.</p>
        </div>
        <div className="flex-1 p-6 md:p-10 bg-slate-900 rounded-r-xl flex flex-col justify-center">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 text-2xl font-bold focus:outline-none">×</button>
          <h2 className="md:hidden text-xl font-bold text-white mb-4 text-center">Agregar Nuevo Equipo</h2>
          {showSuccess ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-5xl text-green-500 mb-4">✓</div>
              <h3 className="text-lg font-semibold text-green-400 mb-2">¡Equipo agregado exitosamente!</h3>
              <p className="text-slate-300 text-center">El equipo ha sido guardado correctamente.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="marca" className="block text-slate-200 font-medium mb-1">Marca</label>
                  <select
                    id="marca"
                    name="marca"
                    value={formData.marca}
                    onChange={handleInputChange}
                    required
                    disabled={loading || isSubmitting}
                    className="w-full rounded border border-slate-600 bg-slate-800 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">Seleccionar marca...</option>
                    {marcasPredefinidas.map(marca => (
                      <option key={marca} value={marca}>{marca}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="modelo" className="block text-slate-200 font-medium mb-1">Modelo</label>
                  <select
                    id="modelo"
                    name="modelo"
                    value={formData.modelo}
                    onChange={handleInputChange}
                    required
                    disabled={!formData.marca || loading || isSubmitting}
                    className="w-full rounded border border-slate-600 bg-slate-800 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">{!formData.marca ? 'Primero selecciona una marca...' : 'Seleccionar modelo...'}</option>
                    {modelosDisponibles.map(modelo => (
                      <option key={modelo} value={modelo}>{modelo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="color" className="block text-slate-200 font-medium mb-1">Color <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    id="color"
                    name="color"
                    value={formData.color}
                    onChange={handleInputChange}
                    required
                    autoComplete="off"
                    placeholder="Color..."
                    className="w-full rounded border border-slate-600 bg-slate-800 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={loading || isSubmitting}
                  />
                  {suggestions.color.length > 0 && (
                    <div className="mt-1 bg-slate-800 border border-slate-600 rounded shadow text-white">
                      {suggestions.color.map((color, index) => (
                        <div
                          key={index}
                          className="px-3 py-1 hover:bg-blue-700 cursor-pointer"
                          onClick={() => handleSuggestionClick('color', color)}
                        >
                          {color}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="cargador" className="block text-slate-200 font-medium mb-1">
                    ¿Se queda el cargador? <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="cargador"
                    name="cargador"
                    value={formData.cargador === true ? 'si' : formData.cargador === false ? 'no' : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        cargador: value === 'si' ? true : value === 'no' ? false : null
                      }));
                    }}
                    required
                    disabled={loading || isSubmitting}
                    className="w-full rounded border-2 border-slate-600 bg-slate-800 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">-- Seleccionar --</option>
                    <option value="si">Sí, se queda el cargador</option>
                    <option value="no">No, no se queda el cargador</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="nota" className="block text-slate-200 font-medium mb-1">Nota</label>
                  <input
                    type="text"
                    id="nota"
                    name="nota"
                    value={formData.nota}
                    onChange={handleInputChange}
                    required
                    className="w-full rounded border border-slate-600 bg-slate-800 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={loading || isSubmitting}
                  />
                </div>
                <div>
                  <label htmlFor="proceso_id" className="block text-slate-200 font-medium mb-1">Proceso a realizar <span className="text-red-400">*</span></label>
                  <select
                    id="proceso_id"
                    name="proceso_id"
                    value={formData.proceso_id}
                    onChange={handleInputChange}
                    required
                    disabled={loading || isSubmitting || procesos.length === 0}
                    className="w-full rounded border border-slate-600 bg-slate-800 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">
                      {procesos.length === 0 ? 'Cargando procesos...' : 'Seleccionar proceso...'}
                    </option>
                    {procesos.length > 0 ? (
                      procesos.map(proceso => (
                        <option key={proceso.id} value={proceso.id}>{proceso.nombre}</option>
                      ))
                    ) : (
                      <option value="" disabled>Cargando procesos...</option>
                    )}
                  </select>
                  {procesos.length === 0 && (
                    <p className="text-xs text-yellow-400 mt-1">No se pudieron cargar los procesos. Verifica la consola para más detalles.</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="problema" className="block text-slate-200 font-medium mb-1">Detalle</label>
                  <textarea
                    id="problema"
                    name="problema"
                    value={formData.problema}
                    onChange={handleInputChange}
                    rows="2"
                    placeholder="Detalles adicionales (opcional)"
                    className="w-full rounded border border-slate-600 bg-slate-800 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={loading || isSubmitting}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded font-semibold bg-slate-700 text-white border border-slate-600 hover:bg-slate-600 focus:outline-none"
                  disabled={loading || isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded font-bold bg-blue-700 text-white shadow hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading || isSubmitting}
                >
                  {loading ? (
                    <span>Agregando...</span>
                  ) : 'Agregar Equipo'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
