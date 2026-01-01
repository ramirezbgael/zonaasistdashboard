# 📦 Diseño Profesional: Módulo de Inventario - Zona Asist

## 1️⃣ Modelo de Datos Profesional

### Tablas Principales

#### `inventario_productos`
**Productos base del inventario**
```sql
- id (PK)
- codigo_sku (VARCHAR, UNIQUE) -- Código interno único
- nombre (VARCHAR, NOT NULL)
- descripcion (TEXT)
- tipo (ENUM: 'refaccion', 'consumible', 'equipo_venta', 'papel', 'tinta', 'almohadilla', 'disco_duro', 'otro')
- categoria (VARCHAR) -- Para agrupación: 'impresoras', 'computadoras', 'general'
- unidad_medida (VARCHAR) -- 'pieza', 'metro', 'litro', 'kg'
- stock_actual (INTEGER, DEFAULT 0) -- Stock físico actual
- stock_minimo (INTEGER, DEFAULT 0) -- Alerta cuando baja de esto
- stock_maximo (INTEGER) -- Para sugerencias de compra
- costo_promedio (DECIMAL) -- Costo promedio ponderado
- precio_venta (DECIMAL) -- Si aplica
- proveedor_id (FK) -- Proveedor principal
- ubicacion (VARCHAR) -- Estante, caja, etc.
- activo (BOOLEAN, DEFAULT true) -- Soft delete
- created_at, updated_at
```

#### `inventario_movimientos`
**Auditoría completa de entradas/salidas**
```sql
- id (PK)
- producto_id (FK, NOT NULL)
- tipo_movimiento (ENUM: 'entrada', 'salida', 'ajuste', 'reserva', 'cancelacion')
- cantidad (INTEGER, NOT NULL)
- costo_unitario (DECIMAL) -- Costo al momento del movimiento
- motivo (VARCHAR) -- 'compra', 'uso_equipo', 'ajuste_inventario', 'devolucion'
- referencia_tipo (VARCHAR) -- 'equipo', 'pedido', 'trabajo', 'manual'
- referencia_id (INTEGER) -- ID del equipo, pedido, etc.
- usuario_id (FK) -- Quién hizo el movimiento
- equipo_id (FK) -- Si se usó en un equipo
- notas (TEXT)
- created_at
```

#### `inventario_reservas`
**Stock reservado para trabajos pendientes**
```sql
- id (PK)
- producto_id (FK, NOT NULL)
- cantidad (INTEGER, NOT NULL)
- equipo_id (FK) -- Equipo que necesita la refacción
- estado (ENUM: 'pendiente', 'confirmada', 'usada', 'cancelada')
- usuario_id (FK) -- Quién reservó
- fecha_reserva (TIMESTAMP)
- fecha_vencimiento (TIMESTAMP) -- Auto-cancelar si pasa mucho tiempo
- notas (TEXT)
- created_at, updated_at
```

#### `inventario_ajustes`
**Ajustes de inventario (conteos físicos, pérdidas, etc.)**
```sql
- id (PK)
- producto_id (FK, NOT NULL)
- cantidad_anterior (INTEGER)
- cantidad_nueva (INTEGER)
- diferencia (INTEGER) -- Calculado
- motivo (VARCHAR) -- 'conteo_fisico', 'perdida', 'robo', 'deterioro'
- usuario_id (FK)
- notas (TEXT)
- created_at
```

### Relaciones con Tablas Existentes

- `equipos` → Puede tener múltiples productos usados
- `pedidos_piezas` → Puede crear entradas automáticas
- `servicios_documentos` → Puede consumir productos (papel, tinta)
- `proveedores` → Ya existe, solo FK

---

## 2️⃣ Lógica de Negocio

### Estados de Producto
- **disponible**: Stock > 0, sin reservas
- **reservado**: Stock disponible pero reservado para trabajo
- **bajo_minimo**: Stock < stock_minimo
- **agotado**: Stock = 0
- **inactivo**: Soft delete

### Flujos de Movimiento

