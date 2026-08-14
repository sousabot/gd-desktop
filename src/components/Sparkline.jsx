import React from 'react';

export default function Sparkline({ points = [], trend = 'flat', width = 96, height = 28 }) {
  if (!points.length) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1 || 1);

  const coords = points.map((p, i) => {
    const x = i * step;
    const y = height - ((p - min) / range) * height;
    return [x, y];
  });

  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lastX, lastY] = coords[coords.length - 1];
  const color = trend === 'up' ? 'var(--gd-success)' : trend === 'down' ? 'var(--gd-danger)' : 'var(--gd-text-faint)';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="gd-sparkline">
      <path d={path} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}
