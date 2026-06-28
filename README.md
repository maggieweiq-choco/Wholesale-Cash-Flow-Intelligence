# Wholesale Cash Flow Intelligence

> **H0 Hackathon · B2B Track · Jun 2026**
>
> Tells wholesale business owners: "On day 45, you'll be short $23,000 — should you liquidate inventory or take a loan?"

---

## The Problem

Wholesalers get squeezed from both sides: cash locked in warehouse inventory and cash locked in customer payment terms (net 30/60/90). Most owners manage this with Excel or gut instinct — both wildly inaccurate.

This app uses AI agents to analyze SKU sales history, current inventory, outstanding invoices, and vendor payment schedules to:
- Show a deterministic 90-day cash runway built from real AR/AP data
- Surface exactly which slow-moving SKUs and overdue customers are causing the squeeze
- Recommend whether to liquidate inventory, chase payments, or take financing — with true APR comparisons

---

## Dashboard Sections

### 1. Cash Flow
Two views under one section:

**Projection (deterministic, instant)**
- Daily cash balance for the full horizon, built directly from Aurora data — no LLM call on load
- Real AP due dates drive outflows (falls back to demo scheduled events if no payables are loaded)
- AR inflows use each customer's historical average days-late to shift expected payment dates conservatively; overdue invoices (past the window) are excluded and called out separately
- **Cash vs Accrual P&L dual-line chart** — cash line shows actual timing; accrual line shows gross profit minus amortized opex so the gap between the two lines equals AR + inventory − AP (working capital deployed)
- **Working Capital KPIs** — AR Outstanding / AP Outstanding / Net AR−AP derived from live projection data
- **Overdue AR simulation** — amber banner shows the excluded overdue total with a "What if collected today?" button that re-runs the projection with that amount as a day-0 inflow
- **Capital injection what-if** — add a planned equity draw or loan disbursement on a specific future date and see the curve update immediately
- Rule-based risk alerts: cash breakpoint date, large outflow clusters, overdue AR coverage, customer concentration risk

**Forecast (AI-generated, saved)**
- Single 90-day Claude run stored in Aurora; slice to 30/60/90d client-side
- Re-run on demand or via daily Vercel Cron
- Horizon toggle with lowest balance and first gap date

### 2. Dead Stock
Slow-moving SKU analysis driven entirely by Aurora data:
- Days of supply = **(on-hand + WIP) / avg daily velocity** — WIP included so in-progress stock isn't ignored
- Tier assignment (A/B/C/D) by sales velocity — deterministic, not AI-chosen
- Suggested liquidation discount by tier (0% / 15% / 30% / 45%)
- Vendor-specific negotiation tip (consignment, extended terms) using actual supplier name from inventory data
- KPIs: Days of Inventory Outstanding, on-hand value, WIP value, avg daily COGS, total supply units
- Stacked on-hand vs WIP chart by tier or vendor
- Inventory value × days-of-supply bubble chart (bubble size = discount %)
- Discount distribution bar chart
- Full searchable/filterable SKU table with export link

### 3. Purchasing Recommendations
- Reorder queue for SKUs below safety stock, ranked by urgency (critical / high / medium / low)
- Tier-filtered and urgency-filtered table
- Estimated spend per SKU

### 4. Collections Priority
- Overdue invoice board ranked by age × amount × customer payment score
- Customer payment score derived from historical days-late across all their past invoices

### 5. Upcoming Bills
- Vendor payment queue ranked by due-date proximity and amount
- Feeds into the cash projection when payables data is loaded

### 6. Financing Recommendation
- Gap amount auto-populated from the projection's worst cash deficit
- APR-normalized comparison table: Bank Loan / AR Finance / Liquidate Inventory
- APR = (cost ÷ raised) × (365 ÷ days) — only for time-priced instruments; liquidation shows "one-time haircut" to avoid misleading annualization of a 33% → ~240% APR
- Columns: Option | Cash Raised | Cost per $1 | Liquidity Days | APR

---

## Architecture

```
Browser (Next.js App Router, React, Tailwind, Recharts)
    │
    ├── /api/projection  ── deterministic AR/AP → daily cash curve (no LLM)
    ├── /api/forecast    ── saves / serves Claude 90-day run
    ├── /api/inventory   ── dead stock + WIP metrics
    ├── /api/purchasing  ── reorder recommendations
    ├── /api/receivables ── collections priority
    ├── /api/payables    ── upcoming bills
    ├── /api/financing   ── APR-normalized options
    ├── /api/upload      ── CSV → DynamoDB
    ├── /api/normalize   ── DynamoDB → Aurora
    ├── /api/seed        ── loads sample data
    └── /api/cron        ── daily forecast refresh (Vercel Cron)
         │
         ├── Claude API (claude-3-5-sonnet) — tool-use for structured agent output
         ├── DynamoDB — raw uploaded CSV rows (companyId PK, rowId SK)
         └── Aurora PostgreSQL Serverless v2 — cleaned tables via RDS Data API
```