#### Entrada de Producto
1. Compra desde proveedor → `inventario_movimientos` (tipo: entrada)
2. Actualizar `stock_actual` en `inventario_productos`
3. Recalcular `costo_promedio` (promedio ponderado)
4. Si viene de `pedidos_piezas`, marcar pedido como recibido

#### Salida de Producto
1. Uso en equipo → `inventario_movimientos` (tipo: salida)
2. Reducir `stock_actual`
3. Si había reserva, marcarla como usada
4. Registrar en historial del equipo

#### Reserva de Stock
1. Técnico asigna refacción a equipo → Crear `inventario_reservas`
2. No descontar stock aún, solo reservar
3. Al usar realmente → Convertir reserva en salida
4. Si se cancela equipo → Liberar reserva

---

## 3️⃣ Flujo Operativo Ideal

### Escenario 1: Producto Nuevo Entra
```
1. Recepción recibe pedido de proveedor
2. Abre modal "Recibir Producto"
3. Selecciona pedido o crea entrada manual
4. Sistema:
   - Crea/actualiza producto en inventario
   - Crea movimiento de entrada
   - Actualiza stock
   - Si viene de pedido, marca como recibido
5. Notificación a técnicos si era algo esperado
```

### Escenario 2: Técnico Necesita Refacción
```
1. Técnico abre equipo en reparación
2. Ve sección "Refacciones Necesarias"
3. Busca producto → Ve stock disponible
4. Si hay stock:
   - Reserva automática
   - Muestra en equipo como "Refacción asignada"
5. Al usar realmente:
   - Confirma uso → Descuenta stock
   - Crea movimiento de salida
   - Asocia a equipo
```

### Escenario 3: Equipo se Cancela
```
1. Equipo se marca como cancelado
2. Sistema automáticamente:
   - Libera todas las reservas de ese equipo
   - Muestra en historial qué se liberó
   - Notifica si había productos costosos reservados
```

### Escenario 4: Stock Bajo
```
1. Sistema detecta stock < stock_minimo
2. Crea alerta en dashboard
3. Sugiere crear pedido automático
4. Muestra último proveedor usado
5. Técnico puede crear pedido con 1 clic
```

---

## 4️⃣ UX/UI Improvements

### Dashboard de Inventario

#### Métricas Principales (Top)
```
┌─────────────────────────────────────────────────┐
│ [💰 Valor Total] [📦 Productos] [⚠️ Alertas]   │
│ $45,230.50       127 items      3 bajos        │
└─────────────────────────────────────────────────┘
```

#### Acciones Rápidas
- ➕ Agregar Producto
- 📥 Recibir Pedido
- 🔍 Buscar por SKU/Nombre
- 📊 Ajuste de Inventario
- 📋 Reporte de Movimientos

#### Filtros Inteligentes
- Por tipo (refacción, consumible, etc.)
- Por estado (disponible, bajo mínimo, agotado)
- Por categoría
- Por proveedor

#### Cards de Producto
```
┌─────────────────────────────────────┐
│ [Icono]  SKU: HP302XL              │
│         Tinta HP 302 Negro          │
│                                     │
│ Stock: 12 / Mín: 5  [🟢 Disponible] │
│ Costo: $450 | Valor: $5,400        │
│                                     │
│ [Ver Detalles] [Usar] [Ajustar]    │
└─────────────────────────────────────┘
```

#### Estados Visuales
- 🟢 Verde: Disponible (stock > mínimo)
- 🟡 Amarillo: Bajo mínimo (stock < mínimo pero > 0)
- 🔴 Rojo: Agotado (stock = 0)
- 🔵 Azul: Reservado (stock reservado)
- ⚪ Gris: Inactivo

#### Qué NO Mostrar
- ❌ Movimientos individuales en lista principal
- ❌ Campos técnicos (IDs, timestamps)
- ❌ Información de proveedor a menos que sea relevante
- ❌ Historial completo (solo en detalle)

---

## 5️⃣ Automatizaciones Clave

