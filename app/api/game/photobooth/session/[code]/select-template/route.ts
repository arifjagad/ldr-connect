import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, requirePhotoboothUser, runPhotoboothAction } from "@/lib/games/photobooth/action";

const bodySchema = z.object({ template_id: z.number().int().positive() });

/**
 * POST /api/game/photobooth/session/[code]/select-template
 * Memilih template frame photobooth (hanya sebelum ada foto yang diambil).
 * Body: { template_id: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await requirePhotoboothUser();
  if ("error" in auth) return auth.error;

  const body = await parseBody(request, bodySchema);
  if ("error" in body) return body.error;

  const { code } = await params;
  const result = await runPhotoboothAction(code, auth.userId, "select_template", body.data);
  if ("error" in result) return result.error;

  return NextResponse.json({
    success: true,
    message: "Template berhasil dipilih",
    data: { session: result.session },
  });
}
