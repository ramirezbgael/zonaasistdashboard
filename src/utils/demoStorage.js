/**
 * Utilidad para persistir datos demo en localStorage.
 * Los formularios en modo demo guardan aquí y las listas leen de aquí.
 */

const KEYS = {
  EQUIPOS: 'demo_equipos',
  CLIENTES: 'demo_clientes',
  DOCUMENTOS: 'demo_documentos',
  PEDIDOS: 'demo_pedidos',
  INVENTARIO: 'demo_inventario',
};

const SEED_EQUIPOS = [
  { id: 'demo-e1', marca: 'Dell', modelo: 'Inspiron 15', color: 'negro', nota: '13500', problema: 'No enciende', created_at: null, cliente_id: null, clientes: { nombre: 'Juan Pérez', telefono: '5512345678' }, estadoActual: 'pendiente', siguienteSubproceso: { nombre: 'Diagnóstico inicial' }, totalSubprocesos: 3, tieneProcesoValido: true, procesoNombre: 'Reparación estándar', estado_equipos: [] },
  { id: 'demo-e2', marca: 'HP', modelo: 'Pavilion 14', color: 'gris', nota: '13501', problema: 'Lento y se traba', created_at: null, cliente_id: null, clientes: { nombre: 'Ana López', telefono: '5522334455' }, estadoActual: 'listo', siguienteSubproceso: null, totalSubprocesos: 4, tieneProcesoValido: true, procesoNombre: 'Mantenimiento completo', estado_equipos: [] },
  { id: 'demo-e3', marca: 'Lenovo', modelo: 'IdeaPad 3', color: 'azul', nota: '13502', problema: 'Pantalla rota', created_at: null, cliente_id: null, clientes: { nombre: 'Mario Díaz', telefono: '5544556677' }, estadoActual: 'finalizado', siguienteSubproceso: null, totalSubprocesos: 2, tieneProcesoValido: true, procesoNombre: 'Cambio de pantalla', estado_equipos: [] },
];

const SEED_CLIENTES = [
  { id: 'demo-c1', nombre: 'Juan Pérez', telefono: '5512345678', email: 'juan@example.com' },
  { id: 'demo-c2', nombre: 'Ana López', telefono: '5522334455', email: 'ana@example.com' },
  { id: 'demo-c3', nombre: 'Empresa XYZ', telefono: '5544556677', email: 'contacto@empresa-xyz.com' },
];

const SEED_DOCUMENTOS = [
  { id: 'demo-d1', tipo_servicio: 'transcripcion', descripcion: 'Conferencia marketing 2h', precio: 650, estado: 'pendiente', fecha_inicio: null, created_at: null, asignado_a: null, usuarioAsignado: 'Tú (demo)', clientes: { id: 'demo-c1', nombre: 'Universidad X', telefono: '5511122233', email: 'contacto@universidadx.mx' } },
  { id: 'demo-d2', tipo_servicio: 'factura', descripcion: 'Factura servicios de impresión', precio: 320, estado: 'pendiente', fecha_inicio: null, created_at: null, asignado_a: null, usuarioAsignado: 'Tú (demo)', clientes: { id: 'demo-c2', nombre: 'Empresa ABC', telefono: '5544455566', email: 'facturacion@empresaabc.com' } },
  { id: 'demo-d3', tipo_servicio: 'transcripcion', descripcion: 'Podcast episodio 10', precio: 500, estado: 'completado', fecha_inicio: null, created_at: null, asignado_a: null, usuarioAsignado: 'Tú (demo)', clientes: { id: 'demo-c3', nombre: 'Cliente frecuente', telefono: '5577788899', email: 'cliente@ejemplo.com' } },
];

const SEED_PEDIDOS = [
  { id: 'demo-p1', nombre_pieza: 'SSD 500GB NVMe', cantidad: 2, estado: 'pendiente', fecha_estimada_llegada: null, created_at: null, proveedores: { nombre: 'Amazon' }, equipos: { id: 'demo-e1', marca: 'Dell', modelo: 'Inspiron 15', nota: '13500', cliente_id: null, clientes: { id: 'demo-c1', nombre: 'Juan Pérez', telefono: '5512345678', email: 'juan@example.com' } } },
  { id: 'demo-p2', nombre_pieza: 'Teclado Lenovo', cantidad: 1, estado: 'recibido', fecha_estimada_llegada: null, created_at: null, proveedores: { nombre: 'Mayorista XYZ' }, equipos: { id: 'demo-e2', marca: 'Lenovo', modelo: 'IdeaPad 3', nota: '13501', cliente_id: null, clientes: { id: 'demo-c2', nombre: 'Ana López', telefono: '5522334455', email: 'ana@example.com' } } },
];

