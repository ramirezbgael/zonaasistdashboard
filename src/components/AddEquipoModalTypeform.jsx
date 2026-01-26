import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase.js';
import useClienteSearch from '../hooks/useClienteSearch.js';
import { notificarEquipoNuevo } from '../utils/notifications.js';
import { uploadEquipoPhoto } from '../services/photoUpload.service.js';
import NotaPDF from './NotaPDF.jsx';
import './AddEquipoModalTypeform.css';

export default function AddEquipoModalTypeform({ onClose, onEquipoAdded }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formSubStep, setFormSubStep] = useState(0); // 0: marca, 1: modelo, 2: color, 3: cargador
  const [additionalSubStep, setAdditionalSubStep] = useState(0); // 0: proceso, 1: cliente_telefono, 2: cliente_datos (nombre/email), 3: detalle
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Autocompletado
  const [marcaSuggestions, setMarcaSuggestions] = useState([]);
  const [modeloSuggestions, setModeloSuggestions] = useState([]);
  const [showMarcaSuggestions, setShowMarcaSuggestions] = useState(false);
  const [showModeloSuggestions, setShowModeloSuggestions] = useState(false);
  
  const [formData, setFormData] = useState({
    marca: '',
    modelo: '',
    color: '',
    cargador: null, // null = no seleccionado, true = sí se queda, false = no se queda
    problema: '',
    contraseña: '',
    proceso_id: '',
    cliente_telefono: '',
    cliente_nombre: '',
    cliente_email: ''
  });
  const [loading, setLoading] = useState(false);
  const [procesos, setProcesos] = useState([]);
  const { clienteEncontrado, buscarCliente, actualizarCliente, obtenerOCrearCliente, verificarDatosCompletos } = useClienteSearch();
  const [datosFaltantes, setDatosFaltantes] = useState([]);
  const [siguienteNota, setSiguienteNota] = useState(null);
  const [showNotaPDF, setShowNotaPDF] = useState(false);
  const [equipoGuardado, setEquipoGuardado] = useState(null);
  const [clienteGuardado, setClienteGuardado] = useState(null);

  // Marcas predefinidas para autocompletado
  const marcasPredefinidas = [
    'Dell', 'HP', 'Lenovo', 'Acer', 'ASUS', 'Toshiba', 'Sony', 'Samsung', 'Apple', 'MSI', 'Epson'
  ];

  const modelosPorMarca = {
    'Dell': ['Inspiron 15 3000', 'Inspiron 15 5000', 'Latitude 3420', 'XPS 13', 'XPS 15', 'Inspiron 14', 'Latitude 5520'],
    'HP': ['Pavilion 15', 'EliteBook 840', 'ProBook 450', 'Spectre x360', 'Pavilion 14', 'EliteBook 850'],
    'Lenovo': ['ThinkPad E14', 'ThinkPad E15', 'IdeaPad 3', 'Yoga 7i', 'ThinkPad X1', 'Legion 5'],
    'Acer': ['Aspire 3', 'Aspire 5', 'Swift 3', 'Nitro 5', 'Aspire 7', 'Predator'],
    'ASUS': ['VivoBook 15', 'ZenBook 13', 'ROG Strix G15', 'VivoBook 14', 'ZenBook 14'],
    'Epson': ['L3150', 'L3250', 'L4150', 'EcoTank L3110', 'L4260', 'L6190'],
    'Apple': ['MacBook Air', 'MacBook Pro', 'iMac', 'Mac Mini'],
    'Samsung': ['Galaxy Book', 'Notebook 9']
  };

  // Función para filtrar sugerencias de marca
  const filterMarcaSuggestions = (value) => {
    if (!value || value.trim() === '') {
      setMarcaSuggestions([]);
      setShowMarcaSuggestions(false);
      return;
    }
    
    const filtered = marcasPredefinidas.filter(marca =>
      marca.toLowerCase().includes(value.toLowerCase())
    );
    setMarcaSuggestions(filtered.slice(0, 5));
    setShowMarcaSuggestions(filtered.length > 0);
  };

  // Función para filtrar sugerencias de modelo
  const filterModeloSuggestions = (value, marca) => {
    if (!value || value.trim() === '' || !marca) {
      setModeloSuggestions([]);
      setShowModeloSuggestions(false);
      return;
    }
    
    const modelos = modelosPorMarca[marca] || [];
    const filtered = modelos.filter(modelo =>
      modelo.toLowerCase().includes(value.toLowerCase())
    );
    setModeloSuggestions(filtered.slice(0, 5));
    setShowModeloSuggestions(filtered.length > 0);
  };

  // Funciones helper para el selector de colores
  const getColorHexForPicker = (colorName) => {
    const colorMap = {
      'Negro': '#000000',
      'Blanco': '#ffffff',
      'Gris': '#808080',
      'Plateado': '#c0c0c0',
      'Dorado': '#ffd700',
      'Rojo': '#ff0000',
      'Azul': '#0000ff',
      'Verde': '#008000',
      'Naranja': '#ffa500'
    };
    // Si es un hex code, devolverlo directamente
    if (colorName && colorName.startsWith('#')) {
      return colorName;
    }
    return colorMap[colorName] || colorName || '#cccccc';
  };

  const hexToColorName = (hex) => {
    // Convertir hex a nombre aproximado si es posible
    const colorMap = {
      '#000000': 'Negro',
      '#ffffff': 'Blanco',
      '#808080': 'Gris',
      '#c0c0c0': 'Plateado',
      '#ffd700': 'Dorado',
      '#ff0000': 'Rojo',
      '#0000ff': 'Azul',
      '#008000': 'Verde',
      '#ffa500': 'Naranja'
    };
    return colorMap[hex.toLowerCase()] || hex;
  };

  // Verificar disponibilidad de la API de cámara
  const checkCameraAvailability = () => {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.startsWith('192.168.') ||
                       window.location.hostname.startsWith('10.');
    const isHTTPS = window.location.protocol === 'https:';
    const userAgent = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    
    // Verificar si existe la API antigua (polyfill)
    const hasOldAPI = navigator.getUserMedia || 
                     navigator.webkitGetUserMedia || 
                     navigator.mozGetUserMedia || 
                     navigator.msGetUserMedia;
    
    if (!navigator.mediaDevices && !hasOldAPI) {
      let errorMsg = '⚠️ Tu navegador no soporta el acceso a la cámara.\n\n';
      
      if (isIOS) {
        errorMsg += 'En iPhone/iPad:\n';
        errorMsg += '• Usa Safari (versión 11 o superior)\n';
        errorMsg += '• O Chrome para iOS\n';
        errorMsg += '• Asegúrate de usar HTTPS\n\n';
      }
      
      if (!isHTTPS && !isLocalhost) {
        errorMsg += '⚠️ Necesitas HTTPS para acceder a la cámara desde dispositivos móviles.\n\n';
      }
      
      errorMsg += 'Puedes continuar sin cámara y agregar los datos manualmente.';
      
      return {
        available: false,
        error: errorMsg,
        canContinue: true
      };
    }
    
    if (navigator.mediaDevices && !navigator.mediaDevices.getUserMedia) {
      let errorMsg = '⚠️ La función getUserMedia no está disponible.\n\n';
      
      if (!isHTTPS && !isLocalhost) {
        errorMsg += 'Necesitas usar HTTPS para acceder a la cámara.\n\n';
      }
      
      errorMsg += 'Por favor:\n';
      errorMsg += '• Actualiza tu navegador a la última versión\n';
      errorMsg += '• O usa HTTPS en lugar de HTTP\n\n';
      errorMsg += 'Puedes continuar sin cámara y agregar los datos manualmente.';
      
      return {
        available: false,
        error: errorMsg,
        canContinue: true
      };
    }
    
    return { available: true };
  };

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    // Guardar el valor original del overflow
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const originalHeight = document.body.style.height;
    
    // Obtener la posición actual del scroll
    const scrollY = window.scrollY;
    
    // Prevenir scroll - método más simple que no afecta el posicionamiento
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'relative';
    document.body.style.height = '100vh';
    
    // Cleanup: restaurar el scroll cuando el modal se cierre
    return () => {
      document.body.style.overflow = originalOverflow || '';
      document.body.style.position = originalPosition || '';
      document.body.style.top = originalTop || '';
      document.body.style.width = originalWidth || '';
      document.body.style.height = originalHeight || '';
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
      }
    };
  }, []);

  // Verificar disponibilidad de cámara al cargar
  useEffect(() => {
    const cameraCheck = checkCameraAvailability();
    if (!cameraCheck.available) {
      setCameraError(cameraCheck.error);
    }
  }, []);

  // Limpiar sugerencias cuando cambia el sub-paso del formulario
  useEffect(() => {
    if (currentStep === 2) {
      setShowMarcaSuggestions(false);
      setShowModeloSuggestions(false);
      setMarcaSuggestions([]);
      setModeloSuggestions([]);
    }
  }, [formSubStep, currentStep]);

  // Resetear sub-pasos cuando cambia el paso principal
  useEffect(() => {
    if (currentStep !== 2) {
      setFormSubStep(0);
    }
    if (currentStep !== 3) {
      setAdditionalSubStep(0);
    }
  }, [currentStep]);

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        // Cargar procesos
        const { data: procesosData } = await supabase
          .from('procesos')
          .select('*')
          .order('id');
        setProcesos(procesosData || []);

        // Cargar siguiente nota automáticamente (sin mostrarla en el form)
        const { data: equiposData } = await supabase
          .from('equipos')
          .select('nota')
          .order('nota', { ascending: false })
          .limit(1);

        if (equiposData && equiposData.length > 0) {
          const siguiente = parseInt(equiposData[0].nota) + 1;
          setSiguienteNota(siguiente);
        } else {
          setSiguienteNota(1); // Primera nota
        }

      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

  // Limpiar stream de cámara al desmontar o cerrar
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    };
  }, [stream]);

  // Manejar el video cuando el stream cambia
  useEffect(() => {
    if (stream && videoRef.current && currentStep === 1) {
      videoRef.current.srcObject = stream;
      setVideoReady(false);
      
      const video = videoRef.current;
      
      const handleLoadedMetadata = () => {
        setVideoReady(true);
        setCameraError(null);
      };
      
      const handleError = (e) => {
        console.error('Video error:', e);
        setCameraError('Error al mostrar el video');
        setVideoReady(false);
      };
      
      const handlePlaying = () => {
        setVideoReady(true);
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', handleError);
      video.addEventListener('playing', handlePlaying);
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('error', handleError);
        video.removeEventListener('playing', handlePlaying);
      };
    }
  }, [stream, currentStep]);

  // Activar cámara
  const startCamera = async () => {
    if (startingCamera) return; // Evitar múltiples llamadas
    
    try {
      setStartingCamera(true);
      console.log('[Camera] Iniciando activación de cámara...');
      setCameraError(null);
      setVideoReady(false);
      
      // Verificar disponibilidad de la API
      const cameraCheck = checkCameraAvailability();
      if (!cameraCheck.available) {
        setCameraError(cameraCheck.error);
        setStartingCamera(false);
        return;
      }
      
      // Intentar primero con cámara trasera (environment)
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (envError) {
        console.log('[Camera] Error con cámara trasera, intentando frontal...', envError);
        // Si falla, intentar con cámara frontal
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
        } catch (userError) {
          console.log('[Camera] Error con cámara frontal, intentando sin restricciones...', userError);
          // Último intento sin restricciones
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
        }
      }
      
      console.log('[Camera] Stream obtenido exitosamente');
      setStream(mediaStream);
      setCurrentStep(1); // Cambiar al paso 1 - el useEffect manejará el video
      setFormSubStep(0); // Resetear sub-paso del formulario
      console.log('[Camera] Cambiado a paso 1');
    } catch (error) {
      console.error('[Camera] Error accessing camera:', error);
      let errorMessage;
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permisos de cámara denegados. Por favor, permite el acceso a la cámara en la configuración de tu navegador.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No se encontró ninguna cámara en tu dispositivo.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Tu navegador no soporta el acceso a la cámara. Por favor, usa Safari actualizado o Chrome en iOS.';
      } else if (error.message && error.message.includes('getUserMedia')) {
        errorMessage = 'Error al acceder a la cámara. Asegúrate de usar HTTPS y un navegador compatible.';
      } else {
        errorMessage = error.message || 'No se pudo acceder a la cámara. Por favor, intenta de nuevo.';
      }
      
      setCameraError(errorMessage);
      setVideoReady(false);
      // Permanecer en el paso actual y mostrar error
    } finally {
      setStartingCamera(false);
    }
  };

  // Saltar cámara y continuar al formulario
  const skipCamera = () => {
    // Detener stream si existe
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setVideoReady(false);
    setCameraError(null);
    setFormSubStep(0); // Iniciar desde el primer campo
    setCurrentStep(2);
  };

  // Función para cerrar el modal limpiando recursos
  const handleClose = () => {
    // Detener stream de cámara si existe
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    onClose();
  };

  // Capturar imagen
  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg');
      setCapturedImage(imageData);
      
      // Detener cámara
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      
      // Ir directamente al formulario
      setFormSubStep(0); // Iniciar desde el primer campo
      setCurrentStep(2);
    }
  };

  // Limpiar stream al cerrar
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    
    // Si es teléfono, manejar de forma asíncrona
    if (name === 'cliente_telefono') {
      setFormData(prev => ({ ...prev, [name]: value }));
      // Buscar cliente cuando se escribe el teléfono
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
        setDatosFaltantes(['nombre', 'email']);
        setFormData(prev => ({ ...prev, cliente_nombre: '', cliente_email: '' }));
      }
    } else {
      // Para otros campos, manejo normal
      setFormData(prev => {
        const newData = { ...prev, [name]: value };
        
        // Filtrar sugerencias cuando cambia la marca o modelo
        if (name === 'marca') {
          filterMarcaSuggestions(value);
          // Limpiar modelo si cambia la marca
          if (prev.marca !== value) {
            newData.modelo = '';
            setModeloSuggestions([]);
          }
        } else if (name === 'modelo') {
          filterModeloSuggestions(value, formData.marca);
        }
        
        return newData;
      });
    }
  };

  const handleSuggestionClick = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      if (field === 'marca') {
        setShowMarcaSuggestions(false);
        setMarcaSuggestions([]);
        // Limpiar modelo cuando cambia la marca
        newData.modelo = '';
        // Avanzar al siguiente paso automáticamente
        setTimeout(() => setFormSubStep(1), 300);
      } else if (field === 'modelo') {
        setShowModeloSuggestions(false);
        setModeloSuggestions([]);
        // Avanzar al siguiente paso automáticamente
        setTimeout(() => setFormSubStep(2), 300);
      }
      return newData;
    });
  };

  // Avanzar al siguiente campo automáticamente
  const handleFieldComplete = (field) => {
    if (field === 'marca' && formData.marca.trim()) {
      setTimeout(() => setFormSubStep(1), 300);
    } else if (field === 'modelo' && formData.modelo.trim()) {
      setTimeout(() => setFormSubStep(2), 300);
    } else if (field === 'color' && formData.color.trim()) {
      setTimeout(() => setFormSubStep(3), 300);
    } else if (field === 'cargador' && formData.cargador !== null) {
      setTimeout(() => {
        setAdditionalSubStep(0);
        setCurrentStep(3);
      }, 300);
    }
  };

  // Avanzar en información adicional
  const handleAdditionalFieldComplete = async (field) => {
    if (field === 'proceso' && formData.proceso_id) {
      setTimeout(() => setAdditionalSubStep(1), 300); // Ir a teléfono
    } else if (field === 'cliente_telefono' && formData.cliente_telefono.trim()) {
      // Buscar cliente y determinar qué falta
      const cliente = await buscarCliente(formData.cliente_telefono);
      if (!cliente) {
        // Cliente no existe, pedir nombre y email
        setDatosFaltantes(['nombre', 'email']);
        setTimeout(() => setAdditionalSubStep(2), 300);
      } else {
        // Cliente existe, cargar sus datos en el formData
        setFormData(prev => ({
          ...prev,
          cliente_nombre: cliente.nombre || prev.cliente_nombre || '',
          cliente_email: cliente.email || prev.cliente_email || ''
        }));
        
        // Verificar qué datos faltan
        const verificacion = verificarDatosCompletos(cliente);
        setDatosFaltantes(verificacion.faltantes);
        if (verificacion.faltantes.length > 0) {
          // Faltan datos, pedir completarlos
          setTimeout(() => setAdditionalSubStep(2), 300);
        } else {
          // Todo completo, ir a detalle
          setTimeout(() => setAdditionalSubStep(3), 300);
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
      
      setTimeout(() => setAdditionalSubStep(3), 300); // Ir a detalle
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar campos requeridos
      if (!formData.marca || !formData.modelo || !formData.color || formData.cargador === null || !formData.proceso_id || !formData.cliente_telefono) {
        alert('Por favor completa todos los campos requeridos (incluyendo si se queda el cargador)');
        setLoading(false);
        return;
      }

      // Obtener o crear/actualizar cliente primero para verificar datos
      let cliente = await obtenerOCrearCliente(
        formData.cliente_telefono.trim(),
        formData.cliente_nombre?.trim() || '',
        formData.cliente_email?.trim() || ''
      );

      // Si el cliente existe, verificar qué datos tiene
      if (cliente && cliente.id) {
        const verificacion = verificarDatosCompletos(cliente);
        
        // Si faltan datos y no se proporcionaron en el form, pedirlos
        if (verificacion.faltantes.length > 0) {
          const faltaNombre = verificacion.faltantes.includes('nombre') && !formData.cliente_nombre?.trim();
          const faltaEmail = verificacion.faltantes.includes('email') && !formData.cliente_email?.trim();
          
          if (faltaNombre || faltaEmail) {
            alert('Por favor completa el nombre y correo del cliente');
            setLoading(false);
            // Volver al paso de datos del cliente
            setAdditionalSubStep(2);
            return;
          }
        }
        
        // Si el cliente tiene los datos, usarlos aunque no estén en formData
        if (cliente.nombre && !formData.cliente_nombre) {
          formData.cliente_nombre = cliente.nombre;
        }
        if (cliente.email && !formData.cliente_email) {
          formData.cliente_email = cliente.email;
        }
      } else {
        // Cliente nuevo, validar que se proporcionaron los datos
        if (!formData.cliente_nombre?.trim() || !formData.cliente_email?.trim()) {
          alert('Por favor completa el nombre y correo del cliente');
          setLoading(false);
          setAdditionalSubStep(2);
          return;
        }
      }

      // Validar formato de email
      const emailFinal = formData.cliente_email?.trim() || cliente?.email || '';
      if (emailFinal) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailFinal)) {
          alert('Por favor ingresa un correo electrónico válido');
          setLoading(false);
          setAdditionalSubStep(2);
          return;
        }
      }

      // Actualizar cliente si faltan datos
      if (cliente && cliente.id) {
        const verificacion = verificarDatosCompletos(cliente);
        if (verificacion.faltantes.length > 0) {
          const updateData = {};
          const nombreFinal = formData.cliente_nombre?.trim() || cliente.nombre || '';
          const emailFinal = formData.cliente_email?.trim() || cliente.email || '';
          
          if (verificacion.faltantes.includes('nombre') && nombreFinal) {
            updateData.nombre = nombreFinal;
          }
          if (verificacion.faltantes.includes('email') && emailFinal) {
            updateData.email = emailFinal;
          }
          
          if (Object.keys(updateData).length > 0) {
            cliente = await actualizarCliente(cliente.id, updateData);
          }
        }
      } else {
        // Si no se obtuvo cliente, crear uno nuevo
        cliente = await obtenerOCrearCliente(
          formData.cliente_telefono.trim(),
          formData.cliente_nombre?.trim() || '',
          formData.cliente_email?.trim() || ''
        );
      }

      if (!cliente || !cliente.id) {
        throw new Error('No se pudo obtener o crear el cliente');
      }

      const clienteId = cliente.id;

      // Generar nota automáticamente
      let notaGenerada = siguienteNota;
      if (!notaGenerada) {
        // Si no se calculó antes, calcular ahora
        const { data: ultimaNota } = await supabase
          .from('equipos')
          .select('nota')
          .order('nota', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        notaGenerada = ultimaNota ? parseInt(ultimaNota.nota) + 1 : 1;
      }

      // Si no hay problema, usar una cadena vacía en lugar de null para evitar error en pendientes
      const equipoData = {
        marca: formData.marca.trim(),
        modelo: formData.modelo.trim(),
        color: formData.color.trim(),
        nota: notaGenerada.toString(),
        problema: formData.problema.trim() || '',
        contraseña: formData.contraseña?.trim() || null,
        cargador: formData.cargador !== null ? formData.cargador : false,
        cliente_id: clienteId
      };

      const { data, error } = await supabase
        .from('equipos')
        .insert([equipoData])
        .select();

      if (error) {
        // Si el error es por nota duplicada, refresca y muestra mensaje
        if (error.message && error.message.includes('duplicate key value')) {
          const { data: equiposData } = await supabase
            .from('equipos')
            .select('nota')
            .order('nota', { ascending: false })
            .limit(1);
          if (equiposData && equiposData.length > 0) {
            setSiguienteNota(parseInt(equiposData[0].nota) + 1);
          }
          alert('Error: La nota ya existe. Se ha actualizado el número de nota, intenta de nuevo.');
        } else {
          alert(`Error: ${error.message}`);
        }
        setLoading(false);
        return;
      }

      if (data && data[0]) {
        // Crear estado inicial
        await supabase.from('estado_equipos').insert({
          equipo_id: data[0].id,
          estado: 'en_proceso',
          proceso_actual_id: parseInt(formData.proceso_id),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        // Registrar en historial
        const procesoSeleccionado = procesos.find(p => p.id === parseInt(formData.proceso_id));
        await supabase.from('historial_procesos').insert({
          equipo_id: data[0].id,
          proceso_id: parseInt(formData.proceso_id),
          notas: `Proceso iniciado: ${procesoSeleccionado?.nombre}`,
          fecha_inicio: new Date().toISOString()
        });

        // Upload photo if captured
        if (capturedImage) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            await uploadEquipoPhoto(data[0].id, capturedImage, user?.id || null);
            console.log('✅ Photo uploaded successfully');
          } catch (photoError) {
            console.error('Error uploading photo (non-critical):', photoError);
            // Don't block the flow if photo upload fails
          }
        }

        // Crear notificación
        try {
          await notificarEquipoNuevo(data[0], cliente.nombre);
        } catch (notifError) {
          console.error('Error creando notificación (no crítico):', notifError);
        }

        // Guardar datos para mostrar nota PDF y confirmar
        setEquipoGuardado({
          ...data[0],
          procesos: procesoSeleccionado
        });
        setClienteGuardado(cliente);
        setShowNotaPDF(true);
        setLoading(false);
        // Aquí puedes mostrar un mensaje de éxito si quieres
        return;
      }
      // Si no se insertó, refrescar siguienteNota y mostrar error
      const { data: equiposData } = await supabase
        .from('equipos')
        .select('nota')
        .order('nota', { ascending: false })
        .limit(1);
      if (equiposData && equiposData.length > 0) {
        setSiguienteNota(parseInt(equiposData[0].nota) + 1);
      }
      alert('Error: No se pudo guardar el equipo. Intenta de nuevo.');
      setLoading(false);
      return;
    } catch (error) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: '📷 Captura la imagen del equipo',
      description: 'Permite el acceso a la cámara para capturar una foto del equipo'
    },
    {
      title: '📝 Información del equipo',
      description: 'Completa los datos del equipo'
    },
    {
      title: '⚙️ Proceso y cliente',
      description: 'Selecciona el proceso y los datos del cliente'
    }
  ];

  return (
    <div 
      className="typeform-modal-overlay" 
      onClick={handleClose}
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
        <button onClick={handleClose} className="typeform-close-btn">×</button>
        
        {/* Progress Bar */}
        <div className="typeform-progress">
          <div 
            className="typeform-progress-bar" 
            style={{ 
              width: `${(() => {
                if (currentStep === 2) {
                  // Paso 2: Formulario (marca, modelo, color, cargador) = 4 sub-pasos
                  return ((currentStep + (formSubStep + 1) / 4) / (steps.length + 1)) * 100;
                } else if (currentStep === 3) {
                  // Paso 3: Cliente y proceso
                  // Máximo 4 sub-pasos: teléfono, nombre (opcional), proceso, detalle
                  const totalSubSteps = 4;
                  const currentProgress = additionalSubStep + 1;
                  return ((currentStep + currentProgress / totalSubSteps) / (steps.length + 1)) * 100;
                } else {
                  return ((currentStep + 1) / (steps.length + 1)) * 100;
                }
              })()}%` 
            }}
          ></div>
        </div>

        {/* Step Indicator */}
        <div className="typeform-step-indicator">
          {currentStep === 2 
            ? `Paso ${currentStep + 1}.${formSubStep + 1} de ${steps.length + 1}`
            : currentStep === 3
            ? `Paso ${currentStep + 1}.${additionalSubStep + 1} de ${steps.length + 1}`
            : `Paso ${currentStep + 1} de ${steps.length + 1}`}
        </div>

        {/* Step 0: Inicio - Activar cámara */}
        {currentStep === 0 && (
          <div className="typeform-step">
            <h2>{steps[0].title}</h2>
            <p className="typeform-description">{steps[0].description}</p>
            {cameraError && (
              <div className="error-message">
                {cameraError}
              </div>
            )}
            <div className="typeform-buttons">
              {!cameraError && (
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startCamera();
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!startingCamera) {
                      startCamera();
                    }
                  }}
                  className="typeform-btn-primary"
                  disabled={startingCamera}
                >
                  {startingCamera ? '⏳ Activando...' : '📷 Activar Cámara'}
                </button>
              )}
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  skipCamera();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  skipCamera();
                }}
                className={cameraError ? "typeform-btn-primary" : "typeform-btn-secondary"}
                disabled={startingCamera}
              >
                {cameraError ? '✓ Continuar sin cámara' : 'Omitir y continuar'}
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Captura con cámara */}
        {currentStep === 1 && (
          <div className="typeform-step">
            <h2>Captura la imagen</h2>
            <p className="typeform-description">
              Coloca el equipo frente a la cámara y captura una foto
            </p>
            {cameraError && (
              <div className="error-message">
                ⚠️ {cameraError}
                <br />
                <small>Puedes continuar sin cámara y agregar los datos manualmente.</small>
              </div>
            )}
            {stream && (
              <div className="camera-container">
                {!videoReady && !cameraError && (
                  <div className="camera-loading">
                    <div className="detecting-spinner"></div>
                    <p>Cargando cámara...</p>
                  </div>
                )}
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline
                  muted
                  className="camera-video"
                  style={{ display: videoReady && !cameraError ? 'block' : 'none' }}
                />
                {capturedImage && (
                  <img src={capturedImage} alt="Captured" className="captured-image" />
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
                {videoReady && !capturedImage && !cameraError && (
                  <div className="camera-controls">
                    <button onClick={captureImage} className="typeform-btn-primary capture-btn">
                      📸 Capturar
                    </button>
                    <button onClick={() => {
                      if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                        setStream(null);
                      }
                      setVideoReady(false);
                      setCameraError(null);
                      setCurrentStep(0);
                    }} className="typeform-btn-secondary">
                      Cancelar
                    </button>
                  </div>
                )}

                
                {cameraError && (
                  <div className="typeform-buttons">
                    <button onClick={skipCamera} className="typeform-btn-primary">
                      Continuar sin cámara
                    </button>
                    <button onClick={() => {
                      if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                        setStream(null);
                      }
                      setVideoReady(false);
                      setCameraError(null);
                      setCurrentStep(0);
                    }} className="typeform-btn-secondary">
                      Intentar de nuevo
                    </button>
                  </div>
                )}
              </div>
            )}
            {!stream && !cameraError && (
              <div className="typeform-buttons">
                <button onClick={startCamera} className="typeform-btn-primary">
                  📷 Activar Cámara
                </button>
                <button onClick={skipCamera} className="typeform-btn-secondary">
                  Omitir y continuar sin cámara
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Formulario tipo Typeform - Campos progresivos */}
        {currentStep === 2 && (
          <div className="typeform-step typeform-single-field">
            {capturedImage && (
              <div className="captured-preview-small">
                <img src={capturedImage} alt="Equipment" />
              </div>
            )}

            {/* Campo: Marca */}
            {formSubStep === 0 && (
              <>
                <h2 className="typeform-question">¿Cuál es la marca del equipo?</h2>
                <div className="typeform-field-wrapper autocomplete-wrapper">
                  <input
                    type="text"
                    name="marca"
                    value={formData.marca}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formData.marca.trim()) {
                        e.preventDefault();
                        handleFieldComplete('marca');
                      }
                    }}
                    onFocus={() => {
                      if (formData.marca) {
                        filterMarcaSuggestions(formData.marca);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowMarcaSuggestions(false), 200);
                    }}
                    placeholder="Escribe la marca..."
                    required
                    autoComplete="off"
                    autoFocus
                    className="typeform-large-input"
                  />
                  {showMarcaSuggestions && marcaSuggestions.length > 0 && (
                    <div className="suggestions-dropdown-large">
                      {marcaSuggestions.map((marca, index) => (
                        <button
                          key={index}
                          type="button"
                          className="suggestion-item-large"
                          onClick={() => handleSuggestionClick('marca', marca)}
                        >
                          {marca}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {formData.marca && (
                  <button
                    type="button"
                    onClick={() => handleFieldComplete('marca')}
                    className="typeform-btn-primary typeform-next-btn"
                  >
                    Continuar →
                  </button>
                )}
              </>
            )}

            {/* Campo: Modelo */}
            {formSubStep === 1 && (
              <>
                <h2 className="typeform-question">¿Cuál es el modelo del equipo?</h2>
                <div className="typeform-field-wrapper autocomplete-wrapper">
                  <input
                    type="text"
                    name="modelo"
                    value={formData.modelo}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formData.modelo.trim()) {
                        e.preventDefault();
                        handleFieldComplete('modelo');
                      }
                    }}
                    onFocus={() => {
                      if (formData.modelo && formData.marca) {
                        filterModeloSuggestions(formData.modelo, formData.marca);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowModeloSuggestions(false), 200);
                    }}
                    placeholder={`Escribe el modelo ${formData.marca || ''}...`}
                    required
                    autoComplete="off"
                    autoFocus
                    className="typeform-large-input"
                  />
                  {showModeloSuggestions && modeloSuggestions.length > 0 && (
                    <div className="suggestions-dropdown-large">
                      {modeloSuggestions.map((modelo, index) => (
                        <button
                          key={index}
                          type="button"
                          className="suggestion-item-large"
                          onClick={() => handleSuggestionClick('modelo', modelo)}
                        >
                          {modelo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="typeform-buttons-horizontal">
                  <button
                    type="button"
                    onClick={() => setFormSubStep(0)}
                    className="typeform-btn-secondary"
                  >
                    ← Volver
                  </button>
                  {formData.modelo && (
                    <button
                      type="button"
                      onClick={() => handleFieldComplete('modelo')}
                      className="typeform-btn-primary"
                    >
                      Continuar →
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Campo: Color */}
            {formSubStep === 2 && (
              <>
                <h2 className="typeform-question">¿De qué color es el equipo?</h2>
                <div className="typeform-field-wrapper">
                  <div className="color-picker-grid-circles">
                    {[
                      'Negro', 'Blanco', 'Gris', 'Plateado', 'Dorado',
                      'Rojo', 'Azul', 'Verde', 'Naranja'
                    ].map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`color-picker-circle ${formData.color.toLowerCase() === color.toLowerCase() ? 'selected' : ''}`}
                        style={{ 
                          backgroundColor: getColorHexForPicker(color),
                          borderColor: formData.color.toLowerCase() === color.toLowerCase() ? '#10b981' : 'transparent'
                        }}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, color }));
                          setTimeout(() => handleFieldComplete('color'), 300);
                        }}
                        title={color}
                      >
                        {formData.color.toLowerCase() === color.toLowerCase() && (
                          <i className="fas fa-check"></i>
                        )}
                      </button>
                    ))}
                    {/* Selector multicolor como décima opción */}
                    <div className="color-picker-custom-wrapper">
                      <input
                        type="color"
                        className="color-picker-custom"
                        value={formData.color && !['Negro', 'Blanco', 'Gris', 'Plateado', 'Dorado', 'Rojo', 'Azul', 'Verde', 'Naranja'].includes(formData.color) 
                          ? getColorHexForPicker(formData.color) 
                          : '#cccccc'}
                        onChange={(e) => {
                          const hexColor = e.target.value;
                          // Convertir hex a nombre aproximado o usar el hex directamente
                          setFormData(prev => ({ ...prev, color: hexToColorName(hexColor) || hexColor }));
                          setTimeout(() => handleFieldComplete('color'), 300);
                        }}
                        title="Otro color"
                      />
                      <i className="fas fa-palette color-picker-custom-icon"></i>
                    </div>
                  </div>
                </div>
                <div className="typeform-buttons-horizontal">
                  <button
                    type="button"
                    onClick={() => setFormSubStep(1)}
                    className="typeform-btn-secondary"
                  >
                    ← Volver
                  </button>
                  {formData.color && (
                    <button
                      type="button"
                      onClick={() => handleFieldComplete('color')}
                      className="typeform-btn-primary"
                    >
                      Continuar →
                    </button>
                  )}
                  {!formData.color && (
                    <button
                      type="button"
                      onClick={() => setFormSubStep(1)}
                      className="typeform-btn-secondary"
                    >
                      ← Volver
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Campo: Cargador */}
            {formSubStep === 3 && (
              <>
                <h2 className="typeform-question">¿Se queda el cargador?</h2>
                <p className="typeform-description">Indica si el cliente deja el cargador del equipo.</p>
                <div className="typeform-field-wrapper">
                  <select
                    name="cargador"
                    value={formData.cargador === true ? 'si' : formData.cargador === false ? 'no' : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        cargador: value === 'si' ? true : value === 'no' ? false : null
                      }));
                      if (value) {
                        setTimeout(() => handleFieldComplete('cargador'), 300);
                      }
                    }}
                    required
                    autoFocus
                    className="typeform-large-input typeform-select"
                  >
                    <option value="">Selecciona una opción...</option>
                    <option value="si">Sí, se queda el cargador</option>
                    <option value="no">No, no se queda el cargador</option>
                  </select>
                </div>
                <div className="typeform-buttons-horizontal">
                  <button
                    type="button"
                    onClick={() => setFormSubStep(2)}
                    className="typeform-btn-secondary"
                  >
                    ← Volver
                  </button>
                  {formData.cargador !== null && (
                    <button
                      type="button"
                      onClick={() => handleFieldComplete('cargador')}
                      className="typeform-btn-primary"
                    >
                      Continuar →
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Información adicional tipo Typeform */}
        {currentStep === 3 && (
          <div className="typeform-step typeform-single-field">
            {/* Campo: Proceso */}
            {additionalSubStep === 0 && (
              <>
                <h2 className="typeform-question">¿Qué proceso se va a realizar?</h2>
                <p className="typeform-description">Selecciona el tipo de servicio a realizar.</p>
                <div className="typeform-field-wrapper">
                  <select
                    name="proceso_id"
                    value={formData.proceso_id}
                    onChange={(e) => {
                      handleInputChange(e);
                      if (e.target.value) {
                        setTimeout(() => handleAdditionalFieldComplete('proceso'), 300);
                      }
                    }}
                    required
                    autoFocus
                    className="typeform-large-input typeform-select"
                  >
                    <option value="">Selecciona un proceso...</option>
                    {procesos.map(proceso => (
                      <option key={proceso.id} value={proceso.id}>
                        {proceso.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                {formData.proceso_id && (
                  <button
                    type="button"
                    onClick={() => handleAdditionalFieldComplete('proceso')}
                    className="typeform-btn-primary typeform-next-btn"
                  >
                    Continuar →
                  </button>
                )}
              </>
            )}

            {/* Campo: Teléfono del cliente */}
            {additionalSubStep === 1 && (
              <>
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
                        handleAdditionalFieldComplete('cliente_telefono');
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
                    onClick={() => setAdditionalSubStep(0)}
                    className="typeform-btn-secondary"
                  >
                    ← Volver
                  </button>
                  {formData.cliente_telefono && (
                    <button
                      type="button"
                      onClick={() => handleAdditionalFieldComplete('cliente_telefono')}
                      className="typeform-btn-primary"
                    >
                      Continuar →
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Campo: Datos del cliente (nombre y email si no existe o faltan datos) */}
            {additionalSubStep === 2 && (
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
                    onClick={() => setAdditionalSubStep(1)}
                    className="typeform-btn-secondary"
                  >
                    ← Volver
                  </button>
                  {(formData.cliente_nombre || !datosFaltantes.includes('nombre')) && 
                   (formData.cliente_email || !datosFaltantes.includes('email')) && (
                    <button
                      type="button"
                      onClick={() => handleAdditionalFieldComplete('cliente_datos')}
                      className="typeform-btn-primary"
                    >
                      Continuar →
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Campo: Detalle (opcional) */}
            {additionalSubStep === 3 && (
              <>
                <h2 className="typeform-question">¿Hay algún detalle adicional? (Opcional)</h2>
                <p className="typeform-description">Describe cualquier problema o información relevante sobre el equipo.</p>
                <div className="typeform-field-wrapper">
                  <textarea
                    name="problema"
                    value={formData.problema}
                    onChange={handleInputChange}
                    placeholder="Escribe detalles adicionales sobre el equipo..."
                    autoFocus
                    className="typeform-large-textarea"
                    rows="5"
                  />
                </div>
                <div className="typeform-buttons-horizontal">
                  <button
                    type="button"
                    onClick={() => {
                      // Volver al paso anterior según si existe el cliente
                      if (clienteEncontrado) {
                        setAdditionalSubStep(1);
                      } else {
                        setAdditionalSubStep(2);
                      }
                    }}
                    className="typeform-btn-secondary"
                  >
                    ← Volver
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdditionalSubStep(4)}
                    className="typeform-btn-primary"
                  >
                    Continuar →
                  </button>
                </div>
              </>
            )}

            {/* Campo: Contraseña (opcional) */}
            {additionalSubStep === 4 && (
              <>
                <h2 className="typeform-question">¿Tiene contraseña el equipo? (Opcional)</h2>
                <p className="typeform-description">Si el equipo tiene contraseña, ingrésala aquí. Este campo es opcional.</p>
                <div className="typeform-field-wrapper">
                  <input
                    type="password"
                    name="contraseña"
                    value={formData.contraseña}
                    onChange={handleInputChange}
                    placeholder="Contraseña del equipo..."
                    autoFocus
                    className="typeform-large-input"
                  />
                </div>
                <div className="typeform-buttons-horizontal">
                  <button
                    type="button"
                    onClick={() => setAdditionalSubStep(3)}
                    className="typeform-btn-secondary"
                  >
                    ← Volver
                  </button>
                  <form onSubmit={handleSubmit} style={{ display: 'inline' }}>
                    <button
                      type="submit"
                      className="typeform-btn-primary"
                      disabled={loading}
                    >
                      {loading ? 'Guardando...' : '✓ Agregar Equipo'}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        )}

        {/* Modal de Nota PDF */}
        {showNotaPDF && equipoGuardado && clienteGuardado && (
          <NotaPDF
            equipo={equipoGuardado}
            cliente={clienteGuardado}
            tipo="recepcion"
            onClose={() => {
              setShowNotaPDF(false);
              setEquipoGuardado(null);
              setClienteGuardado(null);
              onEquipoAdded();
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

