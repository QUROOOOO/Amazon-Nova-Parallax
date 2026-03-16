import './Logo.css';

export default function Logo() {
  return (
    <div className="n-logo">
      <div className="n-logo-dot-circle">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="n-logo-dot" style={{
            transform: `rotate(${i * 30}deg) translateY(-10px)`
          }} />
        ))}
      </div>
      <span className="n-logo-text">Parallax</span>
    </div>
  );
}

