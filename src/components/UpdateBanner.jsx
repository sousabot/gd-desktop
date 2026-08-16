import React, { useEffect, useState } from 'react';
import './UpdateBanner.css';

export default function UpdateBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!window.gdUpdate) return undefined;
    window.gdUpdate.status().then(setStatus).catch(() => {});
    return window.gdUpdate.onStatus(setStatus);
  }, []);

  if (!status || status.state === 'dev' || status.state === 'idle' || status.state === 'current' || status.state === 'checking') {
    return null;
  }

  const version = status.version ? `v${status.version}` : 'a new version';
  let text = `${version} is available.`;
  let action = 'Update';
  if (status.state === 'error') {
    text = status.portable
      ? 'This portable build cannot auto-update. Install GD Esports Setup once — after that, GD updates itself.'
      : (status.message || 'Could not check for updates.');
    action = status.portable ? 'Get Setup' : null;
  } else if (status.state === 'downloading') {
    text = `Downloading ${version}… ${status.percent || 0}%`;
    action = null;
  } else if (status.state === 'ready') {
    text = `${version} is downloaded. Restart to apply it.`;
    action = 'Restart now';
  } else if (status.portable) {
    text = `${version} is out. Install the Setup build once — after that, GD updates itself.`;
    action = 'Get Setup';
  }

  const onClick = async () => {
    if (status.portable) {
      await window.gdUpdate.open(status.setupUrl || status.url);
      return;
    }
    if (status.state === 'ready' || status.state === 'available') {
      await window.gdUpdate.install();
    }
  };

  return (
    <div className="gd-update-banner" role="status">
      <span>{text}</span>
      {action ? (
        <button type="button" onClick={onClick}>{action}</button>
      ) : null}
    </div>
  );
}
