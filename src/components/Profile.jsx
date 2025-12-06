import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import './Profile.css';

export default function Profile({ onClose }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [nombre, setNombre] = useState('');
  const [apodo, setApodo] = useState('');
  const [fotoUrl, setFotoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      // Obtener usuario actual
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!currentUser) {
        setError('No se pudo obtener la información del usuario');
        setLoading(false);
        return;
      }

      setUser(currentUser);

      // Obtener perfil del usuario
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, que es normal si es la primera vez
        throw profileError;
      }

      if (profileData) {
        setProfile(profileData);
        setNombre(profileData.nombre || '');
        setApodo(profileData.apodo || '');
        setFotoUrl(profileData.foto_url || null);
        setIsFirstTime(false);
      } else {
        // Primera vez - no tiene perfil
        setIsFirstTime(true);
        setNombre(currentUser.email?.split('@')[0] || '');
        setApodo('');
        setFotoUrl(null);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Error al cargar el perfil: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona una imagen válida');
      return;
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe superar los 5MB');
      return;
    }

    try {
      setSaving(true);
      setError('');
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Subir archivo a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFotoUrl(publicUrl);

      // Si ya existe perfil, actualizar foto
      if (profile) {
        await updateProfile({ foto_url: publicUrl });
      }

      setSuccess('Foto actualizada correctamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error uploading photo:', err);
      setError('Error al subir la foto: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = async (updates) => {
    try {
      if (isFirstTime) {
        // Crear perfil por primera vez
        const { data, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            nombre: nombre || user.email?.split('@')[0] || 'Usuario',
            apodo: apodo || null,
            foto_url: fotoUrl || null,
            ...updates
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setProfile(data);
        setIsFirstTime(false);
      } else {
        // Actualizar perfil existente
        const { data, error: updateError } = await supabase
          .from('profiles')
          .update({
            nombre: nombre || profile.nombre,
            apodo: apodo || null,
            foto_url: fotoUrl || profile.foto_url,
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
          .select()
          .single();

        if (updateError) throw updateError;
        setProfile(data);
      }
    } catch (err) {
      throw err;
    }
  };

  const handleSave = async () => {
    if (isFirstTime && !nombre.trim()) {
      setError('El nombre es obligatorio la primera vez');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await updateProfile();

      setSuccess('Perfil actualizado correctamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-modal-overlay" onClick={onClose}>
        <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
          <div className="profile-loading">
            <Icon name="circle-notch" className="spinning" />
            <p>Cargando perfil...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-header">
          <h2 className="profile-title">
            <Icon name="user-circle" className="profile-icon" />
            {isFirstTime ? 'Configurar Perfil' : 'Mi Perfil'}
          </h2>
          <button className="profile-close-btn" onClick={onClose}>
            <Icon name="times" />
          </button>
        </div>

        <div className="profile-content">
          {error && (
            <div className="profile-message profile-error">
              <Icon name="exclamation-circle" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="profile-message profile-success">
              <Icon name="check-circle" />
              <span>{success}</span>
            </div>
          )}

          {/* Foto de Perfil */}
          <div className="profile-section">
            <label className="profile-section-title">Foto de Perfil</label>
            <div className="profile-photo-container">
              <div className="profile-photo-wrapper">
                {fotoUrl ? (
                  <img src={fotoUrl} alt="Foto de perfil" className="profile-photo" />
                ) : (
                  <div className="profile-photo-placeholder">
                    <Icon name="user" />
                  </div>
                )}
                <div className="profile-photo-overlay">
                  <label className="profile-photo-upload-btn">
                    <Icon name="camera" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFotoChange}
                      disabled={saving}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
              <p className="profile-photo-hint">
                Haz clic en la cámara para cambiar tu foto
              </p>
            </div>
          </div>

          {/* Nombre */}
          <div className="profile-section">
            <label className="profile-section-title" htmlFor="nombre">
              {isFirstTime ? 'Nombre *' : 'Nombre'}
            </label>
            <div className="profile-input-wrapper">
              <Icon name="user" className="profile-input-icon" />
              <input
                id="nombre"
                type="text"
                className="profile-input"
                placeholder="Tu nombre completo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={saving || (!isFirstTime)}
                required={isFirstTime}
              />
            </div>
            {isFirstTime && (
              <p className="profile-input-hint">
                Este nombre se configurará solo la primera vez
              </p>
            )}
            {!isFirstTime && (
              <p className="profile-input-hint">
                El nombre no se puede cambiar después de la primera configuración
              </p>
            )}
          </div>

          {/* Apodo */}
          <div className="profile-section">
            <label className="profile-section-title" htmlFor="apodo">
              Apodo
            </label>
            <div className="profile-input-wrapper">
                <Icon name="hashtag" className="profile-input-icon" />
              <input
                id="apodo"
                type="text"
                className="profile-input"
                placeholder="Tu apodo o nombre preferido"
                value={apodo}
                onChange={(e) => setApodo(e.target.value)}
                disabled={saving}
              />
            </div>
            <p className="profile-input-hint">
              Puedes cambiar tu apodo cuando quieras
            </p>
          </div>

          {/* Email (solo lectura) */}
          <div className="profile-section">
            <label className="profile-section-title">Email</label>
            <div className="profile-input-wrapper">
              <Icon name="envelope" className="profile-input-icon" />
              <input
                type="email"
                className="profile-input"
                value={user?.email || ''}
                disabled
              />
            </div>
            <p className="profile-input-hint">
              El email no se puede cambiar
            </p>
          </div>
        </div>

        <div className="profile-actions">
          <button
            className="profile-btn profile-btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            className="profile-btn profile-btn-primary"
            onClick={handleSave}
            disabled={saving || (isFirstTime && !nombre.trim())}
          >
            {saving ? (
              <>
                <Icon name="circle-notch" className="spinning" />
                Guardando...
              </>
            ) : (
              <>
                <Icon name="check" />
                Guardar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

