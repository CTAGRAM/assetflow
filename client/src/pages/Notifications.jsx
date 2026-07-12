import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as AF from '../data.js';
import api from '../api.js';
import { Page, PageHeader, Notice, selectReset } from '../components/screenKit.jsx';

// Recreation of design/project/Notifications.dc.html (page body only). Two tabs:
// a personal notification feed (read/unread, type filters, mark-all-read) and
// the org-wide activity log (searchable / filterable audit trail). Reads flow
// through src/api.js; read-state is tracked locally and mirrors the prototype.

const ICONS = {
  alert: 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01',
  swap: 'M17 3l4 4-4 4M21 7H9M7 21l-4-4 4-4M3 17h12',
  wrench: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2H9zM9 14l2 2 4-4',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8',
};
const ICON_COLORS = {
  overdue: ['#FDECEA', '#E14B3B'], transfer: ['#E9EFFC', '#2456C4'], maintenance: ['#FBF1E0', '#A65B04'],
  booking: ['#EEEBFE', '#5F4DEE'], audit: ['#EFEAF9', '#6D4FC2'], assigned: ['#E5F6EF', '#157A57'],
};
const TYPES = [['', 'All'], ['overdue', 'Overdue'], ['transfer', 'Transfers'], ['maintenance', 'Maintenance'], ['booking', 'Bookings'], ['audit', 'Audits']];
const ENT_C = {
  Allocation: ['#E9EFFC', '#2456C4'], Transfer: ['#EEEBFE', '#4A39C9'], Return: ['#E5F6EF', '#157A57'],
  Booking: ['#EFEAF9', '#6D4FC2'], Maintenance: ['#FBF1E0', '#A65B04'], Audit: ['#FDECEA', '#C0331F'],
};

export default function Notifications() {
  const location = useLocation();
  const me = AF.me();

  const [notifications, setNotifications] = useState(null);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(location.hash === '#log' ? 'log' : 'feed');
  const [readOv, setReadOv] = useState({});
  const [feedType, setFeedType] = useState('');
  const [logQ, setLogQ] = useState('');
  const [logUser, setLogUser] = useState('');
  const [logEntity, setLogEntity] = useState('');
  const [logSince, setLogSince] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [n, a] = await Promise.all([api.getNotifications(), api.getActivity()]);
        if (!alive) return;
        setNotifications(n);
        setActivity(a);
      } catch (e) {
        if (alive) setError(e.message || 'Could not load your feed.');
      }
    };
    load();
    // keep the feed live: refresh every 30s and when the tab regains focus
    const iv = setInterval(load, 30_000);
    window.addEventListener('focus', load);
    return () => { alive = false; clearInterval(iv); window.removeEventListener('focus', load); };
  }, []);

  // live API rows are already scoped to the signed-in user; `for` only exists on demo rows
  const mine = notifications ? notifications.filter((n) => !n.for || n.for.indexOf(me.id) >= 0) : [];
  const isUnread = (n) => (readOv[n.id] === undefined ? n.unread : false);
  const unreadCount = mine.filter(isUnread).length;

  const tabsNode = (
    <div style={{ display: 'flex', gap: 2, background: '#17171C', borderRadius: 99, padding: 4 }}>
      {[['feed', 'Notifications'], ['log', 'Activity log']].map(([id, label]) => {
        const on = tab === id, badge = id === 'feed' && unreadCount ? unreadCount : null;
        return (
          <button key={id} onClick={() => setTab(id)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 99, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: on ? '#fff' : '#9A9AA5', background: on ? '#5F4DEE' : 'transparent' }}>
            {label}{badge ? <span style={{ background: '#E14B3B', color: '#fff', fontSize: 9.5, fontWeight: 800, borderRadius: 99, padding: '1px 6px' }}>{badge}</span> : null}
          </button>
        );
      })}
    </div>
  );

  const header = <PageHeader title="Notifications & Activity" subtitle={'Your feed as ' + me.name + ', plus the org-wide audit trail.'} right={tabsNode} />;
  if (error) return <Page>{header}<Notice color="#E14B3B">{error}</Notice></Page>;
  if (!notifications) return <Page>{header}<Notice>Loading your feed…</Notice></Page>;

  return (
    <Page>
      {header}
      {tab === 'feed'
        ? <Feed {...{ mine, isUnread, feedType, setFeedType, setReadOv, readOv }} />
        : <Log {...{ activity, logQ, setLogQ, logUser, setLogUser, logEntity, setLogEntity, logSince, setLogSince }} />}
    </Page>
  );
}

