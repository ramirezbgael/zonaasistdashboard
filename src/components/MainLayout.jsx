import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '../supabase.js';
import './MainLayout.css';

export default function MainLayout() {
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const menuItems = [
        { path: '/', icon: '🏠', label: 'Dashboard' },
        { path: '/equipos', icon: '🔧', label: 'Equipos' },
        { path: '/documentos', icon: '📄', label: 'Documentos' },
        { path: '/logistica', icon: '📦', label: 'Logística' },
        { path: '/clientes', icon: '👥', label: 'Clientes' },
        { path: '/reportes', icon: '📊', label: 'Reportes' },
    ];

    const isActivePath = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    const closeMenus = () => {
        setShowMobileMenu(false);
        setShowUserMenu(false);
    };

    return (
        <div className="main-layout">
            <nav className="navbar">
                <div className="navbar-container">
                    {/* Logo */}
                    <a href="#" className="navbar-brand" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
                        <span className="brand-icon">⚡</span>
                        <span className="brand-text">Zona Asist</span>
                    </a>

                    {/* Desktop Navigation */}
                    <div className="navbar-nav">
                        {menuItems.map((item) => (
                            <div key={item.path} className="nav-item">
                                <a
                                    href="#"
                                    className={`nav-link ${isActivePath(item.path) ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        navigate(item.path);
                                    }}
                                >
                                    <span>{item.icon}</span>
                                    <span className="nav-label">{item.label}</span>
                                </a>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Search */}
                    <div className="navbar-search">
                        <input
                            type="text"
                            placeholder="Buscar equipos, clientes..."
                            className="search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Actions */}
                    <div className="navbar-actions">
                        {/* Mobile Search Button (only visible on mobile) */}
                        <button 
                            className="action-button search-mobile" 
                            aria-label="Buscar"
                            style={{ display: 'none' }}
                        >
                            🔍
                        </button>

                        {/* Notifications */}
                        <button className="action-button" aria-label="Notificaciones">
                            🔔
                            <span className="notification-badge">3</span>
                        </button>

                        {/* User Menu */}
                        <div className="user-menu">
                            <button
                                className="action-button"
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                aria-label="Menú de usuario"
                            >
                                👤
                            </button>
                            
                            {showUserMenu && (
                                <>
                                    <div 
                                        className="user-menu-overlay"
                                        onClick={() => setShowUserMenu(false)}
                                        style={{
                                            position: 'fixed',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            zIndex: 999
                                        }}
                                    />
                                    <div className="user-menu-dropdown active">
                                        <a href="#" className="user-menu-item">Mi Perfil</a>
                                        <a href="#" className="user-menu-item">Configuración</a>
                                        <button 
                                            className="user-menu-item"
                                            onClick={handleLogout}
                                            style={{
                                                width: '100%',
                                                background: 'none',
                                                border: 'none',
                                                textAlign: 'left',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Cerrar Sesión
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Hamburger Menu (Mobile) */}
                        <button
                            className={`hamburger-button ${showMobileMenu ? 'active' : ''}`}
                            onClick={() => setShowMobileMenu(!showMobileMenu)}
                            aria-label="Menú"
                        >
                            <span className="hamburger-line"></span>
                            <span className="hamburger-line"></span>
                            <span className="hamburger-line"></span>
                        </button>
                    </div>
                </div>

                {/* Mobile Menu Sidebar */}
                {showMobileMenu && (
                    <div className="mobile-menu active">
                        <div 
                            className="mobile-menu-overlay"
                            onClick={() => setShowMobileMenu(false)}
                            style={{
                                position: 'fixed',
                                top: 64,
                                left: 280,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.5)',
                                zIndex: 998
                            }}
                        />
                        <div className="mobile-menu-content">
                            {/* Mobile Search */}
                            <div className="mobile-search">
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    className="search-input"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {/* Mobile Navigation */}
                            <div className="mobile-nav">
                                {menuItems.map((item) => (
                                    <a
                                        key={item.path}
                                        href="#"
                                        className={`mobile-nav-item ${isActivePath(item.path) ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            navigate(item.path);
                                            setShowMobileMenu(false);
                                        }}
                                    >
                                        <span>{item.icon}</span>
                                        <span>{item.label}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
