import { NextResponse } from 'next/server';
import { listFiles } from '@/lib/aria2';
export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return NextResponse.json({ files: await listFiles() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}