import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import logo from '../assets/logo.png';
import Settings from './Settings.jsx';
import Profile from './Profile.jsx';
import Notifications from './Notifications.jsx';
import SearchModal from './SearchModal.jsx';
import Footer from './Footer.jsx';
import './MainLayout.css';

export default function MainLayout({ demoMode = false }) {
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [notificationsCount, setNotificationsCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
    const [userMenuPosition, setUserMenuPosition] = useState({ top: 0, right: 0 });
    const userMenuButtonRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        if (demoMode) {
            navigate('/login');
            return;
        }
        await supabase.auth.signOut();
        navigate('/login');
    };

    const basePath = demoMode ? '/demo' : '';
    const menuItems = [
        { path: demoMode ? '/demo' : '/', icon: 'home', label: 'Dashboard' },
        { path: `${basePath}/equipos`, icon: 'tools', label: 'Equipos' },
        { path: `${basePath}/documentos`, icon: 'file-alt', label: 'Documentos' },
        { path: `${basePath}/logistica`, icon: 'shipping-fast', label: 'Logística' },
        { path: `${basePath}/clientes`, icon: 'users', label: 'Clientes' },
        { path: `${basePath}/reportes`, icon: 'chart-bar', label: 'Reportes' },
        { path: `${basePath}/inventario`, icon: 'box', label: 'Inventario' },
        { path: `${basePath}/whatsapp`, icon: 'comment', label: 'WhatsApp' },
    ];

    const isActivePath = (path) => {
        return location.pathname === path || location.pathname.startsWith(`${path}/`);
    };

    const closeMenus = () => {
        setShowMobileMenu(false);
        setShowUserMenu(false);
        setShowNotifications(false);
    };

    // Atajo de teclado para búsqueda + evento desde dashboard "Buscar Nota"
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                if (!demoMode) setShowSearch(true);
            }
            if (e.key === 'Escape') {
                if (showSearch) setShowSearch(false);
                else if (showMobileMenu) setShowMobileMenu(false);
            }
        };
        const handleOpenSearch = () => {
            if (!demoMode) setShowSearch(true);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('openSearchModal', handleOpenSearch);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('openSearchModal', handleOpenSearch);
        };
    }, [showSearch, showMobileMenu, demoMode]);

    // Bloquear scroll del body cuando el menú móvil está abierto
    useEffect(() => {
        if (showMobileMenu) {
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
        } else {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        };
    }, [showMobileMenu]);

    // Cargar foto de perfil (omitido en modo demo)
    useEffect(() => {
        if (demoMode) {
            setProfilePhotoUrl(null);
            return;
        }

        const loadProfilePhoto = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setProfilePhotoUrl(null);
                    return;
                }

                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('foto_url')
                    .eq('id', user.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('Error cargando foto de perfil:', error);
                    return;
                }

                if (profile?.foto_url) {
                    // Agregar timestamp para forzar actualización si cambió
                    setProfilePhotoUrl(`${profile.foto_url}?t=${Date.now()}`);
                } else {
                    setProfilePhotoUrl(null);
                }
            } catch (error) {
                console.error('Error cargando foto de perfil:', error);
                setProfilePhotoUrl(null);
            }
        };

        loadProfilePhoto();

        // Escuchar cambios en el perfil
        const channel = supabase
            .channel('profile-photo')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'profiles' },
                (payload) => {
                    setTimeout(() => {
                        loadProfilePhoto();
                    }, 500);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [demoMode]);

    // Función para recargar foto (se puede llamar desde fuera)
    const reloadProfilePhoto = async () => {
        if (demoMode) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('foto_url')
                .eq('id', user.id)
                .single();

            if (!error && profile?.foto_url) {
                setProfilePhotoUrl(`${profile.foto_url}?t=${Date.now()}`);
            } else {
                setProfilePhotoUrl(null);
            }
        } catch (error) {
            console.error('Error recargando foto:', error);
        }
    };

    // Cargar contador de notificaciones (omitido en modo demo)
    useEffect(() => {
        if (demoMode) {
            setNotificationsCount(0);
            return;
        }

        const loadNotificationsCount = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setNotificationsCount(0);
                    return;
                }

                const { count, error } = await supabase
                    .from('notificaciones')
                    .select('*', { count: 'exact', head: true })
                    .eq('usuario_id', user.id)
                    .eq('leida', false);

                if (error) {
                    console.error('Error cargando contador de notificaciones:', error);
                    setNotificationsCount(0);
                    return;
                }
                setNotificationsCount(count || 0);
            } catch (error) {
                console.error('Error cargando contador de notificaciones:', error);
                setNotificationsCount(0);
            }
        };

        // Cargar inmediatamente
        loadNotificationsCount();

        // Suscribirse a cambios en notificaciones
        const channel = supabase
            .channel('notifications-count')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'notificaciones' },
                (payload) => {
                    // Recargar el contador cuando haya cambios
                    setTimeout(() => {
                        loadNotificationsCount();
                    }, 300); // Pequeño delay para asegurar que la BD se actualizó
                }
            )
            .subscribe();

        // También recargar periódicamente como backup
        const interval = setInterval(() => {
            loadNotificationsCount();
        }, 30000); // Cada 30 segundos

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [demoMode]);

    return (
        <div className="main-layout">
            <nav className="navbar">
                <div className="navbar-container">
                    {/* Logo */}
                    <a href="#" className="navbar-brand" onClick={(e) => { 
                        e.preventDefault(); 
                        navigate(demoMode ? '/demo' : '/'); 
                    }}>
                        <img src={logo} className="brand-logo" alt="Zona Asist" />
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
                                    <Icon name={item.icon} />
                                    <span className="nav-label">{item.label}</span>
                                </a>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Search */}
                    <div className="navbar-search">
                        <input
                            type="text"
                            placeholder="Buscar equipos, clientes... (Cmd/Ctrl + K)"
                            className="search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => {
                                if (!demoMode) setShowSearch(true);
                            }}
                            onClick={() => {
                                if (!demoMode) setShowSearch(true);
                            }}
                        />
                    </div>

                    {/* Actions */}
                    <div className="navbar-actions">
                        {/* Mobile Search Button - abre el modal de búsqueda */}
                        <button 
                            className="action-button search-mobile" 
                            aria-label="Buscar"
                            onClick={() => {
                                if (!demoMode) {
                                    setShowSearch(true);
                                    setShowMobileMenu(false);
                                }
                            }}
                        >
                            <Icon name="search" />
                        </button>

                        {/* Notifications (en demo sólo icono, sin contador real) */}
                        <button 
                            className="action-button" 
                            aria-label="Notificaciones"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!demoMode) {
                                    setShowNotifications(!showNotifications);
                                    setShowUserMenu(false);
                                }
                            }}
                            style={{ position: 'relative' }}
                        >
                            <Icon name="bell" />
                            {!demoMode && notificationsCount > 0 && (
                                <span 
                                    className={`notification-badge ${notificationsCount > 9 ? 'multi-digit' : ''}`}
                                    style={{ 
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {notificationsCount > 99 ? '99+' : notificationsCount}
                                </span>
                            )}
                        </button>

                        {/* User Menu */}
                        <div className="user-menu">
                            <button
                                ref={userMenuButtonRef}
                                className="action-button user-profile-button"
                                onClick={() => {
                                    if (userMenuButtonRef.current) {
                                        const rect = userMenuButtonRef.current.getBoundingClientRect();
                                        setUserMenuPosition({
                                            top: rect.bottom + 8,
                                            right: window.innerWidth - rect.right
                                        });
                                    }
                                    setShowUserMenu(!showUserMenu);
                                }}
                                aria-label="Menú de usuario"
                            >
                                {profilePhotoUrl ? (
                                    <img 
                                        src={profilePhotoUrl} 
                                        alt="Perfil" 
                                        className="user-profile-image"
                                        onError={() => {
                                            setProfilePhotoUrl(null);
                                        }}
                                    />
                                ) : (
                                    <Icon 
                                        name="user-circle" 
                                        className="user-profile-fallback"
                                    />
                                )}
                            </button>
                            
                            {showUserMenu && createPortal(
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
                                            zIndex: 1099
                                        }}
                                    />
                                    <div 
                                        className="user-menu-dropdown active"
                                        style={{
                                            top: `${userMenuPosition.top}px`,
                                            right: `${userMenuPosition.right}px`,
                                            zIndex: 1100
                                        }}
                                    >
                                        {demoMode ? (
                                            <button 
                                                className="user-menu-item"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    navigate('/login');
                                                    setShowUserMenu(false);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    background: 'none',
                                                    border: 'none',
                                                    textAlign: 'left',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Ir al login real
                                            </button>
                                        ) : (
                                            <>
                                                <button 
                                                    className="user-menu-item"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setShowProfile(true);
                                                        setShowUserMenu(false);
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        background: 'none',
                                                        border: 'none',
                                                        textAlign: 'left',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Mi Perfil
                                                </button>
                                                <button 
                                                    className="user-menu-item"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setShowSettings(true);
                                                        setShowUserMenu(false);
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        background: 'none',
                                                        border: 'none',
                                                        textAlign: 'left',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Configuración
                                                </button>
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
                                            </>
                                        )}
                                    </div>
                                </>,
                                document.body
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
                {showMobileMenu && createPortal(
                    <div className="mobile-menu active">
                        <div 
                            className="mobile-menu-overlay"
                            onClick={() => setShowMobileMenu(false)}
                        />
                        <div className="mobile-menu-content">
                            {/* Header móvil con botón cerrar */}
                            <div className="mobile-menu-header">
                                <button
                                    className="mobile-menu-close"
                                    onClick={() => setShowMobileMenu(false)}
                                    aria-label="Cerrar menú"
                                >
                                    <Icon name="times" />
                                </button>
                            </div>
                            {/* Mobile Search - al tocar abre el modal de búsqueda */}
                            <div className="mobile-search">
                                <input
                                    type="text"
                                    placeholder="Buscar equipos, clientes... (Cmd/Ctrl + K)"
                                    className="search-input"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => {
                                        if (!demoMode) {
                                            setShowSearch(true);
                                            setShowMobileMenu(false);
                                        }
                                    }}
                                    onClick={() => {
                                        if (!demoMode) {
                                            setShowSearch(true);
                                            setShowMobileMenu(false);
                                        }
                                    }}
                                    readOnly
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
                                        <Icon name={item.icon} />
                                        <span>{item.label}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </nav>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>

            {/* Footer */}
            <Footer demoMode={demoMode} />

            {/* Settings Modal */}
            {showSettings && (
                <Settings onClose={() => setShowSettings(false)} />
            )}

            {/* Profile Modal */}
            {showProfile && (
                <Profile 
                    onClose={() => {
                        setShowProfile(false);
                        // Recargar la foto después de cerrar el modal
                        setTimeout(() => {
                            reloadProfilePhoto();
                        }, 500);
                    }}
                />
            )}

            {/* Notifications Dropdown */}
            {!demoMode && showNotifications && (
                <Notifications 
                    onClose={() => setShowNotifications(false)}
                    onCountChange={(count) => setNotificationsCount(count)}
                />
            )}

            {/* Search Modal */}
            {!demoMode && (
                <SearchModal 
                    isOpen={showSearch}
                    onClose={() => setShowSearch(false)}
                />
            )}
        </div>
    );
}
