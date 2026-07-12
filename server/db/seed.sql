-- AssetFlow demo seed data. PostgreSQL 16.
-- Company: Northwind Labs. "Now" for this dataset is 2026-07-12 (a Sunday).
-- Matches server/db/schema.sql exactly — DO NOT modify the schema to fit this file.
--
-- Load order:
--   psql -d assetflow -f server/db/schema.sql
--   psql -d assetflow -f server/db/seed.sql
--
-- Re-runnable: it truncates every table and restarts identities first, so you
-- can reload it as often as you like during the demo.
--
-- Every user shares the demo password "assetflow" (real bcrypt hash below).
--
-- Key invariant: assets are inserted in tag order with id/tag left to the
-- sequences, so asset id N == tag AF-000N. Every asset foreign key below
-- (allocations, bookings, maintenance, audits) relies on this mapping.
--   Users:   1 Maya(admin) 2 Daniel(AM) 3 Lena(AM) 4 Priya(head/Eng)
--            5 Marcus(head/Design) 6 Sofia(head/Ops) 7 Hannah(head/Fin)
--            8 Omar(head/HR) 9 Tom 10 Aisha 11 Kenji 12 Jonas 13 Leo
--            14 Rosa 15 Femke 16 Nina 17 Sam 18 Grace(inactive)
--   Depts:   1 Engineering 2 Design 3 Operations 4 Finance 5 People & HR
--            6 Logistics(->Ops) 7 Facilities legacy(->Ops, inactive)
--   Cats:    1 Laptops 2 Vehicles 3 Furniture 4 AV Equipment 5 Meeting Rooms 6 Peripherals

begin;

truncate table
  activity_log, notifications, audit_records, audit_assignments, audit_cycles,
  maintenance_requests, bookings, transfer_requests, allocations, assets,
  asset_categories, users, departments
restart identity cascade;
alter sequence asset_tag_seq restart with 1;

-- ---------------------------------------------------------------------------
-- Departments (heads are wired up after users exist, per the schema's own
-- circular-reference break).
-- ---------------------------------------------------------------------------
insert into departments (name, parent_id, is_active) values
  ('Engineering',         null, true),   -- 1
  ('Design',              null, true),   -- 2
  ('Operations',          null, true),   -- 3
  ('Finance',             null, true),   -- 4
  ('People & HR',         null, true),   -- 5
  ('Logistics',           3,    true),   -- 6  reports into Operations
  ('Facilities (legacy)', 3,    false);  -- 7  deactivated, kept for history

