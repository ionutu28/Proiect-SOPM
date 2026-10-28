/* Voyago – logica aplicației (HTML + CSS + JS pur)
   localStorage: users, currentUser, selectedCountry, selectedPOIs, budgetInputs, countriesCache */
const App = (() => {
  /* ---------- Utilitare ---------- */
  const LS = {
    get(k, d = null) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
    del: k => localStorage.removeItem(k)
  };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = n => new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const hash = s => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36); }; // doar demo, nu e securitate reală
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
    document.body.append(t); setTimeout(() => t.remove(), 2600);
  }

  /* ---------- Autentificare ---------- */
  const user = () => LS.get('currentUser');
  function register(name, email, pass) {
    const users = LS.get('users', []);
    if (users.some(u => u.email === email)) return { ok: false, msg: 'Există deja un cont cu acest email. Autentifică-te.' };
    users.push({ name, email, pass: hash(pass) }); LS.set('users', users);
    LS.set('currentUser', { name, email }); return { ok: true };
  }
  function login(email, pass) {
    const u = LS.get('users', []).find(x => x.email === email && x.pass === hash(pass));
    if (!u) return { ok: false, msg: 'Email sau parolă incorecte. Verifică datele și încearcă din nou.' };
    LS.set('currentUser', { name: u.name, email: u.email }); return { ok: true };
  }
  const logout = () => { LS.del('currentUser'); location.href = 'index.html'; };

  /* ---------- Layout comun (meniu + footer) ---------- */
  function layout(active) {
    const u = user();
    const links = [['index.html#destinatii', 'Destinații', 'home'], ['zboruri.html', 'Zboruri', 'flights'], ['puncte-interes.html', 'Puncte de interes', 'poi'], ['buget.html', 'Buget', 'budget'], ['plata.html#rezervari', 'Rezervări', 'checkout'], ['index.html#faq', 'Ajutor', 'faq']];
    $('#nav').innerHTML = `<header class="nav"><div class="wrap nav-in">
      <a class="logo" href="index.html">Voyago<i></i></a>
      <nav aria-label="Navigare principală">${links.map(l => `<a href="${l[0]}" class="${l[2] === active ? 'on' : ''}">${l[1]}</a>`).join('')}</nav>
      <div class="nav-user">${u
        ? `<span>Salut, ${esc(u.name.split(' ')[0])}</span><button class="btn ghost sm" id="logout">Ieși din cont</button>`
        : `<a class="btn sm" href="index.html#auth">Conectează-te</a>`}</div></div></header>`;
    const col = (t, items) => `<div><h4>${t}</h4>${items.join('')}</div>`;
    const A = (h, t, ext) => `<a href="${h}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
    $('#footer').innerHTML = `<footer class="foot"><div class="wrap"><div class="fcols">
      ${col('Servicii', [A('index.html#destinatii', 'Alege destinația'), A('zboruri.html', 'Caută zboruri'), A('puncte-interes.html', 'Puncte de interes'), A('buget.html', 'Calculator de buget'), A('index.html#auth', 'Cont Voyago')])}
      ${col('Ajutor', [A('index.html#faq', 'Întrebări frecvente'), A('plata.html#rezervari', 'Rezervările mele'), A('mailto:contact@voyago.example', 'Contact')])}
      ${col('Destinații populare', ['ES', 'IT', 'GR', 'TR', 'PT', 'FR'].map(c => A('index.html?tara=' + c, 'Către ' + nm(c))))}
      <div><h4>Urmărește-ne</h4><div class="social">${[['f', 'facebook.com'], ['ig', 'instagram.com'], ['yt', 'youtube.com'], ['in', 'linkedin.com']].map(([i, d]) => `<a href="https://www.${d}" target="_blank" rel="noopener" aria-label="${d}">${i}</a>`).join('')}</div></div>
      </div><p class="copy">© Voyago – proiect școlar realizat în HTML, CSS și JavaScript.</p></div></footer>`;
    $('#logout')?.addEventListener('click', logout);
  }
  const emptyState = (title, text, href, cta) =>
    `<div class="state"><h3>${title}</h3><p class="muted">${text}</p><a class="btn" href="${href}">${cta}</a></div>`;

  /* ---------- Țări (REST Countries) ---------- */
  const CODES = ['FR', 'IT', 'ES', 'GR', 'JP', 'TH', 'TR', 'PT', 'HR', 'EG'];
  // Listă de rezervă, folosită doar dacă API-ul nu răspunde: [cod, nume, capitală, populație, monedă]
  const FALLBACK = [
    ['FR', 'Franța', 'Paris', 68000000, 'Euro'], ['IT', 'Italia', 'Roma', 59000000, 'Euro'],
    ['ES', 'Spania', 'Madrid', 48000000, 'Euro'], ['GR', 'Grecia', 'Atena', 10400000, 'Euro'],
    ['JP', 'Japonia', 'Tokyo', 124000000, 'Yen japonez'], ['TH', 'Thailanda', 'Bangkok', 66000000, 'Baht thailandez'],
    ['TR', 'Turcia', 'Ankara', 85000000, 'Liră turcească'], ['PT', 'Portugalia', 'Lisabona', 10400000, 'Euro'],
    ['HR', 'Croația', 'Zagreb', 3900000, 'Euro'], ['EG', 'Egipt', 'Cairo', 112000000, 'Liră egipteană']
  ].map(([c, n, cap, pop, cur]) => ({
    cca2: c, name: { common: n }, translations: { ron: { common: n } }, capital: [cap], population: pop,
    currencies: { x: { name: cur } }, flags: { png: `https://flagcdn.com/w320/${c.toLowerCase()}.png` }
  }));
  async function fetchCountries(url) {
    const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const list = CODES.map(c => d.find(x => x.cca2 === c)).filter(Boolean);
    if (list.length < CODES.length) throw new Error('Răspuns incomplet');
    return list;
  }
  async function loadCountries() {
    const base = `https://restcountries.com/v3.1/alpha?codes=${CODES.join(',')}`;
    for (const url of [base + '&fields=name,cca2,capital,flags,population,currencies,translations', base]) {
      try { const list = await fetchCountries(url); LS.set('countriesCache', list); return list; }
      catch (e) { console.warn('REST Countries a eșuat:', e.message); }
    }
    return LS.get('countriesCache') || FALLBACK;
  }
  let pending = null, authDlg;
  const getCountry = code => (LS.get('countriesCache') || []).find(c => c.cca2 === code) || FALLBACK.find(c => c.cca2 === code);
  const nm = code => FALLBACK.find(c => c.cca2 === code).name.common;
  function saveCountry(c) {
    LS.set('selectedCountry', { code: c.cca2, name: c.translations?.ron?.common || c.name.common, flag: c.flags.png, capital: c.capital?.[0] || '' });
    LS.del('selectedPOIs');
  }
  function selectCountry(c) {
    const go = () => { saveCountry(c); location.href = 'puncte-interes.html'; };
    if (!user()) { pending = go; openAuth('register', 'Creează un cont ca să îți salvezi destinația.'); return; }
    go();
  }

  /* ---------- Pagina principală ---------- */
  function openAuth(tab = 'login', note = '') {
    if (!authDlg) return;
    $$('[data-tab]', authDlg).forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $$('form', authDlg).forEach(f => f.hidden = f.dataset.form !== tab);
    $('#authNote').textContent = note; $$('.err', authDlg).forEach(e => e.textContent = '');
    if (!authDlg.open) authDlg.showModal();
  }
  function afterAuth() {
    authDlg.close(); layout('home'); toast('Ești autentificat. Spor la planificat!');
    const p = pending; pending = null; if (p) p();
  }
  function home() {
    authDlg = $('#authDlg');
    $$('[data-tab]', authDlg).forEach(b => b.addEventListener('click', () => openAuth(b.dataset.tab)));
    $('.close', authDlg).addEventListener('click', () => authDlg.close());
    authDlg.addEventListener('close', () => { if (!user()) pending = null; });
    $$('[data-open-auth]').forEach(b => b.addEventListener('click', () => openAuth(b.dataset.openAuth)));
    if (location.hash === '#auth') openAuth('login');
    window.addEventListener('hashchange', () => { if (location.hash === '#auth') openAuth('login'); });
    $('[data-form=register]').addEventListener('submit', e => {
      e.preventDefault(); const f = new FormData(e.target);
      const pass = f.get('pass');
      if (pass.length < 6) { $('.err', e.target).textContent = 'Parola trebuie să aibă minimum 6 caractere.'; return; }
      const r = register(f.get('name').trim(), f.get('email').trim().toLowerCase(), pass);
      r.ok ? afterAuth() : $('.err', e.target).textContent = r.msg;
    });
    $('[data-form=login]').addEventListener('submit', e => {
      e.preventDefault(); const f = new FormData(e.target);
      const r = login(f.get('email').trim().toLowerCase(), f.get('pass'));
      r.ok ? afterAuth() : $('.err', e.target).textContent = r.msg;
    });

    // Formular de căutare
    const f = $('#sf'), E = f.elements; let tab = 'flight';
    const TAB = { flight: ['Plecare', 'Întoarcere', true], hotel: ['Check-in', 'Check-out', false], car: ['Preluare', 'Returnare', false] };
    E.dest.innerHTML = FALLBACK.map(c => `<option value="${c.cca2}">${c.name.common}</option>`).join('');
    const iso = d => d.toISOString().slice(0, 10), plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
    E.d1.min = plus(0); E.d1.value = plus(14); E.d2.value = plus(19); E.d2.min = E.d1.value;
    E.d1.addEventListener('change', () => { E.d2.min = E.d1.value; if (E.d2.value < E.d1.value) E.d2.value = E.d1.value; });
    $$('[data-stab]').forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.stab; const [l1, l2, from] = TAB[tab];
      $$('[data-stab]').forEach(x => x.classList.toggle('on', x === b));
      $('#l1').textContent = l1; $('#l2').textContent = l2; $('#wFrom').hidden = !from;
    }));
    $$('[name=trip]').forEach(r => r.addEventListener('change', () => { $('#w2').hidden = E.trip.value === 'ow'; }));
    $('#promoBtn').addEventListener('click', () => { $('#promoBox').hidden = !$('#promoBox').hidden; $('#promoBox').focus(); });
    f.addEventListener('submit', e => {
      e.preventDefault();
      const code = E.promo.value.trim().toUpperCase();
      if (code && code !== 'VOYAGO10') { toast('Cod promoțional invalid. Încearcă VOYAGO10.'); return; }
      const run = () => {
        const days = E.trip.value === 'ow' ? 5 : Math.max(1, Math.round((new Date(E.d2.value) - new Date(E.d1.value)) / 864e5));
        saveCountry(getCountry(E.dest.value));
        LS.set('budgetInputs', { ...LS.get('budgetInputs', {}), days, travelers: +E.pax.value, promo: code });
        if (tab === 'car') LS.set('selectedPOIs', [{ id: 't3', name: 'Mașină închiriată', price: 45, icon: '🚗', mode: 'zi', cat: 'transport' }]);
        location.href = 'puncte-interes.html';
      };
      if (!user()) { pending = run; openAuth('register', 'Creează un cont ca să continui rezervarea.'); return; }
      run();
    });

    // Țări
    const grid = $('#countries'); let all = [];
    const draw = q => {
      const sel = LS.get('selectedCountry')?.code;
      const list = all.filter(c => (c.translations?.ron?.common || c.name.common).toLowerCase().includes(q.toLowerCase()));
      grid.innerHTML = list.length ? list.map(c => {
        const cur = Object.values(c.currencies || {})[0]?.name || '–';
        return `<article class="country ${c.cca2 === sel ? 'on' : ''}">
          <div class="flag" data-cc="${c.cca2}" style="background-image:url('${c.flags.png}')" role="img" aria-label="${esc(c.translations?.ron?.common || c.name.common)}"><img class="fbadge" src="${c.flags.png}" alt=""></div>
          <div class="body"><h3>${esc(c.translations?.ron?.common || c.name.common)}</h3>
          <div class="chips"><span class="chip">${esc(c.capital?.[0] || '–')}</span><span class="chip">${(c.population / 1e6).toFixed(1)} mil. loc.</span><span class="chip">${esc(cur)}</span></div>
          <button class="btn sm" data-code="${c.cca2}">${c.cca2 === sel ? 'Destinație aleasă ✓' : 'Alege destinația'}</button></div></article>`;
      }).join('') : `<div class="state" style="grid-column:1/-1"><h3>Nicio destinație găsită</h3><p class="muted">Încearcă alt nume de țară.</p></div>`;
      $$('[data-code]', grid).forEach(b => b.addEventListener('click', () => selectCountry(all.find(c => c.cca2 === b.dataset.code))));
      list.forEach(async c => { // poză cu capitala, de pe Wikipedia
        const w = await WIKI(LM[c.cca2]), img = await PHOTO(LM[c.cca2], w?.img);
        const el = $(`.flag[data-cc="${c.cca2}"]`, grid); if (img && el) el.style.backgroundImage = `url('${img}')`;
      });
    };
    const start = async () => {
      grid.innerHTML = '<div class="skeleton"></div>'.repeat(4);
      all = await loadCountries(); draw($('#q').value);
    };
    $('#q').addEventListener('input', e => draw(e.target.value));
    start();

    // Link din footer: index.html?tara=ES
    const t = new URLSearchParams(location.search).get('tara')?.toUpperCase();
    if (t && getCountry(t)) selectCountry(getCountry(t));
  }

  /* ---------- Puncte de interes ---------- */
  // format: nume|preț în EUR / persoană|emoji
  // format: nume|preț în EUR / persoană|emoji|articol Wikipedia (pentru poză și hartă)
  const DATA = {
    FR: { a: ['Turnul Eiffel (vârf)|29|🗼|Eiffel Tower', 'Muzeul Luvru|22|🖼️|Louvre', 'Palatul Versailles|21|🏰|Palace of Versailles'], r: ['Cină într-un bistro parizian|35|🍷|Bistro', 'Croissant și cafea la boulangerie|12|🥐|Croissant'] },
    IT: { a: ['Colosseum și Forum|18|🏛️|Colosseum', 'Capelele Vaticanului|25|⛪|Sistine Chapel', 'Plimbare cu gondola|30|🚣|Gondola'], r: ['Pizza napoletană autentică|15|🍕|Neapolitan pizza', 'Cină cu paste proaspete|30|🍝|Pasta'] },
    ES: { a: ['Sagrada Família|26|⛪|Sagrada Família', 'Alhambra, Granada|19|🕌|Alhambra', 'Parc Güell|10|🌳|Park Güell'], r: ['Tur de tapas|25|🍤|Tapas', 'Paella pe malul mării|30|🥘|Paella'] },
    GR: { a: ['Acropole|20|🏛️|Acropolis of Athens', 'Tur în caldera Santorini|45|🌋|Santorini', 'Palatul Knossos|15|🏺|Knossos'], r: ['Souvlaki în Plaka|10|🥙|Souvlaki', 'Cină la o tavernă pe plajă|28|🐟|Taverna'] },
    JP: { a: ['Templul Senso-ji|0|⛩️|Sensō-ji', 'Tur de o zi în Kyoto|60|🎎|Kyoto', 'Excursie la Muntele Fuji|80|🗻|Mount Fuji'], r: ['Sushi la bar|40|🍣|Sushi', 'Ramen în Shinjuku|12|🍜|Ramen'] },
    TH: { a: ['Marele Palat, Bangkok|15|🛕|Grand Palace', 'Tur al insulelor Phi Phi|45|🏝️|Phi Phi Islands', 'Sanctuar de elefanți|55|🐘|Elephant Nature Park'], r: ['Street food pe Yaowarat|8|🍢|Yaowarat Road', 'Cină thailandeză|20|🍛|Thai cuisine'] },
    TR: { a: ['Hagia Sophia|25|🕌|Hagia Sophia', 'Zbor cu balonul, Cappadocia|150|🎈|Cappadocia', 'Palatul Topkapi|18|👑|Topkapı Palace'], r: ['Kebab și ayran|14|🥙|Kebab', 'Meze și rakı pe Bosfor|25|🫒|Meze'] },
    PT: { a: ['Turnul Belém|8|🏰|Belém Tower', 'Palatul Pena, Sintra|14|🎨|Pena Palace', 'Tramvaiul 28, Lisabona|4|🚋|Trams in Lisbon'], r: ['Pastéis de nata și cafea|5|🥧|Pastel de nata', 'Fructe de mare la Cascais|35|🦐|Cascais'] },
    HR: { a: ['Zidurile Dubrovnikului|35|🏯|Walls of Dubrovnik', 'Lacurile Plitvice|40|💧|Plitvice Lakes National Park', 'Palatul lui Dioclețian, Split|8|🏛️|Diocletian\'s Palace'], r: ['Pește la grătar|25|🐟|Dalmatian cuisine', 'Cină la o konobă|22|🍷|Dalmatia'] },
    EG: { a: ['Piramidele din Giza|20|🔺|Giza pyramid complex', 'Muzeul Egiptean|15|🏺|Egyptian Museum', 'Croazieră pe Nil|50|⛵|Nile'], r: ['Koshari local|5|🍲|Koshari', 'Cină tradițională egipteană|18|🍖|Egyptian cuisine'] }
  };
  const LM = { FR: 'Eiffel Tower', IT: 'Colosseum', ES: 'Sagrada Família', GR: 'Acropolis of Athens', JP: 'Mount Fuji', TH: 'Wat Arun', TR: 'Hagia Sophia', PT: 'Belém Tower', HR: 'Walls of Dubrovnik', EG: 'Giza pyramid complex' };
  const TRANSPORT = [
    { id: 't1', name: 'Transfer aeroport – centru', price: 25, icon: '🚕', mode: 'unic' },
    { id: 't2', name: 'Abonament transport public', price: 20, icon: '🚇', mode: 'pers' },
    { id: 't3', name: 'Mașină închiriată', price: 45, icon: '🚗', mode: 'zi' },
    { id: 't4', name: 'Tren între orașe', price: 40, icon: '🚆', mode: 'pers' }
  ];
  const CATS = { atractii: 'Atracții turistice', restaurante: 'Restaurante și gastronomie', transport: 'Opțiuni de transport' };
  const MODE = { pers: 'pe persoană', zi: 'pe zi', unic: 'pe grup' };

  function poi() {
    const main = $('#app'), c = LS.get('selectedCountry');
    if (!user()) { main.innerHTML = `<div class="wrap section">${emptyState('Autentifică-te ca să continui', 'Punctele de interes se salvează în contul tău.', 'index.html#auth', 'Autentificare')}</div>`; return; }
    if (!c) { main.innerHTML = `<div class="wrap section">${emptyState('Alege mai întâi o destinație', 'Selectează una dintre cele 10 țări de pe prima pagină.', 'index.html#destinatii', 'Vezi destinațiile')}</div>`; return; }
    const d = DATA[c.code];
    const mk = (cat, s) => { const [name, price, icon, wiki] = s.split('|'); return { id: cat + name, cat, name, price: +price, icon, mode: 'pers', wiki }; };
    const items = [...d.a.map(s => mk('atractii', s)), ...d.r.map(s => mk('restaurante', s)), ...TRANSPORT.map(t => ({ ...t, cat: 'transport' }))];
    let sel = LS.get('selectedPOIs', []);
    main.innerHTML = `<section class="page-head"><div class="wrap"><h1>Ce vrei să faci în ${esc(c.name)}?</h1>
      <p class="muted">Bifează ce te interesează. Prețurile sunt estimări în euro și intră automat în buget.</p>
      <div class="dest"><img src="${esc(c.flag)}" alt=""> ${esc(c.name)}${c.capital ? ' · ' + esc(c.capital) : ''}</div></div></section>
      <div class="wrap" style="padding-top:40px"><div id="map" class="map" role="region" aria-label="Harta punctelor de interes"></div><p class="muted" style="font-size:.8rem;margin-top:6px">Poze: Unsplash / Wikipedia · Hartă: © OpenStreetMap, © CARTO</p></div><div class="wrap section" style="padding-top:32px">${Object.entries(CATS).map(([k, t]) =>
        `<div class="cat"><h2>${t}</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${items.filter(i => i.cat === k).map(i =>
          `<button class="poi" data-id="${esc(i.id)}" aria-pressed="false"><span class="ic" data-ic="${esc(i.id)}">${i.icon}</span><span><b>${esc(i.name)}</b><small>${i.price ? eur(i.price) + ' ' + MODE[i.mode] : 'Gratuit'}</small></span><span class="tick">✓</span></button>`).join('')}</div></div>`).join('')}
      <div class="dock"><span id="count"></span><a class="btn sm" href="buget.html">Calculează bugetul</a></div></div>`;
    const paint = () => {
      $$('.poi').forEach(b => b.setAttribute('aria-pressed', sel.some(s => s.id === b.dataset.id)));
      $('#count').textContent = sel.length ? `${sel.length} ${sel.length === 1 ? 'selecție' : 'selecții'}` : 'Nimic bifat încă';
    };
    $$('.poi').forEach(b => b.addEventListener('click', () => {
      const it = items.find(i => i.id === b.dataset.id);
      sel = sel.some(s => s.id === it.id) ? sel.filter(s => s.id !== it.id) : [...sel, it];
      LS.set('selectedPOIs', sel); paint();
    }));
    paint();
    let map = null; const pts = [];
    if (window.L) {
      map = L.map('map', { scrollWheelZoom: false }).setView([48, 12], 4);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19, attribution: '© OpenStreetMap, © CARTO' }).addTo(map);
      WIKI(LM[c.code]).then(w => { if (w?.lat && !pts.length) map.setView([w.lat, w.lon], 5); });
    } else $('#map').innerHTML = '<p class="muted" style="padding:24px">Harta nu s-a putut încărca. Verifică conexiunea la internet.</p>';
    items.filter(i => i.wiki).forEach(async it => {
      const w = await WIKI(it.wiki), img = await PHOTO(it.wiki, w?.img);
      if (img) { const el = $$('.ic').find(x => x.dataset.ic === it.id); if (el) el.innerHTML = `<img src="${esc(img)}" alt="${esc(it.name)}" loading="lazy">`; }
      if (map && it.cat === 'atractii' && w?.lat) {
        pts.push([w.lat, w.lon]);
        L.circleMarker([w.lat, w.lon], { radius: 9, color: '#fff', weight: 2, fillColor: '#E4572E', fillOpacity: 1 }).addTo(map).bindPopup(`<b>${esc(it.name)}</b><br>${it.price ? eur(it.price) : 'Gratuit'}`);
        map.fitBounds(pts, { padding: [40, 40], maxZoom: 13 });
      }
    });
  }

  /* ---------- Poze (Wikipedia) ---------- */
  async function WIKI(title) {
    const cache = LS.get('wikiCache2', {});
    if (title in cache) return cache[title];
    try {
      const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&titles=${encodeURIComponent(title)}&prop=pageimages|coordinates&piprop=thumbnail&pithumbsize=800&colimit=1`;
      const d = await (await fetch(u)).json(), p = Object.values(d.query?.pages || {})[0];
      const v = p && !('missing' in p) ? { img: p.thumbnail?.source || '', lat: p.coordinates?.[0]?.lat, lon: p.coordinates?.[0]?.lon } : null;
      cache[title] = v; LS.set('wikiCache2', cache); return v;
    } catch { return null; }
  }

  // Poze de la Unsplash (dacă ai cheie), altfel cele de pe Wikipedia
  async function PHOTO(q, fallback) {
    const key = LS.get('unsplashKey'); if (!key) return fallback;
    const cache = LS.get('photoCache2', {}); if (q in cache) return cache[q] || fallback;
    try {
      const r = await fetch(`https://api.unsplash.com/search/photos?per_page=1&orientation=landscape&query=${encodeURIComponent(q)}&client_id=${encodeURIComponent(key)}`);
      if (!r.ok) return fallback;
      const url = (await r.json()).results?.[0]?.urls?.small || '';
      cache[q] = url; LS.set('photoCache2', cache); return url || fallback;
    } catch { return fallback; }
  }

  /* ---------- Zboruri (Gemini + Căutare Google) ---------- */
  const AIR = { 'Wizz Air': ['https://www.wizzair.com/ro-ro', 'w'], 'Ryanair': ['https://www.ryanair.com/ro/ro', 'r'], 'TAROM': ['https://www.tarom.ro/ro', 't'] };
  const MODELS = ['gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-2.5-flash'];
  async function askGemini(prompt, key, model, search = true) {
    const tried = [...new Set([model, ...MODELS])], fails = [];
    for (const m of tried) {
      const body = { contents: [{ parts: [{ text: prompt }] }] };
      if (search) body.tools = [{ google_search: {} }];
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body)
      });
      const d = await r.json().catch(() => ({})), msg = d.error?.message || 'Eroare ' + r.status;
      if (r.ok) {
        const cand = d.candidates?.[0];
        return { text: (cand?.content?.parts || []).map(p => p.text || '').join(''), sources: (cand?.groundingMetadata?.groundingChunks || []).map(c => c.web).filter(Boolean), model: m };
      }
      if ([404, 429, 500, 503].includes(r.status)) { fails.push(`${m}: ${msg.slice(0, 160)}`); continue; }
      throw new Error(r.status === 403 || /api key/i.test(msg) ? 'Cheia API nu este validă sau nu are acces.' : msg);
    }
    const e = new Error(fails.some(f => /quota|exhaust|limit|429/i.test(f)) ? 'Google a refuzat cererea pentru toate modelele încercate: cota gratuită (mai ales pentru căutarea Google) este depășită sau este 0 pe contul tău.' : 'Niciun model Gemini nu a răspuns.');
    e.details = fails; throw e;
  }
  function flights() {
    const main = $('#app'), sc = LS.get('selectedCountry'), bi = LS.get('budgetInputs', {});
    const iso = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    main.innerHTML = `<section class="page-head"><div class="wrap"><h1>Caută zboruri</h1><p class="muted">Wizz Air, Ryanair și TAROM, căutate cu Gemini prin Google Search. Prețurile sunt orientative.</p></div></section>
      <div class="wrap fl"><form class="panel" id="ff"><h2>Zborul tău</h2>
        <div class="two"><label class="field">Din<input name="from" value="București"></label>
        <label class="field">Către<select name="dest">${FALLBACK.map(c => `<option value="${c.cca2}" ${c.cca2 === (sc?.code || 'IT') ? 'selected' : ''}>${c.name.common}</option>`).join('')}</select></label></div>
        <div class="two"><label class="field">Plecare<input type="date" name="d1" value="${iso(14)}" min="${iso(0)}" required></label>
        <label class="field">Întoarcere<input type="date" name="d2" value="${iso(19)}" min="${iso(0)}"></label></div>
        <label class="field">Pasageri<input type="number" name="pax" min="1" max="9" value="${bi.travelers || 2}"></label>
        <button class="btn" type="submit" style="width:100%">Caută cu Gemini</button>
        <p class="muted" style="margin-top:16px;font-weight:600">Verifică live, direct pe site:</p><div class="quick" id="quick"></div></form>
        <form class="panel" id="gk"><h2>Chei API</h2>
        <label class="field">Cheie API<input type="password" name="key" value="${esc(LS.get('geminiKey', ''))}" placeholder="AIza…" autocomplete="off"></label>
        <label class="field">Model<input name="model" value="${esc(LS.get('geminiModel', MODELS[0]))}"></label>
        <label class="field">Cheie Unsplash (opțional, pentru poze)<input type="password" name="unsplash" value="${esc(LS.get('unsplashKey', ''))}" placeholder="Access Key" autocomplete="off"></label>
        <div class="btns" style="margin-top:0"><button class="btn sm" type="submit">Salvează</button><button class="btn ghost sm" type="button" id="delk">Șterge cheia</button></div>
        <p class="muted" style="margin-top:14px;font-size:.88rem">Creează o cheie gratuită la <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color:var(--coral);font-weight:700">aistudio.google.com/apikey</a>. Pozele mai frumoase le iei cu o cheie gratuită de pe <a href="https://unsplash.com/developers" target="_blank" rel="noopener" style="color:var(--coral);font-weight:700">unsplash.com/developers</a> (Access Key; versiunea demo are 50 de cereri pe oră). Cheile rămân doar în browserul tău. Nu o pune în cod și nu o trimite altcuiva.</p></form></div>
      <div class="wrap section" style="padding-top:8px" id="res"></div>`;
    const F = $('#ff').elements, res = $('#res');
    const info = () => { const d = getCountry(F.dest.value); return { d, city: d.capital?.[0] || d.name.common, ro: d.translations?.ron?.common || d.name.common }; };
    const quick = () => {
      const { city } = info(), q = encodeURIComponent(`Flights from ${F.from.value} to ${city} on ${F.d1.value}${F.d2.value ? ' returning ' + F.d2.value : ''}`);
      $('#quick').innerHTML = [...Object.entries(AIR).map(([n, [u]]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`), `<a href="https://www.google.com/travel/flights?q=${q}" target="_blank" rel="noopener">Google Zboruri</a>`].join('');
    };
    quick(); $('#ff').addEventListener('input', quick);
    $('#gk').addEventListener('submit', e => { e.preventDefault(); const k = e.target.elements; LS.set('geminiKey', k.key.value.trim()); LS.set('geminiModel', k.model.value.trim() || MODELS[0]); LS.set('unsplashKey', k.unsplash.value.trim()); LS.del('photoCache2'); toast('Cheile au fost salvate.'); });
    $('#delk').addEventListener('click', () => { LS.del('geminiKey'); $('#gk').elements.key.value = ''; toast('Cheia a fost ștearsă.'); });
    const run = async search => {
      const key = LS.get('geminiKey');
      if (!key) { res.innerHTML = emptyState('Adaugă cheia Gemini', 'Introdu cheia în căsuța din dreapta și apasă „Salvează”, apoi caută din nou. Între timp poți folosi linkurile de verificare live.', '#gk', 'Am înțeles'); return; }
      const { d, city, ro } = info();
      res.innerHTML = '<div class="skeleton"></div>';
      const prompt = `Caută pe web zboruri de la ${F.from.value} la ${city} (${ro}) în jurul datei ${F.d1.value}${F.d2.value ? ', cu întoarcere în jurul datei ' + F.d2.value : ''}, pentru ${F.pax.value} pasageri, operate de Wizz Air, Ryanair și TAROM (doar cele care zboară pe rută). Răspunde DOAR cu JSON valid, fără alt text și fără markdown, în forma: {"zboruri":[{"companie":"Wizz Air|Ryanair|TAROM","ruta":"OTP - FCO","plecare_ora":"HH:MM sau null","sosire_ora":"HH:MM sau null","durata":"text sau null","escale":0,"pret_eur":număr sau null,"zile":"zilele de operare sau null","sursa":"URL"}],"nota":"o propoziție"}. Nu inventa: dacă nu găsești o informație sigură, pune null, iar dacă o companie nu zboară pe rută, nu o include. Prețurile sunt per persoană, în euro. Nu afirma că zborurile nu sunt în vânzare decât dacă ai o sursă clară.`;
      try {
        const out = await askGemini(prompt, key, LS.get('geminiModel', MODELS[0]), search);
        let data; try { data = JSON.parse(out.text.match(/\{[\s\S]*\}/)[0]); } catch { data = null; }
        const list = (data?.zboruri || []).filter(z => AIR[z.companie]);
        const src = out.sources.length ? `<p class="src">Surse: ${out.sources.slice(0, 5).map(s => `<a href="${esc(s.uri)}" target="_blank" rel="noopener">${esc(s.title || 'sursă')}</a>`).join('')}</p>` : '';
        res.innerHTML = (list.length ? list.map((z, i) => `<article class="flight"><span class="air ${AIR[z.companie][1]}">${esc(z.companie)}</span>
          <div><b>${esc(z.ruta || city)}</b><div class="muted">${z.plecare_ora ? esc(z.plecare_ora) + ' → ' + esc(z.sosire_ora || '?') : 'Ore: vezi pe site'}${z.durata ? ' · ' + esc(z.durata) : ''} · ${+z.escale ? z.escale + ' escală' : 'direct'}${z.zile ? ' · ' + esc(z.zile) : ''}</div></div>
          <div><div class="price">${z.pret_eur ? 'de la ' + eur(z.pret_eur) : 'Preț pe site'}<small>${z.pret_eur ? 'orientativ, per persoană' : 'îl vezi la companie'}</small></div>
          <div class="act"><a class="btn ghost sm" href="${AIR[z.companie][0]}" target="_blank" rel="noopener">Verifică pe site</a>${z.pret_eur ? '' : `<input class="pin" type="number" min="1" placeholder="€ / pers." aria-label="Prețul văzut pe site, în euro" data-pi="${i}">`}<button class="btn sm" data-pick="${i}">Alege zborul</button></div></div></article>`).join('')
          : emptyState('Nu am găsit zboruri sigure', 'Gemini nu a găsit informații verificabile pentru această rută. Folosește linkurile de verificare live.', '#ff', 'Înapoi la căutare')) + (data?.nota ? `<p class="muted">Nota Gemini (părere, nu confirmare): ${esc(data.nota)}</p>` : '') + src +
          (search ? '' : '<p class="src"><b>Atenție:</b> aceste date sunt o estimare AI făcută fără căutare web și pot fi greșite. Verifică pe site-ul companiei.</p>') + `<p class="src">Prețurile reale ale biletelor nu apar în căutările web. Deschide site-ul companiei, vezi prețul și scrie-l în căsuță, apoi apasă „Alege zborul”.</p>`;
        $$('[data-pick]').forEach(b => b.addEventListener('click', () => {
          const z = list[b.dataset.pick], price = Math.round(z.pret_eur || +$(`[data-pi="${b.dataset.pick}"]`)?.value || 0);
          if (!price) { toast('Scrie prețul văzut pe site-ul companiei, apoi alege zborul.'); return; }
          if (LS.get('selectedCountry')?.code !== d.cca2) saveCountry(d);
          LS.set('budgetInputs', { ...LS.get('budgetInputs', {}), flight: price, days: Math.max(1, Math.round((new Date(F.d2.value || F.d1.value) - new Date(F.d1.value)) / 864e5)) || 5, travelers: +F.pax.value });
          LS.set('selectedFlight', { ...z, date: F.d1.value });
          toast(`Zbor ${z.companie} adăugat în buget (${eur(price)} / persoană).`); setTimeout(() => location.href = 'buget.html', 900);
        }));
      } catch (err) {
        res.innerHTML = emptyState('Căutarea nu a reușit', esc(err.message || 'Verifică conexiunea la internet și cheia API.'), '#ff', 'Înapoi la căutare')
          + (err.details ? `<p class="src">${err.details.map(esc).join('<br>')}</p>` : '')
          + (search && err.details ? '<p style="text-align:center;margin-top:16px"><button class="btn ghost sm" id="nosearch">Încearcă fără Google Search (estimare AI)</button></p>' : '');
        $('#nosearch')?.addEventListener('click', () => run(false));
      }
    };
    $('#ff').addEventListener('submit', e => { e.preventDefault(); run(true); });
  }

  /* ---------- Buget ---------- */
  const STAYS = { 25: 'Hostel (25 €/noapte)', 70: 'Hotel 3 stele (70 €/noapte)', 90: 'Apartament (90 €/noapte)', 120: 'Hotel 4 stele (120 €/noapte)', 200: 'Resort 5 stele (200 €/noapte)' };
  // Formula bugetului – o cameră la 2 persoane; nopți = zile
  function calcBudget(b, pois) {
    const rooms = Math.ceil(b.travelers / 2);
    const r = { 'Cazare': b.stay * rooms * b.days, 'Zbor': b.flight * b.travelers * (b.promo === 'VOYAGO10' ? 0.9 : 1), 'Mâncare și cheltuieli zilnice': b.daily * b.travelers * b.days, 'Atracții': 0, 'Restaurante': 0, 'Transport local': 0 };
    pois.forEach(p => {
      const cost = p.mode === 'zi' ? p.price * b.days : p.mode === 'unic' ? p.price : p.price * b.travelers;
      r[p.cat === 'atractii' ? 'Atracții' : p.cat === 'restaurante' ? 'Restaurante' : 'Transport local'] += cost;
    });
    return r;
  }
  function budget() {
    const main = $('#app'), c = LS.get('selectedCountry');
    if (!user() || !c) { main.innerHTML = `<div class="wrap section">${emptyState(!user() ? 'Autentifică-te ca să continui' : 'Alege mai întâi o destinație', 'Bugetul se bazează pe destinația și selecțiile tale.', !user() ? 'index.html#auth' : 'index.html#destinatii', !user() ? 'Autentificare' : 'Vezi destinațiile')}</div>`; return; }
    const pois = LS.get('selectedPOIs', []);
    const b = { days: 5, travelers: 2, stay: 70, flight: 180, daily: 20, ...LS.get('budgetInputs', {}) };
    main.innerHTML = `<section class="page-head"><div class="wrap"><h1>Bugetul tău pentru ${esc(c.name)}</h1>
      <p class="muted">Modifică valorile și vezi totalul actualizat pe loc.</p></div></section>
      <div class="wrap budget"><form class="panel" id="bf"><h2>Detaliile călătoriei</h2>
        <div class="two"><label class="field">Număr de zile<input type="number" name="days" min="1" max="60" value="${b.days}"></label>
        <label class="field">Număr de persoane<input type="number" name="travelers" min="1" max="12" value="${b.travelers}"></label></div>
        <label class="field">Tip de cazare<select name="stay">${Object.entries(STAYS).map(([v, t]) => `<option value="${v}" ${+v === +b.stay ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <div class="two"><label class="field">Bilet de avion (€ / persoană)<input type="number" name="flight" min="0" value="${b.flight}"></label>
        <label class="field">Cheltuieli zilnice (€ / persoană)<input type="number" name="daily" min="0" value="${b.daily}"></label></div>
        <p class="muted">Cazarea se calculează pentru o cameră la 2 persoane, iar numărul de nopți este egal cu numărul de zile.</p>
        <p style="margin-top:16px"><a class="btn ghost sm" href="puncte-interes.html">Modifică punctele de interes (${pois.length})</a> <a class="btn ghost sm" href="zboruri.html">Caută zboruri</a></p></form>
      <aside class="summary" aria-live="polite"><span style="opacity:.7">Total estimat</span><div class="total" id="total"></div>
        <span style="opacity:.7" id="pp"></span><div id="rows"></div><a class="btn lime" href="plata.html" style="margin-top:26px">Continuă spre confirmare &rsaquo;</a></aside></div>`;
    const update = () => {
      const f = new FormData($('#bf'));
      const v = { days: Math.max(1, +f.get('days') || 1), travelers: Math.max(1, +f.get('travelers') || 1), stay: +f.get('stay'), flight: Math.max(0, +f.get('flight') || 0), daily: Math.max(0, +f.get('daily') || 0), promo: b.promo || '' };
      LS.set('budgetInputs', v);
      const r = calcBudget(v, pois), total = Object.values(r).reduce((a, n) => a + n, 0);
      $('#total').textContent = eur(total);
      $('#pp').textContent = `${eur(total / v.travelers)} / persoană · ${v.days} zile${v.promo === 'VOYAGO10' ? ' · cod VOYAGO10 aplicat (−10% la zbor)' : ''}`;
      $('#rows').innerHTML = Object.entries(r).map(([k, n]) => `<div class="row"><div><span>${k}</span><span>${eur(n)}</span></div><div class="bar"><i style="width:${total ? n / total * 100 : 0}%"></i></div></div>`).join('');
    };
    $('#bf').addEventListener('input', update); update();
  }

  /* ---------- Confirmare și plată ---------- */
  function bookings(main) {
    const u = user();
    if (!u) { main.innerHTML = `<div class="wrap section">${emptyState('Autentifică-te ca să vezi rezervările', 'Rezervările sunt legate de contul tău.', 'index.html#auth', 'Autentificare')}</div>`; return; }
    const list = LS.get('bookings', []).filter(x => x.user === u.email).reverse();
    main.innerHTML = `<section class="page-head"><div class="wrap"><h1>Rezervările mele</h1></div></section><div class="wrap section" style="padding-top:40px">${list.length
      ? `<div class="grid">${list.map(x => `<article class="country"><div class="flag" style="background-image:url('${esc(x.flag)}')"></div><div class="body"><h3>${esc(x.country)}</h3><div class="chips"><span class="chip">${esc(x.id)}</span><span class="chip">${esc(x.status)}</span></div><p class="muted">${x.days} zile · ${x.travelers} pers. · ${new Date(x.date).toLocaleDateString('ro-RO')}</p><b style="font-size:1.3rem">${eur(x.total)}</b></div></article>`).join('')}</div>`
      : emptyState('Nu ai nicio rezervare încă', 'După ce plătești, rezervarea apare aici.', 'index.html#destinatii', 'Alege o destinație')}</div>`;
  }
  const luhn = n => { let s = 0; [...n].reverse().forEach((d, i) => { d = +d; if (i % 2) { d *= 2; if (d > 9) d -= 9; } s += d; }); return s % 10 === 0; };
  function checkout() {
    window.addEventListener('hashchange', () => location.reload());
    const main = $('#app'), c = LS.get('selectedCountry'), u = user();
    if (location.hash === '#rezervari') return bookings(main);
    if (!u || !c) { main.innerHTML = `<div class="wrap section">${emptyState(!u ? 'Autentifică-te ca să continui' : 'Alege mai întâi o destinație', 'Ai nevoie de cont și de o destinație pentru a rezerva.', !u ? 'index.html#auth' : 'index.html#destinatii', !u ? 'Autentificare' : 'Vezi destinațiile')}</div>`; return; }
    const pois = LS.get('selectedPOIs', []);
    const b = { days: 5, travelers: 2, stay: 70, flight: 180, daily: 20, ...LS.get('budgetInputs', {}) };
    const r = calcBudget(b, pois), total = Math.round(Object.values(r).reduce((a, n) => a + n, 0));
    const S = { step: 1, email: u.email, phone: '', method: 'card', card: { name: '', num: '', exp: '', cvv: '' }, paypal: u.email,
      people: Array.from({ length: b.travelers }, (_, i) => ({ first: i ? '' : u.name.split(' ')[0], last: i ? '' : u.name.split(' ').slice(1).join(' ') })) };
    const M = { card: ['💳', 'Card bancar', 'Visa sau Mastercard'], paypal: ['🅿️', 'PayPal', 'Plătești cu contul tău'], bank: ['🏦', 'Transfer bancar', 'Rezervarea se confirmă după plată'] };
    const aside = `<aside class="summary"><span style="opacity:.7">Total de plată</span><div class="total">${eur(total)}</div><span style="opacity:.7">${esc(c.name)} · ${b.days} zile · ${b.travelers} pers.</span>${Object.entries(r).filter(([, n]) => n).map(([k, n]) => `<div class="row"><div><span>${k}</span><span>${eur(n)}</span></div></div>`).join('')}</aside>`;

    const stepTravelers = () => `<h2>Datele călătorilor</h2>${S.people.map((p, i) => `<div class="two"><label class="field">Prenume (călător ${i + 1})<input data-p="${i}" data-k="first" value="${esc(p.first)}"></label><label class="field">Nume<input data-p="${i}" data-k="last" value="${esc(p.last)}"></label></div>`).join('')}<div class="two"><label class="field">Email de contact<input type="email" name="email" value="${esc(S.email)}"></label><label class="field">Telefon<input type="tel" name="phone" value="${esc(S.phone)}" placeholder="07xx xxx xxx"></label></div>`;
    const stepPay = () => `<h2>Metoda de plată</h2><div class="methods">${Object.entries(M).map(([k, [i, t, d]]) => `<label class="method ${S.method === k ? 'on' : ''}"><input type="radio" name="method" value="${k}" ${S.method === k ? 'checked' : ''}><span class="mi">${i}</span><span><b>${t}</b><small>${d}</small></span></label>`).join('')}</div>${
      S.method === 'card' ? `<label class="field">Numele de pe card<input name="cname" value="${esc(S.card.name)}" autocomplete="cc-name"></label><label class="field">Număr card<input name="cnum" value="${esc(S.card.num)}" inputmode="numeric" maxlength="19" placeholder="0000 0000 0000 0000" autocomplete="cc-number"></label><div class="two"><label class="field">Expirare (LL/AA)<input name="cexp" value="${esc(S.card.exp)}" placeholder="08/28" maxlength="5"></label><label class="field">CVV<input name="ccvv" type="password" value="${esc(S.card.cvv)}" maxlength="4" inputmode="numeric"></label></div><p class="muted">Simulare: nu se face nicio plată reală, iar cardul nu se salvează.</p>`
      : S.method === 'paypal' ? `<label class="field">Email PayPal<input type="email" name="pp" value="${esc(S.paypal)}"></label>`
      : `<p class="muted">După confirmare primești datele pentru transfer. Rezervarea rămâne „În așteptarea plății” până la efectuarea lui.</p>`}`;
    const stepReview = () => `<h2>Revizuiește și confirmă</h2><div class="review"><p><b>Destinație:</b> ${esc(c.name)} · ${b.days} zile · ${b.travelers} persoane</p><p><b>Călători:</b> ${S.people.map(p => esc(p.first + ' ' + p.last)).join(', ')}</p><p><b>Contact:</b> ${esc(S.email)} · ${esc(S.phone)}</p><p><b>Selecții:</b> ${pois.length ? pois.map(p => esc(p.name)).join(', ') : 'fără puncte de interes'}</p><p><b>Plată:</b> ${S.method === 'card' ? 'Card •••• ' + S.card.num.slice(-4) : S.method === 'paypal' ? 'PayPal (' + esc(S.paypal) + ')' : 'Transfer bancar'}</p><p><b>Total:</b> ${eur(total)}</p></div><label class="chk"><input type="checkbox" id="terms"> Sunt de acord cu termenii și condițiile și confirm că datele sunt corecte.</label>`;

    const read = () => {
      const f = new FormData($('#cf'));
      if (S.step === 1) { $$('[data-p]').forEach(i => S.people[i.dataset.p][i.dataset.k] = i.value.trim()); S.email = f.get('email').trim(); S.phone = f.get('phone').trim(); }
      if (S.step === 2) {
        S.method = f.get('method');
        if (S.method === 'card') S.card = { name: f.get('cname').trim(), num: f.get('cnum').replace(/\s/g, ''), exp: f.get('cexp').trim(), cvv: f.get('ccvv') };
        else if (S.method === 'paypal') S.paypal = f.get('pp').trim();
      }
    };
    const validate = () => {
      const mail = /^\S+@\S+\.\S+$/;
      if (S.step === 1) {
        if (S.people.some(p => !p.first || !p.last)) return 'Completează numele tuturor călătorilor.';
        if (!mail.test(S.email)) return 'Introdu un email valid.';
        if (S.phone.replace(/\D/g, '').length < 9) return 'Introdu un număr de telefon valid.';
      } else if (S.step === 2) {
        if (S.method === 'card') {
          const { name, num, exp, cvv } = S.card, m = exp.match(/^(\d{2})\/(\d{2})$/);
          if (!name) return 'Introdu numele de pe card.';
          if (!/^\d{16}$/.test(num) || !luhn(num)) return 'Numărul cardului nu este valid (16 cifre). Pentru test: 4242 4242 4242 4242.';
          if (!m || +m[1] < 1 || +m[1] > 12 || new Date(2000 + +m[2], +m[1]) <= new Date()) return 'Data de expirare nu este validă.';
          if (!/^\d{3,4}$/.test(cvv)) return 'CVV-ul trebuie să aibă 3 sau 4 cifre.';
        }
        if (S.method === 'paypal' && !mail.test(S.paypal)) return 'Introdu emailul contului PayPal.';
      } else if (!$('#terms').checked) return 'Bifează acceptarea termenilor.';
      return '';
    };
    const done = bk => {
      main.innerHTML = `<div class="wrap section"><div class="panel ok"><div class="okic">✓</div><h2>${bk.status === 'Confirmată' ? 'Rezervare confirmată!' : 'Rezervare înregistrată!'}</h2><p class="muted">Cod rezervare</p><div class="code">${bk.id}</div><p>${esc(bk.country)} · ${bk.days} zile · ${bk.travelers} persoane · <b>${eur(bk.total)}</b></p><p class="muted" style="margin:10px 0 24px">${bk.method === 'bank' ? 'Transfer în contul RO00 VOYA 0000 0000 0000 0000 (demo), cu mențiunea ' + bk.id + '.' : 'Rezervarea a fost salvată în contul tău.'}</p><div class="btns" style="justify-content:center"><button class="btn" id="print">Printează confirmarea</button><a class="btn ghost" href="plata.html#rezervari">Rezervările mele</a><a class="btn ghost" href="index.html">Planifică altă călătorie</a></div></div></div>`;
      $('#print').addEventListener('click', () => window.print());
    };
    const pay = () => {
      const btn = $('#cf [type=submit]'); btn.disabled = true; btn.textContent = 'Se procesează plata…';
      setTimeout(() => {
        const bk = { id: 'VG-' + Math.random().toString(36).slice(2, 8).toUpperCase(), date: new Date().toISOString(), user: u.email, country: c.name, flag: c.flag, days: b.days, travelers: b.travelers, total,
          method: S.method, last4: S.method === 'card' ? S.card.num.slice(-4) : '', people: S.people.map(p => p.first + ' ' + p.last), email: S.email, status: S.method === 'bank' ? 'În așteptarea plății' : 'Confirmată' };
        LS.set('bookings', [...LS.get('bookings', []), bk]); LS.del('selectedPOIs'); done(bk);
      }, 1600);
    };
    const draw = (err = '') => {
      const steps = ['Călători', 'Plată', 'Confirmare'];
      main.innerHTML = `<section class="page-head"><div class="wrap"><h1>Finalizează rezervarea</h1><ol class="steps">${steps.map((t, i) => `<li class="${S.step === i + 1 ? 'on' : S.step > i + 1 ? 'done' : ''}">${i + 1}. ${t}</li>`).join('')}</ol></div></section>
        <div class="wrap budget"><form class="panel" id="cf" novalidate>${[stepTravelers, stepPay, stepReview][S.step - 1]()}<p class="err" role="alert">${err}</p>
        <div class="btns">${S.step > 1 ? '<button type="button" class="btn ghost" id="back">Înapoi</button>' : '<a class="btn ghost" href="buget.html">Înapoi la buget</a>'}<button class="btn" type="submit">${S.step === 3 ? 'Confirmă și plătește ' + eur(total) : 'Continuă'}</button></div></form>${aside}</div>`;
      $('#back')?.addEventListener('click', () => { read(); S.step--; draw(); });
      $$('[name=method]').forEach(i => i.addEventListener('change', () => { read(); draw(); }));
      $('[name=cnum]')?.addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim());
      $('#cf').addEventListener('submit', e => {
        e.preventDefault(); if (S.step < 3) read();
        const m = validate(); if (m) { draw(m); return; }
        if (S.step < 3) { S.step++; draw(); } else pay();
      });
    };
    draw();
  }

  /* ---------- Pornire ---------- */
  function init() {
    const page = document.body.dataset.page;
    layout(page);
    ({ home, poi, budget, checkout, flights })[page]?.();
  }
  document.addEventListener('DOMContentLoaded', init);
  return { calcBudget };
})();
