import React from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../state/SessionContext';
import { useI18n } from '../i18n/LocaleContext';
import LOGO from '../assets/logo.png';
import './Login.css';

export default function Login() {
  const { session, setSession } = useSession();
  const { t } = useI18n();
  const unlink = () => setSession(null);

  return (
    <div className="rift-page rift-page--narrow">
      <section className="rift-panel rift-login-card">
        <img className="rift-login-logo" src={LOGO} alt="Rift.lol" />
        <p className="rift-text-muted">{t('login.blurb')}</p>
        <p className="rift-text-muted">{t('login.unsigned')}</p>

        {session ? (
          <>
            <p className="rift-login-linked">{t('login.linkedAs', { id: `${session.gameName}#${session.tagLine}` })}</p>
            <Link to="/" className="rift-login-btn">{t('login.goDash')}</Link>
            <div className="rift-login-alt">
              <Link to="/link-account">{t('login.switch')}</Link>
              <button type="button" onClick={unlink}>{t('login.unlink')}</button>
            </div>
          </>
        ) : (
          <Link to="/link-account" className="rift-login-btn">{t('login.linkCta')}</Link>
        )}
      </section>
    </div>
  );
}
