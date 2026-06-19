// Table: cashflow-raw (on-demand billing)
// PK: companyId (string) — tenant isolation
// SK: rowId (string) — `${uploadId}#${rowIndex}`
export interface RawUploadRow {
  companyId: string;
  rowId: string;
  type: "sales" | "inventory" | "invoice";
  data: Record<string, string>;
  uploadedAt: string; // ISO timestamp
}
