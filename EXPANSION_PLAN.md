# 🚀 Plan de Expansión - Zona Asist Platform

## 📊 Estructura de Módulos

### 1. 🔧 Módulo de Equipos (ACTUAL - Base completada)
- ✅ Sistema de estados (Pendientes/Listos/Finalizados)
- ✅ Procesos y subprocesos
- ✅ Gestión de clientes y comunicación
- 🎯 **Mejoras pendientes**: Timeline/Bitácora, comunicación interna, fotos/videos

### 2. 📄 Módulo de Documentos y Facturación (NUEVO)
- Gestión de servicios de transcripción
- Sistema de facturación integrado
- Control de documentos por estado
- Asignación de responsables

### 3. 📦 Módulo de Logística y Pedidos (NUEVO)
- Gestión de pedidos a proveedores
- Control de inventario básico
- Tracking de piezas en tránsito
- Integración con reparaciones

### 4. 👥 Módulo de Clientes/Proveedores (EXPANSIÓN)
- Base de datos unificada de contactos
- Historial de servicios por cliente
- Gestión de proveedores para logística

### 5. 📈 Módulo de Reportes (NUEVO)
- Dashboards ejecutivos
- Métricas de rendimiento por módulo
- Reportes financieros

## 🎨 Diseño y UX

### Dashboard Principal
- **Vista de Métricas**: Tarjetas resumen por módulo
- **Navegación Lateral**: Menú modular expandible
- **Buscador Global**: Búsqueda unificada across módulos
- **Centro de Notificaciones**: Alertas en tiempo real

### Paleta de Colores por Módulo
- 🔵 **Equipos**: Azul (#007bff)
- 🟢 **Documentos**: Verde (#28a745)
- 🟡 **Logística**: Amarillo (#ffc107)
- 🟣 **Clientes**: Morado (#6f42c1)
- 🔴 **Reportes**: Rojo (#dc3545)

## 🗄️ Estructura de Base de Datos

### Nuevas Tablas Requeridas

```sql
-- Módulo de Documentos
CREATE TABLE servicios_documentos (
    id SERIAL PRIMARY KEY,
    tipo_servicio VARCHAR(50), -- 'transcripcion', 'factura', 'cotizacion'
    estado VARCHAR(20) DEFAULT 'pendiente',
    cliente_id INTEGER REFERENCES clientes(id),
    asignado_a UUID REFERENCES auth.users(id),
    descripcion TEXT,
    archivos JSONB, -- URLs de archivos subidos
    fecha_inicio TIMESTAMP DEFAULT NOW(),
    fecha_entrega TIMESTAMP,
    precio DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Módulo de Logística
CREATE TABLE pedidos_piezas (
    id SERIAL PRIMARY KEY,
    equipo_id INTEGER REFERENCES equipos(id),
    proveedor_id INTEGER REFERENCES proveedores(id),
    nombre_pieza VARCHAR(255),
    numero_parte VARCHAR(100),
    cantidad INTEGER,
    precio_unitario DECIMAL(10,2),
    estado VARCHAR(20) DEFAULT 'pendiente',
    fecha_pedido TIMESTAMP,
    fecha_estimada_llegada TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Proveedores
CREATE TABLE proveedores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255),
    contacto VARCHAR(255),
    telefono VARCHAR(20),
    email VARCHAR(255),
    direccion TEXT,
    sitio_web VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sistema de Notificaciones
CREATE TABLE notificaciones (
    id SERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES auth.users(id),
    tipo VARCHAR(50),
    titulo VARCHAR(255),
    mensaje TEXT,
    modulo VARCHAR(50),
    referencia_id INTEGER,
    leida BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Comunicación Interna
CREATE TABLE comentarios (
    id SERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES auth.users(id),
    modulo VARCHAR(50), -- 'equipos', 'documentos', 'logistica'
    referencia_id INTEGER,
    mensaje TEXT,
    archivos JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🚦 Fases de Desarrollo

### Fase 1: Infraestructura Base (1-2 semanas)
1. ✅ Actualizar navbar principal con navegación modular
2. ✅ Crear estructura de routing para nuevos módulos
3. ✅ Implementar sistema de notificaciones
4. ✅ Agregar buscador global

### Fase 2: Módulo de Documentos (2-3 semanas)
1. ✅ Crear vistas para servicios de documentos
2. ✅ Sistema de carga/descarga de archivos
3. ✅ Workflow de estados para documentos
4. ✅ Integración con facturación

### Fase 3: Módulo de Logística (2-3 semanas)
1. ✅ Gestión de proveedores
2. ✅ Sistema de pedidos de piezas
3. ✅ Integración con módulo de equipos
4. ✅ Control básico de inventario

### Fase 4: Comunicación y Timeline (1-2 semanas)
1. ✅ Sistema de comentarios internos
2. ✅ Timeline/bitácora para equipos
3. ✅ Carga de fotos/videos
4. ✅ Notificaciones automáticas

### Fase 5: Reportes y Analytics (1-2 semanas)
1. ✅ Dashboard ejecutivo
2. ✅ Métricas por módulo
3. ✅ Reportes financieros
4. ✅ Exportación de datos

## 🔄 Funcionalidades Transversales

### Sistema de Notificaciones
- Equipos listos para recoger
- Piezas que llegaron a inventario
- Documentos completados
- Pedidos en tránsito

### Comunicación Interna
- Comentarios por equipo/documento/pedido
- Menciones entre usuarios (@usuario)
- Archivos adjuntos (fotos/documentos)

### Búsqueda Global
- Equipos por #nota, marca, modelo
- Documentos por cliente, tipo
- Pedidos por proveedor, pieza
- Clientes por nombre, teléfono

## 💡 Tecnologías y Herramientas

### Frontend
- ✅ **React 19** - Base actual
- ✅ **CSS Modules** - Estilos modulares
- 🎯 **React Router** - Navegación avanzada
- 🎯 **Context API** - Estado global

### Backend
- ✅ **Supabase** - Base de datos y auth
- 🎯 **Supabase Storage** - Archivos/imágenes
- 🎯 **Supabase Realtime** - Notificaciones

### Nuevas Dependencias
```json
{
  "react-router-dom": "^7.6.3", // ✅ Ya instalado
  "react-dropzone": "^14.x", // Para carga de archivos
  "recharts": "^2.x", // Para gráficos y métricas
  "@supabase/realtime-js": "^2.x", // Notificaciones en tiempo real
  "react-mention": "^5.x" // Sistema de menciones
}
```

## 📋 Next Steps

1. **¿Empezar con qué módulo?** Recomiendo:
   - Infraestructura base (navbar + routing)
   - Módulo de Documentos (más simple)
   - Módulo de Logística (más complejo)

2. **¿Mantener el diseño actual?** 
   - Sí, expandir el sistema de tarjetas
   - Mantener paleta de colores coherente
   - Mejorar navegación y UX

3. **¿Migración gradual?**
   - Mantener módulo actual funcionando
   - Agregar módulos uno por uno
   - Testing continuo

---

**¿Con qué módulo te gustaría que empecemos?** 🚀
