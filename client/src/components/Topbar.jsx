import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as AF from '../data.js';
import api from '../api.js';

// Faithful recreation of design/project/Topbar.dc.html:
// white bar, brand lockup, total-assets pill, dark pill nav (role-filtered),
// notification bell with a live unread dot, org gear, identity chip + logout.
// The prototype's "View as" persona switcher is gone: the signed-in user's
// real role drives the nav, and the unread dot polls the API.

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview', to: '/dashboard', roles: null },
  { id: 'org', label: 'Organization', to: '/organization', roles: ['Admin'] },
  { id: 'assets', label: 'Assets', to: '/assets', roles: null },
  { id: 'allocation', label: 'Allocation', to: '/allocation', roles: null },
  { id: 'booking', label: 'Booking', to: '/booking', roles: null },
  { id: 'maintenance', label: 'Maintenance', to: '/maintenance', roles: null },
  { id: 'audits', label: 'Audits', to: '/audits', roles: ['Admin', 'Asset Manager'] },
  { id: 'reports', label: 'Reports', to: '/reports', roles: ['Admin', 'Asset Manager', 'Department Head'] },
];

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const role = AF.role();
  const me = AF.me();

  // Which nav item is active, matched by route prefix.
  const activeId = (NAV_ITEMS.find((i) => location.pathname.startsWith(i.to)) || {}).id || 'dashboard';

  const nav = NAV_ITEMS.filter((i) => !i.roles || i.roles.indexOf(role) >= 0);

  // Live counters: poll every 30s and refresh when the tab regains focus,
  // so a notification raised by someone else shows up without a reload.
  const [unread, setUnread] = useState(0);
  const [assetCount, setAssetCount] = useState(null);
  useEffect(() => {
    let alive = true;
    const tick = () => {
      api.getUnreadCount().then((n) => { if (alive) setUnread(n); }).catch(() => {});
      api.getAssets().then((a) => { if (alive) setAssetCount(a.length); }).catch(() => {});
    };
    tick();
    const iv = setInterval(tick, 30_000);
    window.addEventListener('focus', tick);
    return () => { alive = false; clearInterval(iv); window.removeEventListener('focus', tick); };
  }, [location.pathname]);

  function doLogout() {
    api.logout();
    navigate('/login');
  }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, background: '#fff',
        padding: '12px 20px', borderBottom: '1px solid #EEEEF3', flexWrap: 'wrap',
        fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#17171C',
      }}
    >
      <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'inherit' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#7B6CF6,#4A39C9)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>AF</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 800, fontSize: 14.5, letterSpacing: '0.3px' }}>ASSETFLOW</span>
          <span style={{ fontSize: 9.5, color: '#A2A3AE', fontWeight: 500 }}>Track assets. Better operations.</span>
        </div>
      </Link>

      <span title="Assets in the registry" style={{ fontSize: 12, fontWeight: 700, border: '1px solid #E7E7EE', borderRadius: 99, padding: '6px 12px', background: '#fff' }}>{assetCount ?? '…'}</span>

      <nav style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#17171C', borderRadius: 99, padding: 4, flexWrap: 'wrap' }}>
        {nav.map((it) => {
          const on = it.id === activeId;
          return (
            <Link
              key={it.id}
              to={it.to}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 99,
                textDecoration: 'none', fontSize: 12, fontWeight: 600,
                color: on ? '#fff' : '#9A9AA5', background: on ? '#5F4DEE' : 'transparent',
              }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = '#9A9AA5'; }}
            >
              {on && <span style={{ width: 5, height: 5, borderRadius: 99, background: '#fff' }} />}
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid #E7E7EE', borderRadius: 99, padding: '0 12px', background: '#fff', height: 34 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700 }}>{me.name}</span>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.6px', color: '#5F4DEE', textTransform: 'uppercase' }}>{role}</span>
        </span>

        <span style={{ width: 1, height: 22, background: '#E7E7EE' }} />

        <Link to="/notifications" style={{ position: 'relative', width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', textDecoration: 'none' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F1F6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3F4046" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></svg>
          {unread > 0 && <span style={{ position: 'absolute', top: 5, right: 6, width: 7, height: 7, borderRadius: 99, background: '#E14B3B', border: '1.5px solid #fff' }} />}
        </Link>

        <Link to="/organization" title="Organization settings" style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', textDecoration: 'none' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F1F6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3F4046" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.09a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.09a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.09a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
        </Link>

        <button
          onClick={doLogout}
          title={'Sign out ' + me.name}
          style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: 34, height: 34, borderRadius: 11, background: AF.avatarBg(me.id), color: AF.avatarInk(me.id), display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 }}
        >
          {AF.initials(me.name)}
        </button>
      </div>
    </div>
  );
}
