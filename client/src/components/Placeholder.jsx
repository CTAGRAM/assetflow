import { Link } from 'react-router-dom';

// Neutral placeholder for routes owned by a teammate that aren't built yet.
// This is NOT one of their screens — just a stub so the shell never
// white-screens before their route lands. They replace it with the real page.
export default function Placeholder({ title, owner, bare }) {
  const inner = (
    <div style={{ maxWidth: 520, margin: '80px auto', textAlign: 'center', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#2B2D33', padding: '0 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#AEB2C2', marginBottom: 10 }}>{title}</div>
      <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 700 }}>Screen coming soon</h1>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#8A8E9C', lineHeight: 1.6 }}>
        This screen{owner ? ' is owned by ' + owner + ' and' : ''} is not implemented yet.
      </p>
      <Link to="/dashboard" style={{ fontSize: 12, fontWeight: 800, color: '#5F4DEE', textDecoration: 'none' }}>← Back to Overview</Link>
    </div>
  );
  if (bare) return <div style={{ minHeight: '100vh', background: '#F4F3F0' }}>{inner}</div>;
  return inner;
}
