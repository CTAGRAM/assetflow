// AssetFlow — shared demo data + helpers. Loaded via <helmet><script src="data.js">.
(function () {
  const TODAY = '2026-07-12'; // demo "now": Sunday, July 12 2026

  // ---------- design tokens ----------
  const T = {
    font: "'IBM Plex Sans', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    bg: '#F6F6F4', surface: '#FFFFFF', ink: '#1B1F1E', sub: '#5C6361', faint: '#8A908E',
    line: '#E4E4DF', lineSoft: '#EDEDE9',
    accent: '#0E6B5C', accentSoft: '#E3F0ED', accentInk: '#0A4F44',
    sidebar: '#152420', sidebarInk: '#C9D4D0',
    red: '#C23A2B', redSoft: '#FBEAE7', amber: '#B26205', amberSoft: '#FBF1E0',
    green: '#0E7A46', greenSoft: '#E4F2EA', blue: '#1D5FBF', blueSoft: '#E7EEF9',
    purple: '#6D4FC2', purpleSoft: '#EFEAF9', gray: '#6B7271', graySoft: '#EEEFED',
  };

  const STATUS = {
    'Available':        { c: T.green,  bg: T.greenSoft },
    'Allocated':        { c: T.blue,   bg: T.blueSoft },
    'Reserved':         { c: T.purple, bg: T.purpleSoft },
    'Under Maintenance':{ c: T.amber,  bg: T.amberSoft },
    'Lost':             { c: T.red,    bg: T.redSoft },
    'Retired':          { c: T.gray,   bg: T.graySoft },
    'Disposed':         { c: '#8A8F8D', bg: T.graySoft },
  };
  const BOOKING_STATUS = {
    'Upcoming':  { c: T.blue, bg: T.blueSoft }, 'Ongoing': { c: T.green, bg: T.greenSoft },
    'Completed': { c: T.gray, bg: T.graySoft }, 'Cancelled': { c: T.red, bg: T.redSoft },
  };
  const MAINT_STAGE = {
    'Pending':   { c: T.amber, bg: T.amberSoft }, 'Approved': { c: T.blue, bg: T.blueSoft },
    'Rejected':  { c: T.red, bg: T.redSoft }, 'Technician Assigned': { c: T.purple, bg: T.purpleSoft },
    'In Progress': { c: T.accent, bg: T.accentSoft }, 'Resolved': { c: T.green, bg: T.greenSoft },
  };

  // ---------- org ----------
  const departments = [
    { id: 'eng', name: 'Engineering', head: 'priya', parent: null, active: true },
    { id: 'design', name: 'Design', head: 'marcus', parent: null, active: true },
    { id: 'ops', name: 'Operations', head: 'sofia', parent: null, active: true },
    { id: 'fin', name: 'Finance', head: 'hannah', parent: null, active: true },
    { id: 'hr', name: 'People & HR', head: 'omar', parent: null, active: true },
    { id: 'log', name: 'Logistics', head: null, parent: 'ops', active: true },
    { id: 'fac', name: 'Facilities (legacy)', head: null, parent: 'ops', active: false },
  ];

  const employees = [
    { id: 'maya',   name: 'Maya Okafor',    email: 'maya.okafor@northwind.io',  dept: 'ops',    role: 'Admin',           active: true },
    { id: 'daniel', name: 'Daniel Reyes',   email: 'daniel.reyes@northwind.io', dept: 'ops',    role: 'Asset Manager',   active: true },
    { id: 'lena',   name: 'Lena Vogel',     email: 'lena.vogel@northwind.io',   dept: 'log',    role: 'Asset Manager',   active: true },
    { id: 'priya',  name: 'Priya Sharma',   email: 'priya.sharma@northwind.io', dept: 'eng',    role: 'Department Head', active: true },
    { id: 'marcus', name: 'Marcus Webb',    email: 'marcus.webb@northwind.io',  dept: 'design', role: 'Department Head', active: true },
    { id: 'sofia',  name: 'Sofia Lindqvist',email: 'sofia.l@northwind.io',      dept: 'ops',    role: 'Department Head', active: true },
    { id: 'hannah', name: 'Hannah Park',    email: 'hannah.park@northwind.io',  dept: 'fin',    role: 'Department Head', active: true },
    { id: 'omar',   name: 'Omar Haddad',    email: 'omar.haddad@northwind.io',  dept: 'hr',     role: 'Department Head', active: true },
    { id: 'tom',    name: 'Tom Becker',     email: 'tom.becker@northwind.io',   dept: 'eng',    role: 'Employee', active: true },
    { id: 'aisha',  name: 'Aisha Bello',    email: 'aisha.bello@northwind.io',  dept: 'eng',    role: 'Employee', active: true },
    { id: 'kenji',  name: 'Kenji Sato',     email: 'kenji.sato@northwind.io',   dept: 'eng',    role: 'Employee', active: true },
    { id: 'jonas',  name: 'Jonas Meier',    email: 'jonas.meier@northwind.io',  dept: 'design', role: 'Employee', active: true },
    { id: 'leo',    name: 'Leo Martins',    email: 'leo.martins@northwind.io',  dept: 'design', role: 'Employee', active: true },
    { id: 'rosa',   name: 'Rosa Delgado',   email: 'rosa.delgado@northwind.io', dept: 'ops',    role: 'Employee', active: true },
    { id: 'femke',  name: 'Femke de Vries', email: 'femke.dv@northwind.io',     dept: 'fin',    role: 'Employee', active: true },
    { id: 'nina',   name: 'Nina Petrova',   email: 'nina.petrova@northwind.io', dept: 'hr',     role: 'Employee', active: true },
    { id: 'sam',    name: "Sam O'Neill",    email: 'sam.oneill@northwind.io',   dept: 'log',    role: 'Employee', active: true },
    { id: 'grace',  name: 'Grace Tan',      email: 'grace.tan@northwind.io',    dept: 'ops',    role: 'Employee', active: false },
  ];

  const categories = [
    { id: 'laptops', name: 'Laptops', icon: 'laptop', img: 'img/laptop.jpg', count: 0,
      fields: [ { key: 'warrantyMonths', label: 'Warranty (months)', type: 'number' }, { key: 'ram', label: 'RAM', type: 'text' }, { key: 'cpu', label: 'CPU', type: 'text' } ] },
    { id: 'vehicles', name: 'Vehicles', icon: 'truck', img: 'img/van.jpg', count: 0,
      fields: [ { key: 'plate', label: 'License plate', type: 'text' }, { key: 'serviceKm', label: 'Service interval (km)', type: 'number' } ] },
    { id: 'furniture', name: 'Furniture', icon: 'chair', img: 'img/chair.jpg', count: 0,
      fields: [ { key: 'material', label: 'Material', type: 'text' } ] },
    { id: 'av', name: 'AV Equipment', icon: 'video', img: 'img/projector.jpg', count: 0,
      fields: [ { key: 'warrantyMonths', label: 'Warranty (months)', type: 'number' } ] },
    { id: 'rooms', name: 'Meeting Rooms', icon: 'door', img: 'img/room.jpg', count: 0,
      fields: [ { key: 'capacity', label: 'Capacity', type: 'number' }, { key: 'floor', label: 'Floor', type: 'text' } ] },
    { id: 'periph', name: 'Peripherals', icon: 'mouse', img: null,
      fields: [ { key: 'warrantyMonths', label: 'Warranty (months)', type: 'number' } ] },
  ];

  // ---------- assets ----------
  // holder: employee id or dept id (holderType 'employee'|'department')
  const assets = [
    { tag: 'AF-0001', name: 'MacBook Pro 16" M4', cat: 'laptops', serial: 'C02XR1AAMD6T', acq: '2025-01-14', cost: 3299, cond: 'Good', loc: 'HQ · Floor 2', dept: 'eng', status: 'Allocated', bookable: false, img: 'img/laptop.jpg', holder: 'priya', holderType: 'employee', expReturn: null, extra: { warrantyMonths: 24, ram: '48 GB', cpu: 'M4 Pro' } },
    { tag: 'AF-0002', name: 'ThinkPad T480', cat: 'laptops', serial: 'PF1KX2QM', acq: '2019-03-02', cost: 1450, cond: 'Poor', loc: 'HQ · Storage B1', dept: 'ops', status: 'Retired', bookable: false, img: 'img/laptop.jpg', holder: null, extra: { warrantyMonths: 36, ram: '16 GB', cpu: 'i5-8350U' } },
    { tag: 'AF-0003', name: 'Ford Transit 350 Van', cat: 'vehicles', serial: 'WF0XXXTTGXKY51234', acq: '2023-06-20', cost: 42800, cond: 'Fair', loc: 'HQ · Garage', dept: 'log', status: 'Under Maintenance', bookable: true, img: 'img/van.jpg', holder: null, extra: { plate: 'B-AF 2043', serviceKm: 15000 } },
    { tag: 'AF-0004', name: 'MacBook Air 13" M3', cat: 'laptops', serial: 'FVFHK3LLQ6L4', acq: '2024-09-11', cost: 1499, cond: 'Good', loc: 'HQ · Floor 2', dept: 'design', status: 'Allocated', bookable: false, img: 'img/laptop.jpg', holder: 'jonas', holderType: 'employee', expReturn: '2026-08-30', extra: { warrantyMonths: 12, ram: '16 GB', cpu: 'M3' } },
    { tag: 'AF-0005', name: 'Dell XPS 15', cat: 'laptops', serial: 'JH2K3M9', acq: '2024-02-27', cost: 2100, cond: 'Good', loc: 'HQ · Floor 3', dept: 'fin', status: 'Available', bookable: false, img: 'img/laptop.jpg', holder: null, extra: { warrantyMonths: 24, ram: '32 GB', cpu: 'i7-13700H' } },
    { tag: 'AF-0006', name: 'Steelcase Gesture Chair', cat: 'furniture', serial: 'SG-88412', acq: '2022-11-05', cost: 1180, cond: 'Good', loc: 'HQ · Floor 2', dept: 'eng', status: 'Allocated', bookable: false, img: 'img/chair.jpg', holder: 'eng', holderType: 'department', expReturn: null, extra: { material: 'Mesh / aluminium' } },
    { tag: 'AF-0007', name: 'MacBook Pro 14" M3', cat: 'laptops', serial: 'C02F1QRSMD6M', acq: '2024-05-08', cost: 2399, cond: 'Good', loc: 'HQ · Floor 2', dept: 'eng', status: 'Allocated', bookable: false, img: 'img/laptop.jpg', holder: 'tom', holderType: 'employee', expReturn: '2026-07-05', extra: { warrantyMonths: 24, ram: '36 GB', cpu: 'M3 Pro' } },
    { tag: 'AF-0008', name: 'Epson EB-L530U Projector', cat: 'av', serial: 'X3LK002481', acq: '2023-08-30', cost: 2650, cond: 'Good', loc: 'HQ · Floor 1 · AV store', dept: 'ops', status: 'Available', bookable: true, img: 'img/projector.jpg', holder: null, extra: { warrantyMonths: 36 } },
    { tag: 'AF-0009', name: 'Canon EOS R6 Kit', cat: 'av', serial: '013021004556', acq: '2024-11-19', cost: 3150, cond: 'Good', loc: 'HQ · Floor 1 · AV store', dept: 'design', status: 'Reserved', bookable: true, img: 'img/projector.jpg', holder: null, extra: { warrantyMonths: 24 } },
    { tag: 'AF-0010', name: 'Herman Miller Aeron', cat: 'furniture', serial: 'HM-30021', acq: '2021-04-15', cost: 1395, cond: 'Damaged', loc: 'HQ · Floor 3', dept: 'fin', status: 'Lost', bookable: false, img: 'img/chair.jpg', holder: null, extra: { material: 'Mesh / graphite' } },
    { tag: 'AF-0011', name: 'Boardroom Aurora', cat: 'rooms', serial: '—', acq: '2020-01-01', cost: 0, cond: 'Good', loc: 'HQ · Floor 4', dept: 'ops', status: 'Available', bookable: true, img: 'img/room.jpg', holder: null, extra: { capacity: 12, floor: '4' } },
    { tag: 'AF-0012', name: 'Huddle Room Birch', cat: 'rooms', serial: '—', acq: '2020-01-01', cost: 0, cond: 'Good', loc: 'HQ · Floor 2', dept: 'ops', status: 'Available', bookable: true, img: 'img/room.jpg', holder: null, extra: { capacity: 4, floor: '2' } },
    { tag: 'AF-0013', name: 'Dell XPS 13', cat: 'laptops', serial: 'JH8B2F1', acq: '2025-03-16', cost: 1650, cond: 'Good', loc: 'HQ · Floor 2', dept: 'eng', status: 'Allocated', bookable: false, img: 'img/laptop.jpg', holder: 'aisha', holderType: 'employee', expReturn: '2026-07-20', extra: { warrantyMonths: 24, ram: '16 GB', cpu: 'Ultra 7 155H' } },
    { tag: 'AF-0014', name: 'VW ID. Buzz Cargo', cat: 'vehicles', serial: 'WVWZZZE1ZPP012887', acq: '2025-05-22', cost: 54300, cond: 'Good', loc: 'HQ · Garage', dept: 'log', status: 'Allocated', bookable: true, img: 'img/van.jpg', holder: 'sam', holderType: 'employee', expReturn: '2026-07-15', extra: { plate: 'B-AF 3110', serviceKm: 20000 } },
    { tag: 'AF-0015', name: 'Sony 65" Bravia Display', cat: 'av', serial: 'S01-7742190', acq: '2022-02-10', cost: 1899, cond: 'Fair', loc: 'HQ · Floor 4 · Aurora', dept: 'ops', status: 'Available', bookable: false, img: 'img/projector.jpg', holder: null, extra: { warrantyMonths: 24 } },
  ];
  // generated filler assets to reach ~40
  const genNames = [
    ['laptops', 'ThinkPad X1 Carbon G12', 'img/laptop.jpg', 1890], ['laptops', 'MacBook Air 15" M3', 'img/laptop.jpg', 1699],
    ['laptops', 'HP EliteBook 840', 'img/laptop.jpg', 1420], ['laptops', 'Framework 13', 'img/laptop.jpg', 1390],
    ['furniture', 'Standing Desk Bekant', 'img/chair.jpg', 640], ['furniture', 'Ergo Chair Pro', 'img/chair.jpg', 520],
    ['furniture', 'Acoustic Pod Solo', 'img/chair.jpg', 8900], ['furniture', 'Lounge Sofa Module', 'img/chair.jpg', 1750],
    ['av', 'Jabra PanaCast 50', 'img/projector.jpg', 1150], ['av', 'Shure MXA920 Mic', 'img/projector.jpg', 2400],
    ['av', 'BenQ 4K Projector', 'img/projector.jpg', 1980], ['periph', 'LG 32" UltraFine', null, 899],
    ['periph', 'Dell 27" U2723QE', null, 610], ['periph', 'Logitech MX Master 3S', null, 99],
    ['periph', 'Keychron Q1 Pro', null, 199], ['periph', 'CalDigit TS4 Dock', null, 379],
    ['periph', 'Jabra Evolve2 65', null, 229], ['vehicles', 'Toyota Proace City', 'img/van.jpg', 28400],
    ['rooms', 'Huddle Room Cedar', 'img/room.jpg', 0], ['rooms', 'Workshop Studio', 'img/room.jpg', 0],
    ['laptops', 'ThinkPad P1 G7', 'img/laptop.jpg', 2850], ['periph', 'Wacom Cintiq 22', null, 1299],
    ['av', 'DJI Mini 4 Pro Drone', 'img/projector.jpg', 1099], ['furniture', 'Filing Cabinet A4', 'img/chair.jpg', 210],
    ['periph', 'Brother HL-L8360 Printer', null, 449],
  ];
  const statusCycle = ['Available', 'Allocated', 'Available', 'Allocated', 'Available', 'Reserved', 'Available', 'Under Maintenance', 'Available', 'Allocated'];
  const holders = ['kenji', 'leo', 'rosa', 'femke', 'nina', 'marcus', 'hannah', 'omar', 'sofia', 'daniel'];
  const locs = ['HQ · Floor 1', 'HQ · Floor 2', 'HQ · Floor 3', 'HQ · Floor 4', 'HQ · Storage B1'];
  const depts = ['eng', 'design', 'ops', 'fin', 'hr', 'log'];
  genNames.forEach((g, i) => {
    const n = 16 + i, status = g[0] === 'rooms' ? 'Available' : statusCycle[i % 10];
    const holder = status === 'Allocated' ? holders[i % 10] : null;
    assets.push({
      tag: 'AF-' + String(n).padStart(4, '0'), name: g[1], cat: g[0],
      serial: g[0] === 'rooms' ? '—' : 'SN' + (738201 + i * 137), acq: 2022 + (i % 4) + '-' + String((i % 12) + 1).padStart(2, '0') + '-' + String((i % 27) + 1).padStart(2, '0'),
      cost: g[3], cond: i % 7 === 3 ? 'Fair' : 'Good', loc: locs[i % 5], dept: depts[i % 6],
      status, bookable: g[0] === 'rooms' || g[0] === 'vehicles' || (g[0] === 'av' && i % 2 === 0),
      img: g[2], holder, holderType: holder ? 'employee' : undefined,
      expReturn: status === 'Allocated' ? (i % 3 === 0 ? '2026-07-0' + ((i % 8) + 1) : '2026-08-' + String((i % 27) + 1).padStart(2, '0')) : null,
      extra: {},
    });
  });

  // ---------- allocations / transfers ----------
  const allocations = [
    { id: 'AL-118', asset: 'AF-0007', to: 'tom', toType: 'employee', by: 'daniel', date: '2026-04-02', expReturn: '2026-07-05', status: 'Active' },
    { id: 'AL-121', asset: 'AF-0013', to: 'aisha', toType: 'employee', by: 'daniel', date: '2026-05-11', expReturn: '2026-07-20', status: 'Active' },
    { id: 'AL-124', asset: 'AF-0014', to: 'sam', toType: 'employee', by: 'lena', date: '2026-06-28', expReturn: '2026-07-15', status: 'Active' },
    { id: 'AL-102', asset: 'AF-0001', to: 'priya', toType: 'employee', by: 'daniel', date: '2025-02-01', expReturn: null, status: 'Active' },
    { id: 'AL-097', asset: 'AF-0004', to: 'jonas', toType: 'employee', by: 'daniel', date: '2024-10-01', expReturn: '2026-08-30', status: 'Active' },
    { id: 'AL-063', asset: 'AF-0006', to: 'eng', toType: 'department', by: 'daniel', date: '2023-01-09', expReturn: null, status: 'Active' },
    { id: 'AL-051', asset: 'AF-0007', to: 'kenji', toType: 'employee', by: 'daniel', date: '2024-05-20', expReturn: '2026-03-30', status: 'Returned', returned: '2026-03-28', checkin: 'Minor scuff on lid, otherwise good.' },
  ];
  const transfers = [
    { id: 'TR-031', asset: 'AF-0007', from: 'tom', to: 'kenji', requestedBy: 'tom', date: '2026-07-10', status: 'Requested', reason: 'Moving to hardware team; Kenji takes over on-call laptop.' },
    { id: 'TR-029', asset: 'AF-0013', from: 'aisha', to: 'eng', requestedBy: 'priya', date: '2026-07-06', status: 'Approved', approvedBy: 'daniel', reason: 'Convert to Engineering pool loaner.' },
    { id: 'TR-024', asset: 'AF-0004', from: 'leo', to: 'jonas', requestedBy: 'marcus', date: '2026-06-12', status: 'Completed', approvedBy: 'daniel', reason: 'Leo switched to desktop workstation.' },
  ];

  // ---------- bookings (resource = asset tag) ----------
  const bookings = [
    { id: 'BK-201', resource: 'AF-0011', by: 'priya', title: 'Sprint 41 planning', date: '2026-07-13', start: '09:00', end: '10:30', status: 'Upcoming' },
    { id: 'BK-202', resource: 'AF-0011', by: 'hannah', title: 'Q3 budget review', date: '2026-07-13', start: '10:30', end: '12:00', status: 'Upcoming' },
    { id: 'BK-203', resource: 'AF-0011', by: 'maya', title: 'All-hands dry run', date: '2026-07-14', start: '14:00', end: '16:00', status: 'Upcoming' },
    { id: 'BK-204', resource: 'AF-0011', by: 'marcus', title: 'Design crit — mobile app', date: '2026-07-15', start: '11:00', end: '12:30', status: 'Upcoming' },
    { id: 'BK-205', resource: 'AF-0011', by: 'omar', title: 'Onboarding cohort July', date: '2026-07-16', start: '09:30', end: '11:00', status: 'Upcoming' },
    { id: 'BK-198', resource: 'AF-0011', by: 'sofia', title: 'Vendor negotiation', date: '2026-07-10', start: '13:00', end: '14:00', status: 'Completed' },
    { id: 'BK-196', resource: 'AF-0011', by: 'tom', title: 'Arch review', date: '2026-07-09', start: '15:00', end: '16:00', status: 'Cancelled' },
    { id: 'BK-207', resource: 'AF-0008', by: 'jonas', title: 'Client pitch — projector', date: '2026-07-14', start: '13:00', end: '17:00', status: 'Upcoming' },
    { id: 'BK-208', resource: 'AF-0009', by: 'leo', title: 'Product photo shoot', date: '2026-07-13', start: '09:00', end: '18:00', status: 'Upcoming' },
    { id: 'BK-209', resource: 'AF-0014', by: 'rosa', title: 'Warehouse run — Depot 4', date: '2026-07-12', start: '08:00', end: '12:00', status: 'Ongoing' },
    { id: 'BK-210', resource: 'AF-0012', by: 'nina', title: '1:1s block', date: '2026-07-13', start: '13:00', end: '15:00', status: 'Upcoming' },
  ];

  // ---------- maintenance ----------
  const maintenance = [
    { id: 'MR-088', asset: 'AF-0003', by: 'sam', date: '2026-07-08', priority: 'High', stage: 'In Progress', tech: 'AutoServ GmbH', issue: 'Grinding noise from front brakes; brake pads likely worn below limit.', photo: true, history: [['2026-07-08', 'Raised by Sam O\'Neill'], ['2026-07-08', 'Approved by Daniel Reyes'], ['2026-07-09', 'Technician assigned — AutoServ GmbH'], ['2026-07-10', 'In progress — parts ordered']] },
    { id: 'MR-091', asset: 'AF-0015', by: 'rosa', date: '2026-07-11', priority: 'Medium', stage: 'Pending', tech: null, issue: 'Display flickers when input switches from HDMI 1 to 2.', photo: false, history: [['2026-07-11', 'Raised by Rosa Delgado']] },
    { id: 'MR-092', asset: 'AF-0024', by: 'jonas', date: '2026-07-12', priority: 'Low', stage: 'Pending', tech: null, issue: 'PanaCast camera lens has a visible scratch; affects auto-framing.', photo: true, history: [['2026-07-12', 'Raised by Jonas Meier']] },
    { id: 'MR-087', asset: 'AF-0020', by: 'kenji', date: '2026-07-05', priority: 'Medium', stage: 'Technician Assigned', tech: 'FixIT Desk', issue: 'Standing desk motor stalls above 90cm.', photo: false, history: [['2026-07-05', 'Raised by Kenji Sato'], ['2026-07-06', 'Approved by Lena Vogel'], ['2026-07-07', 'Technician assigned — FixIT Desk']] },
    { id: 'MR-085', asset: 'AF-0040', by: 'femke', date: '2026-07-02', priority: 'Low', stage: 'Rejected', tech: null, issue: 'Printer toner streaks — request full drum replacement.', photo: false, rejectReason: 'Toner within tolerance; replace cartridge from stock instead.', history: [['2026-07-02', 'Raised by Femke de Vries'], ['2026-07-03', 'Rejected by Daniel Reyes — cartridge swap from stock']] },
    { id: 'MR-084', asset: 'AF-0026', by: 'priya', date: '2026-06-30', priority: 'High', stage: 'Approved', tech: null, issue: 'ThinkPad P1 fan at 100% constantly, thermal shutdowns under load.', photo: true, history: [['2026-06-30', 'Raised by Priya Sharma'], ['2026-07-01', 'Approved by Daniel Reyes']] },
    { id: 'MR-079', asset: 'AF-0008', by: 'marcus', date: '2026-06-18', priority: 'Medium', stage: 'Resolved', tech: 'AV Partners', issue: 'Projector lamp dim; replaced light source module.', photo: false, resolved: '2026-06-24', history: [['2026-06-18', 'Raised by Marcus Webb'], ['2026-06-19', 'Approved by Daniel Reyes'], ['2026-06-20', 'Technician assigned — AV Partners'], ['2026-06-24', 'Resolved — light source replaced']] },
    { id: 'MR-072', asset: 'AF-0007', by: 'tom', date: '2026-05-14', priority: 'Low', stage: 'Resolved', tech: 'FixIT Desk', issue: 'Two dead pixels top-right; panel replaced under warranty.', photo: true, resolved: '2026-05-21', history: [['2026-05-14', 'Raised by Tom Becker'], ['2026-05-15', 'Approved by Daniel Reyes'], ['2026-05-16', 'Technician assigned — FixIT Desk'], ['2026-05-21', 'Resolved — panel swap under warranty']] },
    { id: 'MR-069', asset: 'AF-0003', by: 'lena', date: '2026-04-03', priority: 'Medium', stage: 'Resolved', tech: 'AutoServ GmbH', issue: '15,000 km scheduled service.', photo: false, resolved: '2026-04-05', history: [['2026-04-03', 'Raised by Lena Vogel'], ['2026-04-03', 'Approved by Daniel Reyes'], ['2026-04-04', 'Technician assigned'], ['2026-04-05', 'Resolved — service complete']] },
  ];

  // ---------- audits ----------
  const audits = [
    { id: 'AU-07', name: 'Q3 2026 — HQ Floor 2', scopeType: 'Location', scope: 'HQ · Floor 2', dept: null, from: '2026-07-06', to: '2026-07-24', auditors: ['daniel', 'rosa'], status: 'In Progress',
      items: [
        { asset: 'AF-0001', result: 'Verified', note: '' }, { asset: 'AF-0006', result: 'Verified', note: '' },
        { asset: 'AF-0007', result: 'Verified', note: 'With Tom Becker, confirmed in person.' },
        { asset: 'AF-0012', result: 'Verified', note: '' }, { asset: 'AF-0013', result: 'Damaged', note: 'Cracked corner on display bezel.' },
        { asset: 'AF-0016', result: null, note: '' }, { asset: 'AF-0017', result: null, note: '' },
        { asset: 'AF-0020', result: 'Missing', note: 'Not at listed desk; last seen in Workshop Studio.' },
        { asset: 'AF-0027', result: null, note: '' }, { asset: 'AF-0033', result: null, note: '' },
      ] },
    { id: 'AU-05', name: 'Q1 2026 — Finance dept', scopeType: 'Department', scope: 'Finance', dept: 'fin', from: '2026-01-12', to: '2026-01-30', auditors: ['lena'], status: 'Closed', closed: '2026-01-30',
      items: [ { asset: 'AF-0005', result: 'Verified', note: '' }, { asset: 'AF-0010', result: 'Missing', note: 'Not found in any Finance area; flagged to Asset Manager.' }, { asset: 'AF-0029', result: 'Verified', note: '' }, { asset: 'AF-0040', result: 'Damaged', note: 'Feed tray hinge broken.' } ] },
    { id: 'AU-04', name: 'FY25 year-end — Vehicles', scopeType: 'Department', scope: 'Logistics', dept: 'log', from: '2025-12-01', to: '2025-12-12', auditors: ['lena', 'sam'], status: 'Closed', closed: '2025-12-12',
      items: [ { asset: 'AF-0003', result: 'Verified', note: '' }, { asset: 'AF-0014', result: 'Verified', note: '' }, { asset: 'AF-0033', result: 'Verified', note: '' } ] },
  ];

  // ---------- notifications + activity ----------
  const notifications = [
    { id: 1, type: 'overdue', icon: 'alert', title: 'Overdue return — AF-0007', body: 'MacBook Pro 14" was due back Jul 5 from Tom Becker.', time: '2026-07-12T08:00', unread: true, for: ['maya', 'daniel', 'priya', 'tom'] },
    { id: 2, type: 'transfer', icon: 'swap', title: 'Transfer requested — AF-0007', body: 'Tom Becker requested transfer to Kenji Sato.', time: '2026-07-10T14:22', unread: true, for: ['daniel', 'priya', 'maya'] },
    { id: 3, type: 'maintenance', icon: 'wrench', title: 'Maintenance approved — MR-084', body: 'ThinkPad P1 thermal issue approved by Daniel Reyes.', time: '2026-07-01T09:40', unread: false, for: ['priya', 'maya'] },
    { id: 4, type: 'booking', icon: 'calendar', title: 'Booking reminder — Boardroom Aurora', body: 'Sprint 41 planning starts tomorrow 09:00.', time: '2026-07-12T09:00', unread: true, for: ['priya'] },
    { id: 5, type: 'audit', icon: 'clipboard', title: 'Audit discrepancy — AF-0020', body: 'Standing Desk Bekant marked Missing in Q3 HQ Floor 2 audit.', time: '2026-07-11T16:05', unread: true, for: ['maya', 'daniel'] },
    { id: 6, type: 'booking', icon: 'calendar', title: 'Booking confirmed — BK-207', body: 'Epson projector booked Jul 14, 13:00–17:00.', time: '2026-07-09T11:15', unread: false, for: ['jonas', 'marcus'] },
    { id: 7, type: 'assigned', icon: 'box', title: 'Asset assigned — AF-0013', body: 'Dell XPS 13 allocated to Aisha Bello, return by Jul 20.', time: '2026-05-11T10:00', unread: false, for: ['aisha', 'priya'] },
    { id: 8, type: 'maintenance', icon: 'wrench', title: 'Maintenance rejected — MR-085', body: 'Printer drum replacement rejected: cartridge swap from stock.', time: '2026-07-03T13:30', unread: false, for: ['femke', 'hannah'] },
    { id: 9, type: 'transfer', icon: 'swap', title: 'Transfer approved — TR-029', body: 'AF-0013 approved to move to Engineering pool.', time: '2026-07-07T09:12', unread: true, for: ['priya', 'aisha', 'maya'] },
    { id: 10, type: 'booking', icon: 'calendar', title: 'Booking cancelled — BK-196', body: 'Arch review in Boardroom Aurora was cancelled.', time: '2026-07-08T17:44', unread: false, for: ['tom', 'priya'] },
    { id: 11, type: 'overdue', icon: 'alert', title: 'Return due in 3 days — AF-0014', body: 'VW ID. Buzz Cargo due back Jul 15 from Sam O\'Neill.', time: '2026-07-12T07:30', unread: true, for: ['lena', 'sam'] },
    { id: 12, type: 'maintenance', icon: 'wrench', title: 'Maintenance resolved — MR-079', body: 'Projector light source replaced; asset back to Available.', time: '2026-06-24T15:20', unread: false, for: ['marcus', 'maya', 'daniel'] },
  ];

  const activity = [
    ['2026-07-12 09:14', 'jonas', 'Maintenance', 'Raised MR-092 for AF-0024 (PanaCast lens scratch)'],
    ['2026-07-12 08:00', 'system', 'Allocation', 'Flagged AF-0007 as overdue (expected return Jul 5)'],
    ['2026-07-11 16:05', 'rosa', 'Audit', 'Marked AF-0020 Missing in AU-07 with note'],
    ['2026-07-11 14:48', 'rosa', 'Audit', 'Marked AF-0013 Damaged in AU-07 — “cracked bezel corner”'],
    ['2026-07-11 09:30', 'daniel', 'Audit', 'Verified 4 assets in AU-07 (HQ Floor 2)'],
    ['2026-07-10 14:22', 'tom', 'Transfer', 'Requested TR-031: AF-0007 → Kenji Sato'],
    ['2026-07-10 11:02', 'lena', 'Maintenance', 'Updated MR-088 to In Progress — parts ordered'],
    ['2026-07-09 11:15', 'jonas', 'Booking', 'Booked AF-0008 (Epson projector) Jul 14 13:00–17:00'],
    ['2026-07-08 17:44', 'tom', 'Booking', 'Cancelled BK-196 (Arch review, Boardroom Aurora)'],
    ['2026-07-08 10:15', 'daniel', 'Maintenance', 'Approved MR-088 (Transit van brakes), asset → Under Maintenance'],
    ['2026-07-08 09:58', 'sam', 'Maintenance', 'Raised MR-088 for AF-0003 with photo'],
    ['2026-07-07 09:12', 'daniel', 'Transfer', 'Approved TR-029: AF-0013 → Engineering pool'],
    ['2026-07-06 08:30', 'maya', 'Audit', 'Opened audit cycle AU-07 (HQ Floor 2, Jul 6–24), auditors Daniel & Rosa'],
    ['2026-07-03 13:30', 'daniel', 'Maintenance', 'Rejected MR-085 — cartridge swap from stock'],
    ['2026-07-01 09:40', 'daniel', 'Maintenance', 'Approved MR-084 (ThinkPad P1 thermals)'],
    ['2026-06-28 15:10', 'lena', 'Allocation', 'Allocated AF-0014 to Sam O\'Neill, return by Jul 15'],
    ['2026-06-24 15:20', 'daniel', 'Maintenance', 'Resolved MR-079; AF-0008 → Available'],
    ['2026-06-12 10:05', 'marcus', 'Transfer', 'Requested TR-024: AF-0004 Leo → Jonas'],
    ['2026-05-11 10:00', 'daniel', 'Allocation', 'Allocated AF-0013 to Aisha Bello'],
    ['2026-04-02 09:00', 'daniel', 'Allocation', 'Allocated AF-0007 to Tom Becker, return by Jul 5'],
    ['2026-03-28 16:40', 'daniel', 'Return', 'Checked in AF-0007 from Kenji Sato — “minor scuff on lid”'],
    ['2026-02-01 09:20', 'daniel', 'Allocation', 'Allocated AF-0001 to Priya Sharma (no return date)'],
    ['2026-01-30 17:00', 'maya', 'Audit', 'Closed AU-05; AF-0010 confirmed Lost'],
  ];

  // ---------- personas / role switching ----------
  const personas = { 'Admin': 'maya', 'Asset Manager': 'daniel', 'Department Head': 'priya', 'Employee': 'tom' };
  function role() { try { return localStorage.getItem('af_role') || 'Admin'; } catch (e) { return 'Admin'; } }
  function setRole(r) { try { localStorage.setItem('af_role', r); } catch (e) {} }
  function me() { return employees.find(e => e.id === personas[role()]); }

  // ---------- helpers ----------
  const byId = {}; employees.forEach(e => byId[e.id] = e);
  const byTag = {}; assets.forEach(a => byTag[a.tag] = a);
  const deptById = {}; departments.forEach(d => deptById[d.id] = d);
  function emp(id) { return byId[id] || null; }
  function empName(id) { return id === 'system' ? 'System' : (byId[id] ? byId[id].name : (deptById[id] ? deptById[id].name + ' (dept)' : id)); }
  function asset(tag) { return byTag[tag] || null; }
  function deptName(id) { return deptById[id] ? deptById[id].name : '—'; }
  function fmtDate(d) { if (!d) return '—'; const dt = new Date(d + (d.length === 10 ? 'T12:00' : '')); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: dt.getFullYear() === 2026 ? undefined : 'numeric' }); }
  function fmtDateTime(d) { const dt = new Date(d.replace(' ', 'T')); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function money(n) { return n ? '$' + n.toLocaleString('en-US') : '—'; }
  function initials(name) { return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(); }
  function daysFromToday(d) { return Math.round((new Date(d + 'T12:00') - new Date(TODAY + 'T12:00')) / 86400000); }
  function isOverdue(d) { return d && daysFromToday(d) < 0; }

  const avatarHues = { maya: 26, daniel: 210, lena: 160, priya: 280, marcus: 100, sofia: 330, hannah: 190, omar: 45, tom: 240, aisha: 10, kenji: 130, jonas: 300, leo: 70, rosa: 350, femke: 175, nina: 220, sam: 90, grace: 30 };
  function avatarBg(id) { const h = avatarHues[id] || 200; return 'oklch(0.88 0.06 ' + h + ')'; }
  function avatarInk(id) { const h = avatarHues[id] || 200; return 'oklch(0.38 0.09 ' + h + ')'; }

  window.AF = { TODAY, T, STATUS, BOOKING_STATUS, MAINT_STAGE, departments, employees, categories, assets, allocations, transfers, bookings, maintenance, audits, notifications, activity, personas, role, setRole, me, emp, empName, asset, deptName, fmtDate, fmtDateTime, money, initials, daysFromToday, isOverdue, avatarBg, avatarInk };
})();
