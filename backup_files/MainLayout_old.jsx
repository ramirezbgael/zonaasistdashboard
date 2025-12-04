import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../../supabase.js';
import './MainLayout.css';

export default function MainLayout() {
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [notificaciones, setNotificaciones] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Obtener usuario actual
        const getUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user || null);
        };
        getUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const menuItems = [
        { path: '/', icon: '🏠', label: 'Dashboard', exact: true },
        { path: '/equipos', icon: '🔧', label: 'Equipos' },
        { path: '/documentos', icon: '📄', label: 'Documentos' },
        { path: '/logistica', icon: '📦', label: 'Logística' },
        { path: '/clientes', icon: '👥', label: 'Clientes' },
        { path: '/reportes', icon: '📈', label: 'Reportes' }
    ];

    const getPageTitle = () => {
        const currentPath = location.pathname;
        const currentItem = menuItems.find(item => 
            item.exact ? item.path === currentPath : currentPath.startsWith(item.path)
        );
        return currentItem?.label || 'Zona Asist';
    };

    return (
        <div className="main-layout">
            {/* Navbar Principal */}
            <nav className="main-navbar">
                <div className="navbar-left">
                    <div className="logo">
                        <span className="logo-icon">⚡</span>
                        <span className="logo-text">Zona Asist</span>
                    </div>
                    
                    <div className="nav-menu">
                        {menuItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => 
                                    `nav-item ${isActive ? 'active' : ''}`
                                }
                                end={item.exact}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                <span className="nav-label">{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                </div>

                <div className="navbar-right">
                    {/* Buscador Global */}
                    <div className="search-container">
                        <input 
                            type="text" 
                            placeholder="Buscar equipos, documentos, pedidos..."
                            className="global-search"
                        />
                        <span className="search-icon">🔍</span>
                    </div>

                    {/* Notificaciones */}
                    <div className="notifications-container">
                        <button 
                            className={`notifications-btn ${notificaciones.length > 0 ? 'has-notifications' : ''}`}
                            onClick={() => setShowNotifications(!showNotifications)}
                        >
                            <span className="notification-icon">🔔</span>
                            {notificaciones.length > 0 && (
                                <span className="notification-badge">{notificaciones.length}</span>
                            )}
                        </button>
                        
                        {showNotifications && (
                            <div className="notifications-dropdown">
                                <div className="notifications-header">
                                    <h3>Notificaciones</h3>
                                    <button onClick={() => setShowNotifications(false)}>✕</button>
                                </div>
                                <div className="notifications-list">
                                    {notificaciones.length === 0 ? (
                                        <p className="no-notifications">No hay notificaciones</p>
                                    ) : (
                                        notificaciones.map(notif => (
                                            <div key={notif.id} className="notification-item">
                                                <span className="notif-title">{notif.titulo}</span>
                                                <span className="notif-message">{notif.mensaje}</span>
                                                <span className="notif-time">{notif.created_at}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Menú de Usuario */}
                    <div className="user-menu-container">
                        <button 
                            className="user-menu-toggle"
                            onClick={() => setShowUserMenu(!showUserMenu)}
                        >
                            <span className="user-icon">👤</span>
                            <span className="user-name">{user?.email?.split('@')[0] || 'Usuario'}</span>
                        </button>
                        
                        {showUserMenu && (
                            <div className="user-menu-dropdown">
                                <div className="user-menu-overlay" onClick={() => setShowUserMenu(false)}></div>
                                <div className="user-menu-content">
                                    <div className="user-info">
                                        <span className="user-email">{user?.email}</span>
                                    </div>
                                    <hr />
                                    <button className="menu-item">
                                        <span className="menu-icon">⚙️</span>
                                        Configuración
                                    </button>
                                    <button className="menu-item">
                                        <span className="menu-icon">👤</span>
                                        Mi Perfil
                                    </button>
                                    <hr />
                                    <button onClick={handleLogout} className="menu-item logout">
                                        <span className="menu-icon">🚪</span>
                                        Cerrar Sesión
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* Header de Página */}
            <header className="page-header">
                <h1 className="page-title">{getPageTitle()}</h1>
                <div className="page-actions">
                    {/* Botones de acción específicos por página se pueden agregar aquí */}
                </div>
            </header>

            {/* Contenido Principal */}
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
