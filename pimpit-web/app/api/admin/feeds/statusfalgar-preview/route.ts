import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

function makeAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

async function checkAdmin(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const db = makeAdminClient();
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).maybeSingle();
  return profile?.role === 'admin';
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const {
    customer_id,
    token,
    statusfalgar_base_url = 'https://api.statusfalgar.se',
    statusfalgar_include_alloy_rims = true,
    statusfalgar_include_steel_rims = false,
    statusfalgar_include_accessories = false,
  } = body;

  if (!customer_id || !token) {
    return NextResponse.json({ error: 'customer_id și token sunt obligatorii' }, { status: 400 });
  }

  const baseUrl = String(statusfalgar_base_url).replace(/\/$/, '');
  const auth = `Basic ${Buffer.from(`${customer_id}:${token}`).toString('base64')}`;
  const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' };

  const params = new URLSearchParams();
  if (statusfalgar_include_alloy_rims) params.set('IncludeAlloyRims', 'true');
  if (statusfalgar_include_steel_rims) params.set('IncludeSteelRims', 'true');
  if (statusfalgar_include_accessories) params.set('IncludeAccessories', 'true');

  const articlesUrl = `${baseUrl}/api/Articles?${params.toString()}`;
  const netPricesUrl = `${baseUrl}/api/NetPrices`;
  const stockUrl = `${baseUrl}/api/Stock?${params.toString()}`;

  try {
    const signal = AbortSignal.timeout(30_000);
    const [articlesRes, netPricesRes, stockRes] = await Promise.all([
      fetch(articlesUrl, { headers, signal }),
      fetch(netPricesUrl, { headers, signal }),
      fetch(stockUrl, { headers, signal }),
    ]);

    if (!articlesRes.ok) {
      return NextResponse.json(
        { error: `Statusfalgar Articles: HTTP ${articlesRes.status} ${articlesRes.statusText}` },
        { status: 502 }
      );
    }

    const articles: any[] = await articlesRes.json();
    const netPrices: any[] = netPricesRes.ok ? await netPricesRes.json() : [];
    const stockItems: any[] = stockRes.ok ? await stockRes.json() : [];

    if (!Array.isArray(articles) || articles.length === 0) {
      return NextResponse.json({ error: 'Niciun articol returnat de Statusfalgar. Verifică credențialele și tipurile de produse selectate.' }, { status: 400 });
    }

    // Build lookup maps
    const priceMap = new Map<string, number>();
    for (const p of netPrices) {
      const id = String(p.ArticleId ?? p.Id ?? p.articleId ?? '');
      if (id) priceMap.set(id, Number(p.NetPrice ?? p.Price ?? 0));
    }

    const stockMap = new Map<string, { qty: number; incoming: number }>();
    for (const s of stockItems) {
      const id = String(s.ArticleId ?? s.Id ?? s.articleId ?? '');
      if (id) stockMap.set(id, {
        qty: Number(s.Quantity ?? s.Stock ?? 0),
        incoming: Number(s.QuantityIncoming ?? s.StockIncoming ?? 0),
      });
    }

    // Merge + take first 10 for preview
    const merged = articles.slice(0, 10).map(article => {
      const id = String(article.Id ?? article.id ?? '');
      const stock = stockMap.get(id);
      return { ...article, NetPrice: priceMap.get(id) ?? 0, Stock: stock?.qty ?? 0, StockIncoming: stock?.incoming ?? 0 };
    });

    const columns = merged.length > 0 ? Object.keys(merged[0]) : [];

    return NextResponse.json({
      columns,
      rows: merged,
      total: articles.length,
      note: `${articles.length} articole în total — afișate primele ${merged.length} pentru preview`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Eroare conexiune: ${e.message}` }, { status: 502 });
  }
}
