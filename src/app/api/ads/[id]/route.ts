import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adClick } from "@/server/services/ads";
import { clientIp } from "@/server/http/handler";
import { rateLimit } from "@/server/http/rate-limit";

/** Ad click-through: counts the click and redirects to the advertiser (http/https only). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await params).id);
  const home = new URL("/", req.url);
  if (!id.success) return NextResponse.redirect(home);
  // repeated clicks from one client still redirect but are not counted
  const url = await adClick(id.data, rateLimit(`ad:${id.data}:${clientIp(req)}`, 5, 60_000).ok);
  return NextResponse.redirect(url ?? home);
}