const SEED_INVENTARIO = [
  { id: 'demo-p1', tipo: 'refaccion', nombre: 'SSD 500GB NVMe', descripcion: 'Disco sólido para upgrades rápidos', codigo_sku: 'SSD-500-NVME', stock_actual: 6, stock_reservado: 2, stock_disponible: 4, stock_minimo: 3, costo_promedio: 850, valor_total: 5100, estado_producto: 'disponible', categoria: 'Almacenamiento', proveedores: { nombre: 'Proveedor demo' }, ubicacion: 'Estante A1' },
  { id: 'demo-p2', tipo: 'consumible', nombre: 'Resma papel carta', descripcion: 'Papel blanco 75g', codigo_sku: 'PAPEL-CARTA', stock_actual: 2, stock_reservado: 0, stock_disponible: 2, stock_minimo: 5, costo_promedio: 120, valor_total: 240, estado_producto: 'bajo_minimo', categoria: 'Papel', proveedores: { nombre: 'Papelería demo' }, ubicacion: 'Bodega' },
  { id: 'demo-p3', tipo: 'tinta', nombre: 'Tinta Epson Negra 544', descripcion: 'Original', codigo_sku: 'TIN-EP-544-N', stock_actual: 0, stock_reservado: 0, stock_disponible: 0, stock_minimo: 2, costo_promedio: 220, valor_total: 0, estado_producto: 'agotado', categoria: 'Tintas', proveedores: { nombre: 'Mayorista demo' }, ubicacion: 'Estante C3' },
];

function now() {
  return new Date().toISOString();
}

function seedIfEmpty(key, seed) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw === '[]') {
      const withDates = seed.map((item) => ({ ...item, created_at: item.created_at ?? now() }));
      localStorage.setItem(key, JSON.stringify(withDates));
      return withDates;
    }
    return JSON.parse(raw);
  } catch {
    const withDates = seed.map((item) => ({ ...item, created_at: item.created_at ?? now() }));
    localStorage.setItem(key, JSON.stringify(withDates));
    return withDates;
  }
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// --- EQUIPOS ---
export function getEquipos() {
  return seedIfEmpty(KEYS.EQUIPOS, SEED_EQUIPOS);
}

const NOTA_EQUIPO_INICIAL = 13500;

export function addEquipo(equipo) {
  const list = getEquipos();
  const id = generateId('demo-e');
  const maxExistente = list.length ? Math.max(...list.map((e) => parseInt(e.nota) || 0)) : 0;
  const nota = equipo.nota || String(Math.max(maxExistente + 1, NOTA_EQUIPO_INICIAL));
  const nuevo = {
    ...equipo,
    id,
    nota,
    created_at: now(),
    cliente_id: equipo.cliente_id ?? null,
    clientes: equipo.clientes ?? { nombre: 'Cliente demo', telefono: '' },
    estadoActual: 'pendiente',
    siguienteSubproceso: { nombre: 'Diagnóstico inicial' },
    totalSubprocesos: 3,
    tieneProcesoValido: true,
    procesoNombre: 'Reparación estándar',
    estado_equipos: [],
  };
  list.unshift(nuevo);
  localStorage.setItem(KEYS.EQUIPOS, JSON.stringify(list));
  return nuevo;
}

// --- CLIENTES ---
export function getClientes() {
  return seedIfEmpty(KEYS.CLIENTES, SEED_CLIENTES);
}

export function addCliente(cliente) {
  const list = getClientes();
  const nuevo = {
    id: generateId('demo-c'),
    nombre: cliente.nombre?.trim() || '',
    telefono: cliente.telefono?.trim() || '',
    email: cliente.email?.trim() || null,
    direccion: cliente.direccion?.trim() || null,
  };
  list.push(nuevo);
  localStorage.setItem(KEYS.CLIENTES, JSON.stringify(list));
  return nuevo;
}

// --- DOCUMENTOS ---
export function getDocumentos() {
  return seedIfEmpty(KEYS.DOCUMENTOS, SEED_DOCUMENTOS);
}

