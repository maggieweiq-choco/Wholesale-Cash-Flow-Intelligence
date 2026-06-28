# Dev Update

- Agents (forecast, financing, etc.) now run on real Aurora data, with an ETL pipeline cleaning raw uploads into typed tables.
- Added username-based login/signup with per-tenant data isolation — `companyId` now comes from the session everywhere instead of being a free-typed field.
- Redesigned Dashboard, Upload, Inventory, Receivables, and Financing with a consistent UI, plus a one-click sample-data loader.
- Added a Days of Inventory Outstanding metric and inventory bubble chart.
- Fixed Aurora/DynamoDB batch-insert limits and a `customers` table primary-key collision.
- Upload page now shows clear step-by-step progress (upload → normalize → return to dashboard).
- Merged Inventory/Receivables/Financing into one Dashboard page as sections, with nav anchors and redirects from the old routes (not yet committed).
- Fixed a recurring "Unexpected end of JSON input" bug in the Financing page (not yet committed).

**Known issue:** `ANTHROPIC_API_KEY` is empty in `.env.local`, so Run Forecast fails — needs a real key.
