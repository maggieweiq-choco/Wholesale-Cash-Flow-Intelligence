import { redirect } from "next/navigation";

// Financing now lives as a section on the merged dashboard page. This route
// is kept only so old bookmarks/links land in the right place.
export default function FinancingRedirect() {
  redirect("/#financing");
}
