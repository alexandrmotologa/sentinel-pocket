import type { FC } from 'react';
import { LatencyTick } from '../types.js';

interface LatencySparklineProps {
  data: LatencyTick[];
  height?: number;
  width?: number;
}

export const LatencySparkline: FC<LatencySparklineProps> = ({
  data,
  height = 36,
  width = 140,
}) => {
  if (!data || data.length < 2) {
    return (
      <div
        style={{ height, width }}
        className="flex items-center justify-center text-[10px] text-tg-hint/50 font-mono"
      >
        Collecting ticks...
      </div>
    );
  }

  const values = data.map((d) => d.latencyMs);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values, minVal + 10);
  const range = maxVal - minVal || 1;

  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * (width - 4) + 2;
    // Invert Y so high latency is near top
    const y = height - ((val - minVal) / range) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const latestVal = values[values.length - 1];
  let strokeColor = '#22c55e'; // Green

  if (latestVal > 1500) {
    strokeColor = '#ef4444'; // Red
  } else if (latestVal > 300) {
    strokeColor = '#f59e0b'; // Amber
  }

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `M ${points[0]} L ${points.join(' L ')} L ${width - 2},${height} L 2,${height} Z`;

  return (
    <div className="relative inline-block">
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id={`grad-${latestVal}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#grad-${latestVal})`} />
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Latest point indicator */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].split(',')[0]}
            cy={points[points.length - 1].split(',')[1]}
            r="3"
            fill={strokeColor}
            className="animate-ping-once"
          />
        )}
      </svg>
    </div>
  );
};
