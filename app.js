// ===== SPOTFRE APP.JS =====
const YT_API_KEY = 'AIzaSyCTj5-7LAYpDj4Ku7lg7QInAmBciCjwGlc';

// ===== STATE =====
let state = {
  user: null,
  authMode: 'login',
  page: 'home',
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  volume: 0.8,
  progress: 0,
  duration: 0,
  repeat: 'off', // off | all | one
  shuffle: false,
  library: [],
  searchResults: [],
  searchView: 'grid',
  libView: 'list',
  bgEffect: 'gradient',
  domColor: '#1DB954',
  settings: { theme: 'dark', quality: 'high', crossfade: false, normalize: true, language: 'id', bgEffect: 'gradient' },
};

// ===== YT PLAYER =====
let ytPlayer = null;
let ytReady = false;
let progressTimer = null;
let searchTimer = null;
let bgAnimFrame = null;
let bgParticles = [];
let bgTime = 0;

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  loadPersistedState();
  loadYTAPI();
  initBgCanvas();
  renderGenres();
  renderHomeChips();

  // Password eye toggle
  document.getElementById('pass-eye').addEventListener('click', () => {
    const inp = document.getElementById('pass-inp');
    const isPass = inp.type === 'password';
    inp.type = isPass ? 'text' : 'password';
    document.getElementById('pass-eye').textContent = isPass ? '🙈' : '👁️';
  });

  if (state.user) showApp();
});

function loadPersistedState() {
  try {
    const u = localStorage.getItem('sf_user');
    if (u) state.user = JSON.parse(u);
    const lib = localStorage.getItem('sf_library');
    if (lib) state.library = JSON.parse(lib);
    const s = localStorage.getItem('sf_settings');
    if (s) state.settings = { ...state.settings, ...JSON.parse(s) };
    const vol = localStorage.getItem('sf_vol');
    if (vol) state.volume = parseFloat(vol);
    state.bgEffect = state.settings.bgEffect || 'gradient';
    document.getElementById('vol-slider').value = state.volume * 100;
    document.getElementById('np-vol-slider').value = state.volume * 100;
  } catch(e) {}
}

// ===== AUTH =====
let authMode = 'login';

function toggleMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  const isReg = authMode === 'register';
  document.getElementById('login-title').textContent = isReg ? 'Buat Akun Baru' : 'Masuk ke Spotfre';
  document.getElementById('login-sub').textContent = isReg ? 'Gratis selamanya. Tidak perlu kartu kredit.' : 'Selamat kembali! Siap dengarkan musik?';
  document.getElementById('name-field').style.display = isReg ? 'flex' : 'none';
  document.getElementById('switch-text').textContent = isReg ? 'Sudah punya akun?' : 'Belum punya akun?';
  document.getElementById('switch-btn').textContent = isReg ? ' Masuk' : ' Daftar sekarang';
  document.getElementById('login-hint').style.display = isReg ? 'none' : 'block';
  setError('');
}

function setError(msg) {
  const el = document.getElementById('login-err');
  el.textContent = msg;
  el.classList.toggle('show', !!msg);
}

async function handleAuth() {
  const email = document.getElementById('email-inp').value.trim();
  const pass = document.getElementById('pass-inp').value;
  const name = document.getElementById('name-inp').value.trim();
  const btn = document.getElementById('login-btn');
  setError('');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';

  await new Promise(r => setTimeout(r, 700));

  const DEMO = [{ email: 'demo@spotfre.com', password: 'demo123', name: 'Demo User', avatar: 'D' }];

  if (authMode === 'login') {
    const accounts = JSON.parse(localStorage.getItem('sf_accounts') || '[]');
    const all = [...DEMO, ...accounts];
    const found = all.find(a => a.email === email && a.password === pass);
    if (found) { doLogin({ email: found.email, name: found.name, avatar: found.name[0].toUpperCase() }); return; }
    setError('Email atau password salah.');
  } else {
    if (!name) { setError('Nama wajib diisi.'); btn.disabled = false; btn.textContent = 'Daftar Gratis'; return; }
    if (pass.length < 6) { setError('Password minimal 6 karakter.'); btn.disabled = false; btn.textContent = 'Daftar Gratis'; return; }
    const accounts = JSON.parse(localStorage.getItem('sf_accounts') || '[]');
    if (accounts.find(a => a.email === email)) { setError('Email sudah terdaftar.'); btn.disabled = false; btn.textContent = 'Daftar Gratis'; return; }
    accounts.push({ email, password: pass, name, avatar: name[0].toUpperCase() });
    localStorage.setItem('sf_accounts', JSON.stringify(accounts));
    doLogin({ email, name, avatar: name[0].toUpperCase() });
    return;
  }

  btn.disabled = false;
  btn.textContent = authMode === 'login' ? 'Masuk' : 'Daftar Gratis';
}

function quickLogin() {
  doLogin({ email: 'demo@spotfre.com', name: 'Demo User', avatar: 'D' });
}

function doLogin(user) {
  state.user = user;
  localStorage.setItem('sf_user', JSON.stringify(user));
  showApp();
}

function logout() {
  state.user = null;
  state.currentTrack = null;
  state.isPlaying = false;
  localStorage.removeItem('sf_user');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-main').style.display = 'none';
  document.getElementById('player-bar').style.display = 'none';
  if (ytPlayer) { try { ytPlayer.stopVideo(); } catch(e) {} }
  stopTimer();
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-main').style.display = 'flex';
  document.getElementById('sb-name').textContent = state.user.name;
  document.getElementById('sb-email').textContent = state.user.email;
  document.getElementById('sb-avatar').textContent = state.user.avatar;
  loadHome();
  renderSettings();
  renderLibrary();
  updateGreeting();
}

function updateGreeting() {
  const h = new Date().getHours();
  const g = h < 10 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  document.getElementById('home-greeting').textContent = `${g} ${state.user?.name?.split(' ')[0] || ''} 👋`;
}

