import { useNavigate } from 'react-router-dom';
import AddEquipoModalTypeform from './AddEquipoModalTypeform.jsx';

export default function NuevoEquipoPage({ demoMode = false }) {
  const navigate = useNavigate();
  const basePath = demoMode ? '/demo' : '';

  return (
    <AddEquipoModalTypeform
      mode="page"
      demoMode={demoMode}
      onClose={() => navigate(`${basePath}/equipos`)}
      onEquipoAdded={() => {
        navigate(`${basePath}/equipos`);
      }}
    />
  );
}

