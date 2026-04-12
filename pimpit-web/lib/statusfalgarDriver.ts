/**
 * Statusfalgar multi-endpoint driver.
 *
 * Fetches Articles, NetPrices and Stock in parallel, merges them into a
 * single flat row array that is then processed by the standard field-mapping
 * and upsert pipeline in importRunner.ts.
 *
 * Merged row field names (use these in ImportWizard field mappings):
 *   Id                  – article ID (used by image proxy)
 *   ArticleNumber       – SKU / part number
 *   BrandName           – brand name
 *   Name                – product name
 *   Description         – long description
 *   EAN                 – EAN / barcode
 *   Diameter            – wheel diameter
 *   Width               – wheel width
 *   ET                  – ET offset
 *   PCD                 – bolt pattern
 *   CenterBore          – center bore
 *   Color               – color
 *   Finish              – surface finish
 *   Weight              – weight (kg)
 *   MaxLoad             – max load (kg)
 *   ProductionMethod    – e.g. flow-formed
 *   NetPrice            – your net price (from /api/NetPrices)
 *   Stock               – available stock (from /api/Stock)
 *   StockIncoming       – incoming stock
 */

interface StatusfalgarConfig {
  /** Base URL, e.g. https://api.statusfalgar.se  (no trailing slash) */
  baseUrl: string;
  customerId: string;
  token: string;
  includeAlloyRims?: boolean;
  includeSteelRims?: boolean;
  includeAccessories?: boolean;
  includeCarTyres?: boolean;
}

function buildAuth(customerId: string, token: string): string {
  return `Basic ${Buffer.from(`${customerId}:${token}`).toString('base64')}`;
}

async function sfFetch(url: string, auth: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: auth,
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchStatusfalgarRows(
  supplier: any
): Promise<Record<string, any>[]> {
  const dc = supplier.driver_config || {};

  const baseUrl: string = (dc.statusfalgar_base_url || 'https://api.statusfalgar.se').replace(/\/$/, '');
  const customerId: string = dc.customer_id || '';
  const token: string = dc.token || '';

  if (!customerId || !token) {
    throw new Error('Statusfalgar driver: customer_id și token sunt obligatorii în driver_config.');
  }

  const auth = buildAuth(customerId, token);

  // Build article query params
  const articleParams = new URLSearchParams();
  if (dc.statusfalgar_include_alloy_rims !== false) articleParams.set('IncludeAlloyRims', 'true');
  if (dc.statusfalgar_include_steel_rims) articleParams.set('IncludeSteelRims', 'true');
  if (dc.statusfalgar_include_accessories) articleParams.set('IncludeAccessories', 'true');
  if (dc.statusfalgar_include_car_tyres) articleParams.set('IncludeCarTyres', 'true');

  const articlesUrl = `${baseUrl}/api/Articles?${articleParams.toString()}`;
  const netPricesUrl = `${baseUrl}/api/NetPrices`;
  const stockUrl = `${baseUrl}/api/Stock?${articleParams.toString()}`;

  // Fetch all three in parallel
  const [articles, netPrices, stockItems] = await Promise.all([
    sfFetch(articlesUrl, auth),
    sfFetch(netPricesUrl, auth),
    sfFetch(stockUrl, auth),
  ]);

  if (!Array.isArray(articles)) {
    throw new Error(`Statusfalgar /api/Articles a returnat un răspuns neașteptat: ${JSON.stringify(articles).slice(0, 200)}`);
  }

  // Build lookup maps: articleId → value
  const priceMap = new Map<string | number, number>();
  if (Array.isArray(netPrices)) {
    for (const p of netPrices) {
      const id = p.ArticleId ?? p.Id ?? p.articleId;
      const price = p.NetPrice ?? p.Price ?? p.price ?? 0;
      if (id != null) priceMap.set(String(id), Number(price));
    }
  }

  const stockMap = new Map<string | number, { qty: number; incoming: number }>();
  if (Array.isArray(stockItems)) {
    for (const s of stockItems) {
      const id = s.ArticleId ?? s.Id ?? s.articleId;
      const qty = s.Quantity ?? s.Stock ?? s.quantity ?? s.stock ?? 0;
      const incoming = s.QuantityIncoming ?? s.StockIncoming ?? s.quantityIncoming ?? 0;
      if (id != null) stockMap.set(String(id), { qty: Number(qty), incoming: Number(incoming) });
    }
  }

  // Merge: one flat row per article
  return articles.map(article => {
    const id = String(article.Id ?? article.id ?? '');
    const stock = stockMap.get(id);
    return {
      ...article,
      NetPrice: priceMap.get(id) ?? 0,
      Stock: stock?.qty ?? 0,
      StockIncoming: stock?.incoming ?? 0,
    };
  });
}
