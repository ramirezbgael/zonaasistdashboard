// MainLayout ahora es un alias de AppLayout para mantener compatibilidad
// TODO: Migrar todas las referencias a AppLayout y eliminar este archivo
import AppLayout from './AppLayout.jsx';

export default function MainLayout({ demoMode = false }) {
    return <AppLayout demoMode={demoMode} />;
}
