import { redirect } from "next/navigation";

// Step 64 fold: the integrations page moved to /contractor/integrations
// (now the single page combining Active connections + the catalog
// gallery). This stub stays in place so old bookmarks still land on
// the new home. The OAuth callback was updated to redirect to the new
// path directly; this stub is the safety net.
export default function MovedIntegrationsSettings() {
  redirect("/contractor/integrations");
}
