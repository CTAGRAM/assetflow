import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as AF from '../data.js';
import api from '../api.js';

// Recreation of design/project/Booking.dc.html (topbar is the app shell).
// Resource picker + Mon–Fri week calendar (8:00–18:00) with time-positioned
// blocks, a booking form with overlap-conflict validation (back-to-back is
// fine, overlaps rejected), and a per-resource booking list with
// remind / reschedule / cancel on upcoming bookings.
//
// Bookings load through src/api.js; create/cancel/reschedule call the matching
// api.* method (demo today) then update local state so the UI stays live.

const WEEK_DAYS = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17'];
const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
// status -> [chipBg, blockBorder, ink, blockSub]
const ST_COLOR = {
  Upcoming: ['#EEEBFE', '#B8AEF7', '#4A39C9', '#8A7DF2'],
  Ongoing: ['#E5F6EF', '#8FDDBB', '#157A57', '#41B487'],
  Completed: ['#F1F1F6', '#E1E1E8', '#8A8B95', '#B4B5BE'],
  Cancelled: ['#FDECEA', '#F5C6BE', '#C0331F', '#E39C91'],
};

const mins = (t) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3), 10);
const H0 = 8 * 60, H1 = 18 * 60, PX = 440;
const y = (m) => Math.round(((m - H0) / (H1 - H0)) * PX);

