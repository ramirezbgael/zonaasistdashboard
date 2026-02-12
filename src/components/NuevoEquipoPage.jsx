import { useNavigate } from 'react-router-dom';
import AddEquipoModalTypeform from './AddEquipoModalTypeform.jsx';

export default function NuevoEquipoPage() {
  const navigate = useNavigate();

  return (
    <AddEquipoModalTypeform
      mode="page"
      onClose={() => navigate('/equipos')}
      onEquipoAdded={() => {
        navigate('/equipos');
      }}
    />
  );
}