export function addDocumento(doc) {
  const list = getDocumentos();
  const nuevo = {
    id: generateId('demo-d'),
    tipo_servicio: doc.tipo_documento || doc.tipo_servicio || 'transcripcion',
    descripcion: doc.descripcion || '',
    precio: parseFloat(doc.precio_total) || 0,
    estado: 'pendiente',
    fecha_inicio: now(),
    created_at: now(),
    asignado_a: null,
    usuarioAsignado: 'Tú (demo)',
    clientes: doc.clientes ?? { nombre: doc.cliente_nombre || '', telefono: doc.cliente_telefono || '', email: doc.cliente_email || '' },
  };
  list.unshift(nuevo);
  localStorage.setItem(KEYS.DOCUMENTOS, JSON.stringify(list));
  return nuevo;
}

export function updateDocumento(id, updates) {
  const list = getDocumentos();
  const idx = list.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...updates };
  localStorage.setItem(KEYS.DOCUMENTOS, JSON.stringify(list));
  return list[idx];
}

// --- PEDIDOS ---
export function getPedidos() {
  return seedIfEmpty(KEYS.PEDIDOS, SEED_PEDIDOS);
}

export function addPedido(pedido) {
  const list = getPedidos();
  const nuevo = {
    id: generateId('demo-p'),
    nombre_pieza: pedido.nombre_pieza || pedido.producto || 'Producto',
    cantidad: pedido.cantidad || 1,
    estado: 'pendiente',
    fecha_estimada_llegada: pedido.fecha_estimada_llegada || now(),
    created_at: now(),
    proveedores: { nombre: pedido.proveedor || 'Proveedor demo' },
    equipos: pedido.equipos ?? null,
  };
  list.unshift(nuevo);
  localStorage.setItem(KEYS.PEDIDOS, JSON.stringify(list));
  return nuevo;
}

export function updatePedido(id, updates) {
  const list = getPedidos();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...updates };
  localStorage.setItem(KEYS.PEDIDOS, JSON.stringify(list));
  return list[idx];
}

// --- INVENTARIO ---
export function getInventario() {
  return seedIfEmpty(KEYS.INVENTARIO, SEED_INVENTARIO);
}

export function addInventarioProducto(producto) {
  const list = getInventario();
  const stock = parseFloat(producto.stock_actual ?? producto.cantidad ?? 0) || 0;
  const costo = parseFloat(producto.costo_promedio ?? producto.precio_unitario ?? 0) || 0;
  let estado = 'disponible';
  if (stock === 0) estado = 'agotado';
  else if (stock < (producto.stock_minimo ?? 0)) estado = 'bajo_minimo';
  const nuevo = {
    id: generateId('demo-p'),
    tipo: producto.tipo || 'otro',
    nombre: producto.nombre || 'Producto',
    descripcion: producto.descripcion || '',
    codigo_sku: producto.codigo_sku || null,
    stock_actual: stock,
    stock_reservado: producto.stock_reservado ?? 0,
    stock_disponible: stock,
    stock_minimo: producto.stock_minimo ?? 0,
    costo_promedio: costo,
    valor_total: stock * costo,
    estado_producto: estado,
    categoria: producto.categoria || null,
    proveedores: producto.proveedores ?? { nombre: 'Proveedor demo' },
    ubicacion: producto.ubicacion || '',
  };
  list.push(nuevo);
  localStorage.setItem(KEYS.INVENTARIO, JSON.stringify(list));
  return nuevo;
}

export function updateInventarioProducto(id, updates) {
  const list = getInventario();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const current = list[idx];
  const stockActual = updates.stock_actual ?? current.stock_actual ?? 0;
  const costoPromedio = updates.costo_promedio ?? current.costo_promedio ?? 0;
  let estado = 'disponible';
  if (stockActual === 0) estado = 'agotado';
  else if (stockActual < (current.stock_minimo ?? 0)) estado = 'bajo_minimo';
  list[idx] = {
    ...current,
    ...updates,
    stock_actual: stockActual,
    stock_disponible: stockActual - (current.stock_reservado ?? 0),
    valor_total: stockActual * costoPromedio,
    estado_producto: estado,
  };
  localStorage.setItem(KEYS.INVENTARIO, JSON.stringify(list));
  return list[idx];
}
