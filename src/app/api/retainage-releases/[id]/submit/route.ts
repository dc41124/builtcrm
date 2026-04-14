import { handleRetainageReleaseTransition } from "../_transition";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleRetainageReleaseTransition(req, id, "submit");
}
