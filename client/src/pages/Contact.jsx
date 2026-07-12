import { useState } from 'react';
import { Link } from 'react-router-dom';

// Recreation of design/project/Contact.dc.html — the standalone support / ticket
// screen (marketing-style chrome, not the app shell). Left column: how to reach
// the IT desk + common self-serve fixes. Right column: a validated contact form
// that files a ticket. Validation is inline (on blur + on submit) and every
// error is shown gracefully, never a blank failure. There is no contact
// endpoint in the API, so — as in the prototype — the ticket id is generated
// client-side on submit.

const TREE = 'M100 180 C100 120 100 80 100 20M100 150 C70 140 50 120 45 95M100 150 C130 140 150 120 155 95M100 115 C75 105 60 90 55 70M100 115 C125 105 140 90 145 70M100 80 C82 72 70 60 66 45M100 80 C118 72 130 60 134 45';
const linkStyle = { fontSize: 11, fontWeight: 600, color: '#7A7E8C', textDecoration: 'none' };

export default function Contact() {
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cTopic, setCTopic] = useState('Account & access');
  const [cMsg, setCMsg] = useState('');
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [sent, setSent] = useState(null);

  const touch = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cEmail);
  const nameOk = cName.trim().length >= 2;
  const msgOk = cMsg.trim().length >= 15;
  const show = (k) => touched[k] || submitted;
  const nameError = show('name') && !nameOk ? 'Tell us who you are.' : null;
  const emailError = show('email') && cEmail && !emailOk ? '“' + cEmail + '” isn\'t a valid email.' : (show('email') && !cEmail ? 'Email is required so we can reply.' : null);
  const msgError = show('msg') && !msgOk ? 'A little more detail helps — at least 15 characters.' : null;
  const valid = nameOk && emailOk && msgOk;
  const border = (err, val, ok) => (err ? '#E14B3B' : (val && ok ? '#2B2D33' : '#DADDE8'));

  const submit = () => {
    if (!valid) { setSubmitted(true); return; }
    setSent({ id: 'IT-' + Math.floor(1000 + Math.random() * 9000), name: cName.split(' ')[0], email: cEmail });
  };
  const another = () => { setSent(null); setCMsg(''); setSubmitted(false); setTouched({}); };

  return (
    <div style={{ minHeight: '100vh', background: '#F4F3F0', position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center', padding: '40px 20px', boxSizing: 'border-box', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#2B2D33' }}>
      <svg width="360" height="360" viewBox="0 0 200 200" style={{ position: 'absolute', top: -70, left: -60, opacity: 0.5 }} fill="none" stroke="#DDE0F2" strokeWidth="2" strokeLinecap="round"><path d={TREE} /></svg>
      <svg width="420" height="420" viewBox="0 0 200 200" style={{ position: 'absolute', bottom: -120, right: -90, opacity: 0.55, transform: 'rotate(160deg)' }} fill="none" stroke="#DDE0F2" strokeWidth="2" strokeLinecap="round"><path d={TREE} /></svg>

      <div style={{ width: 'min(960px, 100%)', background: '#fff', borderRadius: 10, boxShadow: '0 24px 70px rgba(43,45,51,0.13)' }}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '26px 38px 6px', flexWrap: 'wrap', gap: 12 }}>
          <Link to="/login" style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.5px', color: '#2B2D33', textDecoration: 'none' }}>assetflow<span style={{ color: '#5F4DEE' }}>.</span></Link>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 26 }}>
            <Link to="/" style={linkStyle} onMouseEnter={hoverInk('#2B2D33')} onMouseLeave={hoverInk('#7A7E8C')}>Explore demo</Link>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#5F4DEE', borderBottom: '2px solid #5F4DEE', paddingBottom: 2 }}>Contact IT</span>
            <Link to="/login#login" style={linkStyle} onMouseEnter={hoverInk('#2B2D33')} onMouseLeave={hoverInk('#7A7E8C')}>Log in</Link>
            <Link to="/login#signup" style={linkStyle} onMouseEnter={hoverInk('#2B2D33')} onMouseLeave={hoverInk('#7A7E8C')}>Sign up</Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 34, padding: '24px 38px 40px' }}>
          {/* left: info */}
          <div>
            <h1 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 600, letterSpacing: '-0.4px' }}>We've got your back</h1>
            <p style={{ margin: '0 0 24px', fontSize: 13, fontWeight: 500, color: '#8A8E9C', lineHeight: 1.65 }}>Locked out, wrong role, missing asset in your list? The IT service desk answers within one business day — usually much faster.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 26 }}>
              <InfoRow title="it-desk@northwind.io" sub="for accounts & access" icon="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z|M22 6l-10 7L2 6" />
              <InfoRow title="ext. 4410" sub="Mon–Fri, 08:00–18:00" icon="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.12.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.6 2.81.72A2 2 0 0122 16.92z" />
              <InfoRow title="HQ · Floor 1, Desk 12" sub="walk-ins welcome" icon="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z|circle:12,10,3" />
            </div>
            <div style={{ borderTop: '1px solid #EFEFF4', paddingTop: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#AEB2C2', marginBottom: 10 }}>Common fixes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 11.5, fontWeight: 600, color: '#7A7E8C', lineHeight: 1.5 }}>
                <span>· Forgot your password? <Link to="/login#login" style={{ fontWeight: 700, textDecoration: 'none' }}>Reset it yourself</Link> from the login page.</span>
                <span>· Need a role change? Ask your Admin — roles are set in the <b>Employee Directory</b>.</span>
                <span>· Broken equipment? Raise it under <b>Maintenance</b>, not here.</span>
              </div>
            </div>
          </div>

          {/* right: form / confirmation */}
          <div style={{ borderLeft: '1px solid #EFEFF4', paddingLeft: 34 }}>
            {!sent ? (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <input value={cName} onChange={(e) => setCName(e.target.value)} onBlur={touch('name')} placeholder="Your name"
                    style={{ ...fieldInput, borderBottom: '1.5px solid ' + border(nameError, cName, nameOk) }} />
                  {nameError && <div style={errText}>{nameError}</div>}
                </div>
                <div style={{ marginBottom: 20 }}>
                  <input value={cEmail} onChange={(e) => setCEmail(e.target.value)} onBlur={touch('email')} placeholder="Work email"
                    style={{ ...fieldInput, borderBottom: '1.5px solid ' + border(emailError, cEmail, emailOk) }} />
                  {emailError && <div style={errText}>{emailError}</div>}
                </div>
                <div style={{ marginBottom: 20, borderBottom: '1.5px solid #DADDE8', padding: '4px 0' }}>
                  <select value={cTopic} onChange={(e) => setCTopic(e.target.value)} style={{ width: '100%', padding: '5px 0', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#2B2D33', cursor: 'pointer' }}>
                    <option>Account &amp; access</option><option>Wrong or missing asset</option><option>Booking problem</option><option>Role / permissions</option><option>Something else</option>
                  </select>
                </div>
                <div style={{ marginBottom: 22 }}>
                  <textarea value={cMsg} onChange={(e) => setCMsg(e.target.value)} onBlur={touch('msg')} rows={4} placeholder="What's going on? Include an asset tag (AF-…) if it's about a specific item."
                    style={{ ...fieldInput, borderBottom: '1.5px solid ' + border(msgError, cMsg, msgOk), resize: 'vertical', minHeight: 70, lineHeight: 1.6 }} />
                  {msgError && <div style={errText}>{msgError}</div>}
                </div>
                {submitted && !valid && <div style={{ fontSize: 11, fontWeight: 700, color: '#E14B3B', marginBottom: 14 }}>Fix the highlighted fields to send your request.</div>}
                <button onClick={submit} onMouseEnter={hoverBg('#4A39C9')} onMouseLeave={hoverBg('#5F4DEE')}
                  style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '11px 26px', borderRadius: 8, background: '#5F4DEE', color: '#fff', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, boxShadow: '0 8px 18px rgba(95,77,238,0.32)' }}>Send to IT desk</button>
              </div>
            ) : (
              <div style={{ paddingTop: 20 }}>
                <div style={{ width: 46, height: 46, borderRadius: 99, background: '#E5F6EF', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1FA97A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </div>
                <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.3px' }}>Ticket {sent.id} created</h2>
                <p style={{ margin: '0 0 24px', fontSize: 13, fontWeight: 500, color: '#8A8E9C', lineHeight: 1.65 }}>Thanks {sent.name} — the IT desk will reply to {sent.email} within one business day. Urgent? Call ext. 4410.</p>
                <button onClick={another} onMouseEnter={hoverInkBtn('#4A39C9')} onMouseLeave={hoverInkBtn('#5F4DEE')}
                  style={{ all: 'unset', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: '#5F4DEE' }}>← Send another request</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ title, sub, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: '#EEEBFE', display: 'grid', placeItems: 'center' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5F4DEE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon.split('|').map((part, i) => part.startsWith('circle:')
            ? (() => { const [cx, cy, r] = part.slice(7).split(','); return <circle key={i} cx={cx} cy={cy} r={r} />; })()
            : <path key={i} d={part} />)}
        </svg>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 12.5, fontWeight: 800 }}>{title}</span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#8A8E9C' }}>{sub}</span>
      </span>
    </div>
  );
}

const fieldInput = { all: 'unset', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#2B2D33', padding: '9px 2px' };
const errText = { fontSize: 10.5, fontWeight: 600, color: '#E14B3B', marginTop: 5 };
const hoverInk = (c) => (e) => { e.currentTarget.style.color = c; };
const hoverInkBtn = (c) => (e) => { e.currentTarget.style.color = c; };
const hoverBg = (c) => (e) => { e.currentTarget.style.background = c; };
