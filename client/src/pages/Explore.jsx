// Explore (demo/landing) — recreation of design/project/Explore.dc.html.
// TODO(parth): full build in a later commit. Minimal stub for now.
import { Link } from 'react-router-dom';

export default function Explore() {
  return (
    <div style={{ minHeight: '100vh', background: '#F4F3F0', display: 'grid', placeItems: 'center', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#2B2D33' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 10px' }}>Take AssetFlow for a spin</h1>
        <Link to="/dashboard" style={{ color: '#5F4DEE', fontWeight: 800, textDecoration: 'none' }}>Enter the app →</Link>
      </div>
    </div>
  );
}
