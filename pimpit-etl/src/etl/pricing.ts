import { PricingRule } from '../types/etl.js';

export function roundPrice(price: number): number {
  return Math.round(price * 100) / 100;
}

export function applyUniversalFormula(rawPrice: number, rule: PricingRule): number {
  let price = rawPrice;
  // Pas 1: price = rawPrice * (1 - baseDiscount)
  price = price * (1 - rule.baseDiscount);
  // Pas 2: price = price * baseMultiplier
  price = price * rule.baseMultiplier;
  // Pas 3: price = price + fixedCost
  price = price + rule.fixedCost;
  // Pas 4: price = price * vatMultiplier
  price = price * rule.vatMultiplier;
  // Pas 5: price = price * marginMultiplier
  price = price * rule.marginMultiplier;
  // Pas 6: price = price / finalDivisor
  price = price / rule.finalDivisor;
  
  return roundPrice(price);
}

export function applyDualPriceLogic(srp: number, net: number, config: any): number {
  const { srp_threshold, srp_low_add, srp_multiplier, min_margin_multiplier, min_margin_pct } = config;
  
  let srpBased = 0;
  if (srp <= srp_threshold) {
    srpBased = (srp + srp_low_add) * srp_multiplier;
  } else {
    srpBased = srp * srp_multiplier;
  }
  
  const minSafety = net * min_margin_multiplier * (1 + min_margin_pct);
  
  return roundPrice(Math.max(srpBased, minSafety));
}

export function applyOldPriceFormula(rawPrice: number, formula: string): number {
  // Very basic formula evaluator for "rrp * 5.78"
  try {
    const expr = formula.replace(/rrp/gi, rawPrice.toString());
    // Using Function instead of eval for slight safety
    const result = new Function(`return ${expr}`)();
    return roundPrice(Number(result));
  } catch (e) {
    return 0;
  }
}

export function calculatePrice(rawPrice: number, rule: PricingRule, extraData?: any): number {
  if (extraData && extraData.dualPriceConfig) {
    return applyDualPriceLogic(extraData.srp, rawPrice, extraData.dualPriceConfig);
  }
  return applyUniversalFormula(rawPrice, rule);
}
