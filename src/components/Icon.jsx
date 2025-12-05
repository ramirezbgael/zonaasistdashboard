// Componente reutilizable para iconos Font Awesome
export default function Icon({ name, className = '', style = {} }) {
  return <i className={`fas fa-${name} ${className}`} style={style}></i>;
}

