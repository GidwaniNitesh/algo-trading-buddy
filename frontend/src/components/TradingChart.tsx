// src/components/TradingChart.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  SeriesMarker,
  Time,
  CrosshairMode,
} from 'lightweight-charts';
import { useTradingStore } from '../store/zustandStore';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/reduxStore';
import type { Order } from '../types';
import { BarChart2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

type ChartSymbol = 'NIFTY' | 'BANKNIFTY';
type TimeframeKey = '1s' | '1m' | '5m' | '15m';

interface CandleBuilder {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number; // Unix seconds, floored to timeframe
}

const TIMEFRAMES: Record<TimeframeKey, { label: string; seconds: number }> = {
  '1s':  { label: '1s',  seconds: 1    },
  '1m':  { label: '1m',  seconds: 60   },
  '5m':  { label: '5m',  seconds: 300  },
  '15m': { label: '15m', seconds: 900  },
};

// ── Marker builder ─────────────────────────────────────────
function buildMarkers(orders: Order[], symbol: ChartSymbol): SeriesMarker<Time>[] {
  return orders
    .filter(o => o.symbol === symbol && o.status === 'COMPLETE' && o.price)
    .map(o => {
      const ts = Math.floor(new Date(o.created_at).getTime() / 1000) as Time;
      const isBuy = o.side === 'BUY';
      return {
        time: ts,
        position: isBuy ? 'belowBar' : 'aboveBar',
        color: isBuy ? '#00d4aa' : '#ff4757',
        shape: isBuy ? 'arrowUp' : 'arrowDown',
        text: `${o.side} ${o.qty} @₹${Number(o.price).toFixed(0)}${o.strategy ? ' [' + o.strategy + ']' : ''}`,
        size: 1.5,
      } as SeriesMarker<Time>;
    })
    .sort((a, b) => (a.time as number) - (b.time as number));
}

const TradingChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef           = useRef<IChartApi | null>(null);
  const candleSeriesRef    = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef    = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [selectedSymbol, setSelectedSymbol] = useState<ChartSymbol>('NIFTY');
  const [timeframe, setTimeframe]           = useState<TimeframeKey>('1m');
  const [candleCount, setCandleCount]       = useState(0);
  const [orderCount, setOrderCount]         = useState(0);
  const [expanded, setExpanded]             = useState(false);

  // Per-symbol, per-timeframe candle storage
  // key: `${symbol}-${timeframe}`
  const candleMap   = useRef<Map<string, CandlestickData[]>>(new Map());
  const builderMap  = useRef<Map<string, CandleBuilder | null>>(new Map());
  const volumeMap   = useRef<Map<string, { time: Time; value: number; color: string }[]>>(new Map());

  const ticks  = useTradingStore(s => s.ticks);
  const orders = useSelector((s: RootState) => s.orders.items);

  // ── Key helpers ─────────────────────────────────────────
  const mapKey = useCallback(
    (sym: ChartSymbol, tf: TimeframeKey) => `${sym}-${tf}`,
    []
  );

  const getCandles = (sym: ChartSymbol, tf: TimeframeKey): CandlestickData[] =>
    candleMap.current.get(mapKey(sym, tf)) || [];

  const setCandles = (sym: ChartSymbol, tf: TimeframeKey, data: CandlestickData[]) =>
    candleMap.current.set(mapKey(sym, tf), data);

  const getBuilder = (sym: ChartSymbol, tf: TimeframeKey): CandleBuilder | null =>
    builderMap.current.get(mapKey(sym, tf)) ?? null;

  const setBuilder = (sym: ChartSymbol, tf: TimeframeKey, b: CandleBuilder | null) =>
    builderMap.current.set(mapKey(sym, tf), b);

  const getVolumes = (sym: ChartSymbol, tf: TimeframeKey) =>
    volumeMap.current.get(mapKey(sym, tf)) || [];

  const setVolumes = (sym: ChartSymbol, tf: TimeframeKey, data: { time: Time; value: number; color: string }[]) =>
    volumeMap.current.set(mapKey(sym, tf), data);

  // ── Init chart ──────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: expanded ? 520 : 380,
      layout: {
        background: { color: '#0a0e1a' },
        textColor: '#9ca3af',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#111827', style: 1 },
        horzLines: { color: '#111827', style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#374151', labelBackgroundColor: '#1f2937' },
        horzLine: { color: '#374151', labelBackgroundColor: '#1f2937' },
      },
      rightPriceScale: {
        borderColor: '#1a2440',
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderColor: '#1a2440',
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 8,
        barSpacing: 8,
      },
    });

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor:         '#00d4aa',
      downColor:       '#ff4757',
      borderUpColor:   '#00d4aa',
      borderDownColor: '#ff4757',
      wickUpColor:     '#00d4aa',
      wickDownColor:   '#ff4757',
    });

    // Volume histogram (bottom 20%)
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current       = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    });
    ro.observe(chartContainerRef.current);

    // Load existing candle data for current symbol/timeframe
    const existingCandles = getCandles(selectedSymbol, timeframe);
    const existingVolumes = getVolumes(selectedSymbol, timeframe);
    if (existingCandles.length > 0) {
      candleSeries.setData(existingCandles);
      volumeSeries.setData(existingVolumes);
    }

    // Apply current markers
    const markers = buildMarkers(orders, selectedSymbol);
    candleSeries.setMarkers(markers);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current        = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]); // Recreate on expand toggle

  // ── Symbol / timeframe switch ───────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    const candles = getCandles(selectedSymbol, timeframe);
    const volumes = getVolumes(selectedSymbol, timeframe);

    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current.setData(volumes);
    setCandleCount(candles.length);

    // Re-apply markers for this symbol
    const markers = buildMarkers(orders, selectedSymbol);
    candleSeriesRef.current.setMarkers(markers);
    setOrderCount(markers.length);

    // Scroll to right edge
    chartRef.current?.timeScale().scrollToRealTime();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol, timeframe]);

  // ── Process incoming tick → build candles ───────────────
  useEffect(() => {
    const tick = ticks[selectedSymbol];
    if (!tick || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const tfSeconds = TIMEFRAMES[timeframe].seconds;
    const tickTs    = Math.floor(new Date(tick.timestamp).getTime() / 1000);
    const barTime   = Math.floor(tickTs / tfSeconds) * tfSeconds;

    const candles = getCandles(selectedSymbol, timeframe);
    const volumes = getVolumes(selectedSymbol, timeframe);
    let builder   = getBuilder(selectedSymbol, timeframe);

    if (!builder || builder.time !== barTime) {
      // Close the previous bar and push it
      if (builder) {
        const closedBar: CandlestickData = {
          time:  builder.time as Time,
          open:  builder.open,
          high:  builder.high,
          low:   builder.low,
          close: builder.close,
        };
        if (candles.length > 0 && candles[candles.length - 1].time === closedBar.time) {
          candles[candles.length - 1] = closedBar;
        } else {
          candles.push(closedBar);
        }
        if (candles.length > 500) candles.splice(0, candles.length - 500);
        setCandles(selectedSymbol, timeframe, candles);
      }

      // Start new bar
      builder = { time: barTime, open: tick.ltp, high: tick.ltp, low: tick.ltp, close: tick.ltp };
      setBuilder(selectedSymbol, timeframe, builder);
    } else {
      // Update current bar
      builder.high  = Math.max(builder.high, tick.ltp);
      builder.low   = Math.min(builder.low,  tick.ltp);
      builder.close = tick.ltp;
      setBuilder(selectedSymbol, timeframe, builder);
    }

    // Live candle (in-progress)
    const liveBar: CandlestickData = {
      time:  builder.time as Time,
      open:  builder.open,
      high:  builder.high,
      low:   builder.low,
      close: builder.close,
    };

    try {
      candleSeriesRef.current.update(liveBar);
    } catch {
      const all = [...candles, liveBar];
      candleSeriesRef.current.setData(all);
    }

    // Volume bar
    const volColor = builder.close >= builder.open ? '#00d4aa44' : '#ff475744';
    const volEntry = { time: builder.time as Time, value: tick.volume || 100, color: volColor };
    if (volumes.length > 0 && volumes[volumes.length - 1].time === volEntry.time) {
      volumes[volumes.length - 1] = volEntry;
    } else {
      volumes.push(volEntry);
      if (volumes.length > 500) volumes.splice(0, volumes.length - 500);
    }
    setVolumes(selectedSymbol, timeframe, volumes);

    try {
      volumeSeriesRef.current.update(volEntry);
    } catch {
      volumeSeriesRef.current.setData(volumes);
    }

    setCandleCount(candles.length + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticks, selectedSymbol, timeframe]);

  // ── Update markers when orders change ──────────────────
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    const markers = buildMarkers(orders, selectedSymbol);
    candleSeriesRef.current.setMarkers(markers);
    setOrderCount(markers.length);
  }, [orders, selectedSymbol]);

  // ── Zoom helpers ────────────────────────────────────────
  const zoomIn  = () => chartRef.current?.timeScale().applyOptions({ barSpacing: 12 });
  const zoomOut = () => chartRef.current?.timeScale().applyOptions({ barSpacing: 5 });

  const currentTick = ticks[selectedSymbol];
  const currentCandles = getCandles(selectedSymbol, timeframe);
  const lastCandle = currentCandles[currentCandles.length - 1];

  return (
    <div className={`bg-dark-800 rounded-xl border border-dark-500 overflow-hidden flex flex-col ${expanded ? 'fixed inset-4 z-50' : ''}`}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-500 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <BarChart2 size={15} className="text-accent-blue" />
            <span className="text-gray-200 font-semibold text-sm">Candlestick Chart</span>
          </div>

          {/* Symbol toggle */}
          <div className="flex gap-1">
            {(['NIFTY', 'BANKNIFTY'] as ChartSymbol[]).map(sym => (
              <button
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                  selectedSymbol === sym
                    ? sym === 'NIFTY'
                      ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/50'
                      : 'bg-accent-purple/20 text-accent-purple border border-accent-purple/50'
                    : 'text-gray-500 border border-dark-500 hover:border-gray-400 hover:text-gray-300'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>

          {/* Timeframe toggle */}
          <div className="flex gap-1">
            {(Object.keys(TIMEFRAMES) as TimeframeKey[]).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-all ${
                  timeframe === tf
                    ? 'bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/50'
                    : 'text-gray-500 border border-dark-500 hover:border-gray-400 hover:text-gray-300'
                }`}
              >
                {TIMEFRAMES[tf].label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: stats + controls */}
        <div className="flex items-center gap-3">
          {/* Live price */}
          {currentTick && (
            <div className="text-right">
              <div className={`text-sm font-mono font-bold ${
                selectedSymbol === 'NIFTY' ? 'text-accent-blue' : 'text-accent-purple'
              }`}>
                ₹{currentTick.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              {lastCandle && (
                <div className={`text-xs font-mono ${
                  currentTick.ltp >= lastCandle.open ? 'text-accent-green' : 'text-accent-red'
                }`}>
                  {currentTick.ltp >= lastCandle.open ? '▲' : '▼'}
                  {' '}{Math.abs(currentTick.ltp - lastCandle.open).toFixed(2)}
                </div>
              )}
            </div>
          )}

          {/* Candle count */}
          <div className="text-xs text-gray-500 font-mono hidden sm:block">
            <div>{candleCount} bars</div>
            <div className={orderCount > 0 ? 'text-accent-yellow' : ''}>
              {orderCount} orders
            </div>
          </div>

          {/* Order marker legend */}
          <div className="hidden md:flex flex-col gap-0.5 text-xs font-mono">
            <div className="flex items-center gap-1">
              <span className="text-accent-green text-base">↑</span>
              <span className="text-gray-500">BUY</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-accent-red text-base">↓</span>
              <span className="text-gray-500">SELL</span>
            </div>
          </div>

          {/* Zoom controls */}
          <div className="flex gap-1">
            <button onClick={zoomIn}  className="p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-dark-600 transition-colors">
              <ZoomIn size={14} />
            </button>
            <button onClick={zoomOut} className="p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-dark-600 transition-colors">
              <ZoomOut size={14} />
            </button>
            <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-dark-600 transition-colors">
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── OHLC info bar ── */}
      {lastCandle && (
        <div className="flex items-center gap-4 px-4 py-1.5 bg-dark-900/60 border-b border-dark-600 text-xs font-mono">
          <span className="text-gray-500">O</span>
          <span className="text-gray-300">{lastCandle.open.toFixed(2)}</span>
          <span className="text-gray-500">H</span>
          <span className="text-accent-green">{lastCandle.high.toFixed(2)}</span>
          <span className="text-gray-500">L</span>
          <span className="text-accent-red">{lastCandle.low.toFixed(2)}</span>
          <span className="text-gray-500">C</span>
          <span className={lastCandle.close >= lastCandle.open ? 'text-accent-green' : 'text-accent-red'}>
            {lastCandle.close.toFixed(2)}
          </span>
          {lastCandle.close !== lastCandle.open && (
            <>
              <span className="text-gray-500">Chg</span>
              <span className={lastCandle.close >= lastCandle.open ? 'text-accent-green' : 'text-accent-red'}>
                {lastCandle.close >= lastCandle.open ? '+' : ''}
                {(lastCandle.close - lastCandle.open).toFixed(2)}
                {' '}
                ({((lastCandle.close - lastCandle.open) / lastCandle.open * 100).toFixed(2)}%)
              </span>
            </>
          )}
          <span className="ml-auto flex items-center gap-2 text-gray-600">
            {currentTick?.isLive
              ? <span className="text-accent-green font-bold">● LIVE</span>
              : <a href="http://localhost:3001/auth/login" target="_blank" rel="noreferrer"
                   className="text-accent-yellow hover:text-yellow-300 transition-colors font-bold cursor-pointer"
                   title="Connect Upstox for real market data">
                  ⚠ MOCK DATA · Connect Live →
                </a>
            }
            <span>{timeframe} · {selectedSymbol}</span>
          </span>
        </div>
      )}

      {/* ── Chart canvas ── */}
      <div
        ref={chartContainerRef}
        className="w-full flex-1"
        style={{ minHeight: expanded ? 'calc(100vh - 200px)' : '380px' }}
      />

      {/* ── Order list below chart ── */}
      {orders.filter(o => o.symbol === selectedSymbol && o.status === 'COMPLETE').length > 0 && (
        <div className="border-t border-dark-500 px-4 py-2 flex gap-3 overflow-x-auto flex-shrink-0 bg-dark-900/40">
          <span className="text-xs text-gray-500 whitespace-nowrap self-center">Executed:</span>
          {orders
            .filter(o => o.symbol === selectedSymbol && o.status === 'COMPLETE')
            .slice(0, 10)
            .map(o => (
              <div
                key={o.id}
                className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
                  o.side === 'BUY'
                    ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                    : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                }`}
              >
                <span className="font-bold">{o.side === 'BUY' ? '↑' : '↓'} {o.side}</span>
                <span className="text-white/70">{o.qty}</span>
                <span>@₹{Number(o.price).toFixed(0)}</span>
                {o.strategy && <span className="text-gray-500">[{o.strategy}]</span>}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default TradingChart;
