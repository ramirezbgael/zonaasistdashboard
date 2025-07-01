import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import EquipoCard from './EquipoCard';
//import AddEquipoModal from './AddEquipoModal';
//import KeycapButton from './KeycapButton';

export default function Dashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('equipos')
        .select('id,marca,modelo,color,nota,problema,pendientes(id,descripcion,status)');
      setData(data || []);
    }
    fetchData();
  }, []);

  return (
    <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center',color: 'white', flexDirection: 'column', gap: '1rem'}}>
      <h1 style={{color: 'black'}}>Equipos pendientes</h1>
    {data.map(equipo => (
    <EquipoCard key={equipo.id} equipo={equipo} reload={() => {}} />
    ))}
    <button>+</button>
    </div>
  );
}
