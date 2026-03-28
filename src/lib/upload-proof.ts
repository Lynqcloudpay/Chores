import type { SupabaseClient } from "@supabase/supabase-js";

export const PROOF_BUCKET = "contribution-proofs";

export function proofObjectPath(
  householdId: string,
  contributionId: string,
  contentType: string,
): string {
  const ext =
    contentType === "application/pdf"
      ? "pdf"
      : contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
          ? "webp"
          : "jpg";
  return `${householdId}/${contributionId}.${ext}`;
}

export async function uploadContributionProof(
  supabase: SupabaseClient,
  householdId: string,
  contributionId: string,
  blob: Blob,
  contentType: string,
): Promise<{ path: string }> {
  const path = proofObjectPath(householdId, contributionId, contentType);
  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, blob, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return { path };
}

/** Deletes all proof objects under `{householdId}/` (call after DB rows are removed). */
export async function removeAllHouseholdProofFiles(
  supabase: SupabaseClient,
  householdId: string,
): Promise<void> {
  const { data: files, error } = await supabase.storage.from(PROOF_BUCKET).list(householdId, {
    limit: 1000,
  });
  if (error) throw error;
  if (!files?.length) return;
  const paths = files.map((f) => `${householdId}/${f.name}`);
  const { error: rmErr } = await supabase.storage.from(PROOF_BUCKET).remove(paths);
  if (rmErr) throw rmErr;
}
