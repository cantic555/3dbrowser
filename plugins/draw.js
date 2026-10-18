// about:draw — ドラッグで線を引くだけのお絵描き。線を蝶のように飛ばせる
(() => {
  const CSS = `
  .draw { display: block; width: 100%; height: 100%; background: #fff; touch-action: none; cursor: crosshair; }
  .draw-clear, .draw-fly {
    position: absolute; right: 12px; bottom: 12px;
    width: 36px; height: 36px; padding: 0; border-radius: 50%;
    display: grid; place-items: center;
    border: 1px solid #dde0e6; background: #f7f8fa; color: #555; cursor: pointer;
  }
  .draw-fly { right: 56px; }
  .draw-clear:hover, .draw-fly:hover { background: #eef1f8; border-color: #c9d3ee; }
  /* 透過モードではガラスに描いたように、背景を透明にする */
  body.see-through .glass .draw { background: transparent; }
  /* 面から飛び立つ線 (箱の中に 3D で置く) */
  .fly3d { position: absolute; pointer-events: none; }
  /* 暗い背景に出ても見えるよう、白くふちどる */
  .fly3d canvas {
    display: block; width: 100%; height: 100%;
    filter: drop-shadow(0 0 2px #fff) drop-shadow(0 0 6px rgba(255,255,255,.7));
  }
`;

  // 画面に出る文字。[日本語, English]
  const STR = {
    draw: ['お絵描き', 'Draw'],
    clear: ['クリア', 'Clear'],
    flyAway: ['線を飛ばす', 'Let the lines fly away'],
    infoDraw: ['お絵描き', 'Drawing'],
  };

  // ドラッグで線を引くだけのお絵描き。右上のボタンで全部消す
  function renderDraw(tab, api) {
    const { t } = api;
    const canvas = document.createElement('canvas');
    canvas.className = 'draw';
    tab.pane.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const clear = document.createElement('button');
    clear.className = 'draw-clear';
    clear.dataset.i18nTitle = 'clear';
    clear.title = t('clear');
    // ゴミ箱アイコン
    clear.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>`;
    clear.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      strokes.length = 0;
    });
    tab.pane.appendChild(clear);

    const fly = document.createElement('button');
    fly.className = 'draw-fly';
    fly.dataset.i18nTitle = 'flyAway';
    fly.title = t('flyAway');
    // 蝶アイコン
    fly.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 8v11M12 8l-2-4M12 8l2-4"/>
      <path d="M12 10C9 5 3 4 3 8.5c0 3 3.5 4.5 9 3.5M12 10c3-5 9-6 9-1.5 0 3-3.5 4.5-9 3.5"/>
      <path d="M12 13c-3.5.5-6.5 2.5-5.5 5 1 2 3.5.5 5.5-3M12 13c3.5.5 6.5 2.5 5.5 5-1 2-3.5.5-5.5-3"/></svg>`;
    fly.addEventListener('click', () => flyAway());
    tab.pane.appendChild(fly);

    const R = 2;  // 拡大しても線が粗くならないよう、表示の 2 倍の解像度で描く
    const LW = 4;  // 線の太さ
    const strokes = [];  // 描いた線 (点の配列) を 1 本ずつ覚えておく

    // 描いた線を 1 本ずつ蝶のように面から 3D 空間へ飛び立たせ、キャンバスからは消す
    function flyAway() {
      const face = api.face();
      if (!strokes.length || !face) return;
      const { x: ox, y: oy, s } = api.offsetInFace(canvas, face);

      strokes.forEach((pts, i) => {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const minX = Math.min(...xs) - LW, minY = Math.min(...ys) - LW;
        const w = Math.max(...xs) + LW - minX, h = Math.max(...ys) + LW - minY;
        // その線だけを描いた小さなキャンバスを作る
        const c = document.createElement('canvas');
        c.width = w * R; c.height = h * R;
        const g = c.getContext('2d');
        g.strokeStyle = '#222';
        g.lineWidth = LW * R;
        g.lineCap = g.lineJoin = 'round';
        g.beginPath();
        pts.forEach(([x, y], k) => g[k ? 'lineTo' : 'moveTo']((x - minX) * R, (y - minY) * R));
        if (pts.length === 1) g.lineTo((pts[0][0] - minX) * R + 0.1, (pts[0][1] - minY) * R);
        g.stroke();

        const el = document.createElement('div');
        el.className = 'fly3d';
        el.style.width = `${w * s}px`;
        el.style.height = `${h * s}px`;
        el.appendChild(c);
        api.add3d(el, false);  // ページを離れても飛んでいく
        flutter(el, c, face, (ox + minX + w / 2) * s, (oy + minY + h / 2) * s, Math.min(i, 20) * 140);
      });
      strokes.length = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // ふらふらと上へ、手前へ羽ばたいていき、最後に消える
    function flutter(el, wing, face, x, y, delay) {
      const t0 = performance.now() + delay;
      const dur = 3200 + Math.random() * 1400;
      const phase = Math.random() * Math.PI * 2;
      const side = Math.random() < 0.5 ? -1 : 1;
      const hz = 3 + Math.random() * 2;  // 羽ばたきの速さ
      (function frame(now) {
        const p = Math.max(0, (now - t0) / dur);
        if (p >= 1 || !face.isConnected) return el.remove();
        const e = 1 - (1 - p) ** 2;  // だんだん遠くへ
        const dx = side * 160 * p + Math.sin(p * 9 + phase) * 60;
        const dy = -380 * e + Math.sin(p * 13 + phase) * 25;
        const rot = Math.sin(p * 7 + phase) * 18;
        api.place3d(el, face, x, y, 700 * e, `translate(${dx}px, ${dy}px) rotate(${rot}deg)`);
        const t = Math.max(0, now - t0) / 1000;
        wing.style.transform = p > 0 ? `scaleX(${0.3 + 0.7 * Math.abs(Math.cos(t * Math.PI * hz))})` : '';
        el.style.opacity = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
        requestAnimationFrame(frame);
      })(performance.now());
    }

    // 表示サイズに合わせてキャンバスを作り直す (描いた内容は左上基準で残す)
    function fit() {
      const w = canvas.clientWidth * R, h = canvas.clientHeight * R;
      if (!w || !h || (canvas.width === w && canvas.height === h)) return;
      const old = document.createElement('canvas');
      old.width = canvas.width; old.height = canvas.height;
      old.getContext('2d').drawImage(canvas, 0, 0);
      canvas.width = w; canvas.height = h;
      ctx.drawImage(old, 0, 0);
    }
    new ResizeObserver(fit).observe(canvas);

    // offsetX/Y は 3D 変形や縮小を戻した要素内の座標なので、傾けたままでも正しく描ける
    let last = null;
    function line(x, y) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 4 * R;
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(last[0] * R, last[1] * R);
      ctx.lineTo(x * R, y * R);
      ctx.stroke();
      last = [x, y];
      strokes[strokes.length - 1].push(last);
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      fit();
      canvas.setPointerCapture(e.pointerId);
      last = [e.offsetX, e.offsetY];
      strokes.push([last]);
      line(e.offsetX, e.offsetY);  // クリックだけでも点が打てる
    });
    canvas.addEventListener('pointermove', (e) => { if (last) line(e.offsetX, e.offsetY); });
    const end = () => { last = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }
  B3D.registerPage({ id: 'draw', title: 'draw', info: 'infoDraw', menu: true, glass: true, strings: STR, css: CSS, render: renderDraw });
})();
