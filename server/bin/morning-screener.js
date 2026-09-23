#!/usr/bin/env node
/**
 * Morning put screener: checks each watchlist symbol and texts the summary
 * over iMessage. Scheduled by scripts/install-screener.sh; run by hand with
 *
 *   npm run screener -- --dry-run      print the message, don't send
 *   npm run screener -- --force        send even if the market is closed
 *
 * Config (environment): SCREENER_PHONE (required to send), SCREENER_SYMBOLS
 * (comma-separated, defaults to the built-in watchlist).
 */
import { sendIMessage } from '../src/screener/imessage.js';
import { DEFAULT_SYMBOLS, formatMessage, screenSymbol } from '../src/screener/screener.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');

const phone = process.env.SCREENER_PHONE;
const symbols = (process.env.SCREENER_SYMBOLS ?? DEFAULT_SYMBOLS.join(','))
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

// US markets trade on New York dates, whatever the Mac's timezone.
const runAt = new Date();
const today = runAt.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

const log = (msg) => console.log(`[${runAt.toISOString()}] ${msg}`);

async function main() {
  if (!dryRun && !phone) throw new Error('Set SCREENER_PHONE (or use --dry-run).');

  const results = await Promise.all(symbols.map((symbol) => screenSymbol(symbol, today)));
  results.filter((r) => r.error).forEach((r) => log(`${r.symbol}: ${r.error}`));

  if (!force && results.every((r) => r.marketClosed || r.error)) {
    log(`No trading session found for ${today} (holiday?). Nothing sent.`);
    return;
  }

  const message = formatMessage(results, runAt);
  if (dryRun) {
    console.log(message);
    return;
  }
  await sendIMessage(phone, message);
  log(`Sent to ${phone.slice(0, -4).replace(/\d/g, '•')}${phone.slice(-4)}: ${results.filter((r) => r.match).length} match(es).`);
}

main().catch((err) => {
  log(`FAILED: ${err.message}`);
  process.exit(1);
});
