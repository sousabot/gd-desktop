import React from 'react';
import Sparkline from './Sparkline';

export default function StatCard({ label, value, delta, trend, history = [] }) {
  const inferredTrend = trend || (delta?.startsWith('-') ? 'down' : delta?.startsWith('+') ? 'up' : 'flat');

  return (
    <div className="gd-stat-card">
      <div className="gd-stat-card__top">
        <span className="gd-stat-card__label">{label}</span>
        <Sparkline points={history} trend={inferredTrend} />
      </div>
      <div className="gd-stat-card__bottom">
        <span className="gd-stat-card__value gd-mono">{value}</span>
        {delta && (
          <span className={`gd-stat-card__delta gd-mono gd-stat-card__delta--${inferredTrend}`}>{delta}</span>
        )}
      </div>
    </div>
  );
}
