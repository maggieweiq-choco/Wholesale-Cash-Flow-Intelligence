import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 max-w-5xl mx-auto w-full px-6 py-12">
      <h1 className="text-2xl font-semibold">Wholesale Cash Flow Intelligence</h1>
      <p className="text-zinc-600">
        Upload your sales, inventory, and invoice data to generate a 90-day cash flow forecast and
        a recommendation on whether to liquidate stock, chase collections, or take financing.
      </p>
      <nav className="flex gap-4 text-sm font-medium text-blue-600">
        <Link href="/upload">Upload Data</Link>
        <Link href="/inventory">Inventory</Link>
        <Link href="/receivables">Receivables</Link>
        <Link href="/financing">Financing</Link>
      </nav>
    </main>
  );
}
