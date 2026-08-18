import React from 'react';
import Sparkline from './Sparkline';

export default function StatCard({ label, value, delta, trend, history = [] }) {
  const inferredTrend = trend || (delta?.startsWith('-') ? 'down' : delta?.startsWith('+') ? 'up' : 'flat');

  return (
    <div className="rift-stat-card">
      <div className="rift-stat-card__top">
        <span className="rift-stat-card__label">{label}</span>
        <Sparkline points={history} trend={inferredTrend} />
      </div>
      <div className="rift-stat-card__bottom">
        <span className="rift-stat-card__value rift-mono">{value}</span>
        {delta && (
          <span className={`rift-stat-card__delta rift-mono rift-stat-card__delta--${inferredTrend}`}>{delta}</span>
        )}
      </div>
    </div>
  );
}
