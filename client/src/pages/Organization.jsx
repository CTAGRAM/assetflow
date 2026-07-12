import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as AF from '../data.js';
import api from '../api.js';

// Recreation of design/project/Organization.dc.html (page body only — the
// shared topbar lives in the app shell). Admin-only. Three tabs:
//   Departments — create / edit / (de)activate, set head + parent hierarchy
//   Asset Categories — per-category extra field definitions
//   Employee Directory — the ONLY place an Employee gets promoted
//
// Data loads through src/api.js; edits are optimistic (mirroring the prototype)
// and also fire the matching api.* write so the swap to real endpoints is a
// one-line change per call.

const backIcon = 'M19 12H5M12 19l-7-7 7-7';

export default function Organization() {
  const role = AF.role();

  // UI state (mirrors the prototype component state)
  const [tab, setTab] = useState('depts');
  const [toast, setToast] = useState(null);
  const [ndName, setNdName] = useState('');
  const [ndHead, setNdHead] = useState('');
  const [ndParent, setNdParent] = useState('');
  const [ncName, setNcName] = useState('');
  const [dirQ, setDirQ] = useState('');
  const [dirDept, setDirDept] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [eName, setEName] = useState('');
  const [eHead, setEHead] = useState('');
  const [eParent, setEParent] = useState('');
  const [newFields, setNewFields] = useState({});

  // mutable working copies, loaded through the api surface
  const [depts, setDepts] = useState(null);
  const [cats, setCats] = useState(null);
  const [emps, setEmps] = useState(null);
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [d, c, e, a] = await Promise.all([
          api.getDepartments(), api.getCategories(), api.getEmployees(), api.getAssets(),
        ]);
        if (!alive) return;
        setDepts(d.map((x) => ({ ...x })));
        setCats(c.map((x) => ({ ...x, fields: x.fields.slice() })));
        setEmps(e.map((x) => ({ ...x })));
        setAssets(a);
      } catch (err) {
        if (alive) setError(err.message || 'Could not load the organization.');
      }
    })();
    return () => { alive = false; };
  }, []);

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  if (error) return <Notice color="#E14B3B">{error}</Notice>;

  return (
    <div style={{ padding: '24px 26px 28px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#17171C', maxWidth: 1240, margin: '0 auto' }}>
      {/* page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <BackButton />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.6px' }}>Organization Setup</h1>
          <div style={{ fontSize: 12, color: '#A2A3AE', fontWeight: 500, marginTop: 2 }}>Departments, asset categories, and the employee directory — Admin only.</div>
        </div>
      </div>

      {role !== 'Admin' ? (
        <LockedCard title="Admins only">
          You're viewing as {role}. Switch to Admin in the top bar to manage the organization.
        </LockedCard>
      ) : !depts ? (
        <Notice color="#A2A3AE">Loading organization…</Notice>
      ) : (
        <OrgBody
          {...{ tab, setTab, toast, flash, depts, setDepts, cats, setCats, emps, setEmps, assets,
            ndName, setNdName, ndHead, setNdHead, ndParent, setNdParent, ncName, setNcName,
            dirQ, setDirQ, dirDept, setDirDept, editingId, setEditingId,
            eName, setEName, eHead, setEHead, eParent, setEParent, newFields, setNewFields }}
        />
      )}
    </div>
  );
}

function OrgBody(p) {
  const {
    tab, setTab, toast, flash, depts, setDepts, cats, setCats, emps, setEmps, assets,
    ndName, setNdName, ndHead, setNdHead, ndParent, setNdParent, ncName, setNcName,
    dirQ, setDirQ, dirDept, setDirDept, editingId, setEditingId,
    eName, setEName, eHead, setEHead, eParent, setEParent, newFields, setNewFields,
  } = p;

  const tabs = [['depts', 'Departments'], ['cats', 'Asset Categories'], ['dir', 'Employee Directory']];
  const headOptions = emps.filter((e) => e.active && ['Department Head', 'Asset Manager', 'Admin'].includes(e.role)).map((e) => ({ id: e.id, name: e.name }));
  const parentOptions = depts.filter((d) => d.active).map((d) => ({ id: d.id, name: d.name }));

  // parents first, each followed by its children
  const ordered = [];
  depts.filter((d) => !d.parent).forEach((par) => { ordered.push(par); depts.filter((c) => c.parent === par.id).forEach((c) => ordered.push(c)); });

  const addDept = async () => {
    const v = ndName.trim();
    if (!v) { flash('Give the department a name first.'); return; }
    try {
      await api.createDepartment({ name: v, head_id: ndHead || null, parent_id: ndParent || null });
      setDepts(await api.getDepartments());
      setNdName(''); setNdHead(''); setNdParent('');
      flash(v + ' created.');
    } catch (e) { flash(e.message || 'Could not create the department.'); }
  };

  const addCat = async () => {
    const v = ncName.trim();
    if (!v) { flash('Name the category first.'); return; }
    try {
      await api.createCategory({ name: v, extra_fields: [] });
      setCats(await api.getCategories());
      setNcName('');
      flash('Category “' + v + '” created — add its custom fields below.');
    } catch (e) { flash(e.message || 'Could not create the category.'); }
  };

  return (
    <div>
      {/* tab pills */}
      <div style={{ display: 'flex', gap: 2, background: '#17171C', borderRadius: 99, padding: 4, width: 'fit-content', marginBottom: 18 }}>
        {tabs.map(([id, label]) => {
          const on = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '8px 16px', borderRadius: 99, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: on ? '#fff' : '#9A9AA5', background: on ? '#5F4DEE' : 'transparent' }}>{label}</button>
          );
        })}
      </div>

      {toast && <Toast>{toast}</Toast>}

      {tab === 'depts' && (
        <DepartmentsTab {...{ depts, setDepts, emps, headOptions, parentOptions, ordered, flash,
          ndName, setNdName, ndHead, setNdHead, ndParent, setNdParent, addDept,
          editingId, setEditingId, eName, setEName, eHead, setEHead, eParent, setEParent }} />
      )}
      {tab === 'cats' && (
        <CategoriesTab {...{ cats, setCats, assets, flash, ncName, setNcName, addCat, newFields, setNewFields }} />
      )}
      {tab === 'dir' && (
        <DirectoryTab {...{ emps, setEmps, parentOptions, flash, dirQ, setDirQ, dirDept, setDirDept }} />
      )}
    </div>
  );
}

