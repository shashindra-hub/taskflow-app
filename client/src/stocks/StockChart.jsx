import { useEffect, useRef } from 'react';
import {
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
} from 'lightweight-charts';
import { COLORS, OVERLAYS } from './series.js';

const RSI_PANE_HEIGHT = 150;

/**
 * Price chart with volume, moving averages and Bollinger Bands in the main
 * pane and RSI(14) in a second pane below, sharing one time axis.
 * Calls onHover(point | null) as the crosshair moves.
 */
export default function StockChart({ data, onHover }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const onHoverRef = useRef(onHover);
  const pointsByTimeRef = useRef(new Map());

  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);

  // Create the chart and its series once; later data changes only call setData.
  useEffect(() => {
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontFamily: 'inherit',
        panes: { separatorColor: '#1f2937', enableResize: false },
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#6b7280', style: LineStyle.Dashed, labelBackgroundColor: '#374151' },
        horzLine: { color: '#6b7280', style: LineStyle.Dashed, labelBackgroundColor: '#374151' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, secondsVisible: false, lockVisibleTimeRangeOnResize: true },
    });

    const quiet = { lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false };

    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const overlays = OVERLAYS.map(({ key, color }) => ({
      key,
      series: chart.addSeries(LineSeries, {
        ...quiet,
        color,
        lineStyle: key === 'bollMiddle' ? LineStyle.Dotted : LineStyle.Solid,
      }),
    }));

    const price = chart.addSeries(LineSeries, {
      color: COLORS.up,
      lineWidth: 2,
      priceLineStyle: LineStyle.Dashed,
    });
    price.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });

    const rsi = chart.addSeries(LineSeries, { ...quiet, color: COLORS.rsi, lastValueVisible: true }, 1);
    rsi.createPriceLine({ price: 70, color: 'rgba(251, 146, 60, 0.4)', lineStyle: LineStyle.Dashed, axisLabelVisible: false });
    rsi.createPriceLine({ price: 30, color: 'rgba(251, 146, 60, 0.4)', lineStyle: LineStyle.Dashed, axisLabelVisible: false });
    chart.panes()[1].setHeight(RSI_PANE_HEIGHT);

    chart.subscribeCrosshairMove((param) => {
      const point = param.time === undefined ? null : pointsByTimeRef.current.get(param.time);
      onHoverRef.current?.(point ?? null);
    });

    chartRef.current = { chart, price, volume, overlays, rsi };
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const refs = chartRef.current;
    if (!refs || !data) return;
    const { chart, price, volume, overlays, rsi } = refs;

    // Shift timestamps into the exchange's timezone so the axis reads in
    // market time (e.g. 9:30 open for US stocks) wherever the viewer is.
    const toTime = (t) => t + data.gmtOffset;
    const line = (key) =>
      data.points.map((p) => (p[key] === null ? { time: toTime(p.time) } : { time: toTime(p.time), value: p[key] }));

    pointsByTimeRef.current = new Map(data.points.map((p) => [toTime(p.time), p]));

    chart.applyOptions({ timeScale: { timeVisible: data.intraday } });
    price.applyOptions({ color: data.change >= 0 ? COLORS.up : COLORS.down });
    price.setData(line('close'));
    volume.setData(
      data.points.map((p) => ({
        time: toTime(p.time),
        value: p.volume,
        color: p.close >= p.open ? COLORS.volumeUp : COLORS.volumeDown,
      }))
    );
    overlays.forEach(({ key, series }) => series.setData(line(key)));
    rsi.setData(line('rsi'));
    chart.timeScale().fitContent();
  }, [data]);

  return <div className="stock-chart" ref={containerRef} data-testid="stock-chart" />;
}
