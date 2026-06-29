// Table: cashflow-raw (on-demand billing)
// PK: companyId (string) — tenant isolation
// SK: rowId (string) — `${uploadId}#${rowIndex}`
// GSI: type-uploadedAt-index (PK: type, SK: uploadedAt) — query raw rows by
// type without scanning a company's full upload history.
// TTL: ttl (epoch seconds) — raw rows are a transient staging area ahead of
// normalizeCompany(); once normalized into Aurora they don't need to live
// forever, so they expire automatically instead of accumulating indefinitely.
export interface RawUploadRow {
  companyId: string;
  rowId: string;
  type: "sales" | "inventory" | "invoice" | "payable";
  data: Record<string, string>;
  uploadedAt: string; // ISO timestamp
  ttl: number; // epoch seconds — DynamoDB TTL expiry
}

export const RAW_ROW_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

export function rawRowTtl(uploadedAt: string): number {
  return Math.floor(new Date(uploadedAt).getTime() / 1000) + RAW_ROW_TTL_SECONDS;
}
