// Asset detail (allocation + maintenance history) — part of Assets.dc.html.
// TODO(parth): full build alongside the Assets screen.
import { useParams, Link } from 'react-router-dom';

export default function AssetDetail() {
  const { tag } = useParams();
  return (
    <div style={{ padding: '28px 24px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#2B2D33' }}>
      <Link to="/assets" style={{ fontSize: 12, fontWeight: 700, color: '#5F4DEE', textDecoration: 'none' }}>← Registry</Link>
      <h1 style={{ margin: '10px 0 0', fontSize: 22, fontWeight: 700 }}>{tag}</h1>
      <p style={{ fontSize: 13, color: '#8A8E9C' }}>Asset detail coming soon.</p>
    </div>
  );
}
