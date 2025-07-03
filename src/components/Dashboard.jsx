import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import EquipoCard from './EquipoCard';
import './Dashboard.css';
import AddEquipoModal from './AddEquipoModal';
//import KeycapButton from './KeycapButton';
import EquipoModal from './EquipoModal';


export default function Dashboard() {
    const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);

    const [data, setData] = useState([]);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const fetchData = async () => {
        const { data, error } = await supabase
            .from('equipos')
            .select('id,marca,modelo,color,nota,problema,pendientes(id,descripcion,status)');
        setData(data || []);
        console.log(data);
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className={equipoSeleccionado ? 'dashboard modal-active' : 'dashboard'} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', flexDirection: 'column', gap: '1rem' }}>
            <div className="header" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '1rem' }}>
                <h1 className={"title"} style={{ color: 'black' }}>Equipos pendientes</h1>
                 <button onClick={handleLogout} style={{padding: '0.5rem 1rem', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>
          Cerrar Sesión
        </button> 
            </div>
            {data.map(equipo => (
                <EquipoCard
                    key={equipo.id}
                    equipo={equipo}
                    reload={() => { }}
                    onClick={() => setEquipoSeleccionado(equipo)}
                />

            ))}
            <button 
                className="AddEquipoButton" 
                onClick={() => setShowAddModal(true)}
            >
                +
            </button>
            
            {equipoSeleccionado && (
                <EquipoModal
                    equipo={equipoSeleccionado}
                    onClose={() => setEquipoSeleccionado(null)}
                />
            )}
            
            {showAddModal && (
                <AddEquipoModal
                    onClose={() => setShowAddModal(false)}
                    onEquipoAdded={fetchData}
                />
            )}

        </div>
    );
}
