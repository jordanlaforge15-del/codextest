import type { Item } from '@mvp/shared';

const MARKETPLACE_MERCHANTS = new Set([
  'Amazon',
  'Ebay',
  'Etsy',
  'Target',
  'Walmart'
]);

const MULTI_PART_TLDS = new Set(['co.uk', 'com.au', 'com.br', 'co.jp', 'co.nz']);

const SLOT_TYPE_KEYWORDS: Array<{ slotType: string; keywords: string[] }> = [
  { slotType: 'jacket', keywords: ['jacket', 'rain shell', 'shell', 'parka', 'anorak'] },
  { slotType: 'coat', keywords: ['coat', 'overcoat', 'trench'] },
  { slotType: 'vest', keywords: ['vest', 'gilet'] },
  { slotType: 'hoodie', keywords: ['hoodie', 'hooded sweatshirt'] },
  { slotType: 'sweater', keywords: ['sweater', 'pullover', 'cardigan'] },
  { slotType: 'shirt', keywords: ['shirt', 'tee', 't-shirt', 'top', 'blouse'] },
  { slotType: 'pants', keywords: ['pants', 'trousers', 'joggers', 'leggings', 'slacks'] },
  { slotType: 'jeans', keywords: ['jeans', 'denim'] },
  { slotType: 'shorts', keywords: ['shorts'] },
  { slotType: 'skirt', keywords: ['skirt'] },
  { slotType: 'dress', keywords: ['dress', 'gown'] },
  { slotType: 'shoes', keywords: ['shoe', 'sneaker', 'boot', 'loafer', 'trainer', 'sandal'] },
  { slotType: 'bag', keywords: ['bag', 'tote', 'backpack', 'pack', 'purse'] },
  { slotType: 'hat', keywords: ['hat', 'cap', 'beanie'] },
  { slotType: 'helmet', keywords: ['helmet'] }
];

const COLOR_KEYWORDS = [
  'black',
  'white',
  'gray',
  'grey',
  'blue',
  'navy',
  'red',
  'green',
  'olive',
  'khaki',
  'brown',
  'tan',
  'beige',
  'cream',
  'orange',
  'yellow',
  'purple',
  'pink',
  'gold',
  'silver'
] as const;

const PRICE_SYMBOL_CURRENCIES: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY'
};

type JsonRecord = Record<string, unknown>;

export interface MetadataExtractionInput {
  pageUrl?: string | null;
  imageUrl?: string | null;
  pageTitle?: string | null;
  altText?: string | null;
  surroundingText?: string | null;
  rawPayloadJson?: JsonRecord;
}

export interface MetadataExtractionOptions {
  includeDeepSignals?: boolean;
}

export interface ExtractedMetadataResult {
  title: string | null;
  merchant: string | null;
  brand: string | null;
  slotType: string | null;
  price: string | null;
  currency: string | null;
  metadataJson: JsonRecord;
}

