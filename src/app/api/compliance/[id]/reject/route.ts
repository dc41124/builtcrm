import { handleDecision } from "../../_decide";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleDecision(req, id, "reject");
}