// ---- Tab A: Departments ----------------------------------------------------
function DepartmentsTab(p) {
  const { depts, setDepts, emps, headOptions, parentOptions, ordered, flash,
    ndName, setNdName, ndHead, setNdHead, ndParent, setNdParent, addDept,
    editingId, setEditingId, eName, setEName, eHead, setEHead, eParent, setEParent } = p;

  const grid = '1.4fr 1.1fr 1fr 90px 110px 150px';
  const fieldWrap = { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160 };
  const label = { fontSize: 10.5, fontWeight: 700, color: '#3F4046' };
  const input = { all: 'unset', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 12.5, padding: '10px 12px', borderRadius: 11, background: '#F7F7FA', border: '1.5px solid #EBEBF1' };
  const select = { boxSizing: 'border-box', fontSize: 12.5, padding: '10px 12px', borderRadius: 11, background: '#F7F7FA', border: '1.5px solid #EBEBF1', ...selectReset };

  const patchDept = (id, patch) => setDepts((ds) => ds.map((d) => d.id === id ? { ...d, ...patch } : d));

  return (
    <div>
      {/* new-department form */}
      <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ ...fieldWrap, flex: 1 }}>
          <label style={label}>New department</label>
          <input value={ndName} onChange={(e) => setNdName(e.target.value)} placeholder="e.g. Marketing" style={input} />
        </div>
        <div style={fieldWrap}>
          <label style={label}>Department Head</label>
          <select value={ndHead} onChange={(e) => setNdHead(e.target.value)} style={select}>
            <option value="">Unassigned</option>
            {headOptions.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div style={fieldWrap}>
          <label style={label}>Parent (optional)</label>
          <select value={ndParent} onChange={(e) => setNdParent(e.target.value)} style={select}>
            <option value="">None — top level</option>
            {parentOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <PrimaryButton onClick={addDept}>+ Create</PrimaryButton>
      </div>

      {/* department table */}
      <div style={{ background: '#fff', borderRadius: 22, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 10, padding: '12px 18px', borderBottom: '1px solid #F1F1F5', ...thStyle }}>
          <span>Department</span><span>Head</span><span>Parent</span><span>People</span><span>Status</span><span style={{ textAlign: 'right' }}>Actions</span>
        </div>
        {ordered.map((d) => {
          const editing = editingId === d.id;
          const people = emps.filter((e) => e.dept === d.id && e.active).length;
          const parentName = d.parent ? (depts.find((x) => x.id === d.parent) || {}).name : '—';
          const openEdit = () => editing ? setEditingId(null) : (setEditingId(d.id), setEName(d.name), setEHead(d.head || ''), setEParent(d.parent || ''));
          const toggle = async () => {
            const active = !d.active;
            try {
              await api.updateDepartment(d.id, { is_active: active });
              patchDept(d.id, { active });
              flash(d.name + (active ? ' reactivated.' : ' deactivated — its assets stay registered.'));
            } catch (e) { flash(e.message || 'Could not update the department.'); }
          };
          const save = async () => {
            const name = eName || d.name;
            try {
              await api.updateDepartment(d.id, { name, head_id: eHead || null, parent_id: eParent || null });
              patchDept(d.id, { name, head: eHead || null, parent: eParent || null });
              setEditingId(null);
              flash(name + ' updated.');
            } catch (e) { flash(e.message || 'Could not update the department.'); }
          };
          return (
            <div key={d.id} style={{ borderBottom: '1px solid #F6F6F9' }}>
              <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 10, alignItems: 'center', padding: '11px 18px', opacity: d.active ? 1 : 0.55 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700 }}>
                  {d.parent && <span style={{ color: '#C9C9D6' }}>└</span>}{d.name}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: d.head ? '#3F4046' : '#E14B3B' }}>{d.head ? AF.empName(d.head) : 'Unassigned'}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#6B6C75' }}>{parentName}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{people}</span>
                <span><Chip bg={d.active ? '#E5F6EF' : '#F1F1F6'} ink={d.active ? '#157A57' : '#8A8B95'}>{d.active ? 'Active' : 'Inactive'}</Chip></span>
                <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <OutlineButton onClick={openEdit}>{editing ? 'Close' : 'Edit'}</OutlineButton>
                  <OutlineButton onClick={toggle} color={d.active ? '#E14B3B' : '#157A57'}>{d.active ? 'Deactivate' : 'Reactivate'}</OutlineButton>
                </span>
              </div>
              {editing && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', padding: '4px 18px 14px', flexWrap: 'wrap', background: '#FAFAFE' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 140 }}>
                    <label style={editLabel}>Name</label>
                    <input value={eName} onChange={(e) => setEName(e.target.value)} style={editInput} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
                    <label style={editLabel}>Head</label>
                    <select value={eHead} onChange={(e) => setEHead(e.target.value)} style={editSelect}>
                      <option value="">Unassigned</option>
                      {headOptions.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
                    <label style={editLabel}>Parent</label>
                    <select value={eParent} onChange={(e) => setEParent(e.target.value)} style={editSelect}>
                      <option value="">None — top level</option>
                      {parentOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <button onClick={save} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '9px 16px', borderRadius: 99, background: '#17171C', color: '#fff', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800 }}>Save</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Tab B: Categories -----------------------------------------------------
function CategoriesTab(p) {
  const { cats, setCats, assets, flash, ncName, setNcName, addCat, newFields, setNewFields } = p;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
      {cats.map((c) => {
        const count = assets.filter((a) => a.cat === c.id).length;
        const addField = async () => {
          const v = (newFields[c.id] || '').trim();
          if (!v) return;
          const field = { key: v.toLowerCase().replace(/\W+/g, ''), label: v, type: /month|year|km|count|capacity|number/i.test(v) ? 'number' : 'text' };
          const nextFields = c.fields.concat([field]);
          try {
            await api.updateCategory(c.id, { extra_fields: nextFields.map((f) => ({ name: f.key, label: f.label, type: f.type })) });
            setCats((cs) => cs.map((x) => x.id === c.id ? { ...x, fields: nextFields } : x));
            setNewFields((nf) => ({ ...nf, [c.id]: '' }));
            flash('Field “' + v + '” added to ' + c.name + '.');
          } catch (e) { flash(e.message || 'Could not save the field.'); }
        };
        return (
          <div key={c.id} style={{ background: '#fff', borderRadius: 20, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {c.img
                ? <span style={{ display: 'block', width: 38, height: 38, borderRadius: 12, flex: 'none', background: '#F1F1F6 url(/' + c.img + ') center/cover no-repeat' }} />
                : <span style={{ width: 38, height: 38, borderRadius: 12, background: '#EEEBFE', color: '#5F4DEE', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800 }}>{c.name.slice(0, 2).toUpperCase()}</span>}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{c.name}</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A2A3AE' }}>{count} assets registered</div>
              </div>
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#A2A3AE', marginBottom: 7 }}>Category-specific fields</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {c.fields.length === 0
                ? <span style={{ fontSize: 10.5, fontWeight: 600, color: '#C9C9D6' }}>No extra fields yet</span>
                : c.fields.map((f) => (
                  <span key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, background: '#F1F1F6', borderRadius: 99, padding: '4px 10px', color: '#3F4046' }}>{f.label} <span style={{ color: '#A2A3AE', fontWeight: 600 }}>{f.type}</span></span>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newFields[c.id] || ''} onChange={(e) => setNewFields((nf) => ({ ...nf, [c.id]: e.target.value }))} placeholder="Add field, e.g. Warranty months"
                style={{ all: 'unset', boxSizing: 'border-box', flex: 1, fontFamily: 'inherit', fontSize: 11, fontWeight: 600, padding: '8px 11px', borderRadius: 99, background: '#F7F7FA', border: '1.5px solid #EBEBF1' }} />
              <DarkButton onClick={addField}>+ Add</DarkButton>
            </div>
          </div>
        );
      })}
      {/* new category */}
      <div style={{ border: '1.5px dashed #C9C9D6', borderRadius: 20, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, minHeight: 150 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#6B6C75' }}>New category</div>
        <input value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="e.g. Lab Equipment"
          style={{ all: 'unset', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, padding: '10px 12px', borderRadius: 11, background: '#fff', border: '1.5px solid #EBEBF1' }} />
        <button onClick={addCat} onMouseEnter={hoverBg('#4A39C9')} onMouseLeave={hoverBg('#5F4DEE')}
          style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', textAlign: 'center', padding: 10, borderRadius: 99, background: '#5F4DEE', color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 800 }}>+ Create category</button>
      </div>
    </div>
  );
}

// ---- Tab C: Employee Directory --------------------------------------------
function DirectoryTab(p) {
  const { emps, setEmps, parentOptions, flash, dirQ, setDirQ, dirDept, setDirDept } = p;
  const grid = '1.5fr 1.6fr 1fr 170px 110px';
  const q = dirQ.trim().toLowerCase();
  const rows = emps.filter((e) => (!q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)) && (!dirDept || e.dept === dirDept));

  const patchEmp = (id, patch) => setEmps((es) => es.map((e) => e.id === id ? { ...e, ...patch } : e));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #E7E7EE', borderRadius: 99, padding: '9px 14px', width: 220 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A2A3AE" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input value={dirQ} onChange={(e) => setDirQ(e.target.value)} placeholder="Search name or email…" style={{ all: 'unset', flex: 1, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, color: '#17171C' }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #E7E7EE', borderRadius: 99, padding: '9px 14px' }}>
          <select value={dirDept} onChange={(e) => setDirDept(e.target.value)} style={selectReset}>
            <option value="">All departments</option>
            {parentOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#A2A3AE' }}>Role changes here are the only way to promote Employees.</span>
      </div>

      {rows.length > 0 ? (
        <div style={{ background: '#fff', borderRadius: 22, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 10, padding: '12px 18px', borderBottom: '1px solid #F1F1F5', ...thStyle }}>
            <span>Employee</span><span>Email</span><span>Department</span><span>Role</span><span>Status</span>
          </div>
          {rows.map((e) => {
            const setRoleVal = async (ev) => {
              const old = e.role, next = ev.target.value;
              try {
                await api.updateEmployee(e.id, { role: next });
                patchEmp(e.id, { role: next });
                flash(e.name + ': ' + old + ' → ' + next + '.');
              } catch (err) { flash(err.message || 'Could not change the role.'); }
            };
            const toggle = async () => {
              const active = !e.active;
              try {
                await api.updateEmployee(e.id, { is_active: active });
                patchEmp(e.id, { active });
                flash(e.name + (active ? ' reactivated.' : ' marked inactive.'));
              } catch (err) { flash(err.message || 'Could not update the employee.'); }
            };
            return (
              <div key={e.id} style={{ display: 'grid', gridTemplateColumns: grid, gap: 10, alignItems: 'center', padding: '9px 18px', borderBottom: '1px solid #F6F6F9', opacity: e.active ? 1 : 0.55 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 99, background: AF.avatarBg(e.id), color: AF.avatarInk(e.id), display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, flex: 'none' }}>{AF.initials(e.name)}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{e.name}</span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#6B6C75' }}>{e.email}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#3F4046' }}>{AF.deptName(e.dept)}</span>
                <span>
                  {e.role === 'Admin'
                    ? <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '4px 10px', background: '#17171C', color: '#fff' }}>Admin</span>
                    : (
                      <label style={{ display: 'inline-flex', alignItems: 'center', background: '#F7F7FA', border: '1.5px solid ' + (e.role === 'Employee' ? '#EBEBF1' : '#B8AEF7'), borderRadius: 99, padding: '5px 10px' }}>
                        <select value={e.role} onChange={setRoleVal} style={{ ...selectReset, fontSize: 10.5, fontWeight: 700 }}>
                          <option>Employee</option><option>Department Head</option><option>Asset Manager</option>
                        </select>
                      </label>
                    )}
                </span>
                <span>
                  <button onClick={toggle} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '4px 10px', background: e.active ? '#E5F6EF' : '#F1F1F6', color: e.active ? '#157A57' : '#8A8B95' }}>{e.active ? 'Active' : 'Inactive'}</button>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 22, padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Nobody matches that search</div>
          <div style={{ fontSize: 12, color: '#A2A3AE', fontWeight: 500, marginTop: 4 }}>Check the spelling or clear the department filter.</div>
        </div>
      )}
    </div>
  );
}

// ---- shared bits -----------------------------------------------------------
const selectReset = { border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, color: '#3F4046', cursor: 'pointer' };
const thStyle = { fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#A2A3AE' };
const editLabel = { fontSize: 10, fontWeight: 700, color: '#A2A3AE' };
const editInput = { all: 'unset', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 12, padding: '8px 11px', borderRadius: 10, background: '#fff', border: '1.5px solid #DCD6FB' };
const editSelect = { boxSizing: 'border-box', fontSize: 12, padding: '8px 11px', borderRadius: 10, background: '#fff', border: '1.5px solid #DCD6FB', ...selectReset };

function hoverBg(bg) { return (e) => { e.currentTarget.style.background = bg; }; }

function BackButton() {
  return (
    <Link to="/dashboard" style={{ width: 36, height: 36, borderRadius: 99, background: '#fff', border: '1px solid #E7E7EE', display: 'grid', placeItems: 'center', textDecoration: 'none' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#5F4DEE'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E7E7EE'; }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#17171C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={backIcon} /></svg>
    </Link>
  );
}

function PrimaryButton({ onClick, children }) {
  return (
    <button onClick={onClick} onMouseEnter={hoverBg('#4A39C9')} onMouseLeave={hoverBg('#5F4DEE')}
      style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '10px 18px', borderRadius: 99, background: '#5F4DEE', color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, boxShadow: '0 6px 14px rgba(95,77,238,0.3)' }}>{children}</button>
  );
}
function DarkButton({ onClick, children }) {
  return (
    <button onClick={onClick} onMouseEnter={hoverBg('#5F4DEE')} onMouseLeave={hoverBg('#17171C')}
      style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '8px 13px', borderRadius: 99, background: '#17171C', color: '#fff', fontFamily: 'inherit', fontSize: 11, fontWeight: 800 }}>{children}</button>
  );
}
function OutlineButton({ onClick, children, color = '#3F4046' }) {
  return (
    <button onClick={onClick} onMouseEnter={(e) => { e.currentTarget.style.borderColor = color === '#3F4046' ? '#5F4DEE' : '#17171C'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E7E7EE'; }}
      style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 10.5, fontWeight: 700, padding: '5px 11px', borderRadius: 99, border: '1px solid #E7E7EE', color }}>{children}</button>
  );
}
function Chip({ bg, ink, children }) {
  return <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '4px 10px', background: bg, color: ink }}>{children}</span>;
}
function Toast({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#E5F6EF', border: '1px solid #BFE8D6', borderRadius: 14, padding: '11px 16px', marginBottom: 16, fontSize: 12, fontWeight: 700, color: '#157A57' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>{children}
    </div>
  );
}
function LockedCard({ title, children }) {
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
function Notice({ color, children }) {
  return <div style={{ padding: '40px 26px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color, fontWeight: 600 }}>{children}</div>;
}