interface WeightedTextCandidate {
  value: string;
  source: string;
  score: number;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compactRecord<T extends JsonRecord>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === null || entry === undefined) {
        return false;
      }

      if (Array.isArray(entry)) {
        return entry.length > 0;
      }

      if (typeof entry === 'string') {
        return entry.trim().length > 0;
      }

      if (isRecord(entry)) {
        return Object.keys(entry).length > 0;
      }

      return true;
    })
  ) as T;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function titleCaseWords(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

function normalizeMerchant(hostname: string): string {
  const normalizedHost = hostname.replace(/^www\./i, '').toLowerCase();
  const parts = normalizedHost.split('.').filter(Boolean);
  if (parts.length === 0) {
    return '';
  }

  const suffix = parts.slice(-2).join('.');
  const rootLabel =
    parts.length >= 3 && MULTI_PART_TLDS.has(suffix)
      ? parts[parts.length - 3]
      : parts.length >= 2
        ? parts[parts.length - 2]
        : parts[0];

  return titleCaseWords(rootLabel);
}

function extractMerchantFromUrl(pageUrl?: string | null): {
  merchant: string | null;
  hostname: string | null;
} {
  if (!pageUrl) {
    return { merchant: null, hostname: null };
  }

  try {
    const hostname = new URL(pageUrl).hostname;
    const merchant = normalizeMerchant(hostname);
    return {
      merchant: merchant || null,
      hostname
    };
  } catch {
    return { merchant: null, hostname: null };
  }
}

function sanitizeTitleCandidate(value: string, merchant: string | null): string {
  let normalized = normalizeWhitespace(value);
  normalized = normalized.replace(/^(shop|buy|sale)\s+/i, '');
  normalized = normalized.replace(/\s+[|•·]\s+.+$/, '');
  normalized = normalized.replace(/\s+-\s+.+$/, '');
  normalized = normalized.replace(/\s+—\s+.+$/, '');

  if (merchant) {
    const merchantPattern = new RegExp(`\\s*[|\\-—:]\\s*${merchant}\\s*$`, 'i');
    normalized = normalized.replace(merchantPattern, '').trim();
  }

  return normalizeWhitespace(normalized);
}

function valueLooksGeneric(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length < 4 ||
    ['image', 'photo', 'product image', 'item', 'home', 'shop'].includes(normalized)
  );
}

function collectFlatValues(
  value: unknown,
  options: { includeDeepSignals: boolean; path?: string; depth?: number } = {
    includeDeepSignals: false
  }
): Array<{ path: string; value: string }> {
  const path = options.path ?? '';
  const depth = options.depth ?? 0;
  const maxDepth = options.includeDeepSignals ? 6 : 2;

  if (typeof value === 'string') {
    const normalized = normalizeWhitespace(value);
    return normalized ? [{ path, value: normalized }] : [];
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return [{ path, value: String(value) }];
  }

  if (Array.isArray(value)) {
    if (depth >= maxDepth) {
      return [];
    }

    return value.flatMap((entry, index) =>
      collectFlatValues(entry, {
        includeDeepSignals: options.includeDeepSignals,
        path: `${path}[${index}]`,
        depth: depth + 1
      })
    );
  }

  if (!isRecord(value) || depth >= maxDepth) {
    return [];
  }

  return Object.entries(value).flatMap(([key, entry]) =>
    collectFlatValues(entry, {
      includeDeepSignals: options.includeDeepSignals,
      path: path ? `${path}.${key}` : key,
      depth: depth + 1
    })
  );
}

function collectTitleCandidates(
  input: MetadataExtractionInput,
  merchant: string | null,
  options: MetadataExtractionOptions
): WeightedTextCandidate[] {
  const candidates: WeightedTextCandidate[] = [];
  const pushCandidate = (value: string | null | undefined, source: string, score: number) => {
    if (!value) {
      return;
    }

    const sanitized = sanitizeTitleCandidate(value, merchant);
    if (!sanitized || valueLooksGeneric(sanitized) || sanitized.length > 220) {
      return;
    }

    candidates.push({
      value: sanitized,
      source,
      score
    });
  };

  pushCandidate(input.altText, 'alt_text', 9);
  pushCandidate(input.pageTitle, 'page_title', 7);
  pushCandidate(input.surroundingText, 'surrounding_text', 4);

  if (input.pageUrl) {
    try {
      const pathname = new URL(input.pageUrl).pathname;
      const lastSegment = pathname.split('/').filter(Boolean).at(-1);
      if (lastSegment) {
        pushCandidate(decodeURIComponent(lastSegment).replace(/[-_]+/g, ' '), 'page_url_slug', 3);
      }
    } catch {
      // Ignore malformed page URLs.
    }
  }

  const flatValues = collectFlatValues(input.rawPayloadJson, {
    includeDeepSignals: options.includeDeepSignals ?? false
  });

  for (const candidate of flatValues) {
    const normalizedPath = candidate.path.toLowerCase();
    if (/(title|name|product|headline)/.test(normalizedPath)) {
      pushCandidate(candidate.value, `raw_payload:${candidate.path}`, options.includeDeepSignals ? 8 : 6);
      continue;
    }

    if (!options.includeDeepSignals && /^tab\./.test(normalizedPath)) {
      pushCandidate(candidate.value, `raw_payload:${candidate.path}`, 5);
    }
  }

  return candidates;
}

