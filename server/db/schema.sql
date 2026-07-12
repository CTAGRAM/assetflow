-- AssetFlow schema. PostgreSQL 16.
-- Rules that can be constraints are constraints; the API only adds what needs context.

create extension if not exists btree_gist;

create type user_role as enum ('admin', 'asset_manager', 'department_head', 'employee');
create type asset_status as enum ('available', 'allocated', 'reserved', 'under_maintenance', 'lost', 'retired', 'disposed');
create type request_status as enum ('pending', 'approved', 'rejected');
create type maintenance_status as enum ('pending', 'approved', 'rejected', 'assigned', 'in_progress', 'resolved');
create type booking_status as enum ('upcoming', 'ongoing', 'completed', 'cancelled');
create type audit_result as enum ('verified', 'missing', 'damaged');

create table departments (
    id serial primary key,
    name text not null unique,
    parent_id int references departments (id),
    is_active boolean not null default true
);

create table users (
    id serial primary key,
    name text not null,
    email text not null,
    password_hash text not null,
    role user_role not null default 'employee',
    department_id int references departments (id),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);
create unique index users_email_key on users (lower(email));

-- added after users exists to break the circular reference
alter table departments add column head_id int references users (id);

create table asset_categories (
    id serial primary key,
    name text not null unique,
    -- category-specific field definitions, e.g. [{"name": "warranty_months", "type": "number"}]
    extra_fields jsonb not null default '[]',
    is_active boolean not null default true
);

create sequence asset_tag_seq;

create table assets (
    id serial primary key,
    tag text not null unique default 'AF-' || lpad(nextval('asset_tag_seq')::text, 4, '0'),
    name text not null,
    category_id int not null references asset_categories (id),
    serial_number text,
    acquisition_date date,
    acquisition_cost numeric(12, 2) check (acquisition_cost >= 0),
    condition text,
    location text,
    photo_url text,
    -- values for the category's extra_fields
    extra jsonb not null default '{}',
    is_bookable boolean not null default false,
    status asset_status not null default 'available',
    created_by int not null references users (id),
    created_at timestamptz not null default now()
);

create table allocations (
    id serial primary key,
    asset_id int not null references assets (id),
    holder_id int not null references users (id),
    department_id int references departments (id),
    allocated_by int not null references users (id),
    allocated_at timestamptz not null default now(),
    expected_return_date date,
    returned_at timestamptz,
    return_notes text
);
-- the conflict rule: an asset has at most one open allocation
create unique index one_open_allocation_per_asset
    on allocations (asset_id) where returned_at is null;
create index allocations_open_by_holder
    on allocations (holder_id) where returned_at is null;

create table transfer_requests (
    id serial primary key,
    allocation_id int not null references allocations (id),
    requested_by int not null references users (id),
    to_user_id int not null references users (id),
    status request_status not null default 'pending',
    decided_by int references users (id),
    decided_at timestamptz,
    created_at timestamptz not null default now()
);

create table bookings (
    id serial primary key,
    asset_id int not null references assets (id),
    booked_by int not null references users (id),
    slot tstzrange not null check (not isempty(slot)),
    purpose text,
    status booking_status not null default 'upcoming',
    created_at timestamptz not null default now(),
    -- the overlap rule: same resource, intersecting slot, the insert itself fails,
    -- which holds even under concurrent requests
    exclude using gist (asset_id with =, slot with &&) where (status <> 'cancelled')
);

create table maintenance_requests (
    id serial primary key,
    asset_id int not null references assets (id),
    raised_by int not null references users (id),
    description text not null,
    priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
    photo_url text,
    status maintenance_status not null default 'pending',
    decided_by int references users (id),
    technician text,
    resolved_at timestamptz,
    created_at timestamptz not null default now()
);

create table audit_cycles (
    id serial primary key,
    name text not null,
    department_id int references departments (id),
    location text,
    starts_on date not null,
    ends_on date not null,
    closed_at timestamptz,
    created_by int not null references users (id),
    check (ends_on >= starts_on)
);

create table audit_assignments (
    cycle_id int not null references audit_cycles (id),
    auditor_id int not null references users (id),
    primary key (cycle_id, auditor_id)
);

create table audit_records (
    id serial primary key,
    cycle_id int not null references audit_cycles (id),
    asset_id int not null references assets (id),
    auditor_id int not null references users (id),
    result audit_result not null,
    notes text,
    checked_at timestamptz not null default now(),
    unique (cycle_id, asset_id)
);

create table notifications (
    id serial primary key,
    user_id int not null references users (id),
    type text not null,
    payload jsonb not null default '{}',
    read_at timestamptz,
    created_at timestamptz not null default now()
);
create index notifications_unread on notifications (user_id) where read_at is null;

create table activity_log (
    id serial primary key,
    actor_id int references users (id),
    action text not null,
    entity text not null,
    entity_id int,
    details jsonb not null default '{}',
    created_at timestamptz not null default now()
);

create index assets_by_status on assets (status);
create index bookings_by_asset on bookings (asset_id);
