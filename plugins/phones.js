// スマホに変身するページ。箱全体をスマホの形と見た目に変え、ホーム画面を出す
//   about:lphone — 超縦長のスマホ「lPhone」(バナナ色、かじったバナナのロゴ)
// 角を丸くする板・ステータスバー・ホームバー・ホーム画面・バッテリーアプリ・自動回転は、機種によらず共通。
// ほかの機種は、別のプラグインから B3D.addPhone(id, spec, page) で足せる (B3D.phoneKit の部品を使える)
(() => {
  const EDGES = 6;  // 丸い角 1 つを作る細い板の枚数
  // 機種ごとの大きさ (幅・高さ・厚み)、角の丸み、画面のまわりの縁の太さ、電池 (mAh。体積にだいたい比例)。
  // long: 縦に超長い (ホーム画面に空白と案内)。deep: 厚みが幅・高さより大きい (本体の厚みの上限を上げ、箱を奥へずらす)。
  // lpLook: lPhone と同じ見た目 (黒い縁・金属の縁・バナナ色の背面)。name: 背面の刻印。
  // decorate(api, kit): 機種ごとの飾り (なければ lPhone と同じ)。edgeColor(lit): 角の板の色。homeExtra(home, t): ホーム画面に足すもの
  const PHONES = {
    lphone: { w: 420, h: 2600, d: 36, r: 64, bezel: 14, long: true, glass: false, mah: 14000, lpLook: true, name: 'lPhone' },
  };
  const PH = 'body.ph-on';  // どれかの機種に変身している間
  const LP = 'body.ph-lp';  // lPhone の見た目の機種

  const CSS = `
  /* ---------- 共通: 箱をスマホの形にする ---------- */
  ${LP} { --ph-r: ${PHONES.lphone.r}px; --ph-bezel: ${PHONES.lphone.bezel}px; }
  /* 正面: 角丸の画面。タブとアドレスバーは隠す */
  ${PH} #box .face.front { border-radius: var(--ph-r); padding: var(--ph-bezel); }
  ${PH} .face.front .tabs, ${PH} .face.front .toolbar { display: none; }
  ${PH} .face.front .panes { margin: 0; border-radius: calc(var(--ph-r) - var(--ph-bezel)); }
  ${PH} #box .face.back { border-radius: var(--ph-r); display: block; }
  /* 側面・上下の面は丸い角の分だけ短くし、角は細い板 (.ph-edge) で丸く見せる */
  ${PH} #box .face.left, ${PH} #box .face.right { top: var(--ph-r); height: calc(var(--H) - 2 * var(--ph-r)); }
  ${PH} #box .face.top, ${PH} #box .face.bottom { left: var(--ph-r); width: calc(var(--W) - 2 * var(--ph-r)); }
  .ph-edges { position: absolute; left: 0; top: 0; transform-style: preserve-3d; pointer-events: none; }
  .ph-edge {
    position: absolute; width: var(--cw); height: var(--D);
    left: calc(var(--cw) / -2); top: calc(var(--D) / -2);
    /* 角の中心へ移し、外向き (角度 --a) に半径だけ出して、面に垂直に立てる */
    transform: translate(calc(var(--ph-r) + var(--x) * (var(--W) - 2 * var(--ph-r))),
                         calc(var(--ph-r) + var(--y) * (var(--H) - 2 * var(--ph-r))))
               rotateZ(calc(var(--a) - 90deg)) translateY(var(--ph-r)) rotateX(90deg);
  }
  /* 正面: カメラの黒い丸・ステータスバー・ホームバー (どのページの上にも出す) */
  .ph-island {
    position: absolute; left: 50%; top: calc(var(--ph-bezel) + 12px); z-index: 6;
    width: 124px; height: 36px; margin-left: -62px; border-radius: 999px; background: #000; pointer-events: none;
  }
  .ph-status {
    position: absolute; left: calc(var(--ph-bezel) + 30px); right: calc(var(--ph-bezel) + 26px);
    top: calc(var(--ph-bezel) + 16px); z-index: 6;
    display: flex; justify-content: space-between; align-items: center; pointer-events: none;
    font: 600 16px/28px system-ui, sans-serif; color: #fff;
    /* どんな背景でも読めるよう、白い文字に影を付ける */
    text-shadow: 0 0 3px rgba(0,0,0,.55); filter: drop-shadow(0 0 1.5px rgba(0,0,0,.5));
  }
  .ph-battery { width: 28px; height: 13px; border: 2px solid currentColor; border-radius: 4px; padding: 1px; opacity: .9; }
  .ph-battery i { display: block; width: 70%; height: 100%; border-radius: 1px; background: currentColor; }
  .ph-homebar {
    position: absolute; left: 50%; bottom: calc(var(--ph-bezel) + 4px); z-index: 6;
    width: 180px; height: 26px; margin-left: -90px; border: 0; padding: 0; background: none; cursor: pointer;
  }
  /* 白いページでも暗いページでも見える灰色 */
  .ph-homebar::before { content: ''; display: block; height: 6px; margin: 10px 20px; border-radius: 3px;
    background: rgba(150,150,155,.9); box-shadow: 0 0 0 1px rgba(255,255,255,.35); }

  /* ---------- 共通: ホーム画面 ---------- */
  .ph-home { position: absolute; inset: 0; display: flex; flex-direction: column; color: #fff; font-family: system-ui, sans-serif; }
  .ph-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 26px 10px; padding: 90px 22px 0; }
  .ph-app { display: flex; flex-direction: column; align-items: center; gap: 6px; border: 0; background: none;
    color: inherit; cursor: pointer; padding: 0; font: 500 12px/1.2 system-ui, sans-serif; text-shadow: 0 1px 2px rgba(0,0,0,.4); }
  .ph-icon { width: 64px; height: 64px; border-radius: 16px; display: grid; place-items: center; font-size: 34px;
    box-shadow: 0 3px 8px rgba(0,0,0,.25); }
  .ph-app:active .ph-icon { filter: brightness(.85); }
  .ph-long { flex: 1; position: relative; }
  .ph-long p { position: absolute; left: 0; right: 0; margin: 0; text-align: center;
    font-size: 15px; opacity: .75; text-shadow: 0 1px 2px rgba(0,0,0,.4); }
  .ph-dock { margin: 0 14px calc(var(--ph-bezel) + 44px); padding: 16px 10px 12px; border-radius: 34px;
    display: grid; grid-template-columns: repeat(4, 1fr); background: rgba(255,255,255,.28); }
  .ph-dock .ph-app span:last-child { display: none; }  /* Dock は名前なし */
  /* フォルダ: 半透明の箱に、中のアプリの小さなアイコンが 2×2 */
  .ph-folder { background: rgba(255,255,255,.3) !important; display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 5px; padding: 9px; place-items: center; }
  .ph-folder i { width: 21px; height: 21px; border-radius: 6px; display: grid; place-items: center; font-size: 12px; font-style: normal; }
  /* 開いたフォルダ */
  .ph-folder-open { position: absolute; inset: 0; z-index: 4; background: rgba(0,0,0,.3); }
  .ph-home.folder-open > .ph-grid, .ph-home.folder-open > .ph-dock, .ph-home.folder-open > .ph-long {
    opacity: .25; filter: blur(3px); transition: opacity .2s, filter .2s; }
  .ph-folder-panel { position: absolute; left: 50%; top: 150px; width: min(310px, 84%); transform: translateX(-50%); }
  .ph-folder-panel h2 { margin: 0 0 14px; text-align: center; font: 600 26px/1.2 system-ui, sans-serif; text-shadow: 0 1px 3px rgba(0,0,0,.5); }
  .ph-folder-apps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px 8px; padding: 24px 14px; border-radius: 32px;
    background: rgba(255,255,255,.3); }
  .ph-front-only { position: absolute; inset: 0; display: grid; place-items: center; padding: 30px; text-align: center; color: #555; }

  /* ---------- lPhone: 黒い縁、金属の縁、バナナ色の背面 ---------- */
  ${LP} #box .face.front { background: #0b0b0d; box-shadow: inset 0 0 0 2px #3b3c40, inset 0 0 0 4px #111; }
  ${LP} #box .face.back { background: radial-gradient(120% 80% at 30% 20%, #fff3c4, #f6dc7a 55%, #e9c55a); }
  ${LP} #box .face.left, ${LP} #box .face.right {
    background: linear-gradient(90deg, #9fa3aa, #eceef1 45%, #f7f8fa 55%, #9fa3aa);
  }
  ${LP} #box .face.top, ${LP} #box .face.bottom {
    background: linear-gradient(180deg, #9fa3aa, #eceef1 45%, #f7f8fa 55%, #9fa3aa);
  }
  ${LP} .ph-home { background: linear-gradient(180deg, #2c3e8f, #6a4fa8 25%, #d76d77 60%, #ffaf7b 85%, #ffd27b); }
  /* 側面のボタン (左: 消音スイッチと音量、右: 電源) */
  .lp-btn {
    position: absolute; left: 18%; width: 64%; border-radius: 6px;
    background: linear-gradient(90deg, #8d9198, #dfe2e6 50%, #8d9198);
    box-shadow: 0 0 0 1px rgba(0,0,0,.25), 0 2px 3px rgba(0,0,0,.25);
  }
  /* 下の面: 充電口とスピーカーの穴 */
  .lp-port {
    position: absolute; left: 50%; top: 30%; width: 70px; height: 40%; margin-left: -35px;
    border-radius: 999px; background: #222; box-shadow: inset 0 1px 2px #000;
  }
  .lp-holes { position: absolute; top: 40%; height: 20%; width: 60px; display: flex; justify-content: space-between; }
  .lp-holes i { width: 6px; height: 100%; border-radius: 50%; background: #333; }
  /* 背面: カメラとロゴ */
  .lp-camera {
    position: absolute; left: 26px; top: 26px; width: 156px; height: 156px; border-radius: 44px;
    background: linear-gradient(145deg, rgba(255,255,255,.55), rgba(220,190,90,.6));
    box-shadow: 0 6px 14px rgba(120,90,0,.35), inset 0 0 0 1px rgba(255,255,255,.6);
  }
  .lp-lens {
    position: absolute; width: 58px; height: 58px; border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, #5d6b8a, #121521 45%, #05060a 70%);
    box-shadow: 0 0 0 5px #2a2b30, 0 0 0 7px rgba(255,255,255,.35);
  }
  .lp-flash { position: absolute; width: 16px; height: 16px; border-radius: 50%; background: radial-gradient(#fffbe8, #e9dca8); }
  .lp-logo { position: absolute; left: 50%; top: 42%; width: 130px; margin-left: -65px; text-align: center; }
  .lp-logo svg { display: block; width: 100%; }
  .lp-name { position: absolute; left: 0; right: 0; bottom: 90px; text-align: center;
    font: 600 22px/1 system-ui, sans-serif; letter-spacing: .05em; color: rgba(130,95,10,.55); }

  /* ---------- 自動回転: スマホを横にしたら、サイト (外のサイトと検索) の表示を横向きにする ---------- */
  body.ph-land .face.front .viewport:is([data-kind="url"], [data-kind="search"]) {
    inset: auto; left: 50%; top: 50%; width: var(--ph-lw); height: var(--ph-lh);
    transform: translate(-50%, -50%) rotate(var(--ph-rot)); animation: ph-turn .3s ease-out;
  }
  @keyframes ph-turn { from { transform: translate(-50%, -50%) rotate(calc(var(--ph-rot) * 0.3)); opacity: .6; } }
  body.ph-land .ph-status { display: none; }  /* 横向きでは時刻と電池を隠す */
  /* ホームバーは、横向きの画面の下の端 (本体の長い辺) へ */
  body.ph-land .ph-homebar { bottom: auto; margin-left: 0; top: calc(var(--H) / 2 - 13px); }
  body.ph-land-cw .ph-homebar { left: calc(var(--W) - var(--ph-bezel) - 17px - 90px); transform: rotate(-90deg); }
  body.ph-land-ccw .ph-homebar { left: calc(var(--ph-bezel) + 17px - 90px); transform: rotate(90deg); }

  /* ---------- バッテリーアプリ ---------- */
  .ph-batt { position: absolute; inset: 0; z-index: 4; display: grid; place-items: start center; padding-top: 130px;
    background: rgba(0,0,0,.35); }
  .ph-batt-panel { width: min(320px, 86%); padding: 26px 18px 22px; border-radius: 32px; text-align: center;
    background: rgba(255,255,255,.22); box-shadow: 0 8px 24px rgba(0,0,0,.25); text-shadow: 0 1px 3px rgba(0,0,0,.4); }
  .ph-batt-icon { font-size: 54px; line-height: 1; }
  .ph-batt-pct { margin-top: 6px; font: 700 54px/1.1 system-ui, sans-serif; }
  .ph-batt-left { margin-top: 6px; font: 600 20px/1.3 system-ui, sans-serif; }
  .ph-batt-cell { margin-top: 12px; font: 500 12px/1.3 system-ui, sans-serif; opacity: .8; }
`;

  // 画面に出る文字。[日本語, English]
  const STR = {
    lphone: ['lPhone', 'lPhone'],
    infoLphone: ['超縦長スマホ (リセットで戻る)', 'Extra-long smartphone (Reset to exit)'],
    appBattery: ['バッテリー', 'Battery'],
    battLeft: ['あと {0}', '{0} left'],
    battDays: ['{0}日{1}時間', '{0} days {1} h'],
    battHours: ['{0}時間{1}分', '{0} h {1} min'],
    phHome: ['ホームへ', 'Home'],
    phFrontOnly: ['スマホは正面のブラウザで開いてください', 'Please open the phone in the front browser'],
    lpMore: ['↓ まだ続きます', '↓ It keeps going'],
    lpHalf: ['まだ半分くらい', 'Only about halfway'],
    lpAlmost: ['もう少し…', 'Almost there…'],
    lpDock: ['Dock はこちら', 'Here is the Dock'],
    appKobito: ['小人', 'Tiny Folks'],
    appCat: ['猫動画', 'Cat video'],
    appDraw: ['お絵描き', 'Draw'],
    appTower: ['東京タワー', 'Tokyo Tower'],
    appKenon: ['ケノン脱毛', 'Ke-non'],
    appAsteroids: ['小惑星', 'Asteroids'],
    appSelf: ['3D Browser', '3D Browser'],
    appInfo: ['説明', 'About'],
  };

  // アプリ: { id, icon, bg, label (文字のキー) または name, q (開くもの。関数なら言語で変わる) }
  const APPS = [
    { id: 'kobito', icon: '🧑‍🤝‍🧑', bg: 'linear-gradient(135deg, #8fd3a8, #3e9b6b)', label: 'appKobito', q: 'about:kobito' },
    { id: 'cat', icon: '🐱', bg: 'linear-gradient(135deg, #ffb36b, #e86a2f)', label: 'appCat', q: 'https://www.youtube.com/watch?v=DPiAFqesQ5E' },
    { id: 'draw', icon: '🎨', bg: 'linear-gradient(135deg, #fff, #dfe6f5)', label: 'appDraw', q: 'about:draw' },
    { id: 'tower', icon: '🗼', bg: 'linear-gradient(135deg, #ff8a8a, #c9302c)', label: 'appTower', q: (t) => t('appTower') },
    { id: 'kenon', icon: '✨', bg: 'linear-gradient(135deg, #ffd1e8, #e8609f)', label: 'appKenon', q: 'https://ケノン.com/' },
    { id: 'zoom', icon: '🌀', bg: 'linear-gradient(135deg, #b7a6ff, #5b3fd1)', name: 'zoomquilt', q: 'https://zoomquilt.org/' },
    { id: 'aqua', icon: '🐟', bg: 'linear-gradient(135deg, #7fd6ff, #1f7fd1)', name: 'Aquarium', q: 'https://webglsamples.org/aquarium/aquarium.html' },
    { id: 'asteroids', icon: '🌌', bg: 'linear-gradient(135deg, #4a4f6a, #0b0c14)', label: 'appAsteroids', q: 'https://www.asterank.com/3d/' },
    // スマホ (ほかの機種があれば、同じまとめのフォルダに入る)
    { id: 'lphone', icon: '🍌', bg: 'linear-gradient(135deg, #fff3c4, #e9c55a)', name: 'lPhone', q: 'about:lphone' },
    { id: 'battery', icon: '🔋', bg: 'linear-gradient(135deg, #b8f5a8, #2fa84f)', label: 'appBattery', open: 'battery' },
    { id: 'self', icon: '🧊', bg: 'linear-gradient(135deg, #e8eefc, #9fb4e8)', label: 'appSelf', q: 'about:this' },
    { id: 'info', icon: 'ℹ️', bg: 'linear-gradient(135deg, #d9dce3, #8a9099)', label: 'appInfo', q: 'about:info' },
  ];
  const DOCK = ['kobito', 'cat', 'draw', 'self'];

  // かじったバナナのロゴ (lPhone)
  const BANANA_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
    <defs><mask id="lp-bite"><rect width="100" height="100" fill="#fff"/><circle cx="83" cy="66" r="11" fill="#000"/></mask></defs>
    <g mask="url(#lp-bite)">
      <path d="M24 22 C14 52 26 80 56 88 C70 92 84 88 90 80 C70 80 52 72 42 56 C34 44 31 32 32 22 Z" fill="#b58b1d"/>
      <path d="M30 26 C24 50 34 72 56 80" stroke="rgba(255,255,255,.35)" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>
    <path d="M24 22 L22 12 L33 14 L32 22 Z" fill="#7a5a10"/>
  </svg>`;

  // ---------- ページ (機種ごと) ----------
  const renderPhone = (id) => (tab, api) => {
    const { t } = api;
    const spec = PHONES[id];
    const page = document.createElement('div');
    page.className = 'page';
    tab.pane.appendChild(page);
    // 箱の形を変えるので、正面のブラウザでだけ開ける
    if (!api.face()?.classList.contains('front')) {
      page.innerHTML = `<div class="ph-front-only">${t('phFrontOnly')}</div>`;
      return;
    }
    if (api.setLook(id, { w: spec.w, h: spec.h, d: spec.d, minD: 20, glass: spec.glass, maxD: spec.deep ? spec.d : 0, pushBack: !!spec.deep })) decorate(api, id);

    // ホーム画面。lPhone は、アイコンは上のほうに少しだけで、その下はずっと空いていて、一番下にやっと Dock がある
    const appButton = (a) => {
      const b = document.createElement('button');
      b.className = 'ph-app';
      b.innerHTML = `<span class="ph-icon" style="background:${a.bg}">${a.icon}</span><span>${a.label ? t(a.label) : a.name}</span>`;
      b.addEventListener('click', () => {
        if (a.open === 'battery') return openBattery();
        api.navigate(typeof a.q === 'function' ? a.q(t) : a.q);
      });
      return b;
    };
    const home = document.createElement('div');
    home.className = 'ph-home pass-drag';  // 空いた所のドラッグは、本体が箱を回す・パンする (スマホをスクロールするように)
    const grid = document.createElement('div');
    grid.className = 'ph-grid';
    // まとめ (2 つ以上のページが入っているもの) に入っているアプリは、スマホによくあるフォルダに入れる。
    // フォルダは、最初のアプリがあった場所に置く。アプリの一覧にないページだけのまとめは、1 段目 (4 個) のすぐあとに置く
    const groups = api.groups();
    const groupOf = (a) => typeof a.q === 'string' && groups.find((g) => g.pages.includes(a.q.replace(/^about:/, '')));
    const entries = [];
    for (const a of APPS) {
      const g = groupOf(a);
      if (!g) { entries.push(a); continue; }
      let fd = entries.find((e) => e.folder === g.id);
      if (!fd) entries.push(fd = { folder: g.id, title: g.title, apps: [] });
      fd.apps.push(a);
    }
    groups.forEach((g, i) => {
      let fd = entries.find((e) => e.folder === g.id);
      if (!fd) entries.splice(4 + i, 0, fd = { folder: g.id, title: g.title, apps: [] });
      for (const pid of g.pages) {  // アプリの一覧にないページは、ページの名前とアイコンで足す
        if (fd.apps.some((a) => a.q === `about:${pid}`)) continue;
        const info = api.pageInfo(pid);
        fd.apps.push({ id: pid, icon: info.icon || '📄', bg: info.appBg || 'linear-gradient(135deg, #c9cfdb, #7d8698)', name: info.title, q: `about:${pid}` });
      }
    });
    // フォルダ: 角丸の箱の中に、入っているアプリの小さなアイコンが 2×2 で見える。タップで大きく開く
    const folderButton = (fd) => {
      const b = document.createElement('button');
      b.className = 'ph-app';
      b.innerHTML = `<span class="ph-icon ph-folder">${fd.apps.slice(0, 4).map((a) => `<i style="background:${a.bg}">${a.icon}</i>`).join('')}</span><span>${fd.title}</span>`;
      b.addEventListener('click', () => openFolder(fd));
      return b;
    };
    // 開いたフォルダ: 後ろを暗くして、中のアプリを普通の大きさで並べる。外をタップすると閉じる
    const openFolder = (fd) => {
      const ov = document.createElement('div');
      ov.className = 'ph-folder-open no-pass-drag';
      ov.innerHTML = `<div class="ph-folder-panel"><h2>${fd.title}</h2><div class="ph-folder-apps"></div></div>`;
      fd.apps.forEach((a) => ov.querySelector('.ph-folder-apps').appendChild(appButton(a)));
      ov.addEventListener('click', (e) => { if (e.target === ov) { ov.remove(); home.classList.remove('folder-open'); } });
      home.classList.add('folder-open');  // 後ろのアイコンを薄くぼかす
      home.appendChild(ov);
    };
    // バッテリー: 充電の % と、あと何時間もつか。電池は本体の体積にだいたい比例するので、大きい機種ほど長くもつ
    const openBattery = () => {
      const ov = document.createElement('div');
      ov.className = 'ph-batt no-pass-drag';
      ov.innerHTML = `<div class="ph-batt-panel"><div class="ph-batt-icon">🔋</div><div class="ph-batt-pct"></div>
        <div class="ph-batt-left"></div><div class="ph-batt-cell">Li-ion ${spec.mah.toLocaleString('en-US')} mAh · Banana Inc.</div></div>`;
      const show = (pct) => {
        ov.querySelector('.ph-batt-pct').textContent = `${pct}%`;
        const h = Math.floor(spec.mah * pct / 100 / STANDBY_MA), m = Math.floor((spec.mah * pct / 100 / STANDBY_MA - h) * 60);
        const left = h >= 24 ? t('battDays').replace('{0}', Math.floor(h / 24)).replace('{1}', h % 24)
          : t('battHours').replace('{0}', h).replace('{1}', m);
        ov.querySelector('.ph-batt-left').textContent = t('battLeft').replace('{0}', left);
      };
      batteryPct().then(show);
      ov.addEventListener('click', () => { ov.remove(); home.classList.remove('folder-open'); });  // どこを押しても閉じる
      home.classList.add('folder-open');  // 後ろのアイコンを薄くぼかす (フォルダと同じ)
      home.appendChild(ov);
    };
    entries.forEach((e) => grid.appendChild(e.folder ? folderButton(e) : appButton(e)));
    const long = document.createElement('div');
    long.className = 'ph-long';
    if (spec.long) {
      long.innerHTML = [['lpMore', 8], ['lpHalf', 40], ['lpAlmost', 72], ['lpDock', 96]]
        .map(([k, top]) => `<p style="top:${top}%">${t(k)}</p>`).join('');
    }
    const dock = document.createElement('div');
    dock.className = 'ph-dock';
    DOCK.forEach((d) => dock.appendChild(appButton(APPS.find((a) => a.id === d))));
    home.append(grid, long);
    spec.homeExtra?.(home, t);  // 機種ごとに足すもの (Dock のすぐ上)
    home.append(dock);
    page.appendChild(home);
  };

  // ---------- 自動回転 ----------
  // スマホをロールで横 (90° ± 35° か 270° ± 35°) にして少し (0.4 秒) たったら、外のサイトと検索の表示を横向きにする。
  // 逆さま (180°) では回さない。ホーム画面と内蔵のアプリ (ゲームなど) は縦のまま
  function autoRotate(api) {
    let now = null, want = null, since = 0;
    const face = document.querySelector('#box .face.front');
    const set = (dir) => {
      now = dir;
      document.body.classList.toggle('ph-land', !!dir);
      document.body.classList.toggle('ph-land-cw', dir === 'cw');
      document.body.classList.toggle('ph-land-ccw', dir === 'ccw');
      if (!dir) return;
      const panes = face.querySelector('.panes');
      document.body.style.setProperty('--ph-lw', `${panes.clientHeight}px`);  // 横向きの画面は、縦の画面の幅と高さを入れ替えた大きさ
      document.body.style.setProperty('--ph-lh', `${panes.clientWidth}px`);
      document.body.style.setProperty('--ph-rot', dir === 'cw' ? '-90deg' : '90deg');  // 本体を回した向きと逆に回して、まっすぐ読めるように
    };
    const timer = setInterval(() => {
      const a = api.roll(), kind = face.querySelector('.panes > .viewport:not([hidden])')?.dataset.kind;
      const site = kind === 'url' || kind === 'search';
      const dir = !site ? null : Math.abs(a - 90) <= 35 ? 'cw' : Math.abs(a - 270) <= 35 ? 'ccw' : null;
      if (dir !== want) { want = dir; since = performance.now(); }
      if (want !== now && (performance.now() - since >= 400 || !site)) set(want);  // サイトでなくなったら、すぐ縦に
    }, 100);
    api.onLookEnd(() => { clearInterval(timer); set(null); });
  }

  // ---------- バッテリー ----------
  const STANDBY_MA = 180;  // 待ち受けで使う電流 (mA)
  // 充電の %: 使っている端末の本当の残量 (ブラウザが教えてくれれば)。分からなければ、それらしい数字 (開くたびには変えない)
  let fakePct = 0;
  function batteryPct() {
    const fake = () => fakePct || (fakePct = 60 + Math.floor(Math.random() * 41));
    if (!navigator.getBattery) return Promise.resolve(fake());
    return navigator.getBattery().then((b) => Math.round(b.level * 100), fake);
  }

  // ---------- 箱の飾り (見た目を変えている間だけ。戻すと消える) ----------
  const el = (cls, html = '') => {
    const e = document.createElement('div');
    e.className = cls;
    e.innerHTML = html;
    return e;
  };
  function decorate(api, id) {
    const { t } = api;
    const spec = PHONES[id], { r } = spec;
    // CSS で「スマホに変身している」「lPhone の見た目」を見分ける印
    document.body.classList.add('ph-on');
    document.body.classList.toggle('ph-lp', !!spec.lpLook);
    api.onLookEnd(() => document.body.classList.remove('ph-on', 'ph-lp'));
    // 丸い角: 4 つの角に、外向きの細い板を少しずつ角度を変えて並べる
    const edges = el('ph-edges');
    const cw = 2 * r * Math.sin(Math.PI / 4 / EDGES) * 1.12;  // 板の幅 (すき間が出ないよう少し広め)
    for (const [x, y, from] of [[0, 0, 180], [1, 0, 270], [1, 1, 0], [0, 1, 90]]) {
      for (let i = 0; i < EDGES; i++) {
        const a = from + (i + 0.5) * 90 / EDGES;
        // 左上から光が当たる: 外向きが左上ほど明るい
        const lit = 0.5 + 0.5 * Math.max(0, -Math.cos(a * Math.PI / 180) * 0.6 - Math.sin(a * Math.PI / 180) * 0.8);
        const e = el('ph-edge');
        e.style.cssText = `--x:${x};--y:${y};--a:${a}deg;--cw:${cw}px;background:${(spec.edgeColor || metalEdge)(lit)}`;
        edges.appendChild(e);
      }
    }
    api.lookDecorate(edges, 'box');

    // 正面: カメラの黒い丸、ステータスバー (時刻・電池)、ホームバー (押すとホーム画面へ)
    api.lookDecorate(el('ph-island'), 'front');
    const status = el('ph-status', '<span class="ph-time"></span><span class="ph-battery"><i></i></span>');
    const tick = () => {
      const d = new Date();
      status.querySelector('.ph-time').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    tick();
    const timer = setInterval(tick, 10000);
    api.onLookEnd(() => clearInterval(timer));
    api.lookDecorate(status, 'front');
    const homebar = document.createElement('button');
    homebar.className = 'ph-homebar';
    homebar.title = t('phHome');
    homebar.dataset.i18nTitle = 'phHome';
    homebar.addEventListener('click', () => api.navigate(`about:${id}`));
    api.lookDecorate(homebar, 'front');
    autoRotate(api);

    if (spec.decorate) spec.decorate(api, kit); else decorateL(api, spec.name);
  }
  // 角の板の色 (金属)
  function metalEdge(lit) {
    const c = Math.round(150 + 95 * lit);
    return `linear-gradient(90deg, rgb(${c - 40},${c - 38},${c - 34}), rgb(${c},${c + 2},${c + 5}) 50%, rgb(${c - 40},${c - 38},${c - 34}))`;
  }
  const button = (cls, top, h) => { const b = el(cls); b.style.top = `${top}px`; b.style.height = `${h}px`; return b; };

  // lPhone: 側面のボタン、下の充電口とスピーカー、背面のカメラとバナナのロゴ
  function decorateL(api, name) {
    // 左の面は、外から見て上下が箱と同じ向き。消音スイッチと音量の上下
    api.lookDecorate(button('lp-btn', 250, 60), 'left');
    api.lookDecorate(button('lp-btn', 360, 110), 'left');
    api.lookDecorate(button('lp-btn', 490, 110), 'left');
    api.lookDecorate(button('lp-btn', 380, 170), 'right');  // 電源
    const bottom = el('lp-bottom');
    bottom.style.cssText = 'position:absolute;inset:0';
    bottom.innerHTML = '<div class="lp-port"></div>' +
      `<div class="lp-holes" style="left:16%">${'<i></i>'.repeat(6)}</div>` +
      `<div class="lp-holes" style="right:16%">${'<i></i>'.repeat(6)}</div>`;
    api.lookDecorate(bottom, 'bottom');
    const cam = el('lp-camera',
      '<div class="lp-lens" style="left:14px;top:14px"></div><div class="lp-lens" style="left:14px;top:84px"></div>' +
      '<div class="lp-lens" style="left:84px;top:49px"></div><div class="lp-flash" style="left:108px;top:16px"></div>');
    api.lookDecorate(cam, 'back');
    api.lookDecorate(el('lp-logo', BANANA_SVG), 'back');
    api.lookDecorate(el('lp-name', name), 'back');
  }

  // 機種を足す。page: { icon, info (説明のキー), appBg, strings, css }。スマホのページはまとめ「未来スマホ」に入る
  // (機種が 1 つだけなら、まとめにせずそのまま並ぶ)。ページはガラス (glass): 透明な機種では、ホーム画面の向こうが透けて見える
  function addPhone(id, spec, page) {
    PHONES[id] = spec;
    B3D.registerPage({
      id, title: id, icon: page.icon, info: page.info, appBg: page.appBg, menu: true, langRerender: true, glass: true,
      group: { id: 'future', icon: '📱', title: ['未来スマホ', 'Future phones'], info: ['未来のスマホ', 'Phones from the future'] },
      strings: page.strings, css: page.css, render: renderPhone(id),
    });
  }
  // ほかの機種のプラグインが使う部品
  const kit = { el, button, decorateL };
  B3D.addPhone = addPhone;
  B3D.phoneKit = kit;
  addPhone('lphone', PHONES.lphone, { icon: '🍌', info: 'infoLphone', appBg: 'linear-gradient(135deg, #fff3c4, #e9c55a)', strings: STR, css: CSS });
})();