function chooseBestTitle(
  candidates: WeightedTextCandidate[],
  merchant: string | null
): { value: string | null; source: string | null; confidence: number | null } {
  const ranked = candidates
    .map((candidate) => {
      let score = candidate.score;
      if (merchant && candidate.value.toLowerCase().includes(merchant.toLowerCase())) {
        score += 1;
      }

      const text = candidate.value.toLowerCase();
      if (SLOT_TYPE_KEYWORDS.some(({ keywords }) => keywords.some((keyword) => text.includes(keyword)))) {
        score += 2;
      }

      if (candidate.value.length < 8 || candidate.value.length > 160) {
        score -= 1;
      }

      return { ...candidate, score };
    })
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  if (!best) {
    return { value: null, source: null, confidence: null };
  }

  return {
    value: best.value,
    source: best.source,
    confidence: Math.min(0.98, 0.45 + best.score * 0.05)
  };
}

function extractBrand(
  input: MetadataExtractionInput,
  normalizedTitle: string | null,
  merchant: string | null,
  options: MetadataExtractionOptions
): { value: string | null; source: string | null; confidence: number | null } {
  const flatValues = collectFlatValues(input.rawPayloadJson, {
    includeDeepSignals: options.includeDeepSignals ?? false
  });

  for (const candidate of flatValues) {
    if (!/(brand|manufacturer|vendor)/i.test(candidate.path)) {
      continue;
    }

    const value = sanitizeTitleCandidate(candidate.value, merchant);
    if (value && !valueLooksGeneric(value)) {
      return {
        value,
        source: `raw_payload:${candidate.path}`,
        confidence: 0.92
      };
    }
  }

  if (merchant && normalizedTitle && normalizedTitle.toLowerCase().includes(merchant.toLowerCase())) {
    if (!MARKETPLACE_MERCHANTS.has(merchant)) {
      return {
        value: merchant,
        source: 'merchant_title_overlap',
        confidence: 0.76
      };
    }
  }

  return { value: null, source: null, confidence: null };
}

function extractSlotType(texts: Array<string | null | undefined>): {
  value: string | null;
  source: string | null;
  confidence: number | null;
} {
  const combined = normalizeWhitespace(texts.filter(Boolean).join(' ').toLowerCase());
  if (!combined) {
    return { value: null, source: null, confidence: null };
  }

  const ranking = SLOT_TYPE_KEYWORDS.map(({ slotType, keywords }) => {
    const score = keywords.reduce((total, keyword) => total + (combined.includes(keyword) ? 1 : 0), 0);
    return { slotType, score };
  }).sort((left, right) => right.score - left.score);

  if (!ranking[0] || ranking[0].score === 0) {
    return { value: null, source: null, confidence: null };
  }

  return {
    value: ranking[0].slotType,
    source: 'keyword_match',
    confidence: Math.min(0.9, 0.5 + ranking[0].score * 0.1)
  };
}

function normalizeCurrencyCode(currency: string | null | undefined, pageUrl?: string | null): string | null {
  if (!currency) {
    return null;
  }

  const normalized = currency.toUpperCase();
  if (normalized === '$') {
    if (pageUrl?.includes('.ca/')) {
      return 'CAD';
    }

    return 'USD';
  }

  if (normalized in PRICE_SYMBOL_CURRENCIES) {
    return PRICE_SYMBOL_CURRENCIES[normalized];
  }

  return normalized;
}

