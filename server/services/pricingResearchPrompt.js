/**
 * Shared You.com / LLM brief for product-pricing research.
 * Do not treat the company pricing page as the only authoritative source.
 */

export const PRICING_RESEARCH_AGENT = `You are a product-pricing research agent.

Do not assume the company pricing page is the only authoritative source.

First classify the product:
- Mobile app
- SaaS/web application
- Physical product
- API/developer platform
- Marketplace product
- Service

Then identify all plausible purchase channels.

For mobile apps, always investigate:
1. Official product website
2. Apple App Store In-App Purchases
3. Google Play subscription or purchase information
4. Checkout or signup flow, when publicly accessible
5. Official partner and promotional pages

For SaaS products, investigate:
1. Official pricing page
2. Signup or checkout flow
3. Billing documentation
4. App marketplace listings
5. Sales or enterprise pricing information

Search the user's region and currency when known.

For every price, record:
- Product or plan
- Amount
- Currency
- Billing period (only when the source explicitly labels it — never invent weekly/monthly/yearly)
- Standard or promotional
- Region
- Source URL
- Exact supporting evidence (short quote)
- Confidence (high / medium / low)

Compare multiple authoritative sources before concluding.
Clearly explain discrepancies and potentially outdated prices.
Prefer apps.apple.com and play.google.com/store/apps links when the product is a mobile app.`;

/**
 * Build a You.com Research query for pricing across all purchase channels.
 */
export function buildPricingResearchQuery({
  name,
  website = null,
  region = 'US',
  currency = 'USD',
  focus = 'all', // 'all' | 'stores'
} = {}) {
  const product = [name, website ? `(${website})` : null].filter(Boolean).join(' ');
  const focusLine = focus === 'stores'
    ? 'Prioritize Apple App Store In-App Purchases and Google Play subscription / purchase listings. Still note website pricing if found.'
    : 'Cover every plausible purchase channel for the classified product type.';

  return `${PRICING_RESEARCH_AGENT}

PRODUCT: ${product}
REGION: ${region}
CURRENCY PREFERENCE: ${currency}

Task: Research current public pricing for this product. ${focusLine}

Return a structured findings write-up with:
1) Product classification
2) Purchase channels investigated (with URLs)
3) Price rows: plan | amount | currency | billing period | standard/promo | region | source URL | evidence | confidence
4) Discrepancies or outdated prices

Only include prices you can support with a source URL and evidence.`;
}

/**
 * Shorter brief for tier-extraction LLMs reading scraped/research text.
 */
export const TIER_EXTRACTION_RULES = `Rules for prices:
- Prefer explicit amounts from the content (website, App Store IAP, Play Store, checkout).
- Never invent a billing period when the source does not label it.
- Only convert to monthly when the source labels weekly/yearly/annual (weekly × 4.33, yearly ÷ 12).
- Include EVERY distinct price row. Same plan name with different amounts (common on App Store In-App Purchases) = separate tiers. Do not collapse to a single entry price.
- Mark App Store / Play Store tiers with channel "app-store" / "play-store" when known.
- Prefer real plan names; do not invent a "Default" tier with a null price.
- If sources disagree, prefer the most recent labeled store listing or official pricing page.`;
