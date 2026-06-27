import Papa from "papaparse";

export type UploadType = "sales" | "inventory" | "invoice" | "payable";

export function parseCsv(fileContents: string): Record<string, string>[] {
  const { data } = Papa.parse<Record<string, string>>(fileContents, {
    header: true,
    skipEmptyLines: true,
  });
  return data;
}
