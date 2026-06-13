"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type LineData,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

export type LightweightPoint = {
  time: Time;
  value: number;
};

export type LightweightLineSeries = {
  label?: string;
  color: string;
  data: LightweightPoint[];
};

export type LightweightHistogramPoint = LightweightPoint & {
  color?: string;
};

export type LightweightCandle = {
  label?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type ChartTone = "up" | "down" | "neutral";

type BaseChartOptions = {
  height: number;
  compact?: boolean;
  interactive?: boolean;
  decimals?: number;
  valuePrefix?: string;
  valueSuffix?: string;
};

type LightweightAreaChartProps = BaseChartOptions & {
  data: LightweightPoint[];
  tone?: ChartTone;
  lineColor?: string;
  topColor?: string;
  bottomColor?: string;
  className?: string;
  ariaLabel?: string;
};

type LightweightMultiLineChartProps = BaseChartOptions & {
  series: LightweightLineSeries[];
  className?: string;
  ariaLabel?: string;
};

type LightweightHistogramChartProps = BaseChartOptions & {
  data: LightweightHistogramPoint[];
  color?: string;
  className?: string;
  ariaLabel?: string;
};

type LightweightCandlestickChartProps = {
  candles: LightweightCandle[];
  height?: number;
  className?: string;
  ariaLabel?: string;
};

const tonePalette: Record<ChartTone, { line: string; top: string; bottom: string }> = {
  up: {
    line: "#ef4444",
    top: "rgba(239, 68, 68, 0.28)",
    bottom: "rgba(239, 68, 68, 0.02)",
  },
  down: {
    line: "#2563eb",
    top: "rgba(37, 99, 235, 0.24)",
    bottom: "rgba(37, 99, 235, 0.02)",
  },
  neutral: {
    line: "#64748b",
    top: "rgba(100, 116, 139, 0.2)",
    bottom: "rgba(100, 116, 139, 0.02)",
  },
};

export function LightweightAreaChart({
  data,
  height,
  compact = false,
  interactive = true,
  decimals = 0,
  valuePrefix = "",
  valueSuffix = "",
  tone = "neutral",
  lineColor,
  topColor,
  bottomColor,
  className,
  ariaLabel = "Lightweight area chart",
}: LightweightAreaChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || data.length === 0) return;

    const palette = tonePalette[tone];
    const { chart, dispose } = createResponsiveChart(container, {
      height,
      compact,
      interactive,
      decimals,
      valuePrefix,
      valueSuffix,
    });
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: lineColor ?? palette.line,
      topColor: topColor ?? palette.top,
      bottomColor: bottomColor ?? palette.bottom,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: !compact,
    });

    areaSeries.setData(data);
    chart.timeScale().fitContent();

    return dispose;
  }, [bottomColor, className, compact, data, decimals, height, interactive, lineColor, tone, topColor, valuePrefix, valueSuffix]);

  return <div ref={containerRef} className={className} style={{ height }} role="img" aria-label={ariaLabel} />;
}

export function LightweightMultiLineChart({
  series,
  height,
  compact = false,
  interactive = true,
  decimals = 0,
  valuePrefix = "",
  valueSuffix = "",
  className,
  ariaLabel = "Lightweight multi-line chart",
}: LightweightMultiLineChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || series.length === 0) return;

    const { chart, dispose } = createResponsiveChart(container, {
      height,
      compact,
      interactive,
      decimals,
      valuePrefix,
      valueSuffix,
    });

    series.forEach((item) => {
      const lineSeries = chart.addSeries(LineSeries, {
        color: item.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: !compact,
      });
      lineSeries.setData(item.data);
    });

    chart.timeScale().fitContent();

    return dispose;
  }, [className, compact, decimals, height, interactive, series, valuePrefix, valueSuffix]);

  return <div ref={containerRef} className={className} style={{ height }} role="img" aria-label={ariaLabel} />;
}

