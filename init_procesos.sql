-- Script para inicializar procesos y subprocesos en Supabase
-- Ejecutar este script en el SQL Editor de Supabase

-- Insertar procesos principales
INSERT INTO procesos (nombre, descripcion) VALUES
('Está lenta', 'Diagnóstico y solución para equipos con rendimiento lento'),
('No prende', 'Diagnóstico completo para equipos que no encienden'),
('Cambio de disco', 'Proceso completo de reemplazo de disco duro con respaldo y restauración'),
('Restablecer', 'Formateo y reinstalación completa del sistema operativo'),
('Pantalla azul', 'Diagnóstico y solución para errores de pantalla azul (BSOD)');

-- Insertar subprocesos para "Está lenta" (ID: 1)
INSERT INTO subprocesos (proceso_id, nombre, descripcion, orden) VALUES
(1, 'Verificar tipo de disco', 'Identificar si es HDD o SSD y su estado', 1),
(1, 'Verificar tamaño de memoria RAM', 'Comprobar cantidad y estado de la memoria RAM', 2),
(1, 'Verificar versión de sistema operativo', 'Revisar si el OS está actualizado y es compatible', 3),
(1, 'Limpiar sistema', 'Eliminar archivos temporales, malware y programas innecesarios', 4);

-- Insertar subprocesos para "No prende" (ID: 2)
INSERT INTO subprocesos (proceso_id, nombre, descripcion, orden) VALUES
(2, 'Verificar voltaje de cargador', 'Medir voltaje del adaptador de corriente', 1),
(2, 'Intentar encender sin batería', 'Probar encendido solo con corriente directa', 2),
(2, 'Cambiar memoria RAM', 'Probar con memoria RAM diferente', 3),
(2, 'Cambiar disco duro', 'Probar con disco duro diferente', 4),
(2, 'Revisar fuente de poder', 'Verificar estado de la fuente interna', 5),
(2, 'Cambiar tarjeta gráfica', 'Probar con tarjeta gráfica diferente (si aplica)', 6),
(2, 'Determinar si es la placa madre', 'Diagnóstico final para identificar falla en motherboard', 7);

-- Insertar subprocesos para "Cambio de disco" (ID: 3)
INSERT INTO subprocesos (proceso_id, nombre, descripcion, orden) VALUES
(3, 'Verificar tipo de disco requerido', 'Identificar interfaz y especificaciones necesarias', 1),
(3, 'Verificar espacio requerido', 'Determinar capacidad de almacenamiento necesaria', 2),
(3, 'Preguntar si necesita respaldo', 'Consultar al cliente sobre backup de datos', 3),
(3, 'Realizar respaldo de datos', 'Extraer y guardar información importante', 4),
(3, 'Confirmar integridad del respaldo', 'Verificar que el backup esté completo y funcional', 5),
(3, 'Instalar disco nuevo', 'Reemplazar físicamente el disco duro', 6),
(3, 'Instalar sistema operativo', 'Formatear e instalar OS en el disco nuevo', 7),
(3, 'Instalar software básico', 'Instalar navegadores, utilidades y office', 8),
(3, 'Restaurar respaldo de datos', 'Devolver archivos del cliente al equipo', 9),
(3, 'Confirmar restauración exitosa', 'Verificar que todos los datos estén accesibles', 10),
(3, 'Probar funcionamiento del equipo', 'Test final de rendimiento y estabilidad', 11);

-- Insertar subprocesos para "Restablecer" (ID: 4)
INSERT INTO subprocesos (proceso_id, nombre, descripcion, orden) VALUES
(4, 'Verificar tipo de disco actual', 'Evaluar estado del disco existente', 1),
(4, 'Ofrecer disco nuevo si necesario', 'Recomendar reemplazo si el disco está dañado', 2),
(4, 'Consultar necesidad de respaldo', 'Preguntar al cliente sobre backup de datos', 3),
(4, 'Realizar respaldo de datos', 'Extraer y guardar información importante', 4),
(4, 'Verificar integridad del respaldo', 'Comprobar que el backup esté completo', 5),
(4, 'Formatear y restablecer sistema', 'Limpiar completamente el disco', 6),
(4, 'Instalar sistema operativo limpio', 'Instalación fresca del OS', 7),
(4, 'Instalar software esencial', 'Navegadores, utilidades, office y drivers', 8),
(4, 'Restaurar datos del respaldo', 'Devolver archivos del cliente', 9),
(4, 'Confirmar restauración completa', 'Verificar accesibilidad de todos los datos', 10);

-- Insertar subprocesos para "Pantalla azul" (ID: 5)
INSERT INTO subprocesos (proceso_id, nombre, descripcion, orden) VALUES
(5, 'Analizar código de error BSOD', 'Identificar el tipo específico de error', 1),
(5, 'Verificar memoria RAM', 'Probar con memoria diferente o ejecutar memtest', 2),
(5, 'Verificar disco duro', 'Ejecutar chkdsk y verificar sectores', 3),
(5, 'Actualizar o reinstalar drivers', 'Verificar drivers de hardware crítico', 4),
(5, 'Verificar temperatura del sistema', 'Comprobar sobrecalentamiento de componentes', 5),
(5, 'Considerar formateo si persiste', 'Evaluar si es necesario restablecer sistema', 6),
(5, 'Evaluar cambio de disco si necesario', 'Determinar si requiere reemplazo de almacenamiento', 7);
