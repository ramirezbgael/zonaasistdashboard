import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import './Login.css';

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
      <h2 className='login-title'>🔐 Login</h2>
      <input className='email-input' type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} />
      <input className='password-input' type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} />
      <button className='login-button' onClick={handleLogin} disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
      <p>{msg}</p>
    </div>
  );
}
