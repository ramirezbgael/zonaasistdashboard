import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    setMsg('');
    
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    });
    
    if (error) {
      setMsg(error.message);
      setLoading(false);
    } else {
      // Login exitoso - redirigir al dashboard
      navigate('/');
    }
  };

  return (
    <div className="container">
      <h2>🔐 Login</h2>
      <input type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={handleLogin} disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
      <p>{msg}</p>
    </div>
  );
}
