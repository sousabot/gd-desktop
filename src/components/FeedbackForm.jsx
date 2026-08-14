import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '../state/SessionContext';
import './FeedbackForm.css';

const APP_VERSION = '0.1.0';

export default function FeedbackForm({ open, onClose }) {
  const { session } = useSession();
  const location = useLocation();
  const riotId = session ? `${session.gameName}#${session.tagLine}` : '';

  const [kind, setKind] = useState('bug');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !sending) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, sending, onClose]);

  useEffect(() => {
    if (!open) {
      setKind('bug');
      setTitle('');
      setMessage('');
      setContact('');
      setError('');
      setSent(false);
      setSending(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError('Add a title and some details.');
      return;
    }
    if (!window.gdAPI?.sendFeedback) {
      setError('Restart the desktop app so feedback can reach Discord.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await window.gdAPI.sendFeedback({
        kind,
        title: title.trim(),
        message: message.trim(),
        contact: contact.trim(),
        riotId,
        page: location.pathname || '/',
        appVersion: APP_VERSION,
      });
      setSent(true);
    } catch (err) {
      const raw = String(err?.message || '');
      if (raw.includes('No handler registered')) {
        setError('Quit GD Esports fully (not Refresh) and start it again with npm run dev.');
      } else {
        setError(raw.replace(/^Error invoking remote method '[^']+': Error:\s*/i, '') || 'Could not send to Discord.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="gd-fb-overlay" onClick={() => !sending && onClose?.()} role="presentation">
      <div
        className="gd-fb-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gd-fb-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="gd-fb-close" onClick={onClose} aria-label="Close">×</button>
        {sent ? (
          <div className="gd-fb-done">
            <h2 id="gd-fb-title">Sent to Discord</h2>
            <p>Thanks — we’ll take a look.</p>
            <button type="button" className="gd-fb-submit" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 id="gd-fb-title">Report feedback / bugs</h2>
            <p className="gd-fb-lead">This posts straight into the GD Discord webhook.</p>

            <div className="gd-fb-kinds">
              <button type="button" className={kind === 'bug' ? 'is-on' : ''} onClick={() => setKind('bug')}>Bug</button>
              <button type="button" className={kind === 'feedback' ? 'is-on' : ''} onClick={() => setKind('feedback')}>Feedback</button>
            </div>

            <label>
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="Short summary"
                autoFocus
              />
            </label>
            <label>
              Details
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1800}
                rows={6}
                placeholder="What happened, what you expected, and how to reproduce it."
              />
            </label>
            <label>
              Discord / contact (optional)
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={80}
                placeholder="username"
              />
            </label>
            {riotId && <div className="gd-fb-meta">Linked as {riotId}</div>}
            {error && <div className="gd-fb-error">{error}</div>}
            <button type="submit" className="gd-fb-submit" disabled={sending}>
              {sending ? 'Sending…' : 'Send to Discord'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
