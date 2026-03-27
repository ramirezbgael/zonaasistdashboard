import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase, getCurrentUser } from '../supabase.js';
import TopBar from './TopBar.jsx';
import Footer from './Footer.jsx';
import Icon from './Icon.jsx';
import './AppLayout.css';

const ABEL_EMAIL = 'benitezabel209@gmail.com';
const ABEL_PRANK_KEY = 'zonaasist-abel-prank-shown';

export default function AppLayout({ demoMode = false }) {
    const [showAbelPrank, setShowAbelPrank] = useState(false);
    const [abelStep, setAbelStep] = useState(1);

    useEffect(() => {
        if (demoMode) return;
        if (typeof window === 'undefined') return;
        if (window.localStorage.getItem(ABEL_PRANK_KEY) === 'yes') return;

        let cancelled = false;
        const checkUser = async () => {
            try {
                const { data: { user } } = await getCurrentUser();
                if (cancelled) return;
                if (user?.email === ABEL_EMAIL) {
                    setShowAbelPrank(true);
                }
            } catch (error) {
                console.error('Error checking Abel prank user:', error);
            }
        };
        checkUser();

        return () => {
            cancelled = true;
        };
    }, [demoMode]);

    const closeAbelPrank = () => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(ABEL_PRANK_KEY, 'yes');
        }
        setShowAbelPrank(false);
        setAbelStep(1);
    };

    return (
        <div className="app-layout">
            <TopBar demoMode={demoMode} />
            <main className="app-content">
                <Outlet />
            </main>
            <Footer />

            {showAbelPrank && (
                <div className="abel-prank-overlay" onClick={closeAbelPrank}>
                    <div className="abel-prank-modal" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="abel-prank-close"
                            onClick={closeAbelPrank}
                            aria-label="Cerrar"
                        >
                            <Icon name="times" />
                        </button>

                        {abelStep === 1 ? (
                            <div className="abel-prank-content">
                                <h2 className="abel-prank-title">
                                    Hey Abel, hay algo especial preparado para ti 👀
                                </h2>
                                <p className="abel-prank-text">
                                    Esto sólo aparece en tu cuenta.  
                                    ¿Estás listo para verlo? <strong>JJASJSAJSAJSAJ</strong>
                                </p>
                                <button
                                    type="button"
                                    className="abel-prank-button primary"
                                    onClick={() => setAbelStep(2)}
                                >
                                    <Icon name="laugh-beam" />
                                    <span>Sí, muéstrame</span>
                                </button>
                                <button
                                    type="button"
                                    className="abel-prank-button secondary"
                                    onClick={closeAbelPrank}
                                >
                                    <Icon name="meh" />
                                    <span>Después</span>
                                </button>
                            </div>
                        ) : (
                            <div className="abel-prank-content">
                                <h2 className="abel-prank-title">Tu sorpresa especial 😈</h2>
                                <div className="abel-prank-image-wrapper">
                                    <img
                                        src="https://tenor.com/es-MX/view/boobs-funny-breast-caress-gif-16969607.gif"
                                        alt="Sorpresa chistosa"
                                        className="abel-prank-image"
                                    />
                                </div>
                                <p className="abel-prank-text">
                                    Gracias por probar todas las funciones del sistema.  
                                    Esta es la parte menos productiva.
                                </p>
                                <button
                                    type="button"
                                    className="abel-prank-button primary"
                                    onClick={closeAbelPrank}
                                >
                                    <Icon name="check" />
                                    <span>Ok</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
