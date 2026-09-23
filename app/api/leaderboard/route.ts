import { NextResponse } from "next/server";
// Historical scores and rating utilities are retained for a future launch.
export async function GET() { return NextResponse.json({ error: "Not found" }, { status: 404 }); }