### Aurora Tables (drizzle-orm schema)

| Table | Contents |
|---|---|
| `sku_sales_history` | Daily sales transactions per SKU |
| `inventory` | On-hand qty, WIP qty, unit cost, vendor info, lead time |
| `invoices` | AR: customer bills with issue/due/paid dates |
| `customers` | Payment behavior derived from invoice history |
| `payables` | AP: vendor bills with issue/due/paid dates |
| `vendors` | Vendor master |
| `cash_flow_forecast` | Saved 90-day AI forecast rows |

### AI Agents (`/agents/`)

| Agent | Role |
|---|---|
| `cashflow-agent.ts` | 90-day cash flow forecast |
| `inventory-agent.ts` | Dead stock ranking + vendor negotiation copy |
| `receivables-agent.ts` | Collections priority board |
| `payables-agent.ts` | Upcoming bills ranking |
| `purchasing-agent.ts` | Reorder recommendations with urgency |
| `financing-agent.ts` | APR-normalized financing comparison |

All agents use Claude's tool-use API to return structured JSON — no free-form text parsing.

### Key Design Decisions

- **Deterministic projection is separate from the AI forecast.** `/api/projection` runs on every page load with zero LLM cost. The AI forecast is a separate saved run the user triggers manually (or via cron).
- **Real payables replace hardcoded demo events.** When the `payables` table has data, AP due dates drive projection outflows. If empty, it falls back to demo scheduled events so the app works before any data is loaded.
- **WIP included in days-of-supply.** `daysOfSupply = (qtyOnHand + qtyWip) / avgDailyVelocity` — ignoring WIP understates available supply and inflates the reorder queue.
- **APR normalization.** Liquidating inventory at a 33% haircut is not comparable to a 10% annual loan. The financing table shows true annualized APR only for time-priced instruments.
- **Dual-line cash vs profit chart.** The vertical gap between the cash balance line and the accrual P&L line at any point in time equals the working capital deployed in AR + inventory − AP — visually explaining why profitable businesses run out of cash.

---

## Data Flow

```
1. Upload CSVs  →  DynamoDB (raw, idempotent — deduped by content key)
2. Normalize    →  Aurora (typed tables + derived customers/vendors)
3. On load      →  /api/projection reads AR + AP from Aurora → daily cash curve
4. On demand    →  Claude agents read Aurora → ranked lists + forecast
5. Daily cron   →  re-runs forecast, keeps timeline current
```

CSV formats accepted:

| File | Required Columns |
|---|---|
| `sales.csv` | `sku`, `sold_qty`, `revenue`, `sold_at` |
| `inventory.csv` | `sku`, `qty_on_hand`, `unit_cost` (+ optional: `qty_wip`, `vendor_name`, `vendor_lead_time_days`, `return_rate_pct`, `obsolete_risk`) |
| `invoices.csv` | `customer_id`, `customer_name`, `amount`, `issued_at`, `due_at` (+ optional: `paid_at`) |
| `payables.csv` | `vendor_id`, `vendor_name`, `amount`, `issued_at`, `due_at` (+ optional: `paid_at`) |

---

## Local Development

See [SETUP.md](SETUP.md) for full AWS provisioning steps.

```bash
npm install
npm run dev          # http://localhost:3000
./seed.sh            # load sample data (requires app running)
```

Env vars needed (`.env.local`):

```
ANTHROPIC_API_KEY=
APP_AWS_ACCESS_KEY_ID=       # note: APP_ prefix avoids Vercel runtime conflict
APP_AWS_SECRET_ACCESS_KEY=
AWS_REGION=
DYNAMO_TABLE_NAME=cashflow-raw
AURORA_DATABASE=cashflow
AURORA_CLUSTER_ARN=
AURORA_SECRET_ARN=
CRON_SECRET=
```

---

## Roadmap

**ERP / Accounting Integrations** — CSV upload is the MVP path. Direct integrations would sync data automatically:

| System | Data |
|---|---|
| QuickBooks Online | Invoices, AR aging, customer payment history |
| NetSuite | Sales orders, inventory, customer terms |
| Cin7 / Fishbowl | Warehouse stock, SKU movement |
| Odoo | Sales history, stock levels, purchase orders |

Each would connect via OAuth2 into the same DynamoDB → Aurora normalization pipeline — no agent or dashboard changes needed, only the ingestion source.

**Purchasing → Projection feedback** — purchasing recommendations (estimated reorder spend × lead time) could appear as projected AP outflows in the cash timeline automatically.

---

## Judging Criteria

| Criteria | Implementation |
|---|---|
| Technical | Dual-database (DynamoDB + Aurora), Claude tool-use, deterministic projection + AI forecast separation |
| Design | Clean data-focused dashboard, working capital narrative told through the dual-line chart |
| Real-World Impact | Direct answer to "will I run out of cash and what do I do about it" for wholesale SMBs |
| Originality | Inventory + receivables + payables + cash flow + financing in one tool, with accrual vs cash gap explained visually |
