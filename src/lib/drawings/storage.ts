// R2 key layout for drawings. Source PDF lives under
// {orgId}/{projectId}/drawings/{setId}/source.pdf; per-sheet thumbnails
// live under the same prefix as thumbnails/{pageIndex}.png. Keeping them
// colocated means a set can be deleted (cascade) by listing + deleting
// one prefix.

export function buildSourcePdfKey(input: {
  orgId: string;
  projectId: string;
  setId: string;
  filename: string;
}): string {
  const safeName = input.filename.replace(/[\\/]/g, "_").trim();
  return `${input.orgId}/${input.projectId}/drawings/${input.setId}/source__${safeName}`;
}

export function buildThumbnailKey(input: {
  orgId: string;
  projectId: string;
  setId: string;
  pageIndex: number;
}): string {
  return `${input.orgId}/${input.projectId}/drawings/${input.setId}/thumbnails/${input.pageIndex}.png`;
}
