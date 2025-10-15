const API_KEY = '975e470a4df2f04c6da86ee5bfd03034';
const LEAGUES = [
  { key: 'soccer_epl', title: 'Premier League' },
  { key: 'soccer_esp_la_liga', title: 'La Liga' },
  { key: 'soccer_ita_serie_a', title: 'Serie A' },
  { key: 'soccer_fra_ligue_one', title: 'Ligue 1' },
  { key: 'soccer_germany_bundesliga', title: 'Bundesliga' }
];

const regions = 'eu'; // change as desired
const markets = 'h2h'; // head-to-head odds
const oddsFormat = 'decimal';

const leagueSelect = document.getElementById('league-select');
const dateSelect = document.getElementById('date-select');
const customDate = document.getElementById('custom-date');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const applyBtn = document.getElementById('apply-btn');
const refreshBtn = document.getElementById('refresh-btn');
const matchesBody = document.getElementById('matches-body');
const lastUpdated = document.getElementById('last-updated');

let allMatches = [];
let lastFetchTime = null;


function populateLeagueOptions(){
  LEAGUES.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.key;
    opt.textContent = l.title;
    leagueSelect.appendChild(opt);
  });
}
populateLeagueOptions();


dateSelect.addEventListener('change', () => {
  customDate.style.display = (dateSelect.value === 'custom') ? 'inline-block' : 'none';
});


async function fetchAllLeagues(dateISO){
  matchesBody.innerHTML = '<tr><td colspan="7" class="muted">Loading matches...</td></tr>';
  allMatches = [];
  const requests = LEAGUES.map(l => fetchLeague(l.key).then(res => ({...res, leagueKey: l.key, leagueTitle: l.title})).catch(e => ({error: e, leagueKey: l.key, leagueTitle: l.title})));
  const results = await Promise.all(requests);
  results.forEach(r => {
    if(r && r.data && Array.isArray(r.data)) {

      r.data.forEach(m => {
        m._leagueKey = r.leagueKey;
        m._leagueTitle = r.leagueTitle;
      });
      allMatches = allMatches.concat(r.data);
    } else {

      console.warn('league fetch result:', r);
    }
  });
  lastFetchTime = new Date();
  lastUpdated.textContent = 'Last updated: ' + lastFetchTime.toLocaleString();
  applyFiltersAndRender();
}

// Fetch single league from The Odds API
async function fetchLeague(sportKey){
  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?regions=${regions}&markets=${markets}&oddsFormat=${oddsFormat}&apiKey=${API_KEY}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();    
    return { data };
  } catch (err) {

    return { data: [] };
  }
}

function matchDate(match){
  return new Date(match.commence_time);
}

function applyFiltersAndRender(){
  let filtered = allMatches.slice();
console.log(filtered);

  // Date filter
const dateVal = dateSelect.value;
if(dateVal === 'today' || dateVal === 'tomorrow' || dateVal === 'custom' || dateVal === 'all') {
  let target = new Date();
  if(dateVal === 'tomorrow') target.setDate(target.getDate() + 1);
  if(dateVal === 'custom' && customDate.value) target = new Date(customDate.value + 'T00:00:00');
  if(dateVal === 'all') { } else {
    const targetDateStr = target.toISOString().split('T')[0]; // 'YYYY-MM-DD'
    filtered = filtered.filter(m => {
      const mDateStr = matchDate(m).toISOString().split('T')[0];
      return mDateStr === targetDateStr;
    });
  }
}

  // League filter
 const leagueVal = leagueSelect.value;
  if(leagueVal !== 'all') filtered = filtered.filter(m => m._leagueKey === leagueVal);

  // Search
  const q = searchInput.value.trim().toLowerCase();
  if(q) {
    filtered = filtered.filter(m => (m.home_team && m.home_team.toLowerCase().includes(q)) || (m.away_team && m.away_team.toLowerCase().includes(q)));
  }

  // Sort
  const sortVal = sortSelect.value;
  if(sortVal === 'time_asc') {
    filtered.sort((a,b) => matchDate(a) - matchDate(b));
  } else if(sortVal === 'time_desc') {
    filtered.sort((a,b) => matchDate(b) - matchDate(a));
  } else if(sortVal === 'league') {
    filtered.sort((a,b) => (a._leagueTitle || '').localeCompare(b._leagueTitle || ''));
  }

  
  renderMatches(filtered);
}

function renderMatches(matches){
  if(!matches || matches.length === 0){
    matchesBody.innerHTML = '<tr><td colspan="7" class="muted">No matches found for selected filters.</td></tr>';
    return;
  }

  matchesBody.innerHTML = '';
  matches.forEach(m => {
    const d = matchDate(m);
    const timeStr = d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    const bm = (m.bookmakers && m.bookmakers[0]) || null;
    const outcomes = (bm && bm.markets && bm.markets[0] && bm.markets[0].outcomes) || [];
    
    let homeOdd='-', drawOdd='-', awayOdd='-';
    outcomes.forEach(o => {
      if(o.name === m.home_team) homeOdd = o.price;
      else if(o.name === m.away_team) awayOdd = o.price;
      else if(o.name.toLowerCase().includes('draw') || o.name === 'Draw') drawOdd = o.price;
    });

    if(outcomes.length === 3 && drawOdd === '-') drawOdd = outcomes[1].price;

    let scoreText = '-';
    if(Array.isArray(m.scores) && m.scores.length) {

      const homeScore = m.scores.find(s => s.name === m.home_team);
      const awayScore = m.scores.find(s => s.name === m.away_team);
      if(homeScore && awayScore) scoreText = `${homeScore.score}-${awayScore.score}`;
    }

    let statusText = 'Not Started';
    let statusClass = 'status-not-started';
    if(m.updated_at || m.completed || (m.scores && m.scores.length)) {
      if(m.completed) { statusText = 'Finished'; statusClass='status-finished'; }
      else if(m.scores && m.scores.length) { statusText='Live'; statusClass='status-live'; }
    }

    const tr = document.createElement('tr');
    if(statusClass === 'status-live') tr.classList.add('live');

    tr.innerHTML = `
      <td><span class="league-pill">${m._leagueTitle || ''}</span></td>
      <td>${timeStr}</td>
      <td>${m.home_team || ''}</td>
      <td>${scoreText}</td>
      <td>${m.away_team || ''}</td>
      <td>${homeOdd} / ${drawOdd} / ${awayOdd}</td>
      <td class="${statusClass}">${statusText}</td>
    `;
    matchesBody.appendChild(tr);
  });
}


applyBtn.addEventListener('click', () => applyFiltersAndRender());
refreshBtn.addEventListener('click', () => {fetchAllLeagues();});


fetchAllLeagues();


setInterval(() => {
  fetchAllLeagues();
}, 60000);
