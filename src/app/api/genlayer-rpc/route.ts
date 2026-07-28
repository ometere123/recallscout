import { NextResponse } from "next/server";

const target = process.env.GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api";

export async function POST(request: Request) {
  const body = await request.text();
  const upstream = await fetch(target, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body,
    cache: "no-store",
  });

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
