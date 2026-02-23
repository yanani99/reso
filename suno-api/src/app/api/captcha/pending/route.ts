import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sunoApi } from "@/lib/SunoApi";
import { corsHeaders } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const instance = await sunoApi((await cookies()).toString());
    const pending = instance.getCaptchaPending();
    if (!pending) {
      return NextResponse.json(
        { pending: false },
        { headers: corsHeaders }
      );
    }
    return NextResponse.json(
      { pending: true, image: pending.image, prompt: pending.prompt },
      { headers: corsHeaders }
    );
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
