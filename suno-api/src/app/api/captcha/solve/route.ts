import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { sunoApi } from "@/lib/SunoApi";
import { corsHeaders } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { coordinates } = body;
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return NextResponse.json(
        { error: "coordinates must be a non-empty array of {x, y}" },
        { status: 400, headers: corsHeaders }
      );
    }
    const instance = await sunoApi((await cookies()).toString());
    const ok = instance.solveCaptcha(coordinates);
    if (!ok) {
      return NextResponse.json(
        { error: "No CAPTCHA pending" },
        { status: 404, headers: corsHeaders }
      );
    }
    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.toString() },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}
