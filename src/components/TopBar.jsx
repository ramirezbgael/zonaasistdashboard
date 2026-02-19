import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import logo from '../assets/logo.png';
import Settings from './Settings.jsx';
import Profile from './Profile.jsx';
import Notifications from './Notifications.jsx';
import SearchModal from './SearchModal.jsx';
import './TopBar.css';

export default function TopBar({ demoMode = false }) {
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
        if (demoMode) return;
        const loadProfilePhoto = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.user_metadata?.avatar_url) {
                    setProfilePhotoUrl(user.user_metadata.avatar_url);
                }
            } catch (error) {
                console.error('Error loading profile photo:', error);
            }
        };
        loadProfilePhoto();
    }, [demoMode]);

    // Cargar notificaciones (solo en modo real)
    useEffect(() => {
        if (demoMode) return;
        const loadNotifications = async () => {
            try {
                const { data, error } = await supabase
                    .from('notificaciones')
                    .select('id')
                    .eq('leida', false)
                    .limit(100);
                if (!error && data) {
                    setNotificationsCount(data.length);
                }
            } catch (error) {
                console.error('Error loading notifications:', error);
            }
        };
        loadNotifications();

        // Suscribirse a cambios en notificaciones
        const channel = supabase
            .channel('notifications-count')
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
    }, [demoMode]);

    return (
        <>
            <nav className="topbar">
                <div className="topbar-container">
                    {/* Logo */}
                    <a href="#" className="topbar-brand" onClick={(e) => { 
                        e.preventDefault(); 
                        navigate(demoMode ? '/demo' : '/'); 
                    }}>
                        <img src={logo} className="brand-logo" alt="Zona Asist" />
                        <span className="brand-text">Zona Asist</span>
                    </a>

                    {/* Desktop Navigation */}
                    <div className="topbar-nav">
                        {menuItems.map((item) => (
                            <div key={item.path} className="nav-item">
                                <a
                                    href="#"
                                    className={`nav-link ${isActivePath(item.path) ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        navigate(item.path);
                                        closeMenus();
                                    }}
                                >
                                    <Icon name={item.icon} />
                                    <span className="nav-label">{item.label}</span>
                                </a>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Search */}
                    <div className="topbar-search">
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
                    <div className="topbar-actions">
                        {/* Mobile Search Button */}
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

                        {/* Notifications */}
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

                        {/* Hamburger Menu (Mobile) - ÚNICO BOTÓN */}
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
                            <div className="mobile-menu-header">
                                <button
                                    className="mobile-menu-close"
                                    onClick={() => setShowMobileMenu(false)}
                                    aria-label="Cerrar menú"
                                >
                                    <Icon name="times" />
                                </button>
                            </div>
                            <div className="mobile-menu-body">
                                {demoMode ? (
                                    <div className="mobile-menu-section">
                                        <div className="mobile-menu-section-title">Modo Demo</div>
                                        <button
                                            className="mobile-menu-item"
                                            onClick={() => {
                                                navigate('/login');
                                                setShowMobileMenu(false);
                                            }}
                                        >
                                            <Icon name="sign-in-alt" />
                                            Ir al login real
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mobile-menu-section">
                                            <div className="mobile-menu-section-title">Navegación</div>
                                            {menuItems.map((item) => (
                                                <a
                                                    key={item.path}
                                                    href="#"
                                                    className={`mobile-menu-item ${isActivePath(item.path) ? 'active' : ''}`}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        navigate(item.path);
                                                        setShowMobileMenu(false);
                                                    }}
                                                >
                                                    <Icon name={item.icon} />
                                                    {item.label}
                                                </a>
                                            ))}
                                        </div>
                                        <div className="mobile-menu-section">
                                            <div className="mobile-menu-section-title">Cuenta</div>
                                            <button
                                                className="mobile-menu-item"
                                                onClick={() => {
                                                    setShowProfile(true);
                                                    setShowMobileMenu(false);
                                                }}
                                            >
                                                <Icon name="user" />
                                                Mi Perfil
                                            </button>
                                            <button
                                                className="mobile-menu-item"
                                                onClick={() => {
                                                    setShowSettings(true);
                                                    setShowMobileMenu(false);
                                                }}
                                            >
                                                <Icon name="cog" />
                                                Configuración
                                            </button>
                                            <button
                                                className="mobile-menu-item"
                                                onClick={handleLogout}
                                            >
                                                <Icon name="sign-out-alt" />
                                                Cerrar Sesión
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </nav>

            {/* Modales */}
            {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
            {showSettings && <Settings onClose={() => setShowSettings(false)} />}
            {showProfile && <Profile onClose={() => setShowProfile(false)} />}
            {showNotifications && (
                <Notifications 
                    onClose={() => setShowNotifications(false)} 
                    demoMode={demoMode}
                />
            )}
        </>
    );
}