export function LightweightHistogramChart({
  data,
  height,
  compact = false,
  interactive = true,
  decimals = 0,
  valuePrefix = "",
  valueSuffix = "",
  color = "#64748b",
  className,
  ariaLabel = "Lightweight histogram chart",
}: LightweightHistogramChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || data.length === 0) return;

    const { chart, dispose } = createResponsiveChart(container, {
      height,
      compact,
      interactive,
      decimals,
      valuePrefix,
      valueSuffix,
    });
    const histogramSeries = chart.addSeries(HistogramSeries, {
      color,
      priceLineVisible: false,
      lastValueVisible: !compact,
    });

    histogramSeries.setData(data);
    chart.timeScale().fitContent();

    return dispose;
  }, [className, color, compact, data, decimals, height, interactive, valuePrefix, valueSuffix]);

  return <div ref={containerRef} className={className} style={{ height }} role="img" aria-label={ariaLabel} />;
}

export function LightweightCandlestickChart({
  candles,
  height = 340,
  className,
  ariaLabel = "Lightweight candlestick chart",
}: LightweightCandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || candles.length === 0) return;

    const { chart, dispose } = createResponsiveChart(container, {
      height,
      compact: false,
      interactive: true,
      decimals: 0,
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#ef4444",
      downColor: "#2563eb",
      borderUpColor: "#ef4444",
      borderDownColor: "#2563eb",
      wickUpColor: "#ef4444",
      wickDownColor: "#2563eb",
      priceLineVisible: false,
    });
    const candleData: CandlestickData[] = candles.map((candle, index) => ({
      time: indexedTimestamp(index, 15),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    candleSeries.setData(candleData);

    const ma5Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const ma10Series = chart.addSeries(LineSeries, {
      color: "#d946ef",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    ma5Series.setData(movingAverage(candleData, 5));
    ma10Series.setData(movingAverage(candleData, 10));
    chart.timeScale().fitContent();

    return dispose;
  }, [candles, className, height]);

  return <div ref={containerRef} className={className} style={{ height }} role="img" aria-label={ariaLabel} />;
}

function createResponsiveChart(
  container: HTMLDivElement,
  { height, compact = false, interactive = true, decimals = 0, valuePrefix = "", valueSuffix = "" }: BaseChartOptions
) {
  container.replaceChildren();

  const chart = createChart(container, {
    width: Math.max(container.clientWidth, 320),
    height,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: "#64748b",
      fontFamily: "inherit",
      fontSize: compact ? 10 : 11,
    },
    grid: {
      vertLines: { color: compact ? "transparent" : "#eef2f7" },
      horzLines: { color: compact ? "rgba(226, 232, 240, 0.65)" : "#e2e8f0" },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
    },
    rightPriceScale: {
      visible: !compact,
      borderColor: "#cbd5e1",
      scaleMargins: {
        top: 0.12,
        bottom: 0.16,
      },
    },
    timeScale: {
      visible: !compact,
      borderColor: "#cbd5e1",
      timeVisible: true,
      secondsVisible: false,
    },
    localization: {
      locale: "ko-KR",
      priceFormatter: (price: number) => formatChartValue(price, decimals, valuePrefix, valueSuffix),
    },
    handleScroll: interactive,
    handleScale: interactive,
  });

  const resize = () => {
    chart.resize(Math.max(container.clientWidth, 320), height);
  };
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
  observer?.observe(container);

  return {
    chart,
    dispose: () => {
      observer?.disconnect();
      safeRemoveChart(chart);
    },
  };
}

function safeRemoveChart(chart: IChartApi) {
  try {
    chart.remove();
  } catch {
    // The chart can already be disposed during fast React refresh cycles.
  }
}

function indexedTimestamp(index: number, intervalMinutes = 60): UTCTimestamp {
  return Math.floor(Date.UTC(2026, 5, 13, 9, index * intervalMinutes) / 1000) as UTCTimestamp;
}

function movingAverage(data: CandlestickData[], windowSize: number): LineData[] {
  return data
    .map((point, index) => {
      if (index + 1 < windowSize) return null;
      const slice = data.slice(index + 1 - windowSize, index + 1);
      const value = slice.reduce((sum, item) => sum + item.close, 0) / windowSize;
      return {
        time: point.time,
        value: Number(value.toFixed(2)),
      };
    })
    .filter((point): point is LineData => point !== null);
}

function formatChartValue(value: number, decimals: number, valuePrefix: string, valueSuffix: string) {
  return `${valuePrefix}${value.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${valueSuffix}`;
}
