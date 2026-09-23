/**
 * Technical indicators over an array of closing prices. Each function returns
 * an array the same length as its input, with null wherever there is not yet
 * enough history to compute a value.
 */

export function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average, seeded with the SMA of the first `period` values. */
export function ema(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function bollinger(values, period = 20, multiplier = 2) {
  const middle = sma(values, period);
  return values.map((_, i) => {
    if (middle[i] === null) return { upper: null, middle: null, lower: null };
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (values[j] - middle[i]) ** 2;
    const deviation = Math.sqrt(variance / period);
    return {
      upper: middle[i] + multiplier * deviation,
      middle: middle[i],
      lower: middle[i] - multiplier * deviation,
    };
  });
}

function toRsi(avgGain, avgLoss) {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

/** Relative Strength Index using Wilder's smoothing. */
export function rsi(values, period = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length <= period) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = values[i] - values[i - 1];
    if (delta > 0) gain += delta;
    else loss -= delta;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = toRsi(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
    out[i] = toRsi(avgGain, avgLoss);
  }
  return out;
}