// ---- Notifications feed ----------------------------------------------------
function Feed({ mine, isUnread, feedType, setFeedType, setReadOv, readOv }) {
  const pool = mine
    .filter((n) => !feedType || n.type === feedType)
    .sort((a, b) => (a.time < b.time ? 1 : -1));

  const markAll = () => { const ov = { ...readOv }; mine.forEach((n) => { ov[n.id] = true; }); setReadOv(ov); api.markAllNotificationsRead(); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {TYPES.map(([v, label]) => {
          const on = feedType === v;
          return (
            <button key={v || 'all'} onClick={() => setFeedType(v)} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#5F4DEE'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = on ? '#17171C' : '#E7E7EE'; }}
              style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '7px 14px', borderRadius: 99, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, background: on ? '#17171C' : '#fff', color: on ? '#fff' : '#3F4046', border: '1.5px solid ' + (on ? '#17171C' : '#E7E7EE') }}>{label}</button>
          );
        })}
        <button onClick={markAll} onMouseEnter={(e) => { e.currentTarget.style.color = '#4A39C9'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#5F4DEE'; }}
          style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: '#5F4DEE', padding: '7px 4px' }}>Mark all as read</button>
      </div>

      {pool.length > 0 ? (
        <div style={{ background: '#fff', borderRadius: 22, overflow: 'hidden' }}>
          {pool.map((n) => {
            const un = isUnread(n);
            const [iconBg, iconC] = ICON_COLORS[n.type] || ICON_COLORS.booking;
            const read = () => { setReadOv((ov) => ({ ...ov, [n.id]: true })); api.markNotificationRead(n.id); };
            return (
              <button key={n.id} onClick={read} onMouseEnter={(e) => { e.currentTarget.style.background = '#F7F7FC'; }} onMouseLeave={(e) => { e.currentTarget.style.background = un ? '#FCFCFF' : 'transparent'; }}
                style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%', display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 18px', borderBottom: '1px solid #F6F6F9', background: un ? '#FCFCFF' : 'transparent' }}>
                <span style={{ width: 34, height: 34, borderRadius: 11, background: iconBg, display: 'grid', placeItems: 'center', flex: 'none', marginTop: 1 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={iconC} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[n.icon] || ICONS.box} /></svg>
                </span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 12.5, fontWeight: un ? 800 : 600 }}>{n.title}</span>
                    {un && <span style={{ width: 7, height: 7, borderRadius: 99, background: '#5F4DEE', flex: 'none' }} />}
                  </span>
                  <span style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: '#6B6C75', marginTop: 2, lineHeight: 1.5 }}>{n.body}</span>
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#A2A3AE', flex: 'none' }}>{AF.fmtDateTime(n.time)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 22, padding: '52px 20px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 99, background: '#F1F1F6', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A2A3AE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{feedType ? 'No ' + feedType + ' notifications' : "You're all caught up"}</div>
          <div style={{ fontSize: 12, color: '#A2A3AE', fontWeight: 500, marginTop: 4 }}>{feedType ? 'Nothing of this type in your feed — try another filter.' : 'New alerts about your assets, bookings, and approvals will land here.'}</div>
        </div>
      )}
    </div>
  );
}

// ---- Activity log ----------------------------------------------------------
function Log({ activity, logQ, setLogQ, logUser, setLogUser, logEntity, setLogEntity, logSince, setLogSince }) {
  const grid = '150px 170px 110px 1fr';
  const q = logQ.trim().toLowerCase();
  const rows = activity.filter((e) =>
    (!q || e[3].toLowerCase().indexOf(q) >= 0 || AF.empName(e[1]).toLowerCase().indexOf(q) >= 0) &&
    (!logUser || e[1] === logUser) && (!logEntity || e[2] === logEntity) &&
    (!logSince || e[0].slice(0, 10) >= logSince));
  const userOptions = [{ id: 'system', name: 'System' }].concat(AF.employees.map((e) => ({ id: e.id, name: e.name })));
  const filterBox = { display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #E7E7EE', borderRadius: 99, padding: '9px 14px' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #E7E7EE', borderRadius: 99, padding: '9px 14px', width: 210 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A2A3AE" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input value={logQ} onChange={(e) => setLogQ(e.target.value)} placeholder="Search the log…" style={{ all: 'unset', flex: 1, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, color: '#17171C' }} />
        </div>
        <label style={filterBox}>
          <select value={logUser} onChange={(e) => setLogUser(e.target.value)} style={selectReset}>
            <option value="">All users</option>
            {userOptions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label style={filterBox}>
          <select value={logEntity} onChange={(e) => setLogEntity(e.target.value)} style={selectReset}>
            <option value="">All entities</option>
            <option>Allocation</option><option>Transfer</option><option>Return</option><option>Booking</option><option>Maintenance</option><option>Audit</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #E7E7EE', borderRadius: 99, padding: '7px 14px' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#A2A3AE', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Since</span>
          <input type="date" value={logSince} onChange={(e) => setLogSince(e.target.value)} style={{ all: 'unset', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, color: '#17171C' }} />
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: '#A2A3AE' }}>{rows.length} of {activity.length} events</span>
      </div>

      {rows.length > 0 ? (
        <div style={{ background: '#fff', borderRadius: 22, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 10, padding: '12px 18px', borderBottom: '1px solid #F1F1F5', fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#A2A3AE' }}>
            <span>When</span><span>Who</span><span>Entity</span><span>What happened</span>
          </div>
          {rows.map((e, i) => {
            const sys = e[1] === 'system';
            const [entBg, entInk] = ENT_C[e[2]] || ENT_C.Booking;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: grid, gap: 10, alignItems: 'center', padding: '9px 18px', borderBottom: '1px solid #F6F6F9' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6B6C75', fontVariantNumeric: 'tabular-nums' }}>{AF.fmtDateTime(e[0])}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 99, background: sys ? '#F1F1F6' : AF.avatarBg(e[1]), color: sys ? '#6B6C75' : AF.avatarInk(e[1]), display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 800, flex: 'none' }}>{sys ? 'SY' : AF.initials(AF.empName(e[1]))}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{AF.empName(e[1])}</span>
                </span>
                <span><span style={{ fontSize: 9.5, fontWeight: 800, borderRadius: 99, padding: '3px 9px', background: entBg, color: entInk }}>{e[2]}</span></span>
                <span style={{ fontSize: 11.5, fontWeight: 500, color: '#3F4046', lineHeight: 1.45 }}>{e[3]}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 22, padding: '52px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>No log entries match</div>
          <div style={{ fontSize: 12, color: '#A2A3AE', fontWeight: 500, marginTop: 4 }}>Loosen the user, entity, or date filters to see more of the trail.</div>
        </div>
      )}
    </div>
  );
}
