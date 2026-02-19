import { Outlet } from 'react-router-dom';
import TopBar from './TopBar.jsx';
import Footer from './Footer.jsx';
import './AppLayout.css';

export default function AppLayout({ demoMode = false }) {
    return (
        <div className="app-layout">
            <TopBar demoMode={demoMode} />
            <main className="app-content">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