export default function Booking() {
  const me = AF.me();

  const [res, setRes] = useState('AF-0011');
  const [bookings, setBookings] = useState(null);
  const [fTitle, setFTitle] = useState('');
  const [fDay, setFDay] = useState('2026-07-13');
  const [fStart, setFStart] = useState('09:00');
  const [fEnd, setFEnd] = useState('10:00');
  const [err, setErr] = useState(null);
  const [editId, setEditId] = useState(null);
  const [reminders, setReminders] = useState({});
  const [loadError, setLoadError] = useState('');

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const flash = (m) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 4200); };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    let alive = true;
    api.getBookings().then((b) => { if (alive) setBookings(b.map((x) => ({ ...x }))); })
      .catch((e) => { if (alive) setLoadError(e.message || 'Could not load bookings.'); });
    return () => { alive = false; };
  }, []);

  const model = useMemo(() => {
    if (!bookings) return null;

    const resources = AF.assets.filter((a) => a.bookable).map((a) => {
      const on = a.tag === res;
      const n = bookings.filter((b) => b.resource === a.tag && b.status !== 'Cancelled').length;
      return { tag: a.tag, name: a.name, meta: a.loc + ' · ' + n + ' bookings', img: a.img || false, abbr: a.name.slice(0, 2).toUpperCase(),
        bg: on ? '#17171C' : '#fff', border: on ? '#17171C' : '#E7E7EE', ink: on ? '#fff' : '#17171C', sub: on ? '#9A9AA5' : '#A2A3AE' };
    });
    const resAsset = AF.asset(res) || {};

    const days = WEEK_DAYS.map((date, i) => {
      const blocks = bookings.filter((b) => b.resource === res && b.date === date).map((b) => {
        const c = ST_COLOR[b.status] || ST_COLOR.Upcoming;
        return { id: b.id, title: b.title, time: b.start + ' – ' + b.end,
          top: y(mins(b.start)) + 2, h: Math.max(26, y(mins(b.end)) - y(mins(b.start)) - 4),
          bg: c[0], border: c[1], ink: c[2], sub: c[3], deco: b.status === 'Cancelled' ? 'line-through' : 'none',
          tip: b.title + ' · ' + b.start + '–' + b.end + ' · ' + b.status + ' · booked by ' + AF.empName(b.by) };
      });
      return { dow: DOWS[i], num: 13 + i, colBg: '#FAFAFC', blocks,
        lines: Array.from({ length: 10 }, (_, k) => ({ top: y(H0 + (k + 1) * 60) })) };
    });
    const hours = Array.from({ length: 10 }, (_, k) => ({ top: y(H0 + k * 60) - 5, label: (8 + k) + ':00' }));

    const timeOptions = [];
    for (let h = 8; h <= 18; h++) { timeOptions.push(String(h).padStart(2, '0') + ':00'); if (h < 18) timeOptions.push(String(h).padStart(2, '0') + ':30'); }
    const dayOptions = WEEK_DAYS.map((v, i) => ({ v, label: DOWS[i] + ' Jul ' + (13 + i) }));

    const bkAll = bookings.filter((b) => b.resource === res).slice().sort((a, b) => ((a.date + a.start) < (b.date + b.start) ? -1 : 1));
    const bkRows = bkAll.map((b) => {
      const c = ST_COLOR[b.status] || ST_COLOR.Upcoming;
      const rem = !!reminders[b.id];
      return { id: b.id, title: b.title, status: b.status, chipBg: c[0], chipInk: c[2], dot: c[2],
        deco: b.status === 'Cancelled' ? 'line-through' : 'none', opacity: b.status === 'Cancelled' || b.status === 'Completed' ? 0.6 : 1,
        when: AF.fmtDate(b.date) + ', ' + b.start + '–' + b.end, by: AF.empName(b.by), actionable: b.status === 'Upcoming',
        remLabel: rem ? '🔔 15 min' : 'Remind me', remBg: rem ? '#EEEBFE' : '#fff', remInk: rem ? '#4A39C9' : '#3F4046', remBorder: rem ? '#B8AEF7' : '#E7E7EE',
        date: b.date, start: b.start, end: b.end };
    });

    const nextRem = bkAll.filter((b) => reminders[b.id] && b.status === 'Upcoming')[0];
    const reminderBanner = nextRem ? 'Reminder armed: “' + nextRem.title + '” starts ' + AF.fmtDate(nextRem.date) + ' at ' + nextRem.start + " — you'll be notified 15 minutes before." : false;

    return { resources, resName: resAsset.name || res, days, hours, timeOptions, dayOptions, bkRows, bkCount: bkAll.length + ' total', reminderBanner };
  }, [bookings, res, reminders]);

  const findConflict = (excl) => bookings.find((b) => b.resource === res && b.date === fDay && b.status !== 'Cancelled' && b.id !== excl && mins(fStart) < mins(b.end) && mins(fEnd) > mins(b.start));

  async function submit() {
    if (!fTitle.trim()) { setErr('Give the booking a title.'); return; }
    if (mins(fEnd) <= mins(fStart)) { setErr('End time must be after start time.'); return; }
    const cf = findConflict(editId);
    if (cf) { setErr('That slot overlaps “' + cf.title + '” (' + cf.start + '–' + cf.end + ', ' + AF.empName(cf.by) + '). Back-to-back is fine — try starting at ' + cf.end + '.'); return; }

    if (editId) {
      try { await api.rescheduleBooking(editId, { date: fDay, start: fStart, end: fEnd, title: fTitle.trim() }); } catch (e) { setErr(e.message || 'Reschedule failed.'); return; }
      setBookings((cur) => cur.map((b) => (b.id === editId ? { ...b, title: fTitle.trim(), date: fDay, start: fStart, end: fEnd } : b)));
      setEditId(null); setFTitle(''); setErr(null);
      flash('Rescheduled to ' + AF.fmtDate(fDay) + ', ' + fStart + '–' + fEnd + '.');
    } else {
      const nb = { id: 'BK-' + Math.floor(300 + Math.random() * 600), resource: res, by: me.id, title: fTitle.trim(), date: fDay, start: fStart, end: fEnd, status: 'Upcoming' };
      try { await api.createBooking(nb); } catch (e) { setErr(e.message || 'Booking failed.'); return; }
      setBookings((cur) => cur.concat([nb])); setFTitle(''); setErr(null);
      flash('Booked ' + model.resName + ' — ' + AF.fmtDate(fDay) + ', ' + fStart + '–' + fEnd + '. Confirmation sent.');
    }
  }

  async function cancelBooking(row) {
    try { await api.cancelBooking(row.id); } catch (e) { flash(e.message || 'Cancel failed.'); return; }
    setBookings((cur) => cur.map((b) => (b.id === row.id ? { ...b, status: 'Cancelled' } : b)));
    flash('“' + row.title + '” cancelled — the slot is free again.');
  }

  function toggleReminder(row) {
    const rem = !!reminders[row.id];
    setReminders((r) => ({ ...r, [row.id]: !rem }));
    flash(rem ? 'Reminder removed for “' + row.title + '”.' : "You'll be pinged 15 minutes before “" + row.title + '”.');
  }

  function startReschedule(row) {
    setEditId(row.id); setFTitle(row.title); setFDay(row.date); setFStart(row.start); setFEnd(row.end); setErr(null);
  }

  if (loadError) return <div style={{ padding: '40px 26px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#E14B3B', fontWeight: 700 }}>{loadError}</div>;
  if (!model) return <div style={{ padding: '40px 26px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#A2A3AE', fontWeight: 600 }}>Loading calendar…</div>;

  const setField = (setter) => (e) => { setter(e.target.value); setErr(null); };
  const darkSelect = { boxSizing: 'border-box', fontSize: 12, color: '#fff', padding: '10px 10px', borderRadius: 11, background: '#26262C', border: '1.5px solid #33333B', fontFamily: 'inherit', fontWeight: 600 };

  return (
    <div style={{ padding: '24px 26px 28px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#17171C', maxWidth: 1240, margin: '0 auto' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link to="/dashboard" style={{ width: 36, height: 36, borderRadius: 99, background: '#fff', border: '1px solid #E7E7EE', display: 'grid', placeItems: 'center', textDecoration: 'none' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#17171C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg></Link>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.6px' }}>Resource Booking</h1>
          <div style={{ fontSize: 12, color: '#A2A3AE', fontWeight: 500, marginTop: 2 }}>Week of July 13 – 17, 2026 · pick a shared resource, then grab a free slot.</div>
        </div>
      </div>

      {model.reminderBanner && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#EEEBFE', border: '1px solid #DCD6FB', borderRadius: 14, padding: '11px 16px', marginBottom: 14, fontSize: 12, fontWeight: 700, color: '#4A39C9' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></svg>
          {model.reminderBanner}
        </div>
      )}
      {toast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#E5F6EF', border: '1px solid #BFE8D6', borderRadius: 14, padding: '11px 16px', marginBottom: 14, fontSize: 12, fontWeight: 700, color: '#157A57' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>{toast}
        </div>
      )}

      {/* resource picker */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {model.resources.map((r) => (
          <button key={r.tag} onClick={() => { setRes(r.tag); setEditId(null); setErr(null); }} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px 8px 8px', borderRadius: 99, background: r.bg, border: '1.5px solid ' + r.border }}>
            {r.img
              ? <span style={{ display: 'block', width: 28, height: 28, borderRadius: 99, flex: 'none', background: '#F1F1F6 url(/' + r.img + ') center/cover no-repeat' }} />
              : <span style={{ width: 28, height: 28, borderRadius: 99, background: '#F1F1F6', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 800, color: '#A2A3AE' }}>{r.abbr}</span>}
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: r.ink }}>{r.name}</span>
              <span style={{ fontSize: 9.5, fontWeight: 600, color: r.sub }}>{r.meta}</span>
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(280px,1fr)', gap: 16, alignItems: 'start' }}>
        {/* calendar */}
        <div style={{ background: '#fff', borderRadius: 22, padding: '16px 16px 18px', overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(5, 1fr)', gap: 6, minWidth: 640 }}>
            <span />
            {model.days.map((d, i) => (
              <div key={'h' + i} style={{ textAlign: 'center', paddingBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#A2A3AE' }}>{d.dow}</div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 1, color: '#17171C' }}>{d.num}</div>
              </div>
            ))}
            {/* hours gutter */}
            <div style={{ position: 'relative', height: 440 }}>
              {model.hours.map((h, i) => (
                <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: h.top, fontSize: 9, fontWeight: 700, color: '#C9C9D6', textAlign: 'right', paddingRight: 6 }}>{h.label}</div>
              ))}
            </div>
            {/* day columns */}
            {model.days.map((d, i) => (
              <div key={'c' + i} style={{ position: 'relative', height: 440, background: d.colBg, borderRadius: 12 }}>
                {d.lines.map((ln, k) => (
                  <div key={k} style={{ position: 'absolute', left: 0, right: 0, top: ln.top, borderTop: '1px dashed #EFEFF4' }} />
                ))}
                {d.blocks.map((b) => (
                  <button key={b.id} onClick={() => flash(b.tip)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', position: 'absolute', left: 4, right: 4, top: b.top, height: b.h, borderRadius: 10, background: b.bg, border: '1.5px solid ' + b.border, padding: '5px 8px', overflow: 'hidden' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: b.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: b.deco }}>{b.title}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: b.sub }}>{b.time}</div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* form + list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#17171C', borderRadius: 22, padding: 18 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{editId ? 'Reschedule booking' : 'New booking'}</div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#9A9AA5', marginBottom: 13 }}>{model.resName} · back-to-back slots are fine, overlaps are rejected.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <input value={fTitle} onChange={setField(setFTitle)} placeholder="What's it for? e.g. Sprint review" style={{ all: 'unset', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#fff', padding: '10px 12px', borderRadius: 11, background: '#26262C', border: '1.5px solid #33333B' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 8 }}>
                <select value={fDay} onChange={setField(setFDay)} style={darkSelect}>
                  {model.dayOptions.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
                <select value={fStart} onChange={setField(setFStart)} style={darkSelect}>
                  {model.timeOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <select value={fEnd} onChange={setField(setFEnd)} style={darkSelect}>
                  {model.timeOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              {err && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, fontWeight: 700, color: '#F08B7E', background: 'rgba(225,75,59,0.14)', border: '1px solid rgba(225,75,59,0.35)', borderRadius: 11, padding: '9px 12px', lineHeight: 1.5 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
                  <span>{err}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={submit} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', flex: 1, textAlign: 'center', padding: 11, borderRadius: 99, background: '#5F4DEE', color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, boxShadow: '0 6px 14px rgba(95,77,238,0.4)' }}>{editId ? 'Save new slot' : 'Book slot'}</button>
                {editId && (
                  <button onClick={() => { setEditId(null); setFTitle(''); setErr(null); }} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '11px 16px', borderRadius: 99, border: '1.5px solid #33333B', color: '#9A9AA5', fontFamily: 'inherit', fontSize: 12, fontWeight: 700 }}>Cancel</button>
                )}
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 22, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #F1F1F5' }}>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>Bookings — {model.resName}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#A2A3AE' }}>{model.bkCount}</span>
            </div>
            {model.bkRows.length ? model.bkRows.map((b) => (
              <div key={b.id} style={{ padding: '10px 16px', borderBottom: '1px solid #F6F6F9', opacity: b.opacity }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: b.dot, flex: 'none' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: b.deco }}>{b.title}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, borderRadius: 99, padding: '3px 8px', background: b.chipBg, color: b.chipInk }}>{b.status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingLeft: 15 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6C75' }}>{b.when} · {b.by}</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
                    {b.actionable && (
                      <>
                        <button onClick={() => toggleReminder(b)} title="Reminder 15 min before" style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 9.5, fontWeight: 800, padding: '4px 9px', borderRadius: 99, background: b.remBg, color: b.remInk, border: '1px solid ' + b.remBorder }}>{b.remLabel}</button>
                        <button onClick={() => startReschedule(b)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 9.5, fontWeight: 800, padding: '4px 9px', borderRadius: 99, border: '1px solid #E7E7EE', color: '#3F4046' }}>Reschedule</button>
                        <button onClick={() => cancelBooking(b)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 9.5, fontWeight: 800, padding: '4px 9px', borderRadius: 99, border: '1px solid #E7E7EE', color: '#C0331F' }}>Cancel</button>
                      </>
                    )}
                  </span>
                </div>
              </div>
            )) : (
              <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: '#A2A3AE' }}>No bookings yet for this resource — the whole week is free.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