function parsePriceCandidate(value: string, pageUrl?: string | null): { amount: string; currency: string | null } | null {
  const normalized = normalizeWhitespace(value);

  const prefixed = normalized.match(/(CA\$|C\$|US\$|A\$|\$|€|£|¥)\s?(\d[\d,]*(?:\.\d{1,2})?)/i);
  if (prefixed) {
    const symbol = prefixed[1].toUpperCase();
    const currency =
      symbol === 'CA$' || symbol === 'C$'
        ? 'CAD'
        : symbol === 'US$'
          ? 'USD'
          : symbol === 'A$'
            ? 'AUD'
            : normalizeCurrencyCode(symbol, pageUrl);
    return {
      amount: prefixed[2].replace(/,/g, ''),
      currency
    };
  }

  const suffixed = normalized.match(/(\d[\d,]*(?:\.\d{1,2})?)\s?(USD|CAD|AUD|EUR|GBP|JPY)\b/i);
  if (suffixed) {
    return {
      amount: suffixed[1].replace(/,/g, ''),
      currency: normalizeCurrencyCode(suffixed[2], pageUrl)
    };
  }

  return null;
}

function extractPrice(
  input: MetadataExtractionInput,
  options: MetadataExtractionOptions
): {
  price: string | null;
  currency: string | null;
  source: string | null;
  confidence: number | null;
} {
  const flatValues = collectFlatValues(input.rawPayloadJson, {
    includeDeepSignals: options.includeDeepSignals ?? false
  });

  for (const candidate of flatValues) {
    if (!/(price|amount|sale|current|cost)/i.test(candidate.path)) {
      continue;
    }

    const parsed = parsePriceCandidate(candidate.value, input.pageUrl) ?? {
      amount: candidate.value.replace(/[^0-9.]/g, ''),
      currency: null
    };

    if (!parsed.amount) {
      continue;
    }

    const siblingCurrency = flatValues.find(
      (entry) =>
        entry.path !== candidate.path &&
        /(currency|currencycode|currency_code)/i.test(entry.path)
    );

    return {
      price: parsed.amount,
      currency: siblingCurrency
        ? normalizeCurrencyCode(siblingCurrency.value, input.pageUrl)
        : parsed.currency,
      source: `raw_payload:${candidate.path}`,
      confidence: 0.88
    };
  }

  const texts = [input.pageTitle, input.altText, input.surroundingText];
  for (const candidate of texts) {
    if (!candidate) {
      continue;
    }

    const parsed = parsePriceCandidate(candidate, input.pageUrl);
    if (parsed) {
      return {
        price: parsed.amount,
        currency: parsed.currency,
        source: 'capture_text',
        confidence: 0.64
      };
    }
  }

  return {
    price: null,
    currency: null,
    source: null,
    confidence: null
  };
}

function extractColorName(
  input: MetadataExtractionInput,
  options: MetadataExtractionOptions
): { value: string | null; source: string | null } {
  const flatValues = collectFlatValues(input.rawPayloadJson, {
    includeDeepSignals: options.includeDeepSignals ?? false
  });

  for (const candidate of flatValues) {
    if (/(color|colour)/i.test(candidate.path)) {
      return {
        value: candidate.value,
        source: `raw_payload:${candidate.path}`
      };
    }
  }

  const combined = normalizeWhitespace(
    [input.pageTitle, input.altText, input.surroundingText].filter(Boolean).join(' ').toLowerCase()
  );

  const detected = COLOR_KEYWORDS.find((color) => combined.includes(color));
  if (!detected) {
    return { value: null, source: null };
  }

  return {
    value: titleCaseWords(detected),
    source: 'text_keyword'
  };
}

function extractSizeOptions(
  input: MetadataExtractionInput,
  options: MetadataExtractionOptions
): string[] {
  const flatValues = collectFlatValues(input.rawPayloadJson, {
    includeDeepSignals: options.includeDeepSignals ?? false
  });

  const sizes = new Set<string>();

  for (const candidate of flatValues) {
    if (!/(size|sizes|size_options|sizeoption)/i.test(candidate.path)) {
      continue;
    }

    const rawSizes = candidate.value.split(/[,/|]/).map((entry) => normalizeWhitespace(entry));
    for (const size of rawSizes) {
      if (/^(xxs|xs|s|m|l|xl|xxl|\d{1,3})$/i.test(size) || size.length <= 8) {
        sizes.add(size.toUpperCase());
      }
    }
  }

  return [...sizes];
}

