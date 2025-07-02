import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../../supabase.js";

export default function PrivateRoute({ children }){
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Obtener sesión actual
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // Escuchar cambios en la autenticación
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return <div>Cargando...</div>;
    }

    if (!session) {
        return <Navigate to="/login" />;
    }

    return children;
}