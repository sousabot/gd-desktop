import React, { useEffect, useState } from 'react';
import { subscribeApiNotice } from '../lib/apiNotice';
import './ApiNotice.css';

export default function ApiNotice() {
  const [notice, setNotice] = useState(null);

  useEffect(() => subscribeApiNotice((next) => {
    setNotice(next);
  }), []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 20000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!notice) return null;

  return (
    <div className={`rift-api-notice rift-api-notice--${notice.kind}`} role="status">
      <span>{notice.message}</span>
      <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">×</button>
    </div>
  );
}