// ===== NAVIGATION =====
function navigate(page) {
  state.page = page;
  ['home','search','library','settings'].forEach(p => {
    document.getElementById(`page-${p}`).style.display = p === page ? 'block' : 'none';
  });
  document.querySelectorAll('.sb-item, .bn-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  if (page === 'library') renderLibrary();
  if (page === 'settings') renderSettings();
  if (page === 'search') document.getElementById('search-input').focus();
}

// ===== YOUTUBE API =====
function loadYTAPI() {
  if (window.YT && window.YT.Player) { initYT(); return; }
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

window.onYouTubeIframeAPIReady = function() { initYT(); };

function initYT() {
  ytPlayer = new YT.Player('yt-player', {
    height: '1', width: '1',
    playerVars: { autoplay: 0, controls: 0, disablekb: 1, iv_load_policy: 3, modestbranding: 1, rel: 0, playsinline: 1 },
    events: {
      onReady: (e) => {
        ytReady = true;
        e.target.setVolume(state.volume * 100);
      },
      onStateChange: (e) => {
        const S = YT.PlayerState;
        if (e.data === S.PLAYING) {
          state.isPlaying = true;
          updatePlayUI();
          startTimer();
          const d = e.target.getDuration();
          if (d) { state.duration = d; updateTimeUI(); }
        } else if (e.data === S.PAUSED) {
          state.isPlaying = false;
          updatePlayUI();
          stopTimer();
        } else if (e.data === S.ENDED) {
          stopTimer();
          if (state.repeat === 'one') {
            e.target.seekTo(0); e.target.playVideo();
          } else { nextTrack(); }
        }
      },
      onError: (e) => { console.warn('YT error', e.data); setTimeout(nextTrack, 1500); }
    }
  });
}

// ===== PLAYER CONTROLS =====
function playTrack(track, tracks) {
  state.currentTrack = track;
  if (tracks) {
    state.queue = tracks;
    const idx = tracks.findIndex(t => t.id === track.id);
    state.queueIndex = idx >= 0 ? idx : 0;
  }
  state.progress = 0;
  state.duration = 0;

  if (ytReady && ytPlayer) {
    try { ytPlayer.loadVideoById(track.id); }
    catch(e) { console.warn(e); }
  } else {
    setTimeout(() => { if (ytReady && ytPlayer) { try { ytPlayer.loadVideoById(track.id); } catch(e) {} } }, 2000);
  }

  updatePlayerUI();
  document.getElementById('player-bar').style.display = 'block';
  updateBgColor(state.domColor);
}

function togglePlay() {
  if (!state.currentTrack) return;
  if (!ytReady || !ytPlayer) return;
  try {
    if (state.isPlaying) { ytPlayer.pauseVideo(); state.isPlaying = false; }
    else { ytPlayer.playVideo(); state.isPlaying = true; }
    updatePlayUI();
  } catch(e) {}
}

function prevTrack() {
  if (state.progress > 5) { seekTo(0); return; }
  if (!state.queue.length) return;
  let prev = state.queueIndex - 1;
  if (prev < 0) prev = state.repeat === 'all' ? state.queue.length - 1 : 0;
  state.queueIndex = prev;
  playTrack(state.queue[prev]);
}

function nextTrack() {
  if (!state.queue.length) return;
  let next = state.queueIndex + 1;
  if (state.shuffle) next = Math.floor(Math.random() * state.queue.length);
  if (next >= state.queue.length) {
    if (state.repeat === 'all') next = 0;
    else return;
  }
  state.queueIndex = next;
  playTrack(state.queue[next]);
}

function cycleRepeat() {
  state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
  updateRepeatUI();
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;
  document.getElementById('pl-shuffle').classList.toggle('active', state.shuffle);
  document.getElementById('np-shuffle').classList.toggle('active', state.shuffle);
}

function setVolume(v) {
  state.volume = v;
  localStorage.setItem('sf_vol', v);
  document.getElementById('vol-slider').value = v * 100;
  document.getElementById('np-vol-slider').value = v * 100;
  if (ytReady && ytPlayer) { try { ytPlayer.setVolume(v * 100); } catch(e) {} }
}

function seekTo(t) {
  state.progress = t;
  if (ytReady && ytPlayer) { try { ytPlayer.seekTo(t, true); } catch(e) {} }
  updateProgressUI();
}

function handleSeek(e) {
  const rect = document.getElementById('prog-bar').getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  seekTo(pct * state.duration);
}

function handleNpSeek(e) {
  const rect = document.getElementById('np-prog-bar').getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  seekTo(pct * state.duration);
}

function handleNpSeekTouch(e) {
  e.preventDefault();
  const rect = document.getElementById('np-prog-bar').getBoundingClientRect();
  const touch = e.changedTouches[0];
  const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
  seekTo(pct * state.duration);
}

function startTimer() {
  stopTimer();
  progressTimer = setInterval(() => {
    if (!ytReady || !ytPlayer) return;
    try {
      const ct = ytPlayer.getCurrentTime();
      const dur = ytPlayer.getDuration();
      if (ct !== undefined && !isNaN(ct)) state.progress = ct;
      if (dur && !isNaN(dur)) state.duration = dur;
      updateProgressUI();
      updateTimeUI();
    } catch(e) {}
  }, 500);
}

function stopTimer() {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
}

// ===== LIBRARY =====
function toggleLibraryCurrent() {
  if (!state.currentTrack) return;
  toggleLibrary(state.currentTrack);
}

function toggleLibrary(track) {
  const idx = state.library.findIndex(t => t.id === track.id);
  if (idx >= 0) state.library.splice(idx, 1);
  else state.library.unshift(track);
  localStorage.setItem('sf_library', JSON.stringify(state.library));
  updateLibraryUI(track.id);
  if (state.page === 'library') renderLibrary();
}

function isInLibrary(id) { return state.library.some(t => t.id === id); }

// ===== YOUTUBE SEARCH =====
async function searchYT(query, max = 10) {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&maxResults=${max}&type=video&key=${YT_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.items) return [];
    return data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
    }));
  } catch(e) { console.error('YT search error:', e); return []; }
}

