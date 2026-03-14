# Database Schema (PostgreSQL)

## Tables

### users

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| email | TEXT UNIQUE NOT NULL | |
| password_hash | TEXT NOT NULL | |
| name | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### bot_templates

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| name | TEXT NOT NULL | |
| description | TEXT | |
| system_prompt | TEXT NOT NULL | |
| allowed_tools | TEXT[] | e.g. ['browse','http','read_file','write_file'] |
| schedule_cron | TEXT | optional cron for “wake windows” |
| max_runtime_minutes | INT | |
| max_tokens_per_run | INT | |
| max_spend_cents | INT | |
| startup_actions | JSONB | optional list of first actions |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### bots

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| user_id | UUID FK(users) | |
| template_id | UUID FK(bot_templates) | |
| name | TEXT | user-defined |
| status | TEXT | pending \| running \| stopped \| error |
| config_snapshot | JSONB | template config at creation time |
| droplet_id | TEXT | DO droplet id |
| container_id | TEXT | Docker container id |
| last_heartbeat_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### bot_runs

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| bot_id | UUID FK(bots) | |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | nullable |
| status | TEXT | running \| completed \| failed \| stopped |
| tokens_used | INT | |
| spend_cents | INT | |
| summary | TEXT | optional |

### bot_logs

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| bot_id | UUID FK(bots) | |
| run_id | UUID FK(bot_runs) | nullable |
| level | TEXT | info \| warn \| error \| action |
| message | TEXT | |
| meta | JSONB | tool name, args, result summary, etc. |
| created_at | TIMESTAMPTZ | |

### bot_memory

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| bot_id | UUID FK(bots) | |
| key | TEXT | e.g. 'last_url', 'discovered_domains' |
| value | JSONB | |
| updated_at | TIMESTAMPTZ | |
| UNIQUE(bot_id, key) | | |

### usage

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| user_id | UUID FK(users) | |
| period_start | DATE | |
| period_end | DATE | |
| api_calls | INT | |
| tokens_input | INT | |
| tokens_output | INT | |
| spend_cents | INT | |

### billing

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| user_id | UUID FK(users) | |
| amount_cents | INT | |
| currency | TEXT | |
| status | TEXT | pending \| paid \| failed |
| stripe_id | TEXT | optional |
| created_at | TIMESTAMPTZ | |
