import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import AddEquipoModalTypeform from './AddEquipoModalTypeform.jsx';

export default function NuevoEquipoPage({ demoMode = false }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const basePath = demoMode ? '/demo' : '';

  const handleEquipoAdded = () => {
    if (!demoMode) queryClient.invalidateQueries({ queryKey: ['equipos'] });
    navigate(`${basePath}/equipos`);
  };

  return (
    <AddEquipoModalTypeform
      mode="page"
      demoMode={demoMode}
      onClose={() => navigate(`${basePath}/equipos`)}
      onEquipoAdded={handleEquipoAdded}
    />
  );
}