// ===== HOME =====
const HOME_CATS = [
  { q: 'top hits Indonesia 2025', label: '🔥 Trending Indonesia' },
  { q: 'DJ viral tiktok 2025', label: '🎵 DJ Viral TikTok' },
  { q: 'lagu pop Indonesia terbaru 2025', label: '🇮🇩 Pop Indonesia' },
  { q: 'kpop hits 2025', label: '🎤 K-Pop Hits' },
  { q: 'lofi chill music 2025', label: '☁️ Lofi & Chill' },
  { q: 'dangdut koplo terbaru 2025', label: '🥁 Dangdut Koplo' },
];

const CHIPS = ['Housewerk','Old School Reggae','Lofi Study','Dangdut Hits','K-Pop ON!','Easy Friday','DJ Slow Remix','Acoustic Indonesia'];

function renderHomeChips() {
  document.getElementById('home-chips').innerHTML = CHIPS.map(c =>
    `<button class="chip" onclick="playChip('${c}')">${c}</button>`
  ).join('');
}

async function playChip(name) {
  const tracks = await searchYT(name, 12);
  if (tracks.length) playTrack(tracks[0], tracks);
}

async function loadHome() {
  const container = document.getElementById('home-sections');
  container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:14px">' +
    [...Array(8)].map(() => '<div class="skeleton"></div>').join('') + '</div>';

  const sections = {};
  const first4 = HOME_CATS.slice(0, 4);
  await Promise.all(first4.map(async cat => {
    const tracks = await searchYT(cat.q, 8);
    sections[cat.label] = tracks;
  }));

  container.innerHTML = '';
  for (const cat of HOME_CATS) {
    const tracks = sections[cat.label] || [];
    const sec = document.createElement('div');
    sec.className = 'section fade-in';
    sec.innerHTML = `
      <div class="sec-hdr">
        <h2 class="sec-title">${cat.label}</h2>
        ${tracks.length ? `<button class="sec-play" onclick="playAllSection('${cat.label}')">Putar semua</button>` : ''}
      </div>
      ${tracks.length ? `<div class="track-grid" id="sect-${btoa(cat.label).replace(/[^a-z0-9]/gi,'')}">
        ${tracks.map((t, i) => trackCardHTML(t, i)).join('')}
      </div>` : `<button class="chip" onclick="loadSection('${cat.q}','${cat.label}')">Muat ${cat.label}</button>`}
    `;
    container.appendChild(sec);
    if (!sections[cat.label]) loadSection(cat.q, cat.label);
  }
}

async function loadSection(q, label) {
  const tracks = await searchYT(q, 8);
  const id = `sect-${btoa(label).replace(/[^a-z0-9]/gi,'')}`;
  const el = document.getElementById(id);
  if (el) el.innerHTML = tracks.map((t, i) => trackCardHTML(t, i)).join('');
  return tracks;
}

// Stores tracks by section for play all
const sectionTracks = {};
function playAllSection(label) {
  const id = `sect-${btoa(label).replace(/[^a-z0-9]/gi,'')}`;
  const el = document.getElementById(id);
  if (!el) return;
  const cards = el.querySelectorAll('.tcard');
  const tracks = [];
  cards.forEach(card => {
    const id = card.dataset.id;
    const title = card.dataset.title;
    const artist = card.dataset.artist;
    const thumb = card.dataset.thumb;
    tracks.push({ id, title, artist, thumbnail: thumb });
  });
  if (tracks.length) playTrack(tracks[0], tracks);
}

// ===== TRACK CARD HTML =====
function cleanTitle(t) {
  return (t || '').replace(/\(.*?\)/g,'').replace(/\[.*?\]/g,'').replace(/official.*/i,'').trim().slice(0,38);
}

function trackCardHTML(track, idx) {
  const ct = cleanTitle(track.title);
  const inLib = isInLibrary(track.id);
  return `<div class="tcard" data-id="${track.id}" data-title="${escHtml(track.title)}" data-artist="${escHtml(track.artist)}" data-thumb="${track.thumbnail}"
    onclick="playFromCard('${track.id}')" style="animation-delay:${idx*0.05}s">
    <div class="tcard-thumb">
      ${track.thumbnail ? `<img src="${track.thumbnail}" alt="" loading="lazy"/>` : '<div class="tcard-ph">🎵</div>'}
      <div class="tcard-overlay">
        <button class="tcard-play-btn" onclick="event.stopPropagation();playFromCard('${track.id}')">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
      </div>
      <div class="tcard-bars" id="bars-${track.id}" style="display:none">
        <span class="bar"></span><span class="bar" style="animation-delay:.15s"></span><span class="bar" style="animation-delay:.3s"></span>
      </div>
    </div>
    <p class="tcard-title truncate" title="${escHtml(track.title)}">${escHtml(ct)}</p>
    <p class="tcard-artist truncate">${escHtml(track.artist)}</p>
    <button class="tcard-heart${inLib?' liked':''}" onclick="event.stopPropagation();toggleLibraryCard('${track.id}',this)">
      <svg viewBox="0 0 24 24" fill="${inLib?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
    </button>
  </div>`;
}

// Get track from DOM card
function getTrackFromCard(id) {
  const card = document.querySelector(`.tcard[data-id="${id}"]`);
  if (!card) return null;
  return { id, title: card.dataset.title, artist: card.dataset.artist, thumbnail: card.dataset.thumb };
}

function getQueueFromCard(id) {
  const card = document.querySelector(`.tcard[data-id="${id}"]`);
  if (!card) return null;
  const grid = card.closest('.track-grid, .search-grid');
  if (!grid) return [getTrackFromCard(id)];
  const cards = grid.querySelectorAll('.tcard');
  return Array.from(cards).map(c => ({ id: c.dataset.id, title: c.dataset.title, artist: c.dataset.artist, thumbnail: c.dataset.thumb }));
}