### Auto-descontar al Cerrar Equipo
```javascript
// Cuando equipo se marca como "listo" o "finalizado"
1. Buscar todas las reservas del equipo
2. Convertir reservas en movimientos de salida
3. Descontar stock real
4. Registrar en historial del equipo
```

### Bloquear Entrega si Falta Refacción
```javascript
// Al intentar marcar equipo como "listo"
1. Verificar si hay reservas pendientes
2. Si reserva no se confirmó como usada:
   - Mostrar alerta: "Faltan refacciones por usar"
   - Listar productos reservados
   - Opción: "Usar ahora" o "Cancelar reserva"
```

### Sugerir Pedido Automático
```javascript
// Cuando stock < stock_minimo
1. Crear alerta en dashboard
2. Botón "Crear Pedido"
3. Pre-llenar formulario con:
   - Producto
   - Cantidad sugerida (stock_maximo - stock_actual)
   - Último proveedor usado
   - Último costo
```

### Historial de Movimientos
```javascript
// Vista de historial por producto
- Timeline visual
- Filtros por tipo, fecha, usuario
- Exportar a PDF/Excel
- Búsqueda por referencia (equipo #13024)
```

---

## 6️⃣ Errores Comunes a Evitar

### ❌ Malas Prácticas
1. **No usar soft delete** → Perder historial
2. **No registrar quién hizo qué** → Sin auditoría
3. **Descontar stock antes de usar** → Stock negativo
4. **No manejar reservas** → Doble uso del mismo producto
5. **No calcular costo promedio** → Precios incorrectos
6. **No tener stock mínimo** → Quedarse sin productos críticos

### ✅ Buenas Prácticas
1. **Siempre crear movimiento** antes de cambiar stock
2. **Reservar antes de usar** → Evitar conflictos
3. **Validar stock disponible** antes de reservar
4. **Auditoría completa** → Quién, cuándo, por qué
5. **Alertas proactivas** → No reactivas
6. **Integración automática** → Menos errores manuales

---

## 🎯 Prioridades de Implementación

### Fase 1: Base Sólida (Crítico)
- ✅ Modelo de datos completo
- ✅ Movimientos de entrada/salida
- ✅ Reservas básicas
- ✅ Dashboard con métricas clave

### Fase 2: Automatización (Alto)
- ✅ Auto-descontar al cerrar equipo
- ✅ Alertas de stock mínimo
- ✅ Integración con pedidos

### Fase 3: UX Profesional (Medio)
- ✅ Búsqueda avanzada
- ✅ Historial visual
- ✅ Reportes exportables

### Fase 4: Optimizaciones (Bajo)
- ✅ Sugerencias de compra
- ✅ Análisis de rotación
- ✅ Predicción de demanda

---

## 📊 Métricas Clave a Mostrar

1. **Valor Total del Inventario** (suma de stock × costo)
2. **Productos Activos** (total de productos con stock > 0)
3. **Alertas Críticas** (agotados + bajo mínimo)
4. **Movimientos Hoy** (entradas y salidas del día)
5. **Productos Más Usados** (top 5 por frecuencia)

---

## 🔄 Flujo de Uso Típico

### Día a Día
1. Técnico abre equipo
2. Ve qué refacciones necesita
3. Busca en inventario
4. Si hay → Reserva automática
5. Usa la refacción
6. Al cerrar equipo → Se confirma uso y descuenta stock

### Recepción
1. Llega pedido de proveedor
2. Abre "Recibir Producto"
3. Escanea o busca producto
4. Ingresa cantidad recibida
5. Sistema actualiza stock automáticamente

### Administración
1. Revisa alertas de stock bajo
2. Crea pedidos para reponer
3. Revisa movimientos del mes
4. Ajusta stock mínimo si es necesario

---

## 🎨 Principios de Diseño

1. **Simplicidad**: Técnicos deben poder usar sin entrenamiento
2. **Visibilidad**: Estado del inventario siempre claro
3. **Automatización**: Menos clicks = menos errores
4. **Auditoría**: Todo queda registrado
5. **Alertas Inteligentes**: Proactivas, no reactivas

