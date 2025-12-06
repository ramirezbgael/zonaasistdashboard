import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
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
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon-wrapper">
            <Icon name="lock" className="login-icon" />
          </div>
          <h1 className="login-title">Bienvenido</h1>
          <p className="login-subtitle">Inicia sesión en Zona Asist</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="login-input-group">
            <label htmlFor="email" className="login-label">
              <Icon name="envelope" className="input-icon" />
              Correo electrónico
            </label>
            <input
              id="email"
              className="login-input"
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="login-input-group">
            <label htmlFor="password" className="login-label">
              <Icon name="lock" className="input-icon" />
              Contraseña
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                className="login-input"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <Icon name={showPassword ? "eye-slash" : "eye"} />
              </button>
            </div>
          </div>

          {msg && (
            <div className="login-error">
              <Icon name="exclamation-circle" className="error-icon" />
              <span>{msg}</span>
            </div>
          )}

          <button 
            type="submit"
            className="login-button" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Icon name="spinner" className="spinner-icon" />
                <span>Entrando...</span>
              </>
            ) : (
              <>
                <Icon name="sign-in-alt" />
                <span>Entrar</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