function playFromCard(id) {
  const track = getTrackFromCard(id);
  const queue = getQueueFromCard(id);
  if (track) playTrack(track, queue || [track]);
}

function toggleLibraryCard(id, btn) {
  const track = getTrackFromCard(id);
  if (!track) return;
  toggleLibrary(track);
  const inLib = isInLibrary(id);
  btn.className = `tcard-heart${inLib?' liked':''}`;
  btn.querySelector('svg').setAttribute('fill', inLib ? 'currentColor' : 'none');
}

// Track Row HTML
function trackRowHTML(track, idx) {
  const ct = cleanTitle(track.title);
  const inLib = isInLibrary(track.id);
  return `<div class="trow${state.currentTrack?.id===track.id?' active':''}" data-id="${track.id}" data-title="${escHtml(track.title)}" data-artist="${escHtml(track.artist)}" data-thumb="${track.thumbnail}" onclick="playFromRow('${track.id}')">
    <div class="trow-num">
      <span class="trow-idx">${state.currentTrack?.id===track.id?'':idx+1}</span>
      <div class="trow-bars" id="row-bars-${track.id}" style="${state.currentTrack?.id===track.id?'':'display:none'}">
        <span class="bar${state.isPlaying&&state.currentTrack?.id===track.id?' on':''}"></span>
        <span class="bar${state.isPlaying&&state.currentTrack?.id===track.id?' on':''}" style="animation-delay:.15s"></span>
        <span class="bar${state.isPlaying&&state.currentTrack?.id===track.id?' on':''}" style="animation-delay:.3s"></span>
      </div>
      <button class="trow-pbtn" onclick="event.stopPropagation();playFromRow('${track.id}')">
        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
      </button>
    </div>
    <div class="trow-thumb">
      ${track.thumbnail ? `<img src="${track.thumbnail}" alt="" loading="lazy"/>` : '<div class="trow-ph">🎵</div>'}
    </div>
    <div class="trow-info">
      <p class="trow-title truncate${state.currentTrack?.id===track.id?' ':''}">${escHtml(ct)}</p>
      <p class="trow-artist truncate">${escHtml(track.artist)}</p>
    </div>
    <button class="trow-heart${inLib?' liked':''}" onclick="event.stopPropagation();toggleLibraryRow('${track.id}',this)">
      <svg viewBox="0 0 24 24" fill="${inLib?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
    </button>
  </div>`;
}

function getQueueFromContainer(containerId, id) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const rows = container.querySelectorAll('[data-id]');
  return Array.from(rows).map(r => ({ id: r.dataset.id, title: r.dataset.title, artist: r.dataset.artist, thumbnail: r.dataset.thumb }));
}

function playFromRow(id) {
  const rowEl = document.querySelector(`.trow[data-id="${id}"]`);
  if (!rowEl) return;
  const track = { id, title: rowEl.dataset.title, artist: rowEl.dataset.artist, thumbnail: rowEl.dataset.thumb };
  const container = rowEl.closest('[id]');
  const queue = container ? getQueueFromContainer(container.id, id) : [track];
  playTrack(track, queue || [track]);
}

function toggleLibraryRow(id, btn) {
  const rowEl = document.querySelector(`.trow[data-id="${id}"]`);
  if (!rowEl) return;
  const track = { id, title: rowEl.dataset.title, artist: rowEl.dataset.artist, thumbnail: rowEl.dataset.thumb };
  toggleLibrary(track);
  const inLib = isInLibrary(id);
  btn.className = `trow-heart${inLib?' liked':''}`;
  btn.querySelector('svg').setAttribute('fill', inLib ? 'currentColor' : 'none');
}

// ===== SEARCH =====
const GENRES = [
  { label:'Pop Indonesia', q:'pop indonesia hits 2025', emoji:'🎵', color:'#E91E63' },
  { label:'DJ Viral', q:'dj viral tiktok 2025', emoji:'🔥', color:'#FF5722' },
  { label:'K-Pop', q:'kpop hits 2025', emoji:'🎤', color:'#9C27B0' },
  { label:'Dangdut', q:'dangdut koplo terbaru 2025', emoji:'🥁', color:'#FF9800' },
  { label:'Reggae', q:'reggae old school', emoji:'🌴', color:'#4CAF50' },
  { label:'Lofi', q:'lofi chill study music', emoji:'☁️', color:'#00BCD4' },
  { label:'R&B Soul', q:'rnb soul hits 2025', emoji:'🎸', color:'#3F51B5' },
  { label:'Hip-Hop', q:'hip hop trap 2025', emoji:'🎧', color:'#607D8B' },
  { label:'EDM', q:'edm electronic dance 2025', emoji:'⚡', color:'#FFC107' },
  { label:'Akustik', q:'lagu akustik indonesia', emoji:'🎻', color:'#795548' },
];

function renderGenres() {
  document.getElementById('genre-grid').innerHTML = GENRES.map(g =>
    `<button class="genre-card" style="background:${g.color}" onclick="searchGenre('${g.q}','${g.label}')">
      <span class="genre-emoji">${g.emoji}</span>
      <span class="genre-name">${g.label}</span>
    </button>`
  ).join('');
}

async function searchGenre(q, label) {
  document.getElementById('search-input').value = label;
  document.getElementById('sbar-clear').classList.add('show');
  await doSearch(q);
}

let searchResults = [];

function onSearchInput() {
  const q = document.getElementById('search-input').value.trim();
  document.getElementById('sbar-clear').classList.toggle('show', !!q);
  clearTimeout(searchTimer);
  if (q.length < 2) {
    showSearchEmpty(false);
    document.getElementById('search-genre').style.display = 'block';
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('results-toggle').style.display = 'none';
    return;
  }
  searchTimer = setTimeout(() => doSearch(q), 600);
}

