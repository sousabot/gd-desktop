export function padTeamBans(bans, teamId, slots = 5) {
  const list = (bans || [])
    .filter((b) => Number(b.teamId) === Number(teamId))
    .slice()
    .sort((a, b) => (Number(a.pickTurn) || 99) - (Number(b.pickTurn) || 99));
  const out = [];
  for (let i = 0; i < slots; i += 1) {
    out.push(list[i] || { teamId, champion: null, championId: 0, pickTurn: i + 1 });
  }
  return out;
}
