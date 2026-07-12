import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api.js';

// Recreation of design/project/Login.dc.html.
// Three modes: login / signup / forgot. Inline, per-field validation with the
// exact messages from the prototype (bad email shows a specific error; signup
// has NO role selection — new accounts are always Employee). Submit is wired
// through src/api.js so it swaps to the real endpoint with no UI change.

// Same email test the prototype used.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Decorative "growth" line-art used top-left and bottom-right (from the mockup).
function Sprig(props) {
  return (
    <svg viewBox="0 0 200 200" fill="none" stroke="#DDE0F2" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M100 180 C100 120 100 80 100 20" />
      <path d="M100 150 C70 140 50 120 45 95M100 150 C130 140 150 120 155 95M100 115 C75 105 60 90 55 70M100 115 C125 105 140 90 145 70M100 80 C82 72 70 60 66 45M100 80 C118 72 130 60 134 45" />
    </svg>
  );
}

const inputStyle = (border) => ({
  all: 'unset', boxSizing: 'border-box', width: '100%', maxWidth: 340,
  fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#2B2D33',
  padding: '9px 2px', borderBottom: '1.5px solid ' + border,
});
const errStyle = { fontSize: 10.5, fontWeight: 600, color: '#E14B3B', marginTop: 5 };

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();

  // Initial mode can come from the hash (#signup / #login / #forgot), matching
  // the prototype's deep links from Explore.
  const initialMode = ['signup', 'forgot', 'login'].includes(location.hash.replace('#', ''))
    ? location.hash.replace('#', '') : 'login';

  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(null);       // 'login' | 'signup' | 'forgot' when finished
  const [serverError, setServerError] = useState('');

  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  const touch = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
  const resetFields = (m) => { setMode(m); setSubmitted(false); setTouched({}); setServerError(''); };

  const emailOk = EMAIL_RE.test(email);
  const show = (k) => touched[k] || submitted;

  const nameError = isSignup && show('name') && name.trim().length < 2 ? 'Enter your full name.' : false;
  const emailError = show('email') && email && !emailOk
    ? '“' + email + '” isn\'t a valid email — check for a missing @ or domain.'
    : (show('email') && !email ? 'Email is required.' : false);
  const pwError = !isForgot && show('pw') && pw.length > 0 && pw.length < 8
    ? 'At least 8 characters (yours is ' + pw.length + ').'
    : (!isForgot && show('pw') && !pw ? 'Password is required.' : false);
  const pw2Error = isSignup && show('pw2') && pw2 && pw2 !== pw ? 'Passwords don\'t match.' : false;

  const valid = isForgot ? emailOk
    : isLogin ? emailOk && pw.length >= 8
    : name.trim().length >= 2 && emailOk && pw.length >= 8 && pw2 === pw;

  const border = (err, val, ok) => (err ? '#E14B3B' : (val && ok ? '#2B2D33' : '#DADDE8'));

  async function submit() {
    if (!valid) { setSubmitted(true); return; }
    setServerError('');
    try {
      // Forgot has no endpoint of its own; treat as a no-op success like the
      // prototype. Login/signup go through the shared API surface.
      if (isLogin) await api.login({ email, password: pw });
      else if (isSignup) await api.signup({ name, email, password: pw }); // role is always Employee, set server-side
      setDone(mode);
      setSubmitted(false);
    } catch (e) {
      // Never a blank failure — surface the server's message inline.
      setServerError(e.message || 'Something went wrong. Please try again.');
    }
  }

  const headerModes = [['login', 'Log in'], ['signup', 'Sign up']].map((m) => {
    const on = mode === m[0] || (isForgot && m[0] === 'login');
    return { key: m[0], label: m[1], weight: on ? 800 : 600, color: on ? '#5F4DEE' : '#7A7E8C', underline: on ? '#5F4DEE' : 'transparent' };
  });

  const headline = isForgot ? 'Reset your password' : isSignup ? 'Join the workspace' : 'Every asset, accounted for.';
  const subline = isForgot ? "Enter the email on your account and we'll send a reset link. It expires in 30 minutes."
    : isSignup ? 'Create your Employee account to see your assets, book resources, and raise requests at Northwind Labs.'
    : 'Sign in to track assets, book shared resources, and keep Northwind Labs running smoothly.';
  const pwPlaceholder = isSignup ? 'Password — at least 8 characters' : 'Password';
  const checkLabel = isSignup ? 'Notify me about approvals, bookings, and overdue returns.' : 'Keep me signed in on this device.';
  const ctaLabel = isForgot ? 'Send reset link' : isSignup ? 'Create account' : 'Sign in';
  const formError = submitted && !valid ? 'Fix the highlighted fields to continue.' : false;

  const doneTitle = done === 'forgot' ? 'Reset link sent' : done === 'signup' ? 'Welcome to AssetFlow!' : 'Welcome back';
  const doneBody = done === 'forgot' ? 'If ' + email + ' has an account, a reset link is on its way.'
    : done === 'signup' ? 'Your Employee account is ready — view your assets, book resources, and raise requests right away.'
    : 'Signed in as ' + (email || 'you') + '. Your dashboard is waiting.';

  return (
    <div style={{ minHeight: '100vh', background: '#F4F3F0', position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center', padding: '40px 20px', boxSizing: 'border-box', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#2B2D33' }}>
      <Sprig width="360" height="360" style={{ position: 'absolute', top: -70, left: -60, opacity: 0.5 }} />
      <Sprig width="420" height="420" style={{ position: 'absolute', bottom: -120, right: -90, opacity: 0.55, transform: 'rotate(160deg)' }} />
      <div style={{ position: 'absolute', top: '18%', right: '8%', width: 220, height: 220, borderRadius: 99, background: 'radial-gradient(circle, rgba(95,77,238,0.07), transparent 70%)' }} />

      <div style={{ width: 'min(960px, 100%)', background: '#fff', borderRadius: 10, boxShadow: '0 24px 70px rgba(43,45,51,0.13)', position: 'relative' }}>
        {/* card header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '26px 38px 6px' }}>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.5px', color: '#2B2D33' }}>assetflow<span style={{ color: '#5F4DEE' }}>.</span></span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 26 }}>
            <Link to="/" style={{ fontSize: 11, fontWeight: 600, color: '#7A7E8C', textDecoration: 'none' }}>Explore demo</Link>
            <Link to="/contact" style={{ fontSize: 11, fontWeight: 600, color: '#7A7E8C', textDecoration: 'none' }}>Contact IT</Link>
            {headerModes.map((m) => (
              <button key={m.key} onClick={() => resetFields(m.key)} style={{ all: 'unset', cursor: 'pointer', fontSize: 11, fontWeight: m.weight, color: m.color, borderBottom: '2px solid ' + m.underline, paddingBottom: 2 }}>{m.label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 20, alignItems: 'center', padding: '10px 38px 40px' }}>
          {/* illustration */}
          <div style={{ minHeight: 380, background: "#fff url('/img/login-illo.jpg') center/contain no-repeat" }} />

          {/* form column */}
          <div style={{ padding: '14px 8px 0 22px' }}>
            {!done ? (
              <div>
                <h1 style={{ margin: '0 0 12px', fontSize: 26, fontWeight: 600, letterSpacing: '-0.4px', color: '#2B2D33' }}>{headline}</h1>
                <p style={{ margin: '0 0 26px', fontSize: 13, fontWeight: 500, color: '#8A8E9C', lineHeight: 1.65, maxWidth: 340 }}>{subline}</p>

                {isSignup && (
                  <div style={{ marginBottom: 20 }}>
                    <input value={name} onChange={(e) => setName(e.target.value)} onBlur={touch('name')} placeholder="Full name" style={inputStyle(border(nameError, name, name.trim().length >= 2))} />
                    {nameError && <div style={errStyle}>{nameError}</div>}
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} onBlur={touch('email')} placeholder="Work email" style={inputStyle(border(emailError, email, emailOk))} />
                  {emailError && <div style={errStyle}>{emailError}</div>}
                </div>

                {!isForgot && (
                  <div style={{ marginBottom: 20 }}>
                    <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onBlur={touch('pw')} placeholder={pwPlaceholder} style={inputStyle(border(pwError, pw, pw.length >= 8))} />
                    {pwError && <div style={errStyle}>{pwError}</div>}
                  </div>
                )}

                {isSignup && (
                  <div style={{ marginBottom: 20 }}>
                    <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onBlur={touch('pw2')} placeholder="Retype password" style={inputStyle(border(pw2Error, pw2, pw2 && pw2 === pw))} />
                    {pw2Error && <div style={errStyle}>{pw2Error}</div>}
                  </div>
                )}

                <button onClick={() => setChecked((c) => !c)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 9, margin: '4px 0 24px', maxWidth: 340 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid ' + (checked ? '#5F4DEE' : '#C9CCDA'), background: checked ? '#5F4DEE' : '#fff', display: 'grid', placeItems: 'center', flex: 'none', marginTop: 1 }}>
                    {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#8A8E9C', lineHeight: 1.5, textAlign: 'left' }}>{checkLabel}</span>
                </button>

                {(formError || serverError) && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#E14B3B', marginBottom: 14 }}>{serverError || formError}</div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <button onClick={submit} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '11px 26px', borderRadius: 8, background: '#5F4DEE', color: '#fff', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, boxShadow: '0 8px 18px rgba(95,77,238,0.32)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#4A39C9'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#5F4DEE'; }}
                  >{ctaLabel}</button>
                  {isLogin && (
                    <button onClick={() => resetFields('forgot')} style={{ all: 'unset', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: '#8A8E9C' }}>Forgot password?</button>
                  )}
                  {isForgot && (
                    <button onClick={() => resetFields('login')} style={{ all: 'unset', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: '#8A8E9C' }}>← Back to log in</button>
                  )}
                </div>

                {isSignup && (
                  <div style={{ fontSize: 10.5, fontWeight: 500, color: '#AEB2C2', marginTop: 18, maxWidth: 340, lineHeight: 1.55 }}>New accounts start as <b style={{ color: '#7A7E8C' }}>Employee</b> — an Admin promotes roles from the Employee Directory.</div>
                )}

                {isLogin && (
                  <div style={{ marginTop: 26, maxWidth: 360, background: '#F6F5FE', border: '1px solid #E4E1FA', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.6px', color: '#5F4DEE', textTransform: 'uppercase', marginBottom: 8 }}>Demo accounts — click to fill</div>
                    {[
                      ['Admin', 'maya.okafor@northwind.io'],
                      ['Asset Manager', 'daniel.reyes@northwind.io'],
                      ['Employee', 'aisha.bello@northwind.io'],
                    ].map(([label, mail]) => (
                      <button key={mail} onClick={() => { setEmail(mail); setPw('assetflow'); }}
                        style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, width: '100%', padding: '4px 2px', fontSize: 11, fontWeight: 600, color: '#4B4E5C' }}>
                        <span style={{ color: '#7A7E8C' }}>{label}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5 }}>{mail}</span>
                      </button>
                    ))}
                    <div style={{ fontSize: 10, fontWeight: 500, color: '#8A8E9C', marginTop: 6 }}>Shared password: <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>assetflow</span></div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ width: 46, height: 46, borderRadius: 99, background: '#E5F6EF', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1FA97A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </div>
                <h1 style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.4px' }}>{doneTitle}</h1>
                <p style={{ margin: '0 0 24px', fontSize: 13, fontWeight: 500, color: '#8A8E9C', lineHeight: 1.65, maxWidth: 340 }}>{doneBody}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  {done !== 'forgot' && (
                    <button onClick={() => navigate('/dashboard')} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '11px 26px', borderRadius: 8, background: '#5F4DEE', color: '#fff', fontSize: 12.5, fontWeight: 700, boxShadow: '0 8px 18px rgba(95,77,238,0.32)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#4A39C9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#5F4DEE'; }}
                    >Go to dashboard</button>
                  )}
                  <button onClick={() => { setDone(null); setMode('login'); setPw(''); setPw2(''); setSubmitted(false); setTouched({}); }} style={{ all: 'unset', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: '#8A8E9C' }}>← Back</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#B8BBC7' }}>Demo build for the Odoo Hackathon · Northwind Labs workspace</div>
    </div>
  );
}
