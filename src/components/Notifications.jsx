import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import './Notifications.css';

export default function Notifications({ onClose, onCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();
    
    // Suscribirse a nuevas notificaciones en tiempo real
    const channel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'notificaciones' },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Notificar cambios en el contador al componente padre
  useEffect(() => {
    if (onCountChange) {
      onCountChange(unreadCount);
    }
  }, [unreadCount, onCountChange]);

  const loadNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obtener notificaciones del usuario
      const { data, error } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
      
      // Contar no leídas
      const unread = (data || []).filter(n => !n.leida).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true, fecha_leida: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      // Actualizar estado local
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, leida: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marcando notificación como leída:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true, fecha_leida: new Date().toISOString() })
        .eq('usuario_id', user.id)
        .eq('leida', false);

      if (error) throw error;

      // Actualizar estado local
      setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marcando todas como leídas:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notificaciones')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      // Actualizar estado local
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => {
        const deleted = notifications.find(n => n.id === notificationId);
        return deleted && !deleted.leida ? Math.max(0, prev - 1) : prev;
      });
    } catch (error) {
      console.error('Error eliminando notificación:', error);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'Ahora';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    if (diffDays < 7) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short'
    }).format(date);
  };

  const getNotificationIcon = (tipo) => {
    const iconMap = {
      'equipo_nuevo': 'tools',
      'equipo_listo': 'check-circle',
      'equipo_finalizado': 'flag-checkered',
      'documento_nuevo': 'file-alt',
      'documento_completado': 'file-check',
      'pedido_nuevo': 'shipping-fast',
      'pedido_recibido': 'box-check',
      'cliente_nuevo': 'user-plus',
      'sistema': 'info-circle'
    };
    return iconMap[tipo] || 'bell';
  };

  const getNotificationColor = (tipo) => {
    const colorMap = {
      'equipo_nuevo': '#10b981',
      'equipo_listo': '#3b82f6',
      'equipo_finalizado': '#22c55e',
      'documento_nuevo': '#10b981',
      'documento_completado': '#22c55e',
      'pedido_nuevo': '#f59e0b',
      'pedido_recibido': '#22c55e',
      'cliente_nuevo': '#8b5cf6',
      'sistema': '#6b7280'
    };
    return colorMap[tipo] || '#10b981';
  };

  // Determinar la ruta según el tipo de notificación
  const getNotificationRoute = (notification) => {
    const { tipo, datos } = notification;
    
    if (!datos) return null;

    // Notificaciones de equipos
    if (tipo === 'equipo_nuevo' || tipo === 'equipo_listo' || tipo === 'equipo_finalizado') {
      if (datos.equipo_id) {
        return `/equipos?equipo=${datos.equipo_id}`;
      }
      return '/equipos';
    }

    // Notificaciones de documentos
    if (tipo === 'documento_nuevo' || tipo === 'documento_completado') {
      if (datos.documento_id) {
        return `/documentos?documento=${datos.documento_id}`;
      }
      return '/documentos';
    }

    // Notificaciones de pedidos
    if (tipo === 'pedido_nuevo' || tipo === 'pedido_recibido') {
      if (datos.pedido_id) {
        return `/logistica?pedido=${datos.pedido_id}`;
      }
      return '/logistica';
    }

    return null;
  };

  // Manejar click en notificación
  const handleNotificationClick = async (notification) => {
    // Marcar como leída si no lo está
    if (!notification.leida) {
      await markAsRead(notification.id);
    }

    // Obtener la ruta
    const route = getNotificationRoute(notification);
    
    if (route) {
      // Cerrar el modal y navegar
      onClose();
      navigate(route);
    }
  };

  return createPortal(
    <div className="notifications-overlay" onClick={onClose}>
      <div className="notifications-dropdown" onClick={(e) => e.stopPropagation()}>
        <div className="notifications-header">
          <div className="notifications-header-title">
            <Icon name="bell" />
            <h3>Notificaciones</h3>
            {unreadCount > 0 && (
              <span className="notifications-count-badge">{unreadCount}</span>
            )}
          </div>
          <div className="notifications-header-actions">
            {unreadCount > 0 && (
              <button 
                className="notifications-mark-all-read"
                onClick={markAllAsRead}
                title="Marcar todas como leídas"
              >
                <Icon name="check-double" />
              </button>
            )}
            <button 
              className="notifications-close"
              onClick={onClose}
            >
              <Icon name="times" />
            </button>
          </div>
        </div>

        <div className="notifications-content">
          {loading ? (
            <div className="notifications-loading">
              <Icon name="sync" style={{ animation: 'spin 1s linear infinite' }} />
              <p>Cargando notificaciones...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notifications-empty">
              <Icon name="bell-slash" />
              <p>No hay notificaciones</p>
            </div>
          ) : (
            <div className="notifications-list">
              {notifications.map(notification => {
                const hasRoute = getNotificationRoute(notification) !== null;
                return (
                <div 
                  key={notification.id} 
                  className={`notification-item ${!notification.leida ? 'unread' : ''} ${hasRoute ? 'clickable' : ''}`}
                  onClick={() => hasRoute && handleNotificationClick(notification)}
                  style={{ cursor: hasRoute ? 'pointer' : 'default' }}
                >
                  <div 
                    className="notification-icon-wrapper"
                    style={{ backgroundColor: `${getNotificationColor(notification.tipo)}20`, color: getNotificationColor(notification.tipo) }}
                  >
                    <Icon name={getNotificationIcon(notification.tipo)} />
                  </div>
                  <div className="notification-content">
                    <div className="notification-header-row">
                      <h4 className="notification-title">{notification.titulo}</h4>
                      {!notification.leida && <span className="notification-unread-dot"></span>}
                      <button
                        className="notification-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        title="Eliminar"
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                    <p className="notification-message">{notification.mensaje}</p>
                    <span className="notification-time">{formatTime(notification.created_at)}</span>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