async function doSearch(q) {
  document.getElementById('search-genre').style.display = 'none';
  document.getElementById('search-results').style.display = 'none';
  document.getElementById('search-empty').style.display = 'none';
  document.getElementById('search-loading').style.display = 'block';

  searchResults = await searchYT(q, 20);
  document.getElementById('search-loading').style.display = 'none';

  if (!searchResults.length) {
    document.getElementById('search-empty').style.display = 'block';
    return;
  }

  document.getElementById('results-toggle').style.display = 'flex';
  document.getElementById('search-results').style.display = 'block';
  renderSearchResults();
}

function renderSearchResults() {
  const container = document.getElementById('results-container');
  if (state.searchView === 'grid') {
    container.className = 'search-grid';
    container.id = 'search-result-items';
    container.innerHTML = searchResults.map((t, i) => trackCardHTML(t, i)).join('');
  } else {
    container.className = 'search-list';
    container.id = 'search-result-items';
    container.innerHTML = searchResults.map((t, i) => trackRowHTML(t, i)).join('');
  }
}

function setView(v) {
  state.searchView = v;
  document.getElementById('vb-grid').classList.toggle('active', v==='grid');
  document.getElementById('vb-list').classList.toggle('active', v==='list');
  if (searchResults.length) renderSearchResults();
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('sbar-clear').classList.remove('show');
  document.getElementById('search-genre').style.display = 'block';
  document.getElementById('search-results').style.display = 'none';
  document.getElementById('search-empty').style.display = 'none';
  document.getElementById('results-toggle').style.display = 'none';
  searchResults = [];
}

function playAll() {
  if (searchResults.length) playTrack(searchResults[0], searchResults);
}

function showSearchEmpty(show) { document.getElementById('search-empty').style.display = show ? 'block' : 'none'; }

// ===== LIBRARY =====
let libView = 'list';
let libFilter = '';

function setLibView(v) {
  libView = v;
  document.getElementById('lb-list').classList.toggle('active', v==='list');
  document.getElementById('lb-grid').classList.toggle('active', v==='grid');
  renderLibrary();
}

function renderLibrary() {
  const container = document.getElementById('lib-body');
  const filtered = state.library.filter(t =>
    t.title.toLowerCase().includes(libFilter.toLowerCase()) ||
    t.artist.toLowerCase().includes(libFilter.toLowerCase())
  );

  if (!state.library.length) {
    container.innerHTML = `<div class="lib-empty"><div class="lib-empty-icon">❤️</div><h2>Koleksimu masih kosong</h2><p>Tekan ikon ❤️ pada lagu yang kamu suka untuk menyimpannya di sini</p></div>`;
    return;
  }

  let html = `<div class="lib-search" id="lib-search-wrap">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
    <input type="text" placeholder="Cari di koleksimu" value="${libFilter}" oninput="filterLib(this.value)"/>
  </div>`;

  if (!filtered.length) {
    html += `<div class="empty-state"><div class="empty-icon">🔍</div><p class="empty-title">Tidak ada yang cocok</p></div>`;
    container.innerHTML = html;
    return;
  }

  html += `<p class="lib-count">${filtered.length} lagu disimpan</p>`;
  html += `<button class="lib-play-all" onclick="playLibraryAll()">
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5,3 19,12 5,21"/></svg>
    Putar Semua
  </button>`;

  if (libView === 'list') {
    html += `<div class="lib-list" id="lib-items">${filtered.map((t,i) => trackRowHTML(t,i)).join('')}</div>`;
  } else {
    html += `<div class="lib-grid" id="lib-items">${filtered.map((t,i) => trackCardHTML(t,i)).join('')}</div>`;
  }

  container.innerHTML = html;
}

function filterLib(v) { libFilter = v; renderLibrary(); }

function playLibraryAll() {
  const filtered = state.library.filter(t =>
    t.title.toLowerCase().includes(libFilter.toLowerCase()) ||
    t.artist.toLowerCase().includes(libFilter.toLowerCase())
  );
  if (filtered.length) playTrack(filtered[0], filtered);
}

// ===== SETTINGS =====
const BG_EFFECTS = [
  { value:'gradient', label:'Gradient Dinamis', desc:'Warna berubah mengikuti musik', cls:'bg-prev-gradient' },
  { value:'particles', label:'Partikel Musik', desc:'Partikel menari mengikuti beat', cls:'bg-prev-particles' },
  { value:'waves', label:'Gelombang Audio', desc:'Visualisasi gelombang suara', cls:'bg-prev-waves' },
  { value:'none', label:'Polos', desc:'Tanpa efek latar belakang', cls:'bg-prev-none' },
];

