// Colors shared by the chart lines and the indicator legend so they always match.
export const COLORS = {
  up: '#22c55e',
  down: '#ef4444',
  volumeUp: 'rgba(34, 197, 94, 0.45)',
  volumeDown: 'rgba(239, 68, 68, 0.45)',
  ma50: '#f59e8b',
  ma200: '#5eead4',
  boll: '#a5b4fc',
  rsi: '#fb923c',
};

/** Indicator lines drawn over the price, in legend order. */
export const OVERLAYS = [
  { key: 'ma50', label: 'MA(50)', color: COLORS.ma50 },
  { key: 'ma200', label: 'MA(200)', color: COLORS.ma200 },
  { key: 'bollUpper', label: 'BOLL U', color: COLORS.boll },
  { key: 'bollMiddle', label: 'BOLL MA', color: COLORS.boll },
  { key: 'bollLower', label: 'BOLL L', color: COLORS.boll },
];