function extractSku(
  input: MetadataExtractionInput,
  options: MetadataExtractionOptions
): { value: string | null; source: string | null } {
  const flatValues = collectFlatValues(input.rawPayloadJson, {
    includeDeepSignals: options.includeDeepSignals ?? false
  });

  for (const candidate of flatValues) {
    if (!/(sku|product_?id|item_?id|style_?id|model_?number)/i.test(candidate.path)) {
      continue;
    }

    const value = normalizeWhitespace(candidate.value);
    if (/^[A-Za-z0-9_-]{4,40}$/.test(value)) {
      return {
        value,
        source: `raw_payload:${candidate.path}`
      };
    }
  }

  return { value: null, source: null };
}

export function extractMetadata(
  input: MetadataExtractionInput,
  options: MetadataExtractionOptions = {}
): ExtractedMetadataResult {
  const merchantResult = extractMerchantFromUrl(input.pageUrl);
  const titleResult = chooseBestTitle(
    collectTitleCandidates(input, merchantResult.merchant, options),
    merchantResult.merchant
  );
  const brandResult = extractBrand(input, titleResult.value, merchantResult.merchant, options);
  const slotTypeResult = extractSlotType([
    titleResult.value,
    input.pageTitle,
    input.altText,
    input.surroundingText
  ]);
  const priceResult = extractPrice(input, options);
  const colorResult = extractColorName(input, options);
  const sizeOptions = extractSizeOptions(input, options);
  const skuResult = extractSku(input, options);

  const extractionMetadata = compactRecord({
    version: 1,
    mode: options.includeDeepSignals ? 'async_enrichment' : 'sync_capture',
    sources: compactRecord({
      title: titleResult.source,
      brand: brandResult.source,
      merchant: merchantResult.hostname ? 'page_url_domain' : null,
      slotType: slotTypeResult.source,
      price: priceResult.source,
      colorName: colorResult.source,
      sku: skuResult.source
    }),
    confidence: compactRecord({
      title: titleResult.confidence,
      brand: brandResult.confidence,
      merchant: merchantResult.merchant ? 0.98 : null,
      slotType: slotTypeResult.confidence,
      price: priceResult.confidence
    }),
    derived: compactRecord({
      merchantHostname: merchantResult.hostname,
      colorName: colorResult.value,
      sizeOptions,
      sku: skuResult.value
    })
  });

  return {
    title: titleResult.value,
    merchant: merchantResult.merchant,
    brand: brandResult.value,
    slotType: slotTypeResult.value,
    price: priceResult.price,
    currency: priceResult.currency,
    metadataJson: {
      extraction: extractionMetadata
    }
  };
}

export function mergeExtractedMetadata(
  baseMetadata: Record<string, unknown> | null | undefined,
  extractedMetadata: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const base = isRecord(baseMetadata) ? { ...baseMetadata } : {};
  const extracted = isRecord(extractedMetadata) ? extractedMetadata : {};

  for (const [key, value] of Object.entries(extracted)) {
    if (key === 'extraction') {
      continue;
    }

    if (!(key in base)) {
      base[key] = value;
    }
  }

  if (isRecord(extracted.extraction)) {
    base.extraction = {
      ...(isRecord(base.extraction) ? base.extraction : {}),
      ...extracted.extraction
    };
  }

  return base;
}

export function buildNormalizedItemFields(
  input: Partial<Item>,
  extracted: ExtractedMetadataResult
): Pick<Item, 'title' | 'merchant' | 'brand' | 'price' | 'currency' | 'slotType' | 'metadataJson'> {
  return {
    title: input.title ?? extracted.title ?? null,
    merchant: input.merchant ?? extracted.merchant ?? null,
    brand: input.brand ?? extracted.brand ?? null,
    price: input.price ?? extracted.price ?? null,
    currency: input.currency ?? extracted.currency ?? null,
    slotType: input.slotType ?? extracted.slotType ?? null,
    metadataJson: mergeExtractedMetadata(input.metadataJson, extracted.metadataJson)
  };
}
