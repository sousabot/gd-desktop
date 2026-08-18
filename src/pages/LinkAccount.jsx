import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../state/SessionContext';
import { useI18n } from '../i18n/LocaleContext';
import { REGIONS, parseRiotIdInput, linkErrorMessage } from '../lib/regions';
import { noticeFromError } from '../lib/apiNotice';
import './LinkAccount.css';

export default function LinkAccount() {
  const { session, setSession } = useSession();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [gameName, setGameName] = useState('');
  const [tagLine, setTagLine] = useState('');
  const [regionIdx, setRegionIdx] = useState(0);
  const [status, setStatus] = useState(null); // null | 'checking' | 'error'
  const [error, setError] = useState('');

  useEffect(() => {
    window.riotAPI?.wakeProxy?.().catch(() => {});
  }, []);

  const unlink = () => {
    setSession(null);
    setGameName('');
    setTagLine('');
    setStatus(null);
    setError('');
  };

  const onNameChange = (value) => {
    if (value.includes('#')) {
      const parsed = parseRiotIdInput(value, tagLine);
      setGameName(parsed.gameName);
      if (parsed.tagLine) setTagLine(parsed.tagLine);
      return;
    }
    setGameName(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = parseRiotIdInput(gameName, tagLine);
    if (!parsed.gameName || !parsed.tagLine) {
      setStatus('error');
      setError(t('link.needBoth'));
      return;
    }

    setGameName(parsed.gameName);
    setTagLine(parsed.tagLine);
    setError('');

    const hint = REGIONS[regionIdx] || REGIONS[0];
    if (!window.riotAPI?.linkAccount && !window.riotAPI?.getAccountByRiotId) {
      setStatus('error');
      setError(t('link.noApi'));
      return;
    }

    setStatus('checking');
    try {
      const linked = window.riotAPI.linkAccount
        ? await window.riotAPI.linkAccount({
            gameName: parsed.gameName,
            tagLine: parsed.tagLine,
            region: hint.region,
            platform: hint.platform,
          })
        : {
            ...(await window.riotAPI.getAccountByRiotId({
              gameName: parsed.gameName,
              tagLine: parsed.tagLine,
              region: hint.region,
            })),
            region: hint.region,
            platform: hint.platform,
          };

      setSession({
        gameName: linked.gameName || parsed.gameName,
        tagLine: linked.tagLine || parsed.tagLine,
        region: linked.region || hint.region,
        platform: linked.platform || hint.platform,
        puuid: linked.puuid || null,
      });
      setStatus(null);
      navigate({ pathname: '/', search: '' }, { replace: true });
    } catch (err) {
      noticeFromError(err);
      setStatus('error');
      setError(linkErrorMessage(err));
    }
  };

  return (
    <div className="rift-page rift-page--narrow">
      <section className="rift-panel">
        <h2>{session ? t('link.switchTitle') : t('link.title')}</h2>
        {session && (
          <div className="rift-link-current">
            {t('link.current', { id: `${session.gameName}#${session.tagLine}` })}
            <button type="button" className="rift-link-unlink" onClick={unlink}>{t('login.unlink')}</button>
          </div>
        )}
        <form className="rift-link-form" onSubmit={handleSubmit}>
          <div className="rift-link-row">
            <input
              value={gameName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t('link.name')}
              autoFocus
              autoComplete="off"
              required
            />
            <span className="rift-link-hash">#</span>
            <input
              className="rift-link-tag"
              value={tagLine}
              onChange={(e) => setTagLine(e.target.value.replace(/^#/, '').toUpperCase())}
              placeholder={t('link.tag')}
              maxLength={5}
              autoComplete="off"
              required
            />
          </div>

          <select value={regionIdx} onChange={(e) => setRegionIdx(Number(e.target.value))}>
            {REGIONS.map((r, i) => (
              <option key={r.platform} value={i}>{r.label}</option>
            ))}
          </select>
          <p className="rift-link-hint">
            {status === 'checking' ? t('link.checking') : t('link.hint')}
          </p>

          {status === 'error' && <p className="rift-link-error">{error}</p>}

          <button type="submit" disabled={status === 'checking'}>
            {status === 'checking' ? t('link.checkingBtn') : session ? t('link.switch') : t('link.verify')}
          </button>
        </form>
      </section>
    </div>
  );
}
