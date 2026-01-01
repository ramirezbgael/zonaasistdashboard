import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import CustomSelect from './CustomSelect.jsx';
import './AddInventarioModal.css';

export default function AddInventarioModal({ isOpen, onClose, onSuccess, editingProduct = null }) {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [proveedores, setProveedores] = useState([]);
    const [equipos, setEquipos] = useState([]);
    const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
    const [errors, setErrors] = useState({});
    const [warnings, setWarnings] = useState({});
    const [formData, setFormData] = useState({
        codigo_sku: '',
        tipo: '',
        nombre: '',
        descripcion: '',
        categoria: '',
        unidad_medida: 'pieza',
        stock_actual: 0,
        stock_minimo: 0,
        stock_maximo: null,
        costo_promedio: 0,
        precio_venta: null,
        proveedor_id: null,
        ubicacion: '',
        activo: true
    });

    useEffect(() => {
        if (isOpen) {
            fetchProveedores();
            fetchEquipos();
            if (editingProduct) {
                setFormData({
                    codigo_sku: editingProduct.codigo_sku || '',
                    tipo: editingProduct.tipo || '',
                    nombre: editingProduct.nombre || '',
                    descripcion: editingProduct.descripcion || '',
                    categoria: editingProduct.categoria || '',
                    unidad_medida: editingProduct.unidad_medida || 'pieza',
                    stock_actual: editingProduct.stock_actual || 0,
                    stock_minimo: editingProduct.stock_minimo || 0,
                    stock_maximo: editingProduct.stock_maximo || null,
                    costo_promedio: editingProduct.costo_promedio || 0,
                    precio_venta: editingProduct.precio_venta || null,
                    proveedor_id: editingProduct.proveedor_id || null,
                    ubicacion: editingProduct.ubicacion || '',
                    activo: editingProduct.activo !== undefined ? editingProduct.activo : true
                });
            } else {
                resetForm();
            }
        }
    }, [isOpen, editingProduct]);

    const fetchProveedores = async () => {
        try {
            const { data, error } = await supabase
                .from('proveedores')
                .select('id, nombre')
                .order('nombre');
            
            if (!error && data) {
                setProveedores(data);
            }
        } catch (error) {
            console.error('Error fetching proveedores:', error);
        }
    };

    const fetchEquipos = async () => {
        try {
            const { data, error } = await supabase
                .from('equipos')
                .select('id, nota, marca, modelo')
                .order('nota', { ascending: false })
                .limit(50);
            
            if (!error && data) {
                setEquipos(data);
            }
        } catch (error) {
            console.error('Error fetching equipos:', error);
        }
    };

    const resetForm = () => {
        setFormData({
            codigo_sku: '',
            tipo: '',
            nombre: '',
            descripcion: '',
            categoria: '',
            unidad_medida: 'pieza',
            stock_actual: 0,
            stock_minimo: 0,
            stock_maximo: null,
            costo_promedio: 0,
            precio_venta: null,
            proveedor_id: null,
            ubicacion: '',
            activo: true
        });
        setCurrentStep(1);
    };

    const tiposProductos = [
        { value: 'equipo_venta', label: 'Equipo para Venta' },
        { value: 'refaccion', label: 'Refacción' },
        { value: 'consumible', label: 'Consumible' },
        { value: 'papel', label: 'Papel' },
        { value: 'tinta', label: 'Tinta de Impresora' },
        { value: 'almohadilla', label: 'Almohadilla de Impresora' },
        { value: 'disco_duro', label: 'Disco Duro' },
        { value: 'otro', label: 'Otro' }
    ];

    // Placeholder dinámico según tipo
    const getNombrePlaceholder = () => {
        const placeholders = {
            'refaccion': 'Ej: Pantalla LCD 15.6", Batería HP Pavilion, Teclado Dell...',
            'consumible': 'Ej: Papel A4 500 hojas, Limpiador de pantalla...',
            'equipo_venta': 'Ej: Laptop Dell Inspiron 15, Monitor HP 24"...',
            'papel': 'Ej: Papel A4 500 hojas, Papel fotográfico A4...',
            'tinta': 'Ej: Tinta HP 302XL Negro, Tinta Epson 003...',
            'almohadilla': 'Ej: Almohadilla Epson L3110, Almohadilla HP...',
            'disco_duro': 'Ej: Disco Duro 1TB Seagate, SSD 500GB Samsung...',
            'otro': 'Ej: Cable USB-C, Adaptador HDMI...'
        };
        return placeholders[formData.tipo] || 'Ej: Nombre descriptivo del producto...';
    };

    // Calcular valor total
    const valorTotal = (formData.stock_actual || 0) * (formData.costo_promedio || 0);

    // Calcular margen (solo si es equipo para venta)
    const margen = formData.tipo === 'equipo_venta' && formData.precio_venta && formData.costo_promedio > 0
        ? ((formData.precio_venta - formData.costo_promedio) / formData.costo_promedio * 100).toFixed(0)
        : null;

    // Validaciones en tiempo real
    useEffect(() => {
        const newErrors = {};
        const newWarnings = {};

        // Validación: Stock mínimo vs máximo
        if (formData.stock_maximo && formData.stock_minimo > formData.stock_maximo) {
            newErrors.stock_minimo = 'El stock mínimo no puede ser mayor al máximo';
        }

        // Validación: Stock inicial vs máximo
        if (formData.stock_maximo && formData.stock_actual > formData.stock_maximo) {
            newWarnings.stock_actual = 'El stock inicial supera el máximo recomendado. ¿Es correcto?';
        }

        // Validación: Precio vs costo
        if (formData.precio_venta && formData.costo_promedio && formData.precio_venta < formData.costo_promedio) {
            newWarnings.precio_venta = 'Estás vendiendo por debajo del costo. ¿Es correcto?';
        }

        // Validación: Stock = 0 pero costo > 0
        if (formData.stock_actual === 0 && formData.costo_promedio > 0) {
            newWarnings.costo_promedio = 'Tienes costo pero sin stock. ¿Quieres registrar el producto para futuras compras?';
        }

        // Validación: Costo = 0 pero stock > 0
        if (formData.stock_actual > 0 && formData.costo_promedio === 0) {
            newWarnings.costo_promedio = 'Tienes stock pero sin costo. ¿Es un producto gratuito o necesitas agregar el costo?';
        }

        setErrors(newErrors);
        setWarnings(newWarnings);
    }, [formData]);

    // Sugerencias inteligentes
    const sugerenciaStockMinimo = formData.stock_actual > 0 
        ? Math.ceil(formData.stock_actual * 0.1) 
        : 0;
    
    const sugerenciaStockMaximo = formData.stock_actual > 0 
        ? formData.stock_actual * 2 
        : null;

    const handleNext = () => {
        // Validar paso 1
        if (currentStep === 1) {
            if (!formData.tipo || !formData.nombre || formData.nombre.length < 3) {
                setErrors({
                    tipo: !formData.tipo ? 'Selecciona el tipo de producto' : '',
                    nombre: !formData.nombre ? 'El nombre es requerido' : 
                           formData.nombre.length < 3 ? 'El nombre debe tener al menos 3 caracteres' : ''
                });
                return;
            }
            setErrors({});
            setCurrentStep(2);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = async () => {
        if (!formData.tipo || !formData.nombre) {
            alert('Por favor completa los campos requeridos');
            return;
        }

        setLoading(true);
        try {
            // Obtener usuario actual
            const { data: { user } } = await supabase.auth.getUser();

            const productData = {
                codigo_sku: formData.codigo_sku || null,
                tipo: formData.tipo,
                nombre: formData.nombre,
                descripcion: formData.descripcion || null,
                categoria: formData.categoria || null,
                unidad_medida: formData.unidad_medida || 'pieza',
                stock_actual: parseInt(formData.stock_actual) || 0,
                stock_minimo: parseInt(formData.stock_minimo) || 0,
                stock_maximo: formData.stock_maximo ? parseInt(formData.stock_maximo) : null,
                costo_promedio: parseFloat(formData.costo_promedio) || 0,
                precio_venta: formData.precio_venta ? parseFloat(formData.precio_venta) : null,
                proveedor_id: formData.proveedor_id || null,
                ubicacion: formData.ubicacion || null,
                activo: formData.activo !== undefined ? formData.activo : true
            };

            let productoId;

            if (editingProduct) {
                // Actualizar producto existente
                const { data, error } = await supabase
                    .from('inventario_productos')
                    .update(productData)
                    .eq('id', editingProduct.id)
                    .select()
                    .single();

                if (error) {
                    // Fallback a tabla antigua
                    const { error: oldError } = await supabase
                        .from('inventario')
                        .update({
                            tipo: productData.tipo,
                            nombre: productData.nombre,
                            descripcion: productData.descripcion,
                            cantidad: productData.stock_actual,
                            precio_unitario: productData.costo_promedio,
                            proveedor_id: productData.proveedor_id,
                            ubicacion: productData.ubicacion
                        })
                        .eq('id', editingProduct.id);

                    if (oldError) throw oldError;
                } else {
                    productoId = data.id;
                }
                alert('Producto actualizado exitosamente');
            } else {
                // Crear nuevo producto
                console.log('📝 Intentando insertar producto en inventario_productos:', productData);
                const { data, error } = await supabase
                    .from('inventario_productos')
                    .insert([productData])
                    .select()
                    .single();

                if (error) {
                    console.log('⚠️ Error en inventario_productos, usando tabla antigua:', error);
                    // Fallback a tabla antigua
                    const { data: oldData, error: oldError } = await supabase
                        .from('inventario')
                        .insert([{
                            tipo: productData.tipo,
                            nombre: productData.nombre,
                            descripcion: productData.descripcion,
                            cantidad: productData.stock_actual,
                            precio_unitario: productData.costo_promedio,
                            proveedor_id: productData.proveedor_id,
                            ubicacion: productData.ubicacion,
                            estado: 'disponible'
                        }])
                        .select()
                        .single();

                    if (oldError) {
                        console.error('❌ Error en tabla antigua también:', oldError);
                        throw oldError;
                    }
                    console.log('✅ Producto guardado en tabla antigua:', oldData);
                    productoId = oldData.id;
                } else {
                    console.log('✅ Producto guardado en inventario_productos:', data);
                    productoId = data.id;

                    // Si hay stock inicial, crear movimiento de entrada
                    if (productData.stock_actual > 0) {
                        const { error: movError } = await supabase
                            .from('inventario_movimientos')
                            .insert([{
                                producto_id: productoId,
                                tipo_movimiento: 'entrada',
                                cantidad: productData.stock_actual,
                                costo_unitario: productData.costo_promedio,
                                motivo: 'inicial',
                                referencia_tipo: 'manual',
                                usuario_id: user?.id || null
                            }]);
                        
                        if (movError) {
                            console.warn('⚠️ Error creando movimiento (no crítico):', movError);
                        }
                    }
                }
                alert('Producto agregado al inventario exitosamente');
            }

            resetForm();
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error guardando producto:', error);
            alert('Error al guardar el producto: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const totalSteps = 2;

    if (!isOpen) return null;

    return createPortal(
        <div className="modal-overlay typeform-overlay" onClick={onClose}>
            <div className="modal typeform-modal" onClick={(e) => e.stopPropagation()}>
                <div className="typeform-header">
                    <h2>{editingProduct ? 'Editar Producto' : 'Agregar Producto al Inventario'}</h2>
                    <button className="close-btn" onClick={onClose}>
                        <Icon name="times" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="typeform-progress">
                    <div 
                        className="typeform-progress-bar" 
                        style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                    />
                </div>

                {/* Step 1: Identificación del Producto */}
                {currentStep === 1 && (
                    <div className="typeform-step">
                        <div className="step-content">
                            <h3 className="step-title">Identificación del Producto</h3>
                            <p className="step-subtitle">¿Qué producto estás agregando?</p>
                            
                            <div className="form-group typeform-form-group">
                                <label className="form-label">
                                    Tipo de Producto <span className="required">*</span>
                                </label>
                                <CustomSelect
                                    className="form-input"
                                    value={formData.tipo}
                                    onChange={(value) => {
                                        setFormData({ ...formData, tipo: value });
                                        setErrors({ ...errors, tipo: '' });
                                    }}
                                    options={tiposProductos}
                                    placeholder="Selecciona un tipo"
                                    required
                                />
                                {errors.tipo && <p className="form-error">{errors.tipo}</p>}
                                <p className="form-hint">Selecciona la categoría principal del producto</p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Nombre del Producto <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    className={`form-input ${errors.nombre ? 'error' : ''}`}
                                    placeholder={getNombrePlaceholder()}
                                    value={formData.nombre}
                                    onChange={(e) => {
                                        setFormData({ ...formData, nombre: e.target.value.trim() });
                                        setErrors({ ...errors, nombre: '' });
                                    }}
                                    maxLength={255}
                                    required
                                />
                                {errors.nombre && <p className="form-error">{errors.nombre}</p>}
                                <p className="form-hint">Nombre descriptivo que identifique el producto</p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Código SKU</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ej: HP302XL-BLK, DELL-BAT-15"
                                    value={formData.codigo_sku}
                                    onChange={(e) => setFormData({ ...formData, codigo_sku: e.target.value.toUpperCase().replace(/\s/g, '') })}
                                    maxLength={100}
                                />
                                <p className="form-hint">Código interno único. Si no tienes uno, déjalo vacío y se generará automáticamente</p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Descripción</label>
                                <textarea
                                    className="form-input"
                                    rows="2"
                                    placeholder="Características adicionales, especificaciones técnicas..."
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                    maxLength={1000}
                                />
                                <p className="form-hint">Información útil para identificar el producto más adelante</p>
                            </div>
                        </div>

                        <div className="typeform-actions">
                            <button className="btn-secondary" onClick={onClose}>
                                Cancelar
                            </button>
                            <button 
                                className="btn-primary" 
                                onClick={handleNext}
                                disabled={!formData.tipo || !formData.nombre || formData.nombre.length < 3}
                            >
                                Siguiente
                                <Icon name="arrow-right" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Control de Stock y Costos */}
                {currentStep === 2 && (
                    <div className="typeform-step">
                        <div className="step-content">
                            <h3 className="step-title">Control de Stock y Costos</h3>
                            <p className="step-subtitle">¿Cuánto tienes y cuánto cuesta?</p>
                            
                            {/* Sección A: Stock Inicial */}
                            <div className="form-section">
                                <h4 className="section-title">Stock Inicial</h4>
                                
                                <div className="form-group">
                                    <label className="form-label">
                                        Cantidad Inicial <span className="required">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        className={`form-input ${warnings.stock_actual ? 'warning' : ''}`}
                                        min="0"
                                        max="999999"
                                        placeholder="0"
                                        value={formData.stock_actual}
                                        onChange={(e) => {
                                            const value = parseInt(e.target.value) || 0;
                                            setFormData({ ...formData, stock_actual: value });
                                        }}
                                        required
                                    />
                                    {warnings.stock_actual && <p className="form-warning">{warnings.stock_actual}</p>}
                                    {formData.stock_actual === 0 && (
                                        <span className="field-badge warning">⚠️ Producto sin stock inicial</span>
                                    )}
                                    {formData.stock_actual > 0 && (
                                        <span className="field-badge success">✅ Stock inicial registrado</span>
                                    )}
                                    <p className="form-hint">Cantidad que tienes disponible ahora. Puede ser 0 si solo estás registrando el producto</p>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Stock Mínimo</label>
                                        <input
                                            type="number"
                                            className={`form-input ${errors.stock_minimo ? 'error' : ''}`}
                                            min="0"
                                            placeholder="0"
                                            value={formData.stock_minimo}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value) || 0;
                                                setFormData({ ...formData, stock_minimo: value });
                                            }}
                                        />
                                        {errors.stock_minimo && <p className="form-error">{errors.stock_minimo}</p>}
                                        {sugerenciaStockMinimo > 0 && formData.stock_minimo === 0 && (
                                            <button 
                                                type="button"
                                                className="suggestion-btn"
                                                onClick={() => setFormData({ ...formData, stock_minimo: sugerenciaStockMinimo })}
                                            >
                                                💡 Sugerencia: {sugerenciaStockMinimo} (10% del stock inicial)
                                            </button>
                                        )}
                                        <p className="form-hint">Te alertaremos cuando el stock baje de esta cantidad</p>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Stock Máximo</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            min="0"
                                            placeholder="Vacío"
                                            value={formData.stock_maximo || ''}
                                            onChange={(e) => setFormData({ ...formData, stock_maximo: e.target.value ? parseInt(e.target.value) : null })}
                                        />
                                        {sugerenciaStockMaximo && !formData.stock_maximo && (
                                            <button 
                                                type="button"
                                                className="suggestion-btn"
                                                onClick={() => setFormData({ ...formData, stock_maximo: sugerenciaStockMaximo })}
                                            >
                                                💡 Sugerencia: {sugerenciaStockMaximo} (2x del stock inicial)
                                            </button>
                                        )}
                                        <p className="form-hint">Cantidad máxima recomendada. Útil para sugerencias de compra</p>
                                    </div>
                                </div>
                            </div>

                            {/* Sección B: Costos y Precios */}
                            <div className="form-section">
                                <h4 className="section-title">Costos y Precios</h4>
                                
                                <div className="form-group">
                                    <label className="form-label">
                                        Costo por Unidad {formData.stock_actual > 0 && <span className="required">*</span>}
                                    </label>
                                    <div className="input-with-icon">
                                        <span className="input-icon">$</span>
                                        <input
                                            type="number"
                                            className={`form-input ${warnings.costo_promedio ? 'warning' : ''}`}
                                            step="0.01"
                                            min="0"
                                            max="999999.99"
                                            placeholder="0.00"
                                            value={formData.costo_promedio}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value) || 0;
                                                setFormData({ ...formData, costo_promedio: value });
                                            }}
                                            required={formData.stock_actual > 0}
                                        />
                                    </div>
                                    {warnings.costo_promedio && <p className="form-warning">{warnings.costo_promedio}</p>}
                                    <p className="form-hint">Costo de compra por unidad. Si el stock inicial es 0, puedes dejarlo en $0.00</p>
                                </div>

                                {valorTotal > 0 && (
                                    <div className="calculated-field">
                                        <label className="form-label">Valor Total del Inventario</label>
                                        <div className="calculated-value">
                                            ${valorTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <p className="form-hint">Valor total del stock inicial</p>
                                    </div>
                                )}

                                {formData.tipo === 'equipo_venta' && (
                                    <div className="form-group">
                                        <label className="form-label">Precio de Venta</label>
                                        <div className="input-with-icon">
                                            <span className="input-icon">$</span>
                                            <input
                                                type="number"
                                                className={`form-input ${warnings.precio_venta ? 'warning' : ''}`}
                                                step="0.01"
                                                min="0"
                                                placeholder="0.00"
                                                value={formData.precio_venta || ''}
                                                onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value ? parseFloat(e.target.value) : null })}
                                            />
                                        </div>
                                        {warnings.precio_venta && <p className="form-warning">{warnings.precio_venta}</p>}
                                        {margen && margen > 0 && (
                                            <span className={`field-badge ${margen > 20 ? 'success' : 'warning'}`}>
                                                Margen: {margen}% (${(formData.precio_venta - formData.costo_promedio).toFixed(2)} por unidad)
                                            </span>
                                        )}
                                        <p className="form-hint">Precio al que venderás este producto. Solo para productos vendibles</p>
                                    </div>
                                )}
                            </div>

                            {/* Sección C: Información Adicional (Colapsable) */}
                            <div className="form-section collapsible">
                                <button 
                                    type="button"
                                    className="section-toggle"
                                    onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
                                >
                                    <h4 className="section-title">Información Adicional</h4>
                                    <span style={{ fontSize: '0.875rem' }}>
                                        {showAdditionalInfo ? '▲' : '▼'}
                                    </span>
                                </button>
                                
                                {showAdditionalInfo && (
                                    <div className="section-content">
                                        <div className="form-group typeform-form-group">
                                            <label className="form-label">Proveedor</label>
                                            <select
                                                className="form-input typeform-select"
                                                value={formData.proveedor_id || ''}
                                                onChange={(e) => setFormData({ ...formData, proveedor_id: e.target.value ? parseInt(e.target.value) : null })}
                                            >
                                                <option value="">Sin proveedor</option>
                                                {proveedores.map(prov => (
                                                    <option key={prov.id} value={prov.id}>
                                                        {prov.nombre}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="form-hint">Proveedor habitual de este producto</p>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Ubicación Física</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="Ej: Estante A, Caja 3, Almacén Principal"
                                                value={formData.ubicacion}
                                                onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                                                maxLength={255}
                                            />
                                            <p className="form-hint">Dónde está físicamente almacenado</p>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Categoría</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="Ej: Impresoras, Computadoras, General"
                                                value={formData.categoria}
                                                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                                                maxLength={100}
                                            />
                                            <p className="form-hint">Para agrupar productos similares</p>
                                        </div>

                                        <div className="form-group typeform-form-group">
                                            <label className="form-label">Unidad de Medida</label>
                                            <select
                                                className="form-input typeform-select"
                                                value={formData.unidad_medida}
                                                onChange={(e) => setFormData({ ...formData, unidad_medida: e.target.value })}
                                            >
                                                <option value="pieza">Pieza</option>
                                                <option value="metro">Metro</option>
                                                <option value="litro">Litro</option>
                                                <option value="kg">Kilogramo</option>
                                            </select>
                                            <p className="form-hint">Unidad en que se mide este producto</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="typeform-actions">
                            <button className="btn-secondary" onClick={handleBack}>
                                <Icon name="arrow-left" />
                                Anterior
                            </button>
                            <button 
                                className="btn-primary" 
                                onClick={handleSubmit}
                                disabled={loading || Object.keys(errors).length > 0}
                            >
                                {loading ? (
                                    <>
                                        <Icon name="sync" className="spinning" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Icon name="check" />
                                        {editingProduct ? 'Actualizar' : 'Agregar'} Producto
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>,
        document.body
    );
}

