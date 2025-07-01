export default function KeycapButton({ icon, onClick, title, className }) {
  return (
    <button className={`keycap ${className || ''}`} onClick={onClick} title={title} type="button">
      <aside className="letter">{icon}</aside>
    </button>
  );
}
