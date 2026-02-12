import MainDashboard from './MainDashboard.jsx';

// Página de demo: reutiliza el mismo dashboard pero en modo demo (datos estáticos, sin Supabase)
// Cualquier subruta de /demo la maneja App.jsx, pero el contenido siempre es el mismo dashboard demo.
export default function DemoPage() {
  return <MainDashboard demoMode />;
}