-- ---------------------------------------------------------------------------
-- Users — 18 people across all four roles. Shared placeholder password hash.
-- ---------------------------------------------------------------------------
insert into users (name, email, password_hash, role, department_id, is_active, created_at) values
  ('Maya Okafor',     'maya.okafor@northwind.io',  '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'admin',           3, true,  '2023-01-05 09:00+00'), -- 1
  ('Daniel Reyes',    'daniel.reyes@northwind.io', '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'asset_manager',   3, true,  '2023-01-06 09:00+00'), -- 2
  ('Lena Vogel',      'lena.vogel@northwind.io',   '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'asset_manager',   6, true,  '2023-02-01 09:00+00'), -- 3
  ('Priya Sharma',    'priya.sharma@northwind.io', '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'department_head', 1, true,  '2023-02-14 09:00+00'), -- 4
  ('Marcus Webb',     'marcus.webb@northwind.io',  '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'department_head', 2, true,  '2023-03-01 09:00+00'), -- 5
  ('Sofia Lindqvist', 'sofia.l@northwind.io',      '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'department_head', 3, true,  '2023-03-15 09:00+00'), -- 6
  ('Hannah Park',     'hannah.park@northwind.io',  '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'department_head', 4, true,  '2023-04-02 09:00+00'), -- 7
  ('Omar Haddad',     'omar.haddad@northwind.io',  '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'department_head', 5, true,  '2023-04-20 09:00+00'), -- 8
  ('Tom Becker',      'tom.becker@northwind.io',   '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'employee',        1, true,  '2023-06-01 09:00+00'), -- 9
  ('Aisha Bello',     'aisha.bello@northwind.io',  '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'employee',        1, true,  '2023-09-11 09:00+00'), -- 10
  ('Kenji Sato',      'kenji.sato@northwind.io',   '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'employee',        1, true,  '2024-01-08 09:00+00'), -- 11
  ('Jonas Meier',     'jonas.meier@northwind.io',  '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'employee',        2, true,  '2023-07-17 09:00+00'), -- 12
  ('Leo Martins',     'leo.martins@northwind.io',  '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'employee',        2, true,  '2024-02-26 09:00+00'), -- 13
  ('Rosa Delgado',    'rosa.delgado@northwind.io', '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'employee',        3, true,  '2023-05-22 09:00+00'), -- 14
  ('Femke de Vries',  'femke.dv@northwind.io',     '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'employee',        4, true,  '2023-08-30 09:00+00'), -- 15
  ('Nina Petrova',    'nina.petrova@northwind.io', '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'employee',        5, true,  '2024-03-04 09:00+00'), -- 16
  ('Sam O''Neill',    'sam.oneill@northwind.io',   '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'employee',        6, true,  '2023-10-09 09:00+00'), -- 17
  ('Grace Tan',       'grace.tan@northwind.io',    '$2b$10$ORbE85sfYYjH.JbraTNJpO5QtDnRxwmO/0ENoSKcE39R5aW5zI42S', 'employee',        3, false, '2022-11-15 09:00+00'); -- 18 offboarded

-- Wire up department heads now that the users exist.
update departments set head_id = 4 where id = 1;  -- Priya heads Engineering
update departments set head_id = 5 where id = 2;  -- Marcus heads Design
update departments set head_id = 6 where id = 3;  -- Sofia heads Operations
update departments set head_id = 7 where id = 4;  -- Hannah heads Finance
update departments set head_id = 8 where id = 5;  -- Omar heads People & HR
-- Logistics (6) and Facilities (7) intentionally have no head.

-- ---------------------------------------------------------------------------
-- Asset categories, each with its category-specific extra field definitions.
-- ---------------------------------------------------------------------------
insert into asset_categories (name, extra_fields, is_active) values
  ('Laptops',       '[{"name":"warrantyMonths","label":"Warranty (months)","type":"number"},{"name":"ram","label":"RAM","type":"text"},{"name":"cpu","label":"CPU","type":"text"}]'::jsonb, true), -- 1
  ('Vehicles',      '[{"name":"plate","label":"License plate","type":"text"},{"name":"serviceKm","label":"Service interval (km)","type":"number"}]'::jsonb, true),                                   -- 2
  ('Furniture',     '[{"name":"material","label":"Material","type":"text"}]'::jsonb, true),                                                                                                          -- 3
  ('AV Equipment',  '[{"name":"warrantyMonths","label":"Warranty (months)","type":"number"}]'::jsonb, true),                                                                                         -- 4
  ('Meeting Rooms', '[{"name":"capacity","label":"Capacity","type":"number"},{"name":"floor","label":"Floor","type":"text"}]'::jsonb, true),                                                          -- 5
  ('Peripherals',   '[{"name":"warrantyMonths","label":"Warranty (months)","type":"number"}]'::jsonb, true);                                                                                         -- 6

-- ---------------------------------------------------------------------------
-- Assets — 40 items in varied lifecycle states. Inserted in tag order so
-- id == AF-000<id>. Columns: name, category_id, serial, acquisition_date,
-- acquisition_cost, condition, location, photo_url, extra, is_bookable,
-- status, created_by, created_at.
-- ---------------------------------------------------------------------------
insert into assets (name, category_id, serial_number, acquisition_date, acquisition_cost, condition, location, photo_url, extra, is_bookable, status, created_by, created_at) values
  /* AF-0001 */ ('MacBook Pro 16" M4', 1, 'C02XR1AAMD6T', '2025-01-14', 3299.00, 'Good', 'HQ · Floor 2', 'img/laptop.jpg', '{"warrantyMonths":24,"ram":"48 GB","cpu":"M4 Pro"}'::jsonb, false, 'allocated', 2, '2025-01-14 12:00+00'),
  /* AF-0002 */ ('ThinkPad T480', 1, 'PF1KX2QM', '2019-03-02', 1450.00, 'Poor', 'HQ · Storage B1', 'img/laptop.jpg', '{"warrantyMonths":36,"ram":"16 GB","cpu":"i5-8350U"}'::jsonb, false, 'retired', 2, '2019-03-02 12:00+00'),
  /* AF-0003 */ ('Ford Transit 350 Van', 2, 'WF0XXXTTGXKY51234', '2023-06-20', 42800.00, 'Fair', 'HQ · Garage', 'img/van.jpg', '{"plate":"B-AF 2043","serviceKm":15000}'::jsonb, true, 'under_maintenance', 3, '2023-06-20 12:00+00'),
  /* AF-0004 */ ('MacBook Air 13" M3', 1, 'FVFHK3LLQ6L4', '2024-09-11', 1499.00, 'Good', 'HQ · Floor 2', 'img/laptop.jpg', '{"warrantyMonths":12,"ram":"16 GB","cpu":"M3"}'::jsonb, false, 'allocated', 2, '2024-09-11 12:00+00'),
  /* AF-0005 */ ('Dell XPS 15', 1, 'JH2K3M9', '2024-02-27', 2100.00, 'Good', 'HQ · Floor 3', 'img/laptop.jpg', '{"warrantyMonths":24,"ram":"32 GB","cpu":"i7-13700H"}'::jsonb, false, 'available', 2, '2024-02-27 12:00+00'),
  /* AF-0006 */ ('Steelcase Gesture Chair', 3, 'SG-88412', '2022-11-05', 1180.00, 'Good', 'HQ · Floor 2', 'img/chair.jpg', '{"material":"Mesh / aluminium"}'::jsonb, false, 'allocated', 2, '2022-11-05 12:00+00'),
  /* AF-0007 */ ('MacBook Pro 14" M3', 1, 'C02F1QRSMD6M', '2024-05-08', 2399.00, 'Good', 'HQ · Floor 2', 'img/laptop.jpg', '{"warrantyMonths":24,"ram":"36 GB","cpu":"M3 Pro"}'::jsonb, false, 'allocated', 2, '2024-05-08 12:00+00'),
  /* AF-0008 */ ('Epson EB-L530U Projector', 4, 'X3LK002481', '2023-08-30', 2650.00, 'Good', 'HQ · Floor 1 · AV store', 'img/projector.jpg', '{"warrantyMonths":36}'::jsonb, true, 'available', 2, '2023-08-30 12:00+00'),
  /* AF-0009 */ ('Canon EOS R6 Kit', 4, '013021004556', '2024-11-19', 3150.00, 'Good', 'HQ · Floor 1 · AV store', 'img/projector.jpg', '{"warrantyMonths":24}'::jsonb, true, 'reserved', 2, '2024-11-19 12:00+00'),
  /* AF-0010 */ ('Herman Miller Aeron', 3, 'HM-30021', '2021-04-15', 1395.00, 'Damaged', 'HQ · Floor 3', 'img/chair.jpg', '{"material":"Mesh / graphite"}'::jsonb, false, 'lost', 2, '2021-04-15 12:00+00'),
  /* AF-0011 */ ('Boardroom Aurora', 5, null, '2020-01-01', 0.00, 'Good', 'HQ · Floor 4', 'img/room.jpg', '{"capacity":12,"floor":"4"}'::jsonb, true, 'available', 2, '2020-01-01 12:00+00'),
  /* AF-0012 */ ('Huddle Room Birch', 5, null, '2020-01-01', 0.00, 'Good', 'HQ · Floor 2', 'img/room.jpg', '{"capacity":4,"floor":"2"}'::jsonb, true, 'available', 2, '2020-01-01 12:00+00'),
  /* AF-0013 */ ('Dell XPS 13', 1, 'JH8B2F1', '2025-03-16', 1650.00, 'Good', 'HQ · Floor 2', 'img/laptop.jpg', '{"warrantyMonths":24,"ram":"16 GB","cpu":"Ultra 7 155H"}'::jsonb, false, 'allocated', 2, '2025-03-16 12:00+00'),
  /* AF-0014 */ ('VW ID. Buzz Cargo', 2, 'WVWZZZE1ZPP012887', '2025-05-22', 54300.00, 'Good', 'HQ · Garage', 'img/van.jpg', '{"plate":"B-AF 3110","serviceKm":20000}'::jsonb, true, 'allocated', 3, '2025-05-22 12:00+00'),
  /* AF-0015 */ ('Sony 65" Bravia Display', 4, 'S01-7742190', '2022-02-10', 1899.00, 'Fair', 'HQ · Floor 4 · Aurora', 'img/projector.jpg', '{"warrantyMonths":24}'::jsonb, false, 'available', 2, '2022-02-10 12:00+00'),
  /* AF-0016 */ ('ThinkPad X1 Carbon G12', 1, 'SN738201', '2022-01-01', 1890.00, 'Good', 'HQ · Floor 1', 'img/laptop.jpg', '{}'::jsonb, false, 'available', 2, '2022-01-01 12:00+00'),
  /* AF-0017 */ ('MacBook Air 15" M3', 1, 'SN738338', '2023-02-02', 1699.00, 'Good', 'HQ · Floor 2', 'img/laptop.jpg', '{}'::jsonb, false, 'allocated', 2, '2023-02-02 12:00+00'),
  /* AF-0018 */ ('HP EliteBook 840', 1, 'SN738475', '2024-03-03', 1420.00, 'Good', 'HQ · Floor 3', 'img/laptop.jpg', '{}'::jsonb, false, 'available', 2, '2024-03-03 12:00+00'),
  /* AF-0019 */ ('Framework 13', 1, 'SN738612', '2025-04-04', 1390.00, 'Fair', 'HQ · Floor 4', 'img/laptop.jpg', '{}'::jsonb, false, 'allocated', 2, '2025-04-04 12:00+00'),
  /* AF-0020 */ ('Standing Desk Bekant', 3, 'SN738749', '2022-05-05', 640.00, 'Good', 'HQ · Storage B1', 'img/chair.jpg', '{}'::jsonb, false, 'under_maintenance', 2, '2022-05-05 12:00+00'),
  /* AF-0021 */ ('Ergo Chair Pro', 3, 'SN738886', '2023-06-06', 520.00, 'Good', 'HQ · Floor 1', 'img/chair.jpg', '{}'::jsonb, false, 'reserved', 2, '2023-06-06 12:00+00'),
  /* AF-0022 */ ('Acoustic Pod Solo', 3, 'SN739023', '2024-07-07', 8900.00, 'Good', 'HQ · Floor 2', 'img/chair.jpg', '{}'::jsonb, false, 'available', 2, '2024-07-07 12:00+00'),
  /* AF-0023 */ ('Lounge Sofa Module', 3, 'SN739160', '2025-08-08', 1750.00, 'Good', 'HQ · Floor 3', 'img/chair.jpg', '{}'::jsonb, false, 'under_maintenance', 2, '2025-08-08 12:00+00'),
  /* AF-0024 */ ('Jabra PanaCast 50', 4, 'SN739297', '2022-09-09', 1150.00, 'Good', 'HQ · Floor 4', 'img/projector.jpg', '{}'::jsonb, true, 'available', 2, '2022-09-09 12:00+00'),
  /* AF-0025 */ ('Shure MXA920 Mic', 4, 'SN739434', '2023-10-10', 2400.00, 'Good', 'HQ · Storage B1', 'img/projector.jpg', '{}'::jsonb, false, 'allocated', 2, '2023-10-10 12:00+00'),
  /* AF-0026 */ ('BenQ 4K Projector', 4, 'SN739571', '2024-11-11', 1980.00, 'Fair', 'HQ · Floor 1', 'img/projector.jpg', '{}'::jsonb, true, 'available', 2, '2024-11-11 12:00+00'),
  /* AF-0027 */ ('LG 32" UltraFine', 6, 'SN739708', '2025-12-12', 899.00, 'Good', 'HQ · Floor 2', null, '{}'::jsonb, false, 'allocated', 2, '2025-12-12 12:00+00'),
  /* AF-0028 */ ('Dell 27" U2723QE', 6, 'SN739845', '2022-01-13', 610.00, 'Good', 'HQ · Floor 3', null, '{}'::jsonb, false, 'available', 2, '2022-01-13 12:00+00'),
  /* AF-0029 */ ('Logitech MX Master 3S', 6, 'SN739982', '2023-02-14', 99.00, 'Good', 'HQ · Floor 4', null, '{}'::jsonb, false, 'allocated', 2, '2023-02-14 12:00+00'),
  /* AF-0030 */ ('Keychron Q1 Pro', 6, 'SN740119', '2024-03-15', 199.00, 'Good', 'HQ · Storage B1', null, '{}'::jsonb, false, 'available', 2, '2024-03-15 12:00+00'),
  /* AF-0031 */ ('CalDigit TS4 Dock', 6, 'SN740256', '2025-04-16', 379.00, 'Good', 'HQ · Floor 1', null, '{}'::jsonb, false, 'reserved', 2, '2025-04-16 12:00+00'),
  /* AF-0032 */ ('Jabra Evolve2 65', 6, 'SN740393', '2022-05-17', 229.00, 'Good', 'HQ · Floor 2', null, '{}'::jsonb, false, 'available', 2, '2022-05-17 12:00+00'),
  /* AF-0033 */ ('Toyota Proace City', 2, 'SN740530', '2023-06-18', 28400.00, 'Fair', 'HQ · Floor 3', 'img/van.jpg', '{}'::jsonb, true, 'under_maintenance', 3, '2023-06-18 12:00+00'),
  /* AF-0034 */ ('Huddle Room Cedar', 5, null, '2024-07-19', 0.00, 'Good', 'HQ · Floor 4', 'img/room.jpg', '{}'::jsonb, true, 'available', 2, '2024-07-19 12:00+00'),
  /* AF-0035 */ ('Workshop Studio', 5, null, '2025-08-20', 0.00, 'Good', 'HQ · Storage B1', 'img/room.jpg', '{}'::jsonb, true, 'available', 2, '2025-08-20 12:00+00'),
  /* AF-0036 */ ('ThinkPad P1 G7', 1, 'SN740941', '2022-09-21', 2850.00, 'Good', 'HQ · Floor 1', 'img/laptop.jpg', '{}'::jsonb, false, 'available', 2, '2022-09-21 12:00+00'),
  /* AF-0037 */ ('Wacom Cintiq 22', 6, 'SN741078', '2023-10-22', 1299.00, 'Good', 'HQ · Floor 2', null, '{}'::jsonb, false, 'allocated', 2, '2023-10-22 12:00+00'),
  /* AF-0038 */ ('DJI Mini 4 Pro Drone', 4, 'SN741215', '2024-11-23', 1099.00, 'Good', 'HQ · Floor 3', 'img/projector.jpg', '{}'::jsonb, true, 'available', 2, '2024-11-23 12:00+00'),
  /* AF-0039 */ ('Filing Cabinet A4', 3, 'SN741352', '2025-12-24', 210.00, 'Good', 'HQ · Floor 4', 'img/chair.jpg', '{}'::jsonb, false, 'allocated', 2, '2025-12-24 12:00+00'),
  /* AF-0040 */ ('Brother HL-L8360 Printer', 6, 'SN741489', '2022-01-25', 449.00, 'Fair', 'HQ · Storage B1', null, '{}'::jsonb, false, 'available', 2, '2022-01-25 12:00+00');

-- ---------------------------------------------------------------------------
-- Allocations. One OPEN row per allocated asset (the schema's partial unique
-- index enforces this), plus two historical returns. Overdue = expected return
-- date already in the past relative to 2026-07-12.
-- Columns: asset_id, holder_id, department_id, allocated_by, allocated_at,
-- expected_return_date, returned_at, return_notes.
-- ---------------------------------------------------------------------------
insert into allocations (asset_id, holder_id, department_id, allocated_by, allocated_at, expected_return_date, returned_at, return_notes) values
  ( 1,  4, 1, 2, '2025-02-01 09:20+00', null,         null, null),                                          -- AF-0001 -> Priya (open-ended)
  ( 4, 12, 2, 2, '2024-10-01 09:00+00', '2026-08-30', null, null),                                          -- AF-0004 -> Jonas
  ( 6,  4, 1, 2, '2023-01-09 09:00+00', null,         null, null),                                          -- AF-0006 -> Engineering pool (held by head Priya)
  ( 7,  9, 1, 2, '2026-04-02 09:00+00', '2026-07-05', null, null),                                          -- AF-0007 -> Tom  (OVERDUE)
  (13, 10, 1, 2, '2026-05-11 10:00+00', '2026-07-20', null, null),                                          -- AF-0013 -> Aisha
  (14, 17, 6, 3, '2026-06-28 15:10+00', '2026-07-15', null, null),                                          -- AF-0014 -> Sam
  (17, 13, 2, 2, '2026-05-02 09:00+00', '2026-08-02', null, null),                                          -- AF-0017 -> Leo
  (19, 15, 4, 2, '2026-04-04 09:00+00', '2026-07-04', null, null),                                          -- AF-0019 -> Femke (OVERDUE)
  (25,  2, 3, 1, '2026-04-02 09:00+00', '2026-07-02', null, null),                                          -- AF-0025 -> Daniel (OVERDUE)
  (27, 13, 2, 2, '2026-05-12 09:00+00', '2026-08-12', null, null),                                          -- AF-0027 -> Leo
  (29, 15, 4, 2, '2026-05-14 09:00+00', '2026-08-14', null, null),                                          -- AF-0029 -> Femke
  (37, 13, 2, 2, '2026-04-06 09:00+00', '2026-07-06', null, null),                                          -- AF-0037 -> Leo (OVERDUE)
  (39, 15, 4, 2, '2026-05-24 09:00+00', '2026-08-24', null, null),                                          -- AF-0039 -> Femke
  -- historical returns:
  ( 7, 11, 1, 2, '2024-05-20 09:00+00', '2026-03-30', '2026-03-28 16:40+00', 'Minor scuff on lid, otherwise good.'),   -- AF-0007 prev held by Kenji
  ( 5,  7, 4, 2, '2025-06-01 09:00+00', '2025-12-01', '2025-11-20 10:00+00', 'Returned in good condition at project end.'); -- AF-0005 prev held by Hannah

-- ---------------------------------------------------------------------------
-- Transfer requests against open allocations (allocation looked up by asset).
-- request_status enum has no 'completed', so a finished handover is 'approved'.
-- ---------------------------------------------------------------------------
insert into transfer_requests (allocation_id, requested_by, to_user_id, status, decided_by, decided_at, created_at) values
  ((select id from allocations where asset_id =  7 and returned_at is null),  9, 11, 'pending',  null, null,                  '2026-07-10 14:22+00'),  -- TR-031 Tom -> Kenji
  ((select id from allocations where asset_id = 13 and returned_at is null),  4,  4, 'approved', 2,    '2026-07-07 09:12+00', '2026-07-06 16:00+00'),  -- TR-029 Aisha -> Engineering pool
  ((select id from allocations where asset_id =  4 and returned_at is null),  5, 12, 'approved', 2,    '2026-06-12 10:05+00', '2026-06-11 14:00+00');  -- TR-024 Leo -> Jonas

-- ---------------------------------------------------------------------------
-- Bookings this week (demo "now" is Sun 2026-07-12). Overlap-proof by the
-- schema's EXCLUDE constraint; the seeded rows never overlap per resource.
-- ---------------------------------------------------------------------------
insert into bookings (asset_id, booked_by, slot, purpose, status, created_at) values
  (11,  4, tstzrange('2026-07-13 09:00+00', '2026-07-13 10:30+00'), 'Sprint 41 planning',        'upcoming',  '2026-07-08 10:00+00'), -- Boardroom Aurora
  (11,  7, tstzrange('2026-07-13 10:30+00', '2026-07-13 12:00+00'), 'Q3 budget review',          'upcoming',  '2026-07-08 11:00+00'),
  (11,  1, tstzrange('2026-07-14 14:00+00', '2026-07-14 16:00+00'), 'All-hands dry run',          'upcoming',  '2026-07-09 09:00+00'),
  (11,  5, tstzrange('2026-07-15 11:00+00', '2026-07-15 12:30+00'), 'Design crit — mobile app',   'upcoming',  '2026-07-09 15:00+00'),
  (11,  8, tstzrange('2026-07-16 09:30+00', '2026-07-16 11:00+00'), 'Onboarding cohort July',      'upcoming',  '2026-07-10 08:00+00'),
  (11,  6, tstzrange('2026-07-10 13:00+00', '2026-07-10 14:00+00'), 'Vendor negotiation',          'completed', '2026-07-07 09:00+00'),
  (11,  9, tstzrange('2026-07-09 15:00+00', '2026-07-09 16:00+00'), 'Arch review',                 'cancelled', '2026-07-06 09:00+00'),
  ( 8, 12, tstzrange('2026-07-14 13:00+00', '2026-07-14 17:00+00'), 'Client pitch — projector',    'upcoming',  '2026-07-09 11:15+00'), -- Epson projector
  ( 9, 13, tstzrange('2026-07-13 09:00+00', '2026-07-13 18:00+00'), 'Product photo shoot',         'upcoming',  '2026-07-08 10:00+00'), -- Canon kit
  (14, 14, tstzrange('2026-07-12 08:00+00', '2026-07-12 12:00+00'), 'Warehouse run — Depot 4',     'ongoing',   '2026-07-11 16:00+00'), -- VW van
  (12, 16, tstzrange('2026-07-13 13:00+00', '2026-07-13 15:00+00'), '1:1s block',                  'upcoming',  '2026-07-09 12:00+00'); -- Huddle Room Birch

-- ---------------------------------------------------------------------------
-- Maintenance requests — at least one in every pipeline stage. Approval gates
-- the work; approving flips the asset to under_maintenance, resolving frees it.
-- Columns: asset_id, raised_by, description, priority, photo_url, status,
-- decided_by, technician, resolved_at, created_at.
-- ---------------------------------------------------------------------------
insert into maintenance_requests (asset_id, raised_by, description, priority, photo_url, status, decided_by, technician, resolved_at, created_at) values
  ( 3, 17, 'Grinding noise from front brakes; brake pads likely worn below limit.', 'high',   'uploads/maintenance/mr-088.jpg', 'in_progress', 2, 'AutoServ GmbH', null,                  '2026-07-08 09:58+00'), -- MR-088
  (15, 14, 'Display flickers when input switches from HDMI 1 to 2.',                'medium', null,                             'pending',     null, null,          null,                  '2026-07-11 10:00+00'), -- MR-091
  (24, 12, 'PanaCast camera lens has a visible scratch; affects auto-framing.',     'low',    'uploads/maintenance/mr-092.jpg', 'pending',     null, null,          null,                  '2026-07-12 09:14+00'), -- MR-092
  (20, 11, 'Standing desk motor stalls above 90cm.',                                'medium', null,                             'assigned',    3, 'FixIT Desk',    null,                  '2026-07-05 10:00+00'), -- MR-087
  (40, 15, 'Printer toner streaks — request full drum replacement.',                'low',    null,                             'rejected',    2, null,            null,                  '2026-07-02 11:00+00'), -- MR-085
  (26,  4, 'ThinkPad P1 fan at 100% constantly, thermal shutdowns under load.',     'high',   'uploads/maintenance/mr-084.jpg', 'approved',    2, null,            null,                  '2026-06-30 09:00+00'), -- MR-084
  ( 8,  5, 'Projector lamp dim; replaced light source module.',                     'medium', null,                             'resolved',    2, 'AV Partners',   '2026-06-24 15:20+00', '2026-06-18 09:00+00'), -- MR-079
  ( 7,  9, 'Two dead pixels top-right; panel replaced under warranty.',             'low',    'uploads/maintenance/mr-072.jpg', 'resolved',    2, 'FixIT Desk',    '2026-05-21 14:00+00', '2026-05-14 09:00+00'), -- MR-072
  ( 3,  3, '15,000 km scheduled service.',                                          'medium', null,                             'resolved',    2, 'AutoServ GmbH', '2026-04-05 12:00+00', '2026-04-03 09:00+00'); -- MR-069

-- ---------------------------------------------------------------------------
-- Audit cycles: one in progress (AU-07) plus two closed for history.
-- ---------------------------------------------------------------------------
insert into audit_cycles (name, department_id, location, starts_on, ends_on, closed_at, created_by) values
  ('Q3 2026 — HQ Floor 2',       null, 'HQ · Floor 2', '2026-07-06', '2026-07-24', null,                  1),  -- 1 (AU-07, in progress)
  ('Q1 2026 — Finance dept',     4,    null,           '2026-01-12', '2026-01-30', '2026-01-30 17:00+00', 1),  -- 2 (AU-05, closed)
  ('FY25 year-end — Vehicles',   6,    null,           '2025-12-01', '2025-12-12', '2025-12-12 17:00+00', 1);  -- 3 (AU-04, closed)

insert into audit_assignments (cycle_id, auditor_id) values
  (1, 2), (1, 14),   -- AU-07: Daniel, Rosa
  (2, 3),            -- AU-05: Lena
  (3, 3), (3, 17);   -- AU-04: Lena, Sam

-- Audit records — only assets that have actually been checked. AU-07 has 6 of
-- 10 in-scope assets marked (still in progress); the closed cycles are complete.
insert into audit_records (cycle_id, asset_id, auditor_id, result, notes, checked_at) values
  (1,  1,  2, 'verified', null,                                                  '2026-07-11 09:30+00'),
  (1,  6,  2, 'verified', null,                                                  '2026-07-11 09:35+00'),
  (1,  7,  2, 'verified', 'With Tom Becker, confirmed in person.',               '2026-07-11 09:40+00'),
  (1, 12,  2, 'verified', null,                                                  '2026-07-11 09:45+00'),
  (1, 13, 14, 'damaged',  'Cracked corner on display bezel.',                    '2026-07-11 14:48+00'),
  (1, 20, 14, 'missing',  'Not at listed desk; last seen in Workshop Studio.',   '2026-07-11 16:05+00'),
  (2,  5,  3, 'verified', null,                                                  '2026-01-20 11:00+00'),
  (2, 10,  3, 'missing',  'Not found in any Finance area; flagged to Asset Manager.', '2026-01-22 11:00+00'),
  (2, 29,  3, 'verified', null,                                                  '2026-01-20 11:10+00'),
  (2, 40,  3, 'damaged',  'Feed tray hinge broken.',                             '2026-01-24 11:00+00'),
  (3,  3,  3, 'verified', null,                                                  '2025-12-05 10:00+00'),
  (3, 14,  3, 'verified', null,                                                  '2025-12-05 10:10+00'),
  (3, 33, 17, 'verified', null,                                                  '2025-12-06 10:00+00');

-- ---------------------------------------------------------------------------
-- Notifications — one row per recipient (payload carries title + body).
-- read_at null == unread.
-- ---------------------------------------------------------------------------
insert into notifications (user_id, type, payload, read_at, created_at) values
  (1, 'overdue', '{"title":"Overdue return — AF-0007","body":"MacBook Pro 14\" was due back Jul 5 from Tom Becker."}'::jsonb, null, '2026-07-12 08:00+00'),
  (2, 'overdue', '{"title":"Overdue return — AF-0007","body":"MacBook Pro 14\" was due back Jul 5 from Tom Becker."}'::jsonb, null, '2026-07-12 08:00+00'),
  (4, 'overdue', '{"title":"Overdue return — AF-0007","body":"MacBook Pro 14\" was due back Jul 5 from Tom Becker."}'::jsonb, null, '2026-07-12 08:00+00'),
  (9, 'overdue', '{"title":"Overdue return — AF-0007","body":"MacBook Pro 14\" was due back Jul 5 from Tom Becker."}'::jsonb, null, '2026-07-12 08:00+00'),
  (2, 'transfer', '{"title":"Transfer requested — AF-0007","body":"Tom Becker requested transfer to Kenji Sato."}'::jsonb, null, '2026-07-10 14:22+00'),
  (4, 'transfer', '{"title":"Transfer requested — AF-0007","body":"Tom Becker requested transfer to Kenji Sato."}'::jsonb, null, '2026-07-10 14:22+00'),
  (1, 'transfer', '{"title":"Transfer requested — AF-0007","body":"Tom Becker requested transfer to Kenji Sato."}'::jsonb, null, '2026-07-10 14:22+00'),
  (4, 'maintenance', '{"title":"Maintenance approved — MR-084","body":"ThinkPad P1 thermal issue approved by Daniel Reyes."}'::jsonb, '2026-07-01 18:30+00', '2026-07-01 09:40+00'),
  (1, 'maintenance', '{"title":"Maintenance approved — MR-084","body":"ThinkPad P1 thermal issue approved by Daniel Reyes."}'::jsonb, '2026-07-01 18:30+00', '2026-07-01 09:40+00'),
  (4, 'booking', '{"title":"Booking reminder — Boardroom Aurora","body":"Sprint 41 planning starts tomorrow 09:00."}'::jsonb, null, '2026-07-12 09:00+00'),
  (1, 'audit', '{"title":"Audit discrepancy — AF-0020","body":"Standing Desk Bekant marked Missing in Q3 HQ Floor 2 audit."}'::jsonb, null, '2026-07-11 16:05+00'),
  (2, 'audit', '{"title":"Audit discrepancy — AF-0020","body":"Standing Desk Bekant marked Missing in Q3 HQ Floor 2 audit."}'::jsonb, null, '2026-07-11 16:05+00'),
  (12, 'booking', '{"title":"Booking confirmed — BK-207","body":"Epson projector booked Jul 14, 13:00–17:00."}'::jsonb, '2026-07-09 18:30+00', '2026-07-09 11:15+00'),
  (5, 'booking', '{"title":"Booking confirmed — BK-207","body":"Epson projector booked Jul 14, 13:00–17:00."}'::jsonb, '2026-07-09 18:30+00', '2026-07-09 11:15+00'),
  (10, 'assigned', '{"title":"Asset assigned — AF-0013","body":"Dell XPS 13 allocated to Aisha Bello, return by Jul 20."}'::jsonb, '2026-05-11 18:30+00', '2026-05-11 10:00+00'),
  (4, 'assigned', '{"title":"Asset assigned — AF-0013","body":"Dell XPS 13 allocated to Aisha Bello, return by Jul 20."}'::jsonb, '2026-05-11 18:30+00', '2026-05-11 10:00+00'),
  (15, 'maintenance', '{"title":"Maintenance rejected — MR-085","body":"Printer drum replacement rejected: cartridge swap from stock."}'::jsonb, '2026-07-03 18:30+00', '2026-07-03 13:30+00'),
  (7, 'maintenance', '{"title":"Maintenance rejected — MR-085","body":"Printer drum replacement rejected: cartridge swap from stock."}'::jsonb, '2026-07-03 18:30+00', '2026-07-03 13:30+00'),
  (4, 'transfer', '{"title":"Transfer approved — TR-029","body":"AF-0013 approved to move to Engineering pool."}'::jsonb, null, '2026-07-07 09:12+00'),
  (10, 'transfer', '{"title":"Transfer approved — TR-029","body":"AF-0013 approved to move to Engineering pool."}'::jsonb, null, '2026-07-07 09:12+00'),
  (1, 'transfer', '{"title":"Transfer approved — TR-029","body":"AF-0013 approved to move to Engineering pool."}'::jsonb, null, '2026-07-07 09:12+00'),
  (9, 'booking', '{"title":"Booking cancelled — BK-196","body":"Arch review in Boardroom Aurora was cancelled."}'::jsonb, '2026-07-08 18:30+00', '2026-07-08 17:44+00'),
  (4, 'booking', '{"title":"Booking cancelled — BK-196","body":"Arch review in Boardroom Aurora was cancelled."}'::jsonb, '2026-07-08 18:30+00', '2026-07-08 17:44+00'),
  (3, 'overdue', '{"title":"Return due in 3 days — AF-0014","body":"VW ID. Buzz Cargo due back Jul 15 from Sam O''Neill."}'::jsonb, null, '2026-07-12 07:30+00'),
  (17, 'overdue', '{"title":"Return due in 3 days — AF-0014","body":"VW ID. Buzz Cargo due back Jul 15 from Sam O''Neill."}'::jsonb, null, '2026-07-12 07:30+00'),
  (5, 'maintenance', '{"title":"Maintenance resolved — MR-079","body":"Projector light source replaced; asset back to Available."}'::jsonb, '2026-06-24 18:30+00', '2026-06-24 15:20+00'),
  (1, 'maintenance', '{"title":"Maintenance resolved — MR-079","body":"Projector light source replaced; asset back to Available."}'::jsonb, '2026-06-24 18:30+00', '2026-06-24 15:20+00'),
  (2, 'maintenance', '{"title":"Maintenance resolved — MR-079","body":"Projector light source replaced; asset back to Available."}'::jsonb, '2026-06-24 18:30+00', '2026-06-24 15:20+00');

-- ---------------------------------------------------------------------------
-- Activity log — the org-wide audit trail. actor_id null == system action.
-- Columns: actor_id, action, entity, created_at.
-- ---------------------------------------------------------------------------
insert into activity_log (actor_id, action, entity, created_at) values
  (12, 'Raised MR-092 for AF-0024 (PanaCast lens scratch)', 'Maintenance', '2026-07-12 09:14+00'),
  (null, 'Flagged AF-0007 as overdue (expected return Jul 5)', 'Allocation', '2026-07-12 08:00+00'),
  (14, 'Marked AF-0020 Missing in AU-07 with note', 'Audit', '2026-07-11 16:05+00'),
  (14, 'Marked AF-0013 Damaged in AU-07 — “cracked bezel corner”', 'Audit', '2026-07-11 14:48+00'),
  (2, 'Verified 4 assets in AU-07 (HQ Floor 2)', 'Audit', '2026-07-11 09:30+00'),
  (9, 'Requested TR-031: AF-0007 → Kenji Sato', 'Transfer', '2026-07-10 14:22+00'),
  (3, 'Updated MR-088 to In Progress — parts ordered', 'Maintenance', '2026-07-10 11:02+00'),
  (12, 'Booked AF-0008 (Epson projector) Jul 14 13:00–17:00', 'Booking', '2026-07-09 11:15+00'),
  (9, 'Cancelled BK-196 (Arch review, Boardroom Aurora)', 'Booking', '2026-07-08 17:44+00'),
  (2, 'Approved MR-088 (Transit van brakes), asset → Under Maintenance', 'Maintenance', '2026-07-08 10:15+00'),
  (17, 'Raised MR-088 for AF-0003 with photo', 'Maintenance', '2026-07-08 09:58+00'),
  (2, 'Approved TR-029: AF-0013 → Engineering pool', 'Transfer', '2026-07-07 09:12+00'),
  (1, 'Opened audit cycle AU-07 (HQ Floor 2, Jul 6–24), auditors Daniel & Rosa', 'Audit', '2026-07-06 08:30+00'),
  (2, 'Rejected MR-085 — cartridge swap from stock', 'Maintenance', '2026-07-03 13:30+00'),
  (2, 'Approved MR-084 (ThinkPad P1 thermals)', 'Maintenance', '2026-07-01 09:40+00'),
  (3, 'Allocated AF-0014 to Sam O''Neill, return by Jul 15', 'Allocation', '2026-06-28 15:10+00'),
  (2, 'Resolved MR-079; AF-0008 → Available', 'Maintenance', '2026-06-24 15:20+00'),
  (5, 'Requested TR-024: AF-0004 Leo → Jonas', 'Transfer', '2026-06-12 10:05+00'),
  (2, 'Allocated AF-0013 to Aisha Bello', 'Allocation', '2026-05-11 10:00+00'),
  (2, 'Allocated AF-0007 to Tom Becker, return by Jul 5', 'Allocation', '2026-04-02 09:00+00'),
  (2, 'Checked in AF-0007 from Kenji Sato — “minor scuff on lid”', 'Return', '2026-03-28 16:40+00'),
  (2, 'Allocated AF-0001 to Priya Sharma (no return date)', 'Allocation', '2026-02-01 09:20+00'),
  (1, 'Closed AU-05; AF-0010 confirmed Lost', 'Audit', '2026-01-30 17:00+00');

commit;
