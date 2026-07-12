import { Link, useNavigate } from 'react-router-dom';
import * as AF from '../data.js';

// Recreation of design/project/Explore.dc.html — the demo/landing screen.
// Pick a persona to enter the app as that role; the "What's inside" tour links
// to each screen. Setting the role mirrors the prototype (localStorage + go to
// dashboard), so every screen adapts to the chosen persona.

const BLURBS = {
  'Admin': 'Runs org setup, promotes roles, opens audit cycles, and sees everything across Northwind Labs.',
  'Asset Manager': 'Registers assets, approves allocations, transfers and maintenance, assigns technicians.',
  'Department Head': 'Sees and approves what touches their department, books resources on its behalf.',
  'Employee': 'Sees their own assets, books rooms and gear, raises maintenance and return requests.',
};

const TOUR = [
  { label: 'Dashboard', note: 'pending returns', to: '/dashboard' },
  { label: 'Asset Registry', note: '40 assets', to: '/assets' },
  { label: 'Allocation & Transfer', note: 'approvals', to: '/allocation' },
  { label: 'Resource Booking', note: 'week calendar', to: '/booking' },
  { label: 'Maintenance', note: '5-stage pipeline', to: '/maintenance' },
  { label: 'Audit Cycles', note: 'discrepancies', to: '/audits' },
  { label: 'Reports & Analytics', note: 'CSV exports', to: '/reports' },
  { label: 'Organization Setup', note: 'Admin only', to: '/organization' },
  { label: 'Notifications & Log', note: 'audit trail', to: '/notifications' },
];

function Sprig(props) {
  return (
    <svg viewBox="0 0 200 200" fill="none" stroke="#DDE0F2" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M100 180 C100 120 100 80 100 20" />
      <path d="M100 150 C70 140 50 120 45 95M100 150 C130 140 150 120 155 95M100 115 C75 105 60 90 55 70M100 115 C125 105 140 90 145 70M100 80 C82 72 70 60 66 45M100 80 C118 72 130 60 134 45" />
    </svg>
  );
}

export default function Explore() {
  const navigate = useNavigate();

  const personas = Object.keys(AF.personas).map((r) => {
    const e = AF.emp(AF.personas[r]);
    return { role: r, name: e.name, first: e.name.split(' ')[0], init: AF.initials(e.name), avBg: AF.avatarBg(e.id), avInk: AF.avatarInk(e.id), blurb: BLURBS[r] };
  });

  function enter(r) {
    AF.setRole(r);
    navigate('/dashboard');
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F3F0', position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center', padding: '40px 20px', boxSizing: 'border-box', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#2B2D33' }}>
      <Sprig width="360" height="360" style={{ position: 'absolute', top: -70, left: -60, opacity: 0.5 }} />
      <Sprig width="420" height="420" style={{ position: 'absolute', bottom: -120, right: -90, opacity: 0.55, transform: 'rotate(160deg)' }} />

      <div style={{ width: 'min(960px, 100%)', background: '#fff', borderRadius: 10, boxShadow: '0 24px 70px rgba(43,45,51,0.13)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '26px 38px 6px', flexWrap: 'wrap', gap: 12 }}>
          <Link to="/login" style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.5px', color: '#2B2D33', textDecoration: 'none' }}>assetflow<span style={{ color: '#5F4DEE' }}>.</span></Link>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 26 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#5F4DEE', borderBottom: '2px solid #5F4DEE', paddingBottom: 2 }}>Explore demo</span>
            <Link to="/contact" style={{ fontSize: 11, fontWeight: 600, color: '#7A7E8C', textDecoration: 'none' }}>Contact IT</Link>
            <Link to="/login#login" style={{ fontSize: 11, fontWeight: 600, color: '#7A7E8C', textDecoration: 'none' }}>Log in</Link>
            <Link to="/login#signup" style={{ fontSize: 11, fontWeight: 600, color: '#7A7E8C', textDecoration: 'none' }}>Sign up</Link>
          </div>
        </div>

        <div style={{ padding: '24px 38px 40px' }}>
          <h1 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 600, letterSpacing: '-0.4px' }}>Take AssetFlow for a spin</h1>
          <p style={{ margin: '0 0 26px', fontSize: 13, fontWeight: 500, color: '#8A8E9C', lineHeight: 1.65, maxWidth: 520 }}>One shared workspace, four very different jobs. Pick a persona below — every screen adapts its data, permissions, and approval powers to who you are.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 30 }}>
            {personas.map((p) => (
              <button key={p.role} onClick={() => enter(p.role)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', border: '1.5px solid #E7E7EE', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#5F4DEE'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(95,77,238,0.12)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E7E7EE'; e.currentTarget.style.boxShadow = 'none'; }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 99, background: p.avBg, color: p.avInk, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>{p.init}</span>
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800 }}>{p.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#5F4DEE' }}>{p.role}</span>
                  </span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#8A8E9C', lineHeight: 1.55 }}>{p.blurb}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#5F4DEE' }}>Enter as {p.first} →</span>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#AEB2C2', marginBottom: 10 }}>What's inside</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
            {TOUR.map((t) => (
              <Link key={t.label} to={t.to} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 10, background: '#F7F7FA', textDecoration: 'none', color: '#2B2D33' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#EEEBFE'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#F7F7FA'; }}>
                <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{t.label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#8A8E9C' }}>{t.note}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