function renderSettings() {
  const s = state.settings;
  const u = state.user;
  document.getElementById('settings-body').innerHTML = `
  <div class="set-sec">
    <h2 class="set-sec-title">Profil</h2>
    <div class="set-profile">
      <div class="set-avatar">${u?.avatar||'U'}</div>
      <div>
        <p class="set-profile-name">${escHtml(u?.name||'')}</p>
        <p class="set-profile-email">${escHtml(u?.email||'')}</p>
        <p class="set-plan">🎵 Akun Gratis</p>
      </div>
    </div>
    <button class="set-logout" onclick="logout()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Keluar dari Akun
    </button>
  </div>

  <div class="set-sec">
    <h2 class="set-sec-title">Tampilan</h2>
    <div class="set-item">
      <div class="set-item-info"><p class="set-item-label">Tema</p><p class="set-item-desc">Pilih tampilan aplikasi</p></div>
      <div class="set-tg">
        <button class="set-tg-btn${s.theme==='dark'?' active':''}" onclick="setSetting('theme','dark',this)">🌙 Gelap</button>
        <button class="set-tg-btn${s.theme==='light'?' active':''}" onclick="setSetting('theme','light',this)">☀️ Terang</button>
      </div>
    </div>
    <div class="set-item">
      <div class="set-item-info"><p class="set-item-label">Bahasa</p><p class="set-item-desc">Bahasa tampilan</p></div>
      <select class="set-select" onchange="setSetting('language',this.value,this)">
        <option value="id"${s.language==='id'?' selected':''}>🇮🇩 Indonesia</option>
        <option value="en"${s.language==='en'?' selected':''}>🇺🇸 English</option>
      </select>
    </div>
  </div>

  <div class="set-sec">
    <h2 class="set-sec-title">Efek Latar Belakang</h2>
    <p class="set-sec-title" style="font-size:12px;color:var(--text2);margin-top:-10px;margin-bottom:12px;font-weight:400">Efek visual saat memutar musik</p>
    <div class="bg-grid">
      ${BG_EFFECTS.map(ef => `
      <button class="bg-card${s.bgEffect===ef.value?' active':''}" onclick="setBgEffect('${ef.value}',this)">
        <div class="bg-preview ${ef.cls}"></div>
        <p class="bg-label">${ef.label}</p>
        <p class="bg-desc">${ef.desc}</p>
        <div class="bg-check">✓</div>
      </button>`).join('')}
    </div>
  </div>

  <div class="set-sec">
    <h2 class="set-sec-title">Audio</h2>
    <div class="set-item">
      <div class="set-item-info"><p class="set-item-label">Kualitas Streaming</p><p class="set-item-desc">Kualitas audio saat streaming</p></div>
      <select class="set-select" onchange="setSetting('quality',this.value,this)">
        <option value="low"${s.quality==='low'?' selected':''}>Rendah (Hemat Data)</option>
        <option value="medium"${s.quality==='medium'?' selected':''}>Sedang</option>
        <option value="high"${s.quality==='high'?' selected':''}>Tinggi</option>
      </select>
    </div>
    <div class="set-item">
      <div class="set-item-info"><p class="set-item-label">Normalisasi Volume</p><p class="set-item-desc">Samakan volume antar lagu</p></div>
      <button class="set-switch${s.normalize?' on':''}" onclick="toggleSetting('normalize',this)"><span></span></button>
    </div>
    <div class="set-item">
      <div class="set-item-info"><p class="set-item-label">Crossfade</p><p class="set-item-desc">Transisi halus antar lagu</p></div>
      <button class="set-switch${s.crossfade?' on':''}" onclick="toggleSetting('crossfade',this)"><span></span></button>
    </div>
  </div>

  <div class="set-sec set-about">
    <div class="set-about-logo">
      <svg viewBox="0 0 40 40" fill="none" width="36" height="36"><circle cx="20" cy="20" r="20" fill="#1DB954"/><path d="M10 16c5-2 14-2 20 2M11 22c4-1.5 12-1.5 18 1.5M13 28c3-1 9-1 14 1" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>
      <span class="set-about-name">Spotfre</span>
    </div>
    <p class="set-about-ver">Versi 1.0.0</p>
    <p class="set-about-desc">Spotfre menggunakan YouTube sebagai sumber streaming musik. Semua hak atas konten musik dimiliki oleh pemiliknya masing-masing.</p>
  </div>`;
}

function setSetting(key, val, el) {
  state.settings[key] = val;
  localStorage.setItem('sf_settings', JSON.stringify(state.settings));
  if (key === 'theme') {
    document.querySelectorAll('.set-tg-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    applyTheme(val);
  }
}

function toggleSetting(key, btn) {
  state.settings[key] = !state.settings[key];
  btn.classList.toggle('on', state.settings[key]);
  localStorage.setItem('sf_settings', JSON.stringify(state.settings));
}

function setBgEffect(val, btn) {
  state.settings.bgEffect = val;
  state.bgEffect = val;
  localStorage.setItem('sf_settings', JSON.stringify(state.settings));
  document.querySelectorAll('.bg-card').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  initBgCanvas();
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.style.setProperty('--bg','#f0f0f0');
    document.documentElement.style.setProperty('--bg2','#e0e0e0');
    document.documentElement.style.setProperty('--bg3','#d0d0d0');
    document.documentElement.style.setProperty('--surface','#ffffff');
    document.documentElement.style.setProperty('--surface2','#f5f5f5');
    document.documentElement.style.setProperty('--text','#121212');
    document.documentElement.style.setProperty('--text2','#535353');
    document.documentElement.style.setProperty('--text3','#9e9e9e');
  } else {
    document.documentElement.style.setProperty('--bg','#121212');
    document.documentElement.style.setProperty('--bg2','#181818');
    document.documentElement.style.setProperty('--bg3','#232323');
    document.documentElement.style.setProperty('--surface','#282828');
    document.documentElement.style.setProperty('--surface2','#333');
    document.documentElement.style.setProperty('--text','#fff');
    document.documentElement.style.setProperty('--text2','#b3b3b3');
    document.documentElement.style.setProperty('--text3','#535353');
  }
}

// ===== NOW PLAYING =====
function openNowPlaying() {
  document.getElementById('now-playing').classList.add('show');
  document.getElementById('bg-canvas').classList.add('fullscreen');
  renderQueue();
}

function closeNowPlaying() {
  document.getElementById('now-playing').classList.remove('show');
  document.getElementById('bg-canvas').classList.remove('fullscreen');
}

let npTab = 'playing';
function setNpTab(tab) {
  npTab = tab;
  document.getElementById('np-tab-playing').classList.toggle('active', tab==='playing');
  document.getElementById('np-tab-queue').classList.toggle('active', tab==='queue');
  document.getElementById('np-body').style.display = tab==='playing' ? 'flex' : 'none';
  document.getElementById('np-queue').classList.toggle('show', tab==='queue');
}

