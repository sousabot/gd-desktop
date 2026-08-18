function hashPick(id, n) {
  const raw = String(id || '');
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  return Math.abs(h) % Math.max(1, n);
}

function minutesOf(game) {
  const m = Number(game?.durationMin);
  if (Number.isFinite(m) && m > 0) return m;
  return 1;
}

function csTotal(game) {
  const n = Number(game?.cs);
  if (Number.isFinite(n) && n > 0) return n;
  const alt = Number(game?.csm);
  return Number.isFinite(alt) ? alt : null;
}

function expectedShare(role) {
  const r = String(role || '');
  if (r === 'Support') return 0.12;
  if (r === 'ADC' || r === 'Mid') return 0.24;
  if (r === 'Jungle') return 0.18;
  return 0.20;
}

function expectedCsm(role) {
  const r = String(role || '');
  if (r === 'Support') return null;
  if (r === 'Jungle') return 6.2;
  if (r === 'ADC' || r === 'Mid') return 8.0;
  return 7.0;
}

export function pickMatchStory(game) {
  const won = !!game?.win;
  const mins = minutesOf(game);
  const role = game?.role || '';
  const picks = [];

  const gd15 = game?.goldDiff15;
  if (gd15 != null && Number.isFinite(Number(gd15))) {
    const n = Math.round(Number(gd15));
    const abs = Math.abs(n);
    let w = abs / 380;
    if (abs < 280) w *= 0.28;
    picks.push({ kind: 'gold', w, n, abs, diff: `${n >= 0 ? '+' : ''}${n}` });
  }

  const share = game?.damageShare;
  if (share != null && Number.isFinite(Number(share))) {
    const pct = Math.round(Number(share) * 100);
    const delta = Math.abs(Number(share) - expectedShare(role));
    picks.push({ kind: 'dmg', w: delta / 0.07, pct, high: Number(share) >= expectedShare(role) });
  }

  const cs = csTotal(game);
  const parCs = expectedCsm(role);
  if (cs != null && parCs != null) {
    const csm = cs / mins;
    picks.push({
      kind: 'cs',
      w: Math.abs(csm - parCs) / 1.5,
      cs: Math.round(cs),
      csm: csm.toFixed(1),
      high: csm >= parCs,
    });
  }

  const deaths = Number(game?.deaths);
  if (Number.isFinite(deaths)) {
    const dpm = deaths / mins;
    const w = dpm >= 0.26 ? (dpm - 0.18) / 0.12 : dpm * 0.25;
    picks.push({ kind: 'deaths', w, deaths, high: dpm >= 0.26 });
  }

  const kda = Number(game?.kda);
  if (Number.isFinite(kda)) {
    picks.push({
      kind: 'kda',
      w: Math.abs(kda - 2.4) / 1.7,
      kda: kda.toFixed(1),
      k: game.kills,
      d: game.deaths,
      a: game.assists,
      high: kda >= 2.4,
    });
  }

  picks.sort((a, b) => b.w - a.w);
  if (!picks.length) return { key: 'review.goldUnknown', vars: null };

  let choice = picks[0];
  const close = picks.filter((p) => p.w >= choice.w * 0.78).slice(0, 3);
  if (close.length > 1 && ((choice.kind === 'gold' && Math.abs(choice.n) < 500) || close[1].w > 0.85)) {
    const pool = close.some((p) => p.kind !== 'gold')
      ? close.filter((p) => p.kind !== 'gold' || Math.abs(p.n) >= 450)
      : close;
    choice = pool[hashPick(game.matchId, pool.length)] || choice;
  }

  if (choice.kind === 'gold') {
    if (!won) {
      if (choice.n <= -300) return { key: 'review.lossBehind', vars: { n: choice.abs } };
      if (choice.n >= 300) return { key: 'review.lossAhead', vars: { n: choice.abs } };
      return { key: 'review.lossEven', vars: { diff: choice.diff } };
    }
    if (choice.n >= 300) return { key: 'review.winAhead', vars: { n: choice.abs } };
    if (choice.n <= -300) return { key: 'review.winBehind', vars: { n: choice.abs } };
    return { key: 'review.winEven', vars: { diff: choice.diff } };
  }

  if (choice.kind === 'dmg') {
    if (won && !choice.high) return { key: 'review.winLowDmg', vars: { n: choice.pct } };
    if (won && choice.high) return { key: 'review.winHighDmg', vars: { n: choice.pct } };
    if (!won && !choice.high) return { key: 'review.lossLowDmg', vars: { n: choice.pct } };
    return { key: 'review.lossHighDmg', vars: { n: choice.pct } };
  }

  if (choice.kind === 'cs') {
    if (won && !choice.high) return { key: 'review.winLowCs', vars: { cs: choice.cs, csm: choice.csm } };
    if (won && choice.high) return { key: 'review.winHighCs', vars: { cs: choice.cs, csm: choice.csm } };
    if (!won && !choice.high) return { key: 'review.lossLowCs', vars: { cs: choice.cs, csm: choice.csm } };
    return { key: 'review.lossHighCs', vars: { cs: choice.cs, csm: choice.csm } };
  }

  if (choice.kind === 'deaths') {
    if (won) return { key: 'review.winDeaths', vars: { n: choice.deaths } };
    return { key: 'review.lossDeaths', vars: { n: choice.deaths } };
  }

  if (won && choice.high) return { key: 'review.winGoodKda', vars: { kda: choice.kda, k: choice.k, d: choice.d, a: choice.a } };
  if (won) return { key: 'review.winLowKda', vars: { kda: choice.kda } };
  if (choice.high) return { key: 'review.lossGoodKda', vars: { kda: choice.kda } };
  return { key: 'review.lossLowKda', vars: { kda: choice.kda } };
}
