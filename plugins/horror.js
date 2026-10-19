// about:horror — 幽霊が這って近づいてきて……花をくれる。花は小人のページにあげられる (api.giveItem)
(() => {
  const CSS = `
  .horror { position: absolute; inset: 0; overflow: hidden; background: #0b0c0e; color: #ddd; }
  .h-room {
    position: absolute; inset: 0; opacity: 0; transition: opacity .6s;
    background: linear-gradient(#15171b 0 58%, #23262c 58% 100%);
  }
  .h-noise {
    position: absolute; inset: 0; width: 100%; height: 100%;
    image-rendering: pixelated; opacity: 0; transition: opacity .15s; pointer-events: none;
  }
  /* 這ってくる幽霊 (正面から見た四つんばい) */
  .h-ghost {
    position: absolute; left: 50%; bottom: 40%; width: 300px; height: 210px;
    transform-origin: 50% 100%; opacity: 0;
  }
  .crawl-svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .crawl-svg .arm { transform-box: fill-box; transform-origin: 50% 0; transition: transform .14s steps(2); }
  .crawl-svg.a .arm-r, .crawl-svg.b .arm-l { transform: translateY(-14px) scale(1.05); }
  .crawl-svg.no-l .arm-l, .crawl-svg.no-r .arm-r { opacity: 0; }
  /* 普段は顔が髪で完全に隠れている。reveal で髪が左右に分かれて笑い顔が見える */
  .crawl-svg .hair-up, .crawl-svg .face { opacity: 0; }
  .crawl-svg.reveal .hair-down { opacity: 0; }
  .crawl-svg.reveal .hair-up, .crawl-svg.reveal .face { opacity: 1; }
  /* 顔をガッと上げる: 一瞬縮んでから跳ね上がる */
  .crawl-svg.lift { animation: h-lift .5s cubic-bezier(.2, 1.6, .4, 1) forwards; transform-origin: 50% 100%; }
  @keyframes h-lift {
    0% { transform: none; }
    25% { transform: translateY(4%) scaleY(.92); }
    100% { transform: translateY(-9%) scaleY(1.04); }
  }
  .crawl-svg.wave .arm-r { animation: h-wave .3s steps(2) infinite alternate; }
  @keyframes h-wave { to { transform: translateY(-40px) rotate(-25deg); } }
  .horror.flicker { animation: h-flicker .12s steps(2) 1; }
  @keyframes h-flicker { 50% { filter: brightness(2.2) contrast(1.4); } }
  .h-end {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 8px; background: #fbf7f2; color: #555;
  }
  .h-end[hidden] { display: none; }
  .h-end-flower { width: 60px; }
  .h-end p { margin: 0; font-size: 18px; letter-spacing: .2em; }
  .h-replay {
    border: 1px solid #dde0e6; background: #fff; border-radius: 999px;
    padding: 6px 16px; font-size: 13px; cursor: pointer;
  }

  /* 面の外に出てくる手 (箱の中に 3D で置く) */
  .grip3d, .arm3d { position: absolute; pointer-events: none; }
  .grip3d { width: 150px; height: 140px; }
  .arm3d { width: 200px; height: 270px; }
  .grip3d svg, .arm3d svg { display: block; width: 100%; height: 100%; }

  /* 右手に咲く花 (箱の中に 3D で置く) */
  .arm3d .offer-flower {
    transform-box: view-box; transform-origin: 100px 150px;
    scale: 0; rotate: -25deg;
    transition: scale .45s cubic-bezier(.3, 1.7, .5, 1), rotate .45s cubic-bezier(.3, 1.7, .5, 1), opacity .4s;
  }
  .arm3d.pop .offer-flower { scale: 1; rotate: 0deg; }
  .arm3d.given .offer-flower { opacity: 0; }  /* 渡したので手元からは消える */
  /* 花が出る瞬間に面の中が白く光る */
  .h-flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }
  .horror.pop .h-flash { animation: h-flash .45s ease-out; }
  @keyframes h-flash { 15% { opacity: .85; } 100% { opacity: 0; } }
  /* 笑い顔のまわりに浮かぶハート */
  .h-hearts span {
    position: absolute; left: 50%; top: 30%; color: #ff7aa8; font-size: 34px; opacity: 0;
    pointer-events: none;
  }
  .horror.pop .h-hearts span { animation: h-heart 1.8s ease-out forwards; }
  .horror.pop .h-hearts span:nth-child(1) { animation-delay: .2s; margin-left: -150px; }
  .horror.pop .h-hearts span:nth-child(2) { animation-delay: .45s; margin-left: 120px; }
  .horror.pop .h-hearts span:nth-child(3) { animation-delay: .7s; margin-left: -20px; top: 18%; }
  @keyframes h-heart {
    0% { opacity: 0; transform: translateY(0) scale(.6); }
    20% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-120px) scale(1.2); }
  }
`;

  // 画面に出る文字。[日本語, English]
  const STR = {
    horror: ['ホラー', 'Horror'],
    theEnd: ['おしまい', 'The End'],
    again: ['もう一度', 'Again'],
    souvenir: ['もらった花 (ドラッグで持っていける・クリックで片付ける)', 'A flower for you (drag it somewhere, or click to put away)'],
    infoHorror: ['ちょっと怖い? (Esc でスキップ)', 'A little scary? (Esc to skip)'],
  };

  // 長い黒髪の幽霊が地面を這って近づき、画面の縁をつかんで手を伸ばしてくる……と思ったら花をくれる
  const SKIN = 'fill="#e6e2d9" stroke="#b9b5ab" stroke-width="2"';

  // 正面から見た四つんばいの姿。arm-r が画面の左 (幽霊の右手)、arm-l が画面の右 (幽霊の左手)
  const CRAWL_SVG = `
    <svg viewBox="0 0 300 210" class="crawl-svg" aria-hidden="true">
      <ellipse cx="150" cy="92" rx="74" ry="38" fill="#ecebe6" stroke="#b9b5ab" stroke-width="2"/>
      <g class="arm arm-r">
        <path d="M96 96 Q70 140 62 186" stroke="#d6d3cb" stroke-width="16" fill="none" stroke-linecap="round"/>
        <g ${SKIN}><ellipse cx="50" cy="203" rx="4" ry="7"/><ellipse cx="58" cy="205" rx="4" ry="7"/>
          <ellipse cx="66" cy="205" rx="4" ry="7"/><ellipse cx="74" cy="203" rx="4" ry="7"/>
          <ellipse cx="62" cy="193" rx="18" ry="10"/></g>
      </g>
      <g class="arm arm-l">
        <path d="M204 96 Q230 140 238 186" stroke="#d6d3cb" stroke-width="16" fill="none" stroke-linecap="round"/>
        <g ${SKIN}><ellipse cx="226" cy="203" rx="4" ry="7"/><ellipse cx="234" cy="205" rx="4" ry="7"/>
          <ellipse cx="242" cy="205" rx="4" ry="7"/><ellipse cx="250" cy="203" rx="4" ry="7"/>
          <ellipse cx="238" cy="193" rx="18" ry="10"/></g>
      </g>
      <!-- 垂れた髪で顔は完全に隠れている (目も見せない) -->
      <g class="hair-down">
        <path d="M100 72 Q100 22 150 22 Q200 22 200 72 Q214 122 222 196 Q208 206 196 194 Q186 208 174 195
                 Q162 209 150 196 Q138 209 126 195 Q114 208 104 194 Q92 206 78 196 Q86 122 100 72 Z" fill="#131313"/>
        <g stroke="#2b2b2b" stroke-width="2" fill="none">
          <path d="M122 40 Q112 120 104 190"/><path d="M150 30 Q150 120 150 194"/><path d="M178 40 Q188 120 196 190"/>
        </g>
      </g>
      <!-- 顔を上げると髪が分かれて、不気味かわいい笑い顔が見える
           (青白い顔、目の下のくま、細めた目、口角の上がった細い笑み、顔にかかる髪) -->
      <g class="face">
        <ellipse cx="150" cy="74" rx="37" ry="34" fill="#e9e6e1"/>
        <g fill="#b8b2c4" opacity=".55">
          <ellipse cx="135" cy="76" rx="9" ry="3.5"/><ellipse cx="165" cy="76" rx="9" ry="3.5"/>
        </g>
        <g stroke="#222" stroke-width="3" fill="none" stroke-linecap="round">
          <path d="M126 70 Q135 64 144 71"/><path d="M156 71 Q165 64 174 70"/>
        </g>
        <ellipse cx="124" cy="85" rx="6" ry="3" fill="#e9a3b2" opacity=".6"/>
        <ellipse cx="176" cy="85" rx="6" ry="3" fill="#e9a3b2" opacity=".6"/>
        <path d="M133 86 Q150 99 167 86" stroke="#8a3a4c" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M164 86.5 L168 84" stroke="#8a3a4c" stroke-width="2" stroke-linecap="round"/>
      </g>
      <g class="hair-up" fill="#131313">
        <path d="M108 64 Q108 22 150 22 Q192 22 192 64 Q172 44 150 48 Q128 44 108 64 Z"/>
        <path d="M110 54 Q94 110 98 190 Q88 200 78 194 Q84 120 104 58 Z"/>
        <path d="M190 54 Q206 110 202 190 Q212 200 222 194 Q216 120 196 58 Z"/>
        <!-- 顔にかかったままの髪の毛 -->
        <g stroke="#131313" stroke-width="2.2" fill="none" stroke-linecap="round">
          <path d="M140 48 Q132 74 128 106"/><path d="M146 47 Q143 70 141 92"/><path d="M172 50 Q178 78 176 104"/>
        </g>
      </g>
    </svg>`;


  // 指を広げてこちらに伸ばしてくる手 (指先が上)
  const HAND_SVG = `
    <svg viewBox="0 0 200 270" aria-hidden="true"><g ${SKIN}>
      <rect x="72" y="180" width="58" height="95" rx="22"/>
      <g class="fingers">
        <rect x="-10" y="-84" width="20" height="90" rx="10" transform="translate(74 138) rotate(-20)"/>
        <rect x="-10" y="-96" width="20" height="100" rx="10" transform="translate(94 130) rotate(-7)"/>
        <rect x="-10" y="-92" width="20" height="96" rx="10" transform="translate(114 130) rotate(6)"/>
        <rect x="-10" y="-76" width="20" height="80" rx="10" transform="translate(133 138) rotate(19)"/>
        <rect x="-11" y="-62" width="22" height="66" rx="11" transform="translate(56 178) rotate(-58)"/>
      </g>
      <ellipse cx="102" cy="168" rx="50" ry="48"/>
    </g></svg>`;

  // 画面の縁をつかむ手 (手の甲が上、指が縁にかかって下に垂れる)
  const GRIP_SVG = `
    <svg viewBox="0 0 160 150" aria-hidden="true"><g ${SKIN}>
      <rect x="30" y="40" width="22" height="92" rx="11" transform="rotate(8 41 40)"/>
      <rect x="54" y="44" width="22" height="104" rx="11" transform="rotate(3 65 44)"/>
      <rect x="78" y="44" width="22" height="100" rx="11" transform="rotate(-2 89 44)"/>
      <rect x="102" y="40" width="20" height="84" rx="10" transform="rotate(-8 112 40)"/>
      <ellipse cx="78" cy="40" rx="58" ry="34"/>
    </g></svg>`;

  const FLOWER_SVG = `
    <svg viewBox="0 0 60 120" aria-hidden="true">
      <path d="M30 50 Q27 85 30 118" stroke="#3a8f3a" stroke-width="4" fill="none"/>
      <path d="M30 86 Q14 74 11 88 Q22 96 30 91" fill="#4caf50"/>
      <g fill="#ff7aa8"><circle cx="30" cy="22" r="11"/><circle cx="18" cy="34" r="11"/>
        <circle cx="42" cy="34" r="11"/><circle cx="23" cy="48" r="11"/><circle cx="37" cy="48" r="11"/></g>
      <circle cx="30" cy="37" r="7" fill="#ffd54f"/>
    </svg>`;

  // 花を差し出す手 (軽く握った手で茎を持ち、こちらに向ける)
  const OFFER_SVG = `
    <svg viewBox="0 0 200 270" aria-hidden="true">
      <g class="offer-flower" transform="translate(70 32)">
        ${FLOWER_SVG.replace(/^\s*<svg[^>]*>|<\/svg>\s*$/g, '')}
      </g>
      <g ${SKIN}>
        <rect x="74" y="190" width="54" height="85" rx="22"/>
        <rect x="64" y="140" width="72" height="62" rx="26"/>
      </g>
      <g stroke="#b9b5ab" stroke-width="2" fill="none" stroke-linecap="round">
        <path d="M80 160 Q104 154 130 160"/><path d="M80 174 Q104 168 130 174"/><path d="M82 188 Q104 182 128 188"/>
      </g>
      <ellipse cx="92" cy="146" rx="11" ry="19" transform="rotate(-35 92 146)" ${SKIN}/>
    </svg>`;

  const STOP = Symbol('stop');

  function renderHorror(tab, api) {
    const { t } = api;
    const page = document.createElement('div');
    page.className = 'horror';
    page.innerHTML = `
      <div class="h-room"></div>
      <canvas class="h-noise" width="160" height="100"></canvas>
      <div class="h-ghost">${CRAWL_SVG}</div>
      <div class="h-hearts"><span>♥</span><span>♥</span><span>♥</span></div>
      <div class="h-flash"></div>
      <div class="h-end" hidden>
        <div class="h-end-flower">${FLOWER_SVG}</div>
        <p data-i18n="theEnd">${t('theEnd')}</p>
        <button class="h-replay" data-i18n="again">${t('again')}</button>
      </div>`;
    page.querySelector('.h-replay').addEventListener('click', () => api.rerender());
    tab.pane.appendChild(page);
    playHorror(page, api);
  }
  B3D.registerPage({ id: 'horror', icon: '👻', title: 'horror', info: 'infoHorror', menu: true, strings: STR, css: CSS, render: renderHorror });

  // 砂嵐。opacity で強さを変える
  function startNoise(canvas, alive) {
    const g = canvas.getContext('2d');
    const img = g.createImageData(canvas.width, canvas.height);
    (function draw() {
      if (!alive()) return;
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      requestAnimationFrame(draw);
    })();
  }

  async function playHorror(page, api) {
    const q = (s) => page.querySelector(s);
    const noise = q('.h-noise'), room = q('.h-room'), ghost = q('.h-ghost'), svg = q('.crawl-svg');
    const temps = [];  // 面の外に出した要素 (最後に片付ける)
    let skipped = false, closed = false;
    const alive = () => !skipped && !closed;
    // 一定時間待つ。途中でページが閉じられたり Esc が押されたら中断する
    let wake = null;
    const step = (ms) => new Promise((resolve, reject) => {
      const id = setTimeout(() => { wake = null; alive() ? resolve() : reject(STOP); }, ms);
      wake = () => { clearTimeout(id); wake = null; reject(STOP); };
    });
    const onKey = (e) => { if (e.key === 'Escape') { skipped = true; wake?.(); } };
    addEventListener('keydown', onKey);
    api.onCleanup(() => { closed = true; wake?.(); });  // ページを離れたら中断する
    startNoise(noise, () => !closed && !page.classList.contains('done'));
    const shake = () => api.shake();
    const add3d = (cls, html) => {
      const el = document.createElement('div');
      el.className = cls;
      el.innerHTML = html;
      temps.push(api.add3d(el));
      return el;
    };
    // 這う姿の位置と大きさ (t: 0 = 遠く, 1 = 目の前)
    const pose = (t, jitter = 0) => {
      ghost.style.bottom = `${40 - t * 48}%`;
      ghost.style.transform = `translateX(-50%) scale(${0.14 + t * 2.06}) rotate(${jitter}deg)`;
    };

    try {
      // 1. 砂嵐とちらつき
      noise.style.opacity = 1;
      await step(1200);
      noise.style.opacity = 0.12;
      room.style.opacity = 1;
      ghost.style.opacity = 1;

      // 2. 左右の手を交互に出しながら、地面を這って近づいてくる
      const N = 14;
      for (let i = 0; i < N; i++) {
        svg.classList.toggle('a', i % 2 === 0);
        svg.classList.toggle('b', i % 2 === 1);
        pose(i / (N - 1), (Math.random() - 0.5) * 5);
        if (i % 5 === 4) {  // ときどき砂嵐が強くなる
          noise.style.opacity = 0.6;
          page.classList.add('flicker');
          await step(120);
          noise.style.opacity = 0.12;
          page.classList.remove('flicker');
        }
        await step(420);
      }
      svg.classList.remove('a', 'b');
      await step(700);  // 目の前で止まる

      // 3. 左手 (画面の右) で画面の縁をつかむ
      const face = api.face();
      const fw = face.offsetWidth, fh = face.offsetHeight;
      svg.classList.add('no-l');
      const grip = add3d('grip3d', GRIP_SVG);
      api.place3d(grip, face, fw * 0.7, fh - 22, 6);
      shake();
      await step(900);

      // 4. 右手 (画面の左) がプルプル震えながら、画面の中から少しだけ出てくる。
      //    ためらうように、少し出ては止まり、また少し出る
      svg.classList.add('no-r');
      const arm = add3d('arm3d', HAND_SVG);
      const ax = fw * 0.32, ay = fh * 0.66;
      let z = 0;
      const jitter = () => `translate(${(Math.random() - 0.5) * 5}px, ${(Math.random() - 0.5) * 5}px) rotate(${(Math.random() - 0.5) * 5}deg)`;
      for (const [to, ms] of [[35, 600], [35, 450], [70, 550], [70, 500], [95, 500], [95, 600]]) {
        const from = z, n = Math.round(ms / 40);
        for (let i = 1; i <= n; i++) {
          z = from + (to - from) * i / n;
          api.place3d(arm, face, ax, ay, z, jitter());
          await step(40);
        }
      }

      // 5. ぱっ！ 手が花を差し出す形に変わって花が咲き、同時に顔をガッと上げて笑い顔を見せる
      arm.innerHTML = OFFER_SVG;
      api.place3d(arm, face, ax, ay, z, 'rotate(-6deg)');
      void arm.offsetWidth;
      arm.classList.add('pop');
      page.classList.add('pop');  // 面の中の光とハート
      svg.classList.add('reveal', 'lift');
      shake();
      await step(2800);

      // 6. 手を引っ込める。花はお土産として受け取る
      api.giveItem('flower', FLOWER_SVG, 'souvenir');
      arm.classList.add('given');
      for (let i = 1; i <= 8; i++) {
        api.place3d(arm, face, ax, ay, z * (1 - i / 8));
        await step(45);
      }
      arm.remove();
      grip.remove();
      svg.classList.remove('no-l', 'no-r', 'lift');

      // にっこりして右手を振り、後ずさりして消える
      svg.classList.add('wave');
      await step(1300);
      svg.classList.remove('wave');
      for (let i = 0; i < 8; i++) {
        svg.classList.toggle('a', i % 2 === 0);
        svg.classList.toggle('b', i % 2 === 1);
        pose(1 - (i + 1) / 9);
        await step(220);
      }
      ghost.style.opacity = 0;
      noise.style.opacity = 0.5;
      await step(400);
    } catch (e) {
      if (e !== STOP) throw e;
    } finally {
      removeEventListener('keydown', onKey);
      for (const el of temps) el.remove();
      api.shake(false);
    }
    // 終わり (Esc で飛ばしたときもここ)
    if (closed) return;
    page.classList.add('done');  // 砂嵐の描画も止める
    noise.style.opacity = 0;
    room.style.opacity = 0;
    ghost.style.opacity = 0;
    q('.h-end').hidden = false;
  }
})();
