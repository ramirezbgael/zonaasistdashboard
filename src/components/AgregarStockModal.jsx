import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import './AddInventarioModal.css';

export default function AgregarStockModal({ isOpen, onClose, onSuccess, producto = null, productos = [] }) {
    const [loading, setLoading] = useState(false);
    const [productoSeleccionado, setProductoSeleccionado] = useState(producto);
    const [cantidad, setCantidad] = useState(0);
    const [costoUnitario, setCostoUnitario] = useState(0);
    const [motivo, setMotivo] = useState('compra');
    const [notas, setNotas] = useState('');

    // Actualizar producto seleccionado cuando cambia la prop
    useEffect(() => {
        setProductoSeleccionado(producto);
    }, [producto]);

    useEffect(() => {
        if (isOpen && productoSeleccionado) {
            setCantidad(0);
            setCostoUnitario(productoSeleccionado.costo_promedio || 0);
            setMotivo('compra');
            setNotas('');
        }
    }, [isOpen, productoSeleccionado]);

    const handleSubmit = async () => {
        if (!productoSeleccionado) return;
        if (cantidad <= 0) {
            alert('La cantidad debe ser mayor a 0');
            return;
        }
        if (costoUnitario <= 0) {
            alert('El costo unitario debe ser mayor a 0');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Intentar usar la nueva tabla profesional
            let productoId = producto.id;
            let error = null;

            // Actualizar stock en inventario_productos
            const { data: productoActual, error: fetchError } = await supabase
                .from('inventario_productos')
                .select('stock_actual, costo_promedio')
                .eq('id', productoSeleccionado.id)
                .single();

            if (!fetchError && productoActual) {
                // Calcular nuevo costo promedio ponderado
                const stockAnterior = productoActual.stock_actual || 0;
                const costoAnterior = productoActual.costo_promedio || 0;
                const nuevoStock = stockAnterior + cantidad;
                
                let nuevoCostoPromedio = costoUnitario;
                if (stockAnterior > 0 && costoAnterior > 0) {
                    // Costo promedio ponderado
                    nuevoCostoPromedio = ((stockAnterior * costoAnterior) + (cantidad * costoUnitario)) / nuevoStock;
                }

                // Actualizar producto
                const { error: updateError } = await supabase
                    .from('inventario_productos')
                    .update({
                        stock_actual: nuevoStock,
                        costo_promedio: nuevoCostoPromedio
                    })
                    .eq('id', productoSeleccionado.id);

                if (updateError) throw updateError;

                // Crear movimiento de entrada
                const { error: movError } = await supabase
                    .from('inventario_movimientos')
                    .insert([{
                        producto_id: productoSeleccionado.id,
                        tipo_movimiento: 'entrada',
                        cantidad: cantidad,
                        costo_unitario: costoUnitario,
                        motivo: motivo,
                        referencia_tipo: 'manual',
                        usuario_id: user?.id || null,
                        notas: notas || null
                    }]);

                if (movError) {
                    console.warn('Error creando movimiento (no crítico):', movError);
                }

                alert(`Se agregaron ${cantidad} unidades al inventario`);
            } else {
                // Fallback a tabla antigua
                const { data: productoOld, error: fetchOldError } = await supabase
                    .from('inventario')
                    .select('cantidad, precio_unitario')
                    .eq('id', productoSeleccionado.id)
                    .single();

                if (fetchOldError) throw fetchOldError;

                const cantidadAnterior = productoOld.cantidad || 0;
                const nuevoStock = cantidadAnterior + cantidad;

                // Calcular nuevo precio promedio
                const precioAnterior = productoOld.precio_unitario || 0;
                let nuevoPrecio = costoUnitario;
                if (cantidadAnterior > 0 && precioAnterior > 0) {
                    nuevoPrecio = ((cantidadAnterior * precioAnterior) + (cantidad * costoUnitario)) / nuevoStock;
                }

                const { error: updateOldError } = await supabase
                    .from('inventario')
                    .update({
                        cantidad: nuevoStock,
                        precio_unitario: nuevoPrecio
                    })
                    .eq('id', productoSeleccionado.id);

                if (updateOldError) throw updateOldError;

                alert(`Se agregaron ${cantidad} unidades al inventario`);
            }

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error agregando stock:', error);
            alert('Error al agregar stock: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;
    
    // Si no hay producto seleccionado pero hay productos disponibles, mostrar selector
    if (!productoSeleccionado && productos.length > 0) {
        return createPortal(
            <div className="modal-overlay typeform-overlay" onClick={onClose}>
                <div className="modal typeform-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="typeform-header">
                        <h2>Agregar Stock al Inventario</h2>
                        <button className="close-btn" onClick={onClose}>
                            <Icon name="times" />
                        </button>
                    </div>
                    <div className="typeform-step">
                        <div className="step-content">
                            <h3 className="step-title">Selecciona un Producto</h3>
                            <p className="step-subtitle">Elige el producto al que quieres agregar stock</p>
                            
                            <div className="form-group">
                                <label className="form-label">
                                    Producto <span className="required">*</span>
                                </label>
                                <select
                                    className="form-input typeform-select"
                                    value=""
                                    onChange={(e) => {
                                        const productoId = parseInt(e.target.value);
                                        const producto = productos.find(p => p.id === productoId);
                                        if (producto) {
                                            setProductoSeleccionado(producto);
                                        }
                                    }}
                                >
                                    <option value="">Selecciona un producto...</option>
                                    {productos.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.nombre} (Stock actual: {p.stock_actual || 0})
                                        </option>
                                    ))}
                                </select>
                                <p className="form-hint">Selecciona el producto al que quieres agregar cantidad</p>
                            </div>
                        </div>
                        <div className="typeform-actions">
                            <button className="btn-secondary" onClick={onClose}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    }
    
    // Si no hay producto seleccionado y no hay productos, mostrar mensaje
    if (!productoSeleccionado) {
        return createPortal(
            <div className="modal-overlay typeform-overlay" onClick={onClose}>
                <div className="modal typeform-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="typeform-header">
                        <h2>Agregar Stock al Inventario</h2>
                        <button className="close-btn" onClick={onClose}>
                            <Icon name="times" />
                        </button>
                    </div>
                    <div className="typeform-step">
                        <div className="step-content" style={{ textAlign: 'center', padding: '2rem' }}>
                            <Icon name="info-circle" style={{ fontSize: '3rem', color: '#10b981', marginBottom: '1rem' }} />
                            <h3>No hay productos disponibles</h3>
                            <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: '0.5rem' }}>
                                Primero debes crear un producto antes de agregar stock.
                            </p>
                        </div>
                        <div className="typeform-actions">
                            <button className="btn-secondary" onClick={onClose}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    const valorTotal = cantidad * costoUnitario;

    return createPortal(
        <div className="modal-overlay typeform-overlay" onClick={onClose}>
            <div className="modal typeform-modal" onClick={(e) => e.stopPropagation()}>
                <div className="typeform-header">
                    <h2>Agregar Stock al Inventario</h2>
                    <button className="close-btn" onClick={onClose}>
                        <Icon name="times" />
                    </button>
                </div>

                <div className="typeform-step">
                    <div className="step-content">
                        <div className="producto-info" style={{ 
                            padding: '1rem', 
                            background: 'rgba(16, 185, 129, 0.1)', 
                            borderRadius: '8px', 
                            marginBottom: '1.5rem' 
                        }}>
                            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>{productoSeleccionado.nombre}</h3>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                                Stock actual: <strong>{productoSeleccionado.stock_actual || 0}</strong> unidades
                            </p>
                            {productos.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => setProductoSeleccionado(null)}
                                    style={{
                                        marginTop: '0.5rem',
                                        padding: '0.25rem 0.5rem',
                                        background: 'transparent',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        borderRadius: '4px',
                                        color: '#10b981',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cambiar producto
                                </button>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                Cantidad a Agregar <span className="required">*</span>
                            </label>
                            <input
                                type="number"
                                className="form-input"
                                min="1"
                                placeholder="0"
                                value={cantidad}
                                onChange={(e) => setCantidad(parseInt(e.target.value) || 0)}
                                required
                            />
                            <p className="form-hint">Cantidad de unidades que estás agregando al inventario</p>
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                Costo por Unidad <span className="required">*</span>
                            </label>
                            <div className="input-with-icon">
                                <span className="input-icon">$</span>
                                <input
                                    type="number"
                                    className="form-input"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={costoUnitario}
                                    onChange={(e) => setCostoUnitario(parseFloat(e.target.value) || 0)}
                                    required
                                />
                            </div>
                            <p className="form-hint">Costo de compra por unidad. Se usará para calcular el nuevo costo promedio</p>
                        </div>

                        {valorTotal > 0 && (
                            <div className="calculated-field">
                                <label className="form-label">Valor Total de esta Entrada</label>
                                <div className="calculated-value">
                                    ${valorTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Motivo</label>
                            <select
                                className="form-input typeform-select"
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                            >
                                <option value="compra">Compra</option>
                                <option value="devolucion">Devolución</option>
                                <option value="ajuste">Ajuste de Inventario</option>
                                <option value="transferencia">Transferencia</option>
                                <option value="otro">Otro</option>
                            </select>
                            <p className="form-hint">Razón por la que se agrega este stock</p>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Notas (opcional)</label>
                            <textarea
                                className="form-input"
                                rows="2"
                                placeholder="Ej: Comprado a proveedor X, Factura #123..."
                                value={notas}
                                onChange={(e) => setNotas(e.target.value)}
                                maxLength={500}
                            />
                            <p className="form-hint">Información adicional sobre esta entrada</p>
                        </div>
                    </div>

                    <div className="typeform-actions">
                        <button className="btn-secondary" onClick={onClose}>
                            Cancelar
                        </button>
                        <button 
                            className="btn-primary" 
                            onClick={handleSubmit}
                            disabled={loading || cantidad <= 0 || costoUnitario <= 0}
                        >
                            {loading ? (
                                <>
                                    <Icon name="sync" className="spinning" />
                                    Agregando...
                                </>
                            ) : (
                                <>
                                    <Icon name="check" />
                                    Agregar {cantidad} {cantidad === 1 ? 'unidad' : 'unidades'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

