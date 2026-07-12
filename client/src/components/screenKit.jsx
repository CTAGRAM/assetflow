import { Link } from 'react-router-dom';

// Small shared UI kit for Tanishq's screens (Maintenance, Audits, Reports,
// Notifications, Organization). These recreate the repeated chrome from the
// design prototypes — the back button, page header, success toast, the
// admin/role lock card, status chips, and the plain loading/error notice — so
// every screen stays pixel-consistent with the mockups and with each other.

const BACK_ICON = 'M19 12H5M12 19l-7-7 7-7';

// Reset applied to native <select> so it inherits the prototype's typography.
export const selectReset = {
  border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit',
  fontSize: 11.5, fontWeight: 600, color: '#3F4046', cursor: 'pointer',
};

// hover helper: returns an onMouse* handler that sets one style property.
export const setStyle = (prop, val) => (e) => { e.currentTarget.style[prop] = val; };

export function BackButton({ to = '/dashboard' }) {
  return (
    <Link
      to={to}
      style={{ width: 36, height: 36, borderRadius: 99, background: '#fff', border: '1px solid #E7E7EE', display: 'grid', placeItems: 'center', textDecoration: 'none', flex: 'none' }}
      onMouseEnter={setStyle('borderColor', '#5F4DEE')}
      onMouseLeave={setStyle('borderColor', '#E7E7EE')}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#17171C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={BACK_ICON} /></svg>
    </Link>
  );
}

// Page header: back button + title/subtitle, with an optional right-aligned
// node (an action button, a tab group, etc.).
export function PageHeader({ title, subtitle, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
      <BackButton />
      <div style={{ flex: 1, minWidth: 200 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.6px' }}>{title}</h1>
        <div style={{ fontSize: 12, color: '#A2A3AE', fontWeight: 500, marginTop: 2 }}>{subtitle}</div>
      </div>
      {right}
    </div>
  );
}

// Green success toast used across the screens.
export function Toast({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#E5F6EF', border: '1px solid #BFE8D6', borderRadius: 14, padding: '11px 16px', marginBottom: 14, fontSize: 12, fontWeight: 700, color: '#157A57' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>{children}
    </div>
  );
}

// A locked card for role-gated screens (Organization is Admin-only; Audits are
// Admin + Asset Manager only).
export function LockedCard({ title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 22, padding: '56px 20px', textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: 99, background: '#F1F1F6', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A2A3AE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
      </div>
      <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#A2A3AE', fontWeight: 500, marginTop: 4 }}>{children}</div>
    </div>
  );
}

// Small rounded status pill.
export function Chip({ bg, ink, children, style }) {
  return <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '4px 10px', background: bg, color: ink, ...style }}>{children}</span>;
}

// Plain padded line for loading / error states.
export function Notice({ color = '#A2A3AE', children }) {
  return <div style={{ padding: '40px 26px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color, fontWeight: 600 }}>{children}</div>;
}

// Standard content-column wrapper matching Parth's finished pages: page gutters,
// centered max width, sitting on the app background under the topbar.
export function Page({ children }) {
  return (
    <div style={{ padding: '24px 26px 28px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#17171C', maxWidth: 1240, margin: '0 auto' }}>
      {children}
    </div>
  );
}