function renderQueue() {
  const container = document.getElementById('np-queue');
  container.innerHTML = state.queue.map((t, i) => `
    <div class="np-queue-item${i===state.queueIndex?' active':''}" onclick="playTrack(${JSON.stringify(t)})">
      <div class="np-q-num">
        ${i===state.queueIndex?`<div class="np-q-bars"><span class="bar${state.isPlaying?' on':''}"></span><span class="bar${state.isPlaying?' on':''}" style="animation-delay:.15s"></span><span class="bar${state.isPlaying?' on':''}" style="animation-delay:.3s"></span></div>`:`<span>${i+1}</span>`}
      </div>
      <div class="np-q-thumb">${t.thumbnail?`<img src="${t.thumbnail}" alt=""/>`:'🎵'}</div>
      <div class="np-q-info">
        <p class="truncate" style="font-size:13px;font-weight:600;color:${i===state.queueIndex?'var(--green)':'#fff'}">${escHtml(cleanTitle(t.title))}</p>
        <p class="truncate" style="font-size:11px;color:var(--text2)">${escHtml(t.artist)}</p>
      </div>
    </div>
  `).join('');
}

// ===== BACKGROUND CANVAS =====
function initBgCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  if (bgAnimFrame) cancelAnimationFrame(bgAnimFrame);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  window.removeEventListener('resize', onResize);
  window.addEventListener('resize', onResize);

  if (state.bgEffect === 'none') { ctx.clearRect(0,0,canvas.width,canvas.height); return; }
  if (state.bgEffect === 'particles') {
    bgParticles = Array.from({length:70}, () => ({
      x: Math.random()*canvas.width, y: Math.random()*canvas.height,
      vx:(Math.random()-.5)*1.5, vy:(Math.random()-.5)*1.5,
      size:Math.random()*3+1, opacity:Math.random()*.5+.1, pulse:Math.random()*Math.PI*2
    }));
  }
  drawBg(ctx, canvas);
}

function onResize() {
  const canvas = document.getElementById('bg-canvas');
  if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
}

