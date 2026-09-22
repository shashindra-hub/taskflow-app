import { ema, rsi } from '../indicators.js';
import { fetchDailyHistory, fetchPuts } from './marketData.js';

export const DEFAULT_SYMBOLS = ['MRVL', 'INTC', 'TSLA', 'SPCX', 'NVDA', 'SOXL', 'HOOD'];

export const RULES = {
  emaPeriod: 50,
  rsiPeriod: 14,
  rsiMin: 30,
  rsiMax: 50,
  targetDelta: 0.3,
  targetDte: 30,
  minYieldPercent: 2,
};

const DAY_MS = 86400000;

/** Whole days from `today` to `expiration` (both YYYY-MM-DD). */
export function daysToExpiration(expiration, today) {
  return Math.round((Date.parse(expiration) - Date.parse(today)) / DAY_MS);
}

/**
 * Checks 1 and 2: a red day (below yesterday's close), below the 50-day EMA,
 * and RSI(14) between 30 and 50. `closes` ends with today's live price.
 */
export function evaluateTechnicals({ price, previousClose, closes }, rules = RULES) {
  const series = [...closes.slice(0, -1), price];
  const emaValue = ema(series, rules.emaPeriod).at(-1);
  const rsiValue = rsi(series, rules.rsiPeriod).at(-1);
  const changePercent = ((price - previousClose) / previousClose) * 100;

  return {
    price,
    previousClose,
    changePercent,
    redDay: price < previousClose,
    ema: emaValue,
    emaGapPercent: emaValue === null ? null : ((price - emaValue) / emaValue) * 100,
    belowEma: emaValue !== null && price < emaValue,
    rsi: rsiValue,
    rsiInRange: rsiValue !== null && rsiValue >= rules.rsiMin && rsiValue <= rules.rsiMax,
  };
}

/**
 * Check 3: the cash-secured put nearest to 30 DTE and 0.30 delta, and whether
 * its bid pays at least 2% of the collateral (strike x 100).
 */
export function pickPut(puts, today, rules = RULES) {
  const tradable = puts.filter((p) => p.delta !== null && p.bid > 0 && daysToExpiration(p.expiration, today) > 0);
  if (tradable.length === 0) return null;

  const expirations = [...new Set(tradable.map((p) => p.expiration))];
  const expiration = expirations.reduce((best, e) =>
    Math.abs(daysToExpiration(e, today) - rules.targetDte) < Math.abs(daysToExpiration(best, today) - rules.targetDte)
      ? e
      : best
  );

  const put = tradable
    .filter((p) => p.expiration === expiration)
    .reduce((best, p) =>
      Math.abs(Math.abs(p.delta) - rules.targetDelta) < Math.abs(Math.abs(best.delta) - rules.targetDelta) ? p : best
    );

  const collateral = put.strike * 100;
  const premium = put.bid * 100;
  const yieldPercent = (premium / collateral) * 100;

  return {
    ...put,
    dte: daysToExpiration(expiration, today),
    collateral,
    premium,
    yieldPercent,
    meetsYield: yieldPercent >= rules.minYieldPercent,
  };
}

/** Screens one symbol. Never throws: failures come back as { error }. */
export async function screenSymbol(symbol, today, { fetchImpl, rules = RULES } = {}) {
  try {
    const history = await fetchDailyHistory(symbol, { fetchImpl });
    if (history.lastBarDate !== today) return { symbol, marketClosed: true };

    const closes = history.bars.map((bar) => bar.close);
    const technicals = evaluateTechnicals(
      { price: history.price, previousClose: closes.at(-2), closes },
      rules
    );
    const put = pickPut(await fetchPuts(symbol, { fetchImpl }), today, rules);
    const match = technicals.redDay && technicals.belowEma && technicals.rsiInRange && Boolean(put?.meetsYield);
    return { symbol, technicals, put, match };
  } catch (err) {
    return { symbol, error: err.message };
  }
}

const money = (n, digits = 2) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const pct = (n, digits = 1) => `${Math.abs(n).toFixed(digits)}%`;
const shortDate = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function headline({ symbol, technicals: t }) {
  const arrow = t.changePercent < 0 ? '▼' : '▲';
  return `${symbol} ${money(t.price)} ${arrow}${pct(t.changePercent)}`;
}

function failedChecks({ technicals: t, put }, rules) {
  const reasons = [];
  if (!t.redDay) reasons.push('not red');
  if (!t.belowEma) reasons.push(`above EMA${rules.emaPeriod}`);
  if (!t.rsiInRange) reasons.push(`RSI ${t.rsi === null ? 'n/a' : t.rsi.toFixed(0)}`);
  if (!put) reasons.push('no put quote');
  else if (!put.meetsYield) reasons.push(`put ${pct(put.yieldPercent)}`);
  return reasons.join(' · ');
}

/** The text message: matches first with the put to sell, then one line per other stock. */
export function formatMessage(results, runAt, rules = RULES) {
  const when = runAt.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  });
  const matches = results.filter((r) => r.match);
  const others = results.filter((r) => !r.match);
  const lines = [`Put screener · ${when} CT`];

  if (matches.length === 0) lines.push(`No setups today (0/${results.length}).`);
  for (const r of matches) {
    const { technicals: t, put } = r;
    lines.push(
      '',
      `✅ ${headline(r)}`,
      `RSI ${t.rsi.toFixed(0)} · ${pct(t.emaGapPercent)} below EMA${rules.emaPeriod}`,
      `Sell ${shortDate(put.expiration)} ${money(put.strike, put.strike % 1 ? 2 : 0)} put · Δ${Math.abs(put.delta).toFixed(2)} · ${put.dte} DTE`,
      `Bid ${money(put.bid)} → ${money(put.premium, 0)} on ${money(put.collateral, 0)} (${pct(put.yieldPercent)})`
    );
  }

  if (others.length > 0) lines.push('');
  for (const r of others) {
    if (r.error) lines.push(`${r.symbol}: data unavailable`);
    else if (r.marketClosed) lines.push(`${r.symbol}: no trading today`);
    else lines.push(`${headline(r)} · ${failedChecks(r, rules)}`);
  }

  lines.push('', 'Options ~15 min delayed. Not advice.');
  return lines.join('\n');
}
