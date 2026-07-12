# AssetFlow API

Base URL `http://localhost:3000/api`. Everything except signup/login needs `Authorization: Bearer <token>`.

Error shapes: field problems come back as `400 {"errors": {"field": "message"}}`, business conflicts as `409 {"error": "message"}` (allocation conflicts add `"suggestion": "transfer"`), permission issues as `403 {"error": ...}`.

Roles: `admin`, `asset_manager`, `department_head`, `employee`. "manager" below means admin, asset_manager or department_head.

## Auth
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/auth/signup` | public | `{name, email, password}`; always creates an employee |
| POST | `/auth/login` | public | `{email, password}` returns `{token, user}` |
| GET | `/auth/me` | any | current user |

## Organization
| POST | `/departments` | admin | `{name, parent_id?, head_id?}` |
|---|---|---|---|
| GET | `/departments` | any | includes head_name, parent_name, member_count |
| PATCH | `/departments/:id` | admin | name, parent_id, head_id, is_active |
| GET/POST/PATCH | `/categories`, `/categories/:id` | GET any, write admin | `extra_fields` is a JSON list of field defs |
| GET | `/employees?search=` | any | directory with department_name |
| PATCH | `/employees/:id` | admin | role, department_id, is_active; cannot change self |

## Assets
| GET | `/assets?search=&category_id=&status=&location=&bookable=` | any | includes holder_name when allocated |
|---|---|---|---|
| GET | `/assets/:id` | any | plus `allocations[]` and `maintenance[]` history |
| POST | `/assets` | admin, asset_manager | name + category_id required; tag auto-assigned |
| PATCH | `/assets/:id` | admin, asset_manager | manual status only available/reserved/lost/retired/disposed, blocked while held |

## Allocation and transfer
| GET | `/allocations?open=&overdue=&holder_id=&mine=` | any | `overdue` flag computed |
|---|---|---|---|
| POST | `/allocations` | manager | `{asset_id, holder_id, department_id?, expected_return_date?}`; 409 names the holder |
| POST | `/allocations/:id/return` | manager | `{notes?}`; asset back to available |
| GET | `/transfers?status=` | any | with asset + people names |
| POST | `/transfers` | any | `{allocation_id, to_user_id}` |
| POST | `/transfers/:id/decide` | manager | `{approve: bool}`; approve re-allocates atomically |

## Bookings
| GET | `/bookings?asset_id=&mine=&from=&to=` | any | status derived: upcoming/ongoing/completed/cancelled |
|---|---|---|---|
| POST | `/bookings` | any | `{asset_id, starts_at, ends_at, purpose?}`; 409 on overlap names the clash |
| PATCH | `/bookings/:id` | booker or manager | reschedule `{starts_at, ends_at}` |
| POST | `/bookings/:id/cancel` | booker or manager | frees the slot |

## Maintenance
| GET | `/maintenance?status=&asset_id=&mine=` | any | |
|---|---|---|---|
| POST | `/maintenance` | any | `{asset_id, description, priority?, photo_url?}` |
| POST | `/maintenance/:id/decide` | admin, asset_manager | `{approve}`; approve flips asset to under_maintenance |
| POST | `/maintenance/:id/assign` | admin, asset_manager | `{technician}` |
| POST | `/maintenance/:id/start` | admin, asset_manager | |
| POST | `/maintenance/:id/resolve` | admin, asset_manager | asset back to allocated/available |

## Audits
| GET | `/audits` | any | with progress counts and auditor names |
|---|---|---|---|
| POST | `/audits` | admin | `{name, starts_on, ends_on, auditor_ids[], department_id?, location?}` |
| GET | `/audits/:id` | any | scope assets each with their record (or null) |
| POST | `/audits/:id/records` | assigned auditor | `{asset_id, result: verified\|missing\|damaged, notes?}`; upserts |
| GET | `/audits/:id/discrepancies` | any | non-verified records |
| POST | `/audits/:id/close` | admin | locks cycle, missing assets become lost, returns summary |

## Reports and feeds
| GET | `/reports/summary` | any | dashboard KPI counts |
|---|---|---|---|
| GET | `/reports/utilization` | any | held days + booked hours per asset, 90d |
| GET | `/reports/maintenance-frequency` | any | per asset |
| GET | `/reports/booking-heatmap` | any | `{weekday, hour, bookings}` rows |
| GET | `/reports/department-allocation` | any | open allocations per department |
| GET | `/notifications` | any | own feed + unread count |
| POST | `/notifications/:id/read`, `/notifications/read-all` | any | |
| GET | `/activity?entity=&user_id=&from=&to=` | any | managers see all, employees their own |