function drawBg(ctx, canvas) {
  bgTime += 0.012;
  const t = bgTime;
  const w = canvas.width, h = canvas.height;
  const color = state.domColor || '#1DB954';
  const r = parseInt(color.slice(1,3),16)||29;
  const g = parseInt(color.slice(3,5),16)||185;
  const b = parseInt(color.slice(5,7),16)||84;

  ctx.clearRect(0,0,w,h);

  if (state.bgEffect === 'gradient') {
    const grad = ctx.createRadialGradient(w*(0.3+Math.sin(t*.7)*.2), h*(0.3+Math.cos(t*.5)*.2), 0, w/2,h/2, w*.8);
    grad.addColorStop(0, `rgba(${r},${g},${b},.32)`);
    grad.addColorStop(.5, `rgba(${Math.floor(r*.4)},0,${Math.floor(b*.8)},.18)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
    const grad2 = ctx.createRadialGradient(w*(.7+Math.cos(t*.6)*.18), h*(.7+Math.sin(t*.4)*.22), 0, w*.7,h*.7, w*.55);
    grad2.addColorStop(0, `rgba(${b},${r},${g},.22)`);
    grad2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad2; ctx.fillRect(0,0,w,h);

  } else if (state.bgEffect === 'particles') {
    bgParticles.forEach(p => {
      p.pulse += state.isPlaying ? .05 : .015;
      p.x += p.vx * (state.isPlaying?1.4:.35);
      p.y += p.vy * (state.isPlaying?1.4:.35);
      if (p.x<0) p.x=w; if (p.x>w) p.x=0;
      if (p.y<0) p.y=h; if (p.y>h) p.y=0;
      const sz = p.size*(1+Math.sin(p.pulse)*.4);
      ctx.beginPath();
      ctx.arc(p.x,p.y,sz,0,Math.PI*2);
      ctx.fillStyle = `rgba(${r},${g},${b},${p.opacity*(state.isPlaying?1:.35)})`;
      ctx.fill();
    });
    bgParticles.forEach((p1,i) => {
      bgParticles.slice(i+1).forEach(p2 => {
        const dist = Math.hypot(p1.x-p2.x, p1.y-p2.y);
        if (dist < 90) {
          ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y);
          ctx.strokeStyle = `rgba(${r},${g},${b},${(1-dist/90)*.12})`;
          ctx.lineWidth = .5; ctx.stroke();
        }
      });
    });

  } else if (state.bgEffect === 'waves') {
    for (let wave=0; wave<4; wave++) {
      ctx.beginPath();
      const amp = (state.isPlaying?38:14)*(1-wave*.18);
      const freq = .007+wave*.002;
      const speed = t*(1+wave*.6);
      const yBase = h*(.25+wave*.16);
      ctx.moveTo(0,yBase);
      for (let x=0; x<=w; x+=3) ctx.lineTo(x, yBase+Math.sin(x*freq+speed)*amp);
      ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.closePath();
      const wg = ctx.createLinearGradient(0,yBase-amp,0,h);
      wg.addColorStop(0, `rgba(${r},${g},${b},${.14-wave*.025})`);
      wg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = wg; ctx.fill();
    }
  }

  bgAnimFrame = requestAnimationFrame(() => drawBg(ctx, canvas));
}

// ===== UI UPDATES =====
function updatePlayerUI() {
  const t = state.currentTrack;
  if (!t) return;
  const ct = cleanTitle(t.title);

  // Player bar
  document.getElementById('pl-title').textContent = ct;
  document.getElementById('pl-artist').textContent = t.artist;
  if (t.thumbnail) {
    document.getElementById('pl-thumb-img').src = t.thumbnail;
    document.getElementById('pl-thumb-img').style.display = 'block';
    document.getElementById('pl-thumb-ph').style.display = 'none';
  } else {
    document.getElementById('pl-thumb-img').style.display = 'none';
    document.getElementById('pl-thumb-ph').style.display = 'flex';
  }

  // Heart
  const inLib = isInLibrary(t.id);
  updateHeartUI(inLib);

  // Now playing
  document.getElementById('np-title').textContent = ct;
  document.getElementById('np-artist').textContent = t.artist;
  if (t.thumbnail) {
    document.getElementById('np-art-img').src = t.thumbnail;
    document.getElementById('np-art-img').style.display = 'block';
    document.getElementById('np-art-ph').style.display = 'none';
  } else {
    document.getElementById('np-art-img').style.display = 'none';
    document.getElementById('np-art-ph').style.display = 'flex';
  }
  document.getElementById('np-art').classList.toggle('on', state.isPlaying);

  // All card highlights
  document.querySelectorAll('.tcard').forEach(el => {
    el.classList.toggle('active', el.dataset.id === t.id);
    const bars = document.getElementById(`bars-${el.dataset.id}`);
    if (bars) {
      bars.style.display = el.dataset.id === t.id ? 'flex' : 'none';
      bars.querySelectorAll('.bar').forEach(b => b.classList.toggle('on', state.isPlaying && el.dataset.id === t.id));
    }
  });
  document.querySelectorAll('.trow').forEach(el => {
    el.classList.toggle('active', el.dataset.id === t.id);
  });

  // BG color from track (use a fixed nice color per track)
  const colors = ['#1DB954','#e91e63','#9c27b0','#3f51b5','#ff5722','#00bcd4','#ff9800','#607d8b'];
  const idx = Math.abs([...t.id].reduce((a,c) => a+c.charCodeAt(0), 0)) % colors.length;
  state.domColor = colors[idx];
  updateBgColor(state.domColor);
}

function updateBgColor(color) {
  document.getElementById('pl-play').style.background = color;
  document.getElementById('np-play-btn').style.background = color;
  document.getElementById('np-prog-fill').style.background = color;
  document.getElementById('np-prog-thumb').style.background = color;
  document.getElementById('prog-fill').style.background = color;
  document.getElementById('np-bg').style.background = `radial-gradient(ellipse at 30% 20%, ${color}55, transparent 70%), radial-gradient(ellipse at 80% 80%, ${color}33, transparent 60%), #0a0a0a`;
  document.documentElement.style.setProperty('--np-color', color);
}

function updatePlayUI() {
  const playing = state.isPlaying;
  const playIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
  const pauseIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>`;
  document.getElementById('pl-play-icon').outerHTML = `<svg id="pl-play-icon" viewBox="0 0 24 24" fill="currentColor">${playing?'<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>':'<polygon points="5,3 19,12 5,21"/>'}</svg>`;
  document.getElementById('np-play-icon').outerHTML = `<svg id="np-play-icon" viewBox="0 0 24 24" fill="currentColor">${playing?'<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>':'<polygon points="5,3 19,12 5,21"/>'}</svg>`;

  // Thumb bars
  const thumbBars = document.getElementById('pl-thumb-bars');
  thumbBars.style.display = playing ? 'flex' : 'none';
  thumbBars.querySelectorAll('.bar').forEach(b => b.classList.toggle('on', playing));

  // Art anim
  document.getElementById('np-art').classList.toggle('on', playing);

  // Card bars update
  if (state.currentTrack) {
    document.querySelectorAll('.tcard.active .tcard-bars .bar, .bar.on').forEach(b => b.classList.toggle('on', playing));
  }
}

function updateProgressUI() {
  const pct = state.duration > 0 ? (state.progress / state.duration) * 100 : 0;
  document.getElementById('prog-fill').style.width = pct+'%';
  document.getElementById('prog-thumb').style.left = pct+'%';
  document.getElementById('np-prog-fill').style.width = pct+'%';
  document.getElementById('np-prog-thumb').style.left = pct+'%';
}

function updateTimeUI() {
  const cur = fmt(state.progress);
  const dur = fmt(state.duration);
  document.getElementById('pl-time').textContent = `${cur} / ${dur}`;
  document.getElementById('np-curr').textContent = cur;
  document.getElementById('np-dur').textContent = dur;
}

function updateRepeatUI() {
  const r = state.repeat;
  document.getElementById('pl-repeat').classList.toggle('active', r!=='off');
  document.getElementById('np-repeat').classList.toggle('active', r!=='off');
  document.getElementById('np-rep-badge').style.display = r==='one'?'flex':'none';
}

function updateHeartUI(inLib) {
  [document.getElementById('pl-heart'), document.getElementById('np-heart')].forEach(el => {
    if (!el) return;
    el.classList.toggle('liked', inLib);
    el.querySelector('svg').setAttribute('fill', inLib?'currentColor':'none');
  });
}

function updateLibraryUI(id) {
  const inLib = isInLibrary(id);
  document.querySelectorAll(`.tcard[data-id="${id}"] .tcard-heart`).forEach(btn => {
    btn.className = `tcard-heart${inLib?' liked':''}`;
    btn.querySelector('svg').setAttribute('fill', inLib?'currentColor':'none');
  });
  document.querySelectorAll(`.trow[data-id="${id}"] .trow-heart`).forEach(btn => {
    btn.className = `trow-heart${inLib?' liked':''}`;
    btn.querySelector('svg').setAttribute('fill', inLib?'currentColor':'none');
  });
  if (state.currentTrack?.id === id) updateHeartUI(inLib);
}

// ===== UTILS =====
function fmt(s) {
  if (!s||isNaN(s)) return '0:00';
  const m = Math.floor(s/60);
  const sec = Math.floor(s%60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

function escHtml(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight') { e.preventDefault(); seekTo(Math.min(state.progress+10, state.duration)); }
  if (e.code === 'ArrowLeft') { e.preventDefault(); seekTo(Math.max(state.progress-10, 0)); }
  if (e.code === 'ArrowUp') { e.preventDefault(); setVolume(Math.min(1, state.volume+0.1)); }
  if (e.code === 'ArrowDown') { e.preventDefault(); setVolume(Math.max(0, state.volume-0.1)); }
  if (e.code === 'KeyN') nextTrack();
  if (e.code === 'KeyP') prevTrack();
  if (e.code === 'Escape') closeNowPlaying();
});
