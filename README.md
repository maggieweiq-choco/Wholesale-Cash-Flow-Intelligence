# Wholesale Cash Flow Intelligence

> **H0 Hackathon · B2B Track · Jun 29 2026**
>
> Tells wholesale business owners: "On day 45, you'll be short $23,000 — should you liquidate inventory or take a loan?"

---

## Overview

Wholesalers get squeezed from both sides: cash locked in warehouse inventory and cash locked in customer payment terms (net 30/60/90). Most owners manage this with Excel spreadsheets or gut instinct — both wildly inaccurate.

This app uses AI agents to analyze SKU sales history, current inventory, outstanding invoices, and supplier payment schedules to forecast a 90-day cash flow timeline and recommend whether to liquidate slow stock, chase overdue payments, or secure financing — and in what order.

---

## Features

| Feature | Description |
|---|----|
| Cash Flow Timeline | Daily cash position for the next 90 days with gap alerts |
| Dead Stock List | Slow-moving SKUs ranked by days-of-supply, with a suggested discount, a JIT/reorder recommendation to cut holding costs, and a vendor-negotiation tip (consignment / extended terms) |
| Collections Priority | Overdue invoices ranked by aging × amount × late-payment probability |
| Financing Recommendation | How much to borrow, for how long, and how liquidation offsets the gap |
| Audit Compliance Alert | Flags receivables approaching the 90-day write-off threshold |

---

## Architecture

- **Frontend** — Next.js dashboard (v0-generated), deployed on Vercel
- **AI Layer** — Claude API agents turn raw sales/inventory/invoice data into a forecast and recommendation
- **Storage** — DynamoDB holds raw uploaded data; Aurora PostgreSQL holds the cleaned, structured tables the agents and dashboard query
- **Scheduling** — Vercel Cron refreshes the forecast daily

## Data Flow

1. User uploads CSVs (sales, inventory, invoices) → stored as raw rows in DynamoDB
2. Raw data is cleaned and normalized into Aurora
3. Claude agents query Aurora to compute the cash flow gap, rank dead stock and overdue receivables, and compare financing options
4. Dashboard reads the results from Aurora and renders the timeline, tables, and recommendation
5. Cron job re-runs the forecast daily so the timeline stays current

---

## Roadmap

**ERP / Accounting Integrations** — Manual CSV upload is the MVP data path for this hackathon. The natural next step is direct integration with the systems wholesalers already run their business on, so sales, inventory, and invoice data sync automatically and the upload step disappears entirely:

| System | Data Synced |
|---|---|
| QuickBooks Online | Invoices, customer payment history, AR aging |
| NetSuite | Sales orders, inventory levels, customer terms |
| Odoo | SKU sales history, stock levels, purchase orders |
| Cin7 / Fishbowl | Warehouse inventory, SKU movement |
| Sage / Acumatica | Invoices, supplier payment schedules |

Each would connect via the vendor's OAuth2 API, with a scheduled pull (reusing the existing Vercel Cron pattern) feeding the same DynamoDB → Aurora normalization pipeline that CSV uploads use today — so the agents and dashboard don't need to change, only the ingestion source.

---

## Local Development

```bash
npm install
npm run dev
```

---

## Judging Criteria

| Criteria | Implementation |
|---|---|
| Technical Implementation | Dual-database architecture, Claude tool-use for structured output, full AWS ecosystem |
| Design | v0-generated dashboard, clean data-focused UI with a clear cash flow timeline |
| Real-World Impact | Addresses a genuine pain point for wholesale SMBs, output is directly actionable |
| Originality | Inventory + receivables + cash flow + financing in one tool — no direct competitor for this market segment |
