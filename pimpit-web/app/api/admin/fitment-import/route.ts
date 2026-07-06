/**
 * Importul galeriei de fitmenturi, rulat pe server (butonul din /admin/vehicule).
 * POST { apply?: boolean, limit?: number }
 *   apply=false (implicit) → dry-run: doar parsează și raportează
 *   apply=true             → scrie în vehicle_makes/models/vehicles/fitments
 *
 * Sursa de date: data/fitmentgallery.csv.gz din repo (inclus în deploy prin
 * outputFileTracingIncludes din next.config.js).
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { checkAdmin, makeAdminClient } from '@/lib/adminAuth';
import { importFitmentGallery } from '@/lib/import/fitmentGallery';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function findDataFile(): string | null {
  const candidates = [
    join(process.cwd(), 'data', 'fitmentgallery.csv.gz'),        // deploy cu root = repo
    join(process.cwd(), '..', 'data', 'fitmentgallery.csv.gz'),  // deploy cu root = pimpit-web
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let apply = false;
  let limit: number | undefined;
  try {
    const body = await req.json();
    apply = body?.apply === true;
    if (Number.isFinite(body?.limit)) limit = Math.max(1, Math.floor(body.limit));
  } catch {
    // body gol → dry-run
  }

  const filePath = findDataFile();
  if (!filePath) {
    return NextResponse.json(
      { error: 'Fișierul data/fitmentgallery.csv.gz nu a fost găsit în deploy.' },
      { status: 500 }
    );
  }

  try {
    const buffer = readFileSync(filePath);
    const db = apply ? makeAdminClient() : null;
    const summary = await importFitmentGallery(db, buffer, { apply, limit });
    return NextResponse.json(summary);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
