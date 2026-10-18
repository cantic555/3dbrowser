// about:kobito — 小人が暮らしている放置鑑賞ページ。回すとあたふたする
(() => {
  const CSS = `
  .kobito { position: absolute; inset: 0; }
  .kobito canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: crosshair; }
  /* 線を全部消すボタン (線があるときだけ出す)。小人は下にいるので右上に置く */
  .kobito-clear {
    position: absolute; right: 12px; top: 12px;
    width: 36px; height: 36px; padding: 0; border-radius: 50%;
    display: grid; place-items: center;
    border: 1px solid #dde0e6; background: #f7f8fa; color: #555; cursor: pointer;
  }
  .kobito-clear[hidden] { display: none; }
  .kobito-clear:hover { background: #eef1f8; border-color: #c9d3ee; }
  .fall3d { position: absolute; pointer-events: none; }
  .fall3d canvas { display: block; width: 100%; height: 100%; }
`;

  // 画面に出る文字。[日本語, English]
  const STR = {
    kobito: ['小人', 'Tiny Folks'],
    panicWords: [['わー', 'きゃー', 'ひぇ', 'おっとっと', 'わわわ'], ['Whoa!', 'Eek!', 'Yikes!', 'Oops!', 'Wah!']],
    fallWords: [['うわー', 'あ〜れ〜', 'たすけて〜', 'ひゅ〜', 'うわぁぁぁ', 'おちる〜'],
      ['Waaah!', 'Help me~', 'Nooo~', 'Wheee~', 'Aaaaah!', "I'm falling~"]],
    bossLine: ['ハッハッハッ、小人がゴミのようだ', 'Ha ha ha! Look, the Tiny Folks are like trash!'],
    imBack: ['ただいま', "I'm back"],
    phew: ['ふぅ', 'Phew'],
    gulp: ['ギクッ', 'Gulp!'],
    snackFound: [['あっ！おかし持ってる！', 'ずるい！', 'じーっ'], ['Hey! A snack!', 'No fair!', '*stare*']],
    letsShare: ['…みんなでたべよ', "…let's share"],
    yay: ['わーい', 'Yay!'],
    munch: ['もぐもぐ', 'Munch munch'],
    flowerWow: ['わあ！', 'Wow!'],
    flowerGot: ['わーい', 'Yay!'],
    flowerEnvy: [['いいなー', 'きれい', 'おはなだ'], ['Lucky!', 'So pretty', 'A flower!']],
    flowerPlant: ['うえよう', "Let's plant it"],
    flowerWater: ['おみず〜', 'Watering~'],
    pokeWords: [['ひゃっ', 'なに？', 'くすぐったい', '！', 'やめて〜', 'えへへ'],
      ['Eep!', 'What?', 'That tickles', '!', 'Stop it~', 'Hehe']],
    liftWords: [['わっ', 'はなして〜'], ['Whoa!', 'Put me down~']],
    launchWords: [['ひゃっほー', 'とんでるー', 'わーい！', 'ぎゃー'], ['Wheee!', "I'm flying!", 'Yahoo!', 'Aaah!']],
    linesClear: ['線を全部消す (1 本だけ消すときは線をダブルクリック)', 'Clear all lines (double-click a line to remove just that one)'],
    lineTip: ['ドラッグで移動・ダブルクリックで消す', 'Drag to move, double-click to remove'],
    infoKobito: ['小人が暮らしている。回すとあたふたする。線を引くとその上を歩く', 'Tiny Folks live here. Rotate and watch them panic. Draw lines for them to walk on'],
  };

  // ブラウザの中で小人が暮らしている放置鑑賞ページ。
  // 3D ブラウザの向きからこの面の中での重力の向きを求め、傾けると小人があたふたする
  const KOBITO_SHIRTS = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4db6ac', '#f06292', '#9575cd', '#fff176', '#a1887f'];
  const KOBITO_HAIR = ['#3e2723', '#212121', '#795548', '#5d4037', '#424242', '#8d6e63'];
  const KOBITO_COUNT = 10;
  const KR0 = 12, KS = 1.8;  // 小人の元の大きさ (中心から足まで) と表示倍率
  const KR = KR0 * KS;      // 当たり判定に使う大きさ
  const GRAVITY = 900;  // px/s²
  const FALL_TIME = 4;  // 画面から落ちて消えるまでの秒数
  const LINE_W = 4;     // 引いた線の太さ
  const MAX_LINES = 15; // 線の本数の上限 (越えたら古い線から消える)
  const LINES_KEY = '3d-browser-kobito-lines';

  function renderKobito(tab, api) {
    const { t, pick } = api;
    const page = document.createElement('div');
    page.className = 'kobito';
    const canvas = document.createElement('canvas');
    page.appendChild(canvas);
    tab.pane.appendChild(page);
    // 描く先。画面から落ちていく小人を別のキャンバスに描くときだけ一時的に差し替える
    const mainCtx = canvas.getContext('2d');
    let ctx = mainCtx;
    const R = 2;
    const rnd = (a, b) => a + Math.random() * (b - a);

    let W = 0, H = 0;
    const people = [];
    const fallers = [];   // 画面から落ちていく途中の小人
    let away = 0, comeback = 0;  // 落ちていなくなった人数と、次に戻ってくるまでの時間
    let prevG = null, shake = 0;
    let boss = null;  // みんなが落ちていくのを見て高笑いする 1 人 (いれば眼鏡の小人)
    let glassesAway = false;  // 眼鏡の小人が落ちていなくなっているか
    // ---------- 隠し機能: お菓子を隠し持っている小人 ----------
    // 表からは体に隠れて見えないが、透過モードで裏から見るとばれる
    let fromBack = false;      // 透過モードで面を裏から見ているか
    let snackT = 0;            // 裏から見続けている時間 (ばれる演出の進み具合)
    let snackAgain = 0;        // 次にお菓子を隠し持つまでの時間

    function makePerson(i, x, y) {
      return {
        x, y, vx: 0, vy: 0,
        shirt: KOBITO_SHIRTS[i % KOBITO_SHIRTS.length],
        hair: KOBITO_HAIR[Math.floor(Math.random() * KOBITO_HAIR.length)],
        state: 'idle', timer: rnd(0.5, 3), dir: Math.random() < 0.5 ? -1 : 1,
        heading: rnd(0, Math.PI * 2), ang: 0, spin: 0, step: rnd(0, 6),
        bubble: '', bubbleT: 0, grounded: false, glasses: false,
      };
    }

    function spawn() {
      for (let i = 0; i < KOBITO_COUNT; i++) people.push(makePerson(i, rnd(KR * 2, W - KR * 2), H - KR));
      people[0].glasses = true;  // 1 人だけ眼鏡 (ボス)
      people[1].snack = true;    // 1 人だけお菓子を隠し持っている
    }

    // 面が下を向いたら、小人は画面から飛び出して落ちていく (箱の中に 3D で置く)
    const FW = 80, FH = 110, FCX = 40, FCY = 70;  // 落ちる小人を描く小さなキャンバスと、その中の小人の位置
    function startFall(p, face, g) {
      people.splice(people.indexOf(p), 1);
      away++;
      if (p.glasses) glassesAway = true;
      const el = document.createElement('div');
      el.className = 'fall3d';
      const c = document.createElement('canvas');
      c.width = FW * R; c.height = FH * R;
      el.appendChild(c);
      api.add3d(el);
      const off = api.offsetInFace(canvas, face);
      el.style.width = `${FW * off.s}px`;
      el.style.height = `${FH * off.s}px`;
      // 半分くらいは叫びながら落ちていく (残りは無言)
      if (Math.random() < 0.6) say(p, pick('fallWords'), FALL_TIME);
      else p.bubbleT = 0;
      p.state = 'panic';
      fallers.push({
        el, g2d: c.getContext('2d'), p, face, g, t: 0, spin: 0, spinV: rnd(-3, 3),
        // 面の中での位置 (キャンバスの中心がずれる分を補正)
        x: (off.x + p.x) * off.s, y: (off.y + p.y - (FCY - FH / 2)) * off.s, s: off.s,
        dx: rnd(-40, 40), dy: rnd(-40, 40),
      });
    }

    function updateFallers(dt) {
      for (const f of [...fallers]) {
        f.t += dt;
        if (f.t > FALL_TIME || !f.face.isConnected) {  // 面を閉じたときも消す
          f.el.remove();
          fallers.splice(fallers.indexOf(f), 1);
          continue;
        }
        // 真下 (重力の向き) へ、ゆっくりだんだん速く落ちていく。
        // 重力は面の座標で表してあるので、面の中の成分と面から出る成分に分けて動かす
        const d = 80 * f.t + 20 * f.t * f.t;
        f.spin += f.spinV * dt;
        api.place3d(f.el, f.face,
          f.x + f.dx * f.t + f.g.x * d, f.y + f.dy * f.t + f.g.y * d, f.g.z * d, `rotate(${f.spin}rad)`);
        f.el.style.opacity = f.t > FALL_TIME - 1 ? FALL_TIME - f.t : 1;  // 最後の 1 秒で消える
        // 手足をばたばたさせる
        const saved = ctx;
        ctx = f.g2d;
        ctx.setTransform(R, 0, 0, R, 0, 0);
        ctx.clearRect(0, 0, FW, FH);
        f.p.bubbleT -= dt;
        drawPerson({ ...f.p, x: FCX, y: FCY, ang: 0 }, false);
        ctx = saved;
      }
    }

    // 面が下を向いていなければ、いなくなった小人が 1 人ずつ戻ってくる
    function comeBack(dt, upright, g) {
      if (!away || (comeback -= dt) > 0) return;
      comeback = 0.8;
      away--;
      let x = rnd(KR * 2, W - KR * 2), y = rnd(KR * 2, H - KR * 2);
      if (upright) {  // 空の側 (地面の反対) から降ってくる
        if (Math.abs(g.y) >= Math.abs(g.x)) y = g.y > 0 ? KR : H - KR;
        else { x = g.x > 0 ? KR : W - KR; y = rnd(KR * 2, H - KR * 2); }
      }
      const p = makePerson(Math.floor(Math.random() * KOBITO_SHIRTS.length), x, y);
      if (glassesAway) { p.glasses = true; glassesAway = false; }
      say(p, t('imBack'), 1.5);
      people.push(p);
    }

    function say(p, text, t = 1.2) { p.bubble = text; p.bubbleT = t; }

    // 落ち着いているときの暮らし。次の行動をランダムに選ぶ
    function nextActivity(p) {
      const friend = people.find((q) => q !== p && q.state !== 'panic' &&
        Math.hypot(q.x - p.x, q.y - p.y) < KR * 4);
      const r = Math.random();
      const near = planted.find((f) => Math.abs(f.x * W - p.x) < KR * 2.5 && p.y > H - KR * 2);
      if (near && Math.random() < 0.35) {
        p.state = 'water'; p.timer = rnd(2, 3);
        p.dir = Math.sign(near.x * W - p.x) || 1;
        say(p, t('flowerWater'), 1.5);
        return;
      }
      if (friend && r < 0.3) {
        p.state = 'talk'; p.timer = rnd(2, 4);
        p.dir = Math.sign(friend.x - p.x) || 1;
        say(p, Math.random() < 0.5 ? '…' : '♪', p.timer);
      } else if (r < 0.6) {
        p.state = 'walk'; p.timer = rnd(2, 5);
        if (Math.random() < 0.4) p.dir *= -1;
        p.heading += rnd(-1, 1);
      } else if (r < 0.78) {
        p.state = 'sit'; p.timer = rnd(3, 6);
      } else if (r < 0.88) {
        p.state = 'sleep'; p.timer = rnd(5, 10);
      } else if (r < 0.95) {
        p.state = 'wave'; p.timer = 1.5;
      } else {
        p.state = 'idle'; p.timer = rnd(1, 3);
      }
    }

    function step(dt) {
      const face = api.face();
      if (!face) return;
      const g = api.faceGravity(face);
      const m = Math.hypot(g.x, g.y);       // 面の中での重力の強さ (0 = 面が水平)
      const upright = m > 0.35;             // 地面がある (面が立っている)
      const gx = g.x / (m || 1), gy = g.y / (m || 1);
      // 重力の向きの変化の速さ = 揺さぶられ具合
      if (prevG) shake = shake * 0.85 + Math.hypot(g.x - prevG.x, g.y - prevG.y) / dt * 0.15;
      prevG = g;
      const targetAng = upright ? Math.atan2(-gx, gy) : 0;  // 頭を重力と逆向きにする角度

      // 面が下を向いたら (重力が面の外向き)、ばらばらに画面から落ちていく
      if (g.z > 0.75) {
        // たくさん落ちるときは、1 人だけ踏みとどまって高笑いする
        if (!boss && people.length >= 5) {
          boss = people.find((q) => q.glasses) || people[Math.floor(Math.random() * people.length)];
          boss.state = 'idle'; boss.timer = 99;
          say(boss, t('bossLine'), 4);
        }
        for (const p of [...people]) if (p !== boss && p !== held?.p && Math.random() < dt * 4) startFall(p, face, g);
      } else if (g.z < 0.3) {
        if (boss) { boss.timer = 0; boss = null; }
        comeBack(dt, upright, g);
      }
      updateFallers(dt);
      updateSnack(dt, face);
      updateFlowers(dt, g, upright);
      checkFlick();

      for (const p of people) {
        p.bubbleT -= dt;
        p.timer -= dt;
        if (p.state === 'held') {  // つままれている間はぶら下がっているだけ
          const d = ((targetAng - p.ang) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
          p.ang += d * Math.min(1, dt * 6);
          continue;
        }
        const calm = p.state !== 'panic' && p.state !== 'dizzy';
        if (upright) {
          let ax = g.x * GRAVITY * dt, ay = g.y * GRAVITY * dt;
          // ゆるい坂 (線) の上では踏ん張って、坂に沿って滑り落ちない
          if (calm && p.grounded && p.groundN) {
            const [nx, ny] = p.groundN;
            if (-(nx * gx + ny * gy) > 0.8) {
              const an = ax * nx + ay * ny;
              ax = nx * an; ay = ny * an;
            }
          }
          p.vx += ax;
          p.vy += ay;
        }
        // 歩く
        if (calm && p.state === 'walk') {
          if (upright && p.grounded) {
            // 地面 (線の坂も) に沿って歩く。dir = +1 で体の右 (顔を向けている側) へ
            const [nx, ny] = p.groundN || [-gx, -gy];
            let tx = -ny, ty = nx;
            if ((tx * gy - ty * gx) * p.dir < 0) { tx = -tx; ty = -ty; }
            const sp = p.flowerRun ? 60 : 28;  // 花に向かうときは急いで
            const vt = p.vx * tx + p.vy * ty;
            const k = (sp - vt) * Math.min(1, dt * 6);
            p.vx += tx * k;
            p.vy += ty * k;
          } else if (!upright) {
            // 上から見た形: どの向きにも歩ける
            p.heading += rnd(-1.5, 1.5) * dt;
            p.vx = Math.cos(p.heading) * 24;
            p.vy = Math.sin(p.heading) * 24;
          }
          p.step += dt * 10;
        } else if (!upright) {
          p.vx *= 1 - Math.min(1, dt * 6);
          p.vy *= 1 - Math.min(1, dt * 6);
        }

        // 動かす。速いときに線をすり抜けないよう、何回かに分けて動かしながら線との当たり判定をする
        const contacts = [];
        const n = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) * dt / (KR * 0.5)));
        for (let i = 0; i < n; i++) {
          p.x += p.vx * dt / n;
          p.y += p.vy * dt / n;
          collideLines(p, KR, contacts, upright && { x: gx, y: gy });
        }

        // 壁 (画面の端) との当たり判定
        if (p.x < KR) { p.x = KR; if (p.vx < 0) p.vx *= -0.25; contacts.push([1, 0]); }
        if (p.x > W - KR) { p.x = W - KR; if (p.vx > 0) p.vx *= -0.25; contacts.push([-1, 0]); }
        if (p.y < KR) { p.y = KR; if (p.vy < 0) p.vy *= -0.25; contacts.push([0, 1]); }
        if (p.y > H - KR) { p.y = H - KR; if (p.vy > 0) p.vy *= -0.25; contacts.push([0, -1]); }
        if (!upright && contacts.length) {
          p.heading = Math.atan2(p.vy, p.vx) + Math.PI + rnd(-0.5, 0.5);
        }
        // 足元が地面 (重力の向きにある壁や線) か。一番「床らしい」ものを足元とする
        let ground = null, best = 0.55;
        for (const c of contacts) {
          const d = -(c[0] * gx + c[1] * gy);
          if (d > best) { best = d; ground = c; }
        }
        p.grounded = upright && !!ground;
        p.groundN = p.grounded ? ground : null;
        p.groundLine = p.grounded ? ground[2] : null;  // 立っている線 (地面や壁なら undefined)
        if (p.grounded) {
          // 地面の摩擦で踏ん張る。坂がきついと踏ん張りきれずにずるずる滑る。
          // 転がっている間も少しずつ止まる (摩擦がないと、仲間に押し返されたまま永遠に回り続ける)
          const grip = p.state === 'panic' ? 1.5 : p.state === 'walk' ? 2 : 10;
          p.vx *= 1 - Math.min(1, dt * grip);
          p.vy *= 1 - Math.min(1, dt * grip);
        }
        // 壁に当たったら引き返す
        if (p.state === 'walk' && upright && contacts.some(([nx, ny]) => Math.abs(nx * gx + ny * gy) < 0.45)) {
          p.dir *= -1;
        }

        // あたふた判定: 落ちている、滑っている、揺さぶられている
        const speed = Math.hypot(p.vx, p.vy);
        p.hopT = Math.max(0, (p.hopT || 0) - dt);
        if (p.hopT > 0) {
          // つっつかれて跳ねているだけ
        } else if (p === boss) {
          // 高笑いしている間は動じない
          p.vx = p.vy = 0;
        } else if (upright && (!p.grounded && speed > 80 || speed > 140 || shake > 3) &&
                   !(p.state === 'panic' && p.panicT > 4)) {  // 念のため、4 秒以上はあたふたし続けない
          if (p.state !== 'panic') {
            say(p, pick('panicWords'), 1.4);
            p.panicT = 0;
          }
          p.state = 'panic';
          p.panicT += dt;
          p.timer = rnd(0.8, 1.4);
          p.spin += (speed / 40 + shake) * dt * (p.dir || 1);
        } else if (p.state === 'panic' && p.timer <= 0) {
          // 落ち着いたら目を回してから起き上がる
          p.state = 'dizzy'; p.timer = rnd(1, 2);
          say(p, Math.random() < 0.5 ? '@_@' : t('phew'), p.timer);
        } else if (p.state === 'dizzy' && p.timer <= 0) {
          p.spin = 0;
          nextActivity(p);
        } else if (calm && p.timer <= 0) {
          nextActivity(p);
        }

        // 小人同士は重ならないよう押し合う (団子状に積み重なる)
        for (const q of people) {
          if (q === p) continue;
          const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 0.01;
          const min = KR * 1.3;
          if (d < min) {
            const nx = dx / d, ny = dy / d, push = (min - d) / 2;
            p.x += nx * push; p.y += ny * push;
            q.x -= nx * push; q.y -= ny * push;
            // ぶつかり合う向きの速さは打ち消す (押し返されても速さが残らないように)
            const rel = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny;
            if (rel < 0) {
              p.vx -= nx * rel / 2; p.vy -= ny * rel / 2;
              q.vx += nx * rel / 2; q.vy += ny * rel / 2;
            }
          }
        }

        // 体の向き: 転がっている間は回し、それ以外はゆっくり起き上がる
        if (p.state === 'panic') {
          p.ang += p.spin;
          p.spin *= 0.9;
        } else {
          const d = ((targetAng - p.ang) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
          p.ang += d * Math.min(1, dt * 6);
        }
      }
    }

    function updateSnack(dt, face) {
      fromBack = api.seeThrough() && api.faceFacing(face) < -0.2;
      let sneak = people.find((q) => q.snack);
      if (!sneak) {
        // しばらくしたら、また誰かがこっそりお菓子を持つ
        if ((snackAgain -= dt) <= 0 && people.length > 1) {
          const q = people.filter((r) => !r.glasses);
          (q[Math.floor(Math.random() * q.length)] || people[0]).snack = true;
        }
        return;
      }
      if (!fromBack) { snackT = 0; return; }
      const prev = snackT;
      snackT += dt;
      const at = (t) => prev < t && snackT >= t;  // ちょうど t 秒たったとき
      const near = () => people.filter((q) => q !== sneak).sort((a, b) =>
        Math.hypot(a.x - sneak.x, a.y - sneak.y) - Math.hypot(b.x - sneak.x, b.y - sneak.y)).slice(0, 3);
      if (at(0.8)) {
        // 寝ていたら飛び起きる (寝ている間は吹き出しが zzz になってしまうため)
        if (sneak.state !== 'panic' && sneak.state !== 'held') { sneak.state = 'idle'; sneak.timer = 6; }
        say(sneak, t('gulp'), 1.4);
      }
      if (at(1.8)) near().forEach((q, i) => say(q, t('snackFound')[i], 2));
      if (at(4)) say(sneak, t('letsShare'), 1.8);
      if (at(6)) {
        sneak.snack = false;
        near().forEach((q) => say(q, t('yay'), 1.5));
        say(sneak, t('munch'), 1.5);
        snackAgain = 20;
      }
    }

    // お菓子 (クッキー)。手で背中に回して持っている
    function drawSnack(by) {
      ctx.fillStyle = '#c98a4b';
      ctx.beginPath(); ctx.arc(0, 6 + by, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a3a1e';
      for (const [x, y] of [[-1.2, 5], [1.3, 6.4], [-0.4, 7.6]]) {
        ctx.beginPath(); ctx.arc(x, y + by, 0.55, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawPerson(p, upright) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.ang);
      ctx.scale(KS, KS);  // 以下は元の大きさ (KR0) の座標で描く
      const sit = p.state === 'sit';
      const sleep = p.state === 'sleep';
      if (sleep) ctx.rotate(Math.PI / 2 * (p.dir || 1));
      // 影
      if (upright && p.grounded && !sleep) {
        ctx.fillStyle = 'rgba(0,0,0,.15)';
        ctx.beginPath(); ctx.ellipse(0, KR0, 8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      }
      const bob = p.state === 'walk' ? Math.abs(Math.sin(p.step)) * -1.5 : 0;
      const by = (sit ? 3 : 0) + bob;
      // 足
      ctx.fillStyle = '#5d4037';
      const swing = p.state === 'walk' ? Math.sin(p.step) * 3 : 0;
      if (sit) {
        ctx.beginPath(); ctx.ellipse(-4 * p.dir + 7 * p.dir, KR0 - 2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.ellipse(-3 + swing, KR0 - 1.5, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(3 - swing, KR0 - 1.5, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill();
      }
      // 体 (お菓子は表からは体の後ろに隠れる。裏から見ると体より手前に見える)
      const snack = p.snack && ctx === mainCtx;
      if (snack && !fromBack) drawSnack(by);
      ctx.fillStyle = p.shirt;
      ctx.beginPath(); ctx.ellipse(0, 4 + by, 6.5, 6.5, 0, 0, Math.PI * 2); ctx.fill();
      if (snack && fromBack) drawSnack(by);
      // 腕 (あたふた中はばんざい、手を振る)
      ctx.strokeStyle = '#f5d0b0'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      const t = performance.now() / 1000;
      if (p.state === 'panic' || p.state === 'held') {
        const f = Math.sin(t * 20) * 2;
        ctx.beginPath(); ctx.moveTo(-5, 1 + by); ctx.lineTo(-10, -6 + f + by); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5, 1 + by); ctx.lineTo(10, -6 - f + by); ctx.stroke();
      } else if (p.state === 'wave') {
        const f = Math.sin(t * 10) * 3;
        ctx.beginPath(); ctx.moveTo(5, 1 + by); ctx.lineTo(10 + f, -6 + by); ctx.stroke();
      }
      // 頭
      ctx.fillStyle = '#f9dcc4';
      ctx.beginPath(); ctx.arc(0, -5 + by, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.hair;
      ctx.beginPath(); ctx.arc(0, -6.5 + by, 7.2, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
      // 顔
      ctx.fillStyle = '#333'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
      const ex = (p.state === 'walk' || p.state === 'talk') ? p.dir * 1.5 : 0;
      if (sleep || p.state === 'sit' && Math.sin(t + p.step) > 0.8) {
        ctx.beginPath(); ctx.moveTo(-3.5 + ex, -4 + by); ctx.lineTo(-1.5 + ex, -4 + by);
        ctx.moveTo(1.5 + ex, -4 + by); ctx.lineTo(3.5 + ex, -4 + by); ctx.stroke();
      } else if (p.state === 'dizzy') {
        ctx.font = '5px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('@', -2.5, -4 + by); ctx.fillText('@', 2.5, -4 + by);
      } else {
        ctx.beginPath(); ctx.arc(-2.5 + ex, -4 + by, 1, 0, Math.PI * 2); ctx.arc(2.5 + ex, -4 + by, 1, 0, Math.PI * 2); ctx.fill();
        if (p.state === 'panic') {  // 口を開けて汗
          ctx.beginPath(); ctx.ellipse(ex, -0.5 + by, 1.3, 1.6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#7ec8f0';
          ctx.beginPath(); ctx.ellipse(7, -9 + by, 1.5, 2.2, 0.4, 0, Math.PI * 2); ctx.fill();
        }
      }
      // 眼鏡
      if (p.glasses) {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(-2.6 + ex, -4 + by, 2.1, 0, Math.PI * 2);
        ctx.moveTo(4.7 + ex, -4 + by); ctx.arc(2.6 + ex, -4 + by, 2.1, 0, Math.PI * 2);
        ctx.moveTo(-0.5 + ex, -4 + by); ctx.lineTo(0.5 + ex, -4 + by);
        ctx.stroke();
      }
      // もらった花を頭の上に掲げる
      if (p.carry && ctx === mainCtx) drawFlower(6, -11 + by, 0.9, 0.25);
      // 水やり (じょうろの代わりに水滴)
      if (p.state === 'water') {
        ctx.fillStyle = '#7ec8f0';
        const tt = performance.now() / 300;
        for (let i = 0; i < 3; i++) {
          const k = (tt + i / 3) % 1;
          ctx.beginPath(); ctx.ellipse(9 + k * 3, -2 + k * 12, 0.9, 1.4, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      // 吹き出し (zzz は寝ている間ずっと)
      const text = sleep ? 'zzz' : p.bubbleT > 0 ? p.bubble : '';
      if (text) {
        if (sleep) ctx.rotate(-Math.PI / 2 * (p.dir || 1));
        ctx.font = '7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(text).width + 6;
        // 画面の端で吹き出しが切れないよう、横にずらす (小人がおおむね立っているときだけ)
        let sx = 0;
        const c = Math.cos(p.ang), canvasW = ctx === mainCtx ? W : 0;  // 落ちていく小人は対象外
        if (!sleep && Math.abs(c) > 0.5 && canvasW) {
          const half = w / 2 * KS, room = 4;
          const left = p.x - half * Math.abs(c), right = p.x + half * Math.abs(c);
          if (left < room) sx = (room - left) / KS / c;
          else if (right > canvasW - room) sx = (canvasW - room - right) / KS / c;
        }
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.strokeStyle = '#d5d8dd'; ctx.lineWidth = 0.6;  // 白い背景でも吹き出しの形が見えるように
        ctx.beginPath(); ctx.roundRect(sx - w / 2, -24, w, 10, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#333';
        // 裏から透かして見ていると文字が左右反転するので、反転して描いて読めるようにする
        if (fromBack && ctx === mainCtx) { ctx.save(); ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.fillText(text, 0, -19); ctx.restore(); }
        else ctx.fillText(text, sx, -19);
      }
      ctx.restore();
    }

    function draw() {
      const face = api.face();
      const g = face ? api.faceGravity(face) : { x: 0, y: 1 };
      const m = Math.hypot(g.x, g.y), upright = m > 0.35;
      // 背景は真っ白なだけ。透過モードではガラスのように透明にする (小人や線だけが見える)
      ctx.setTransform(R, 0, 0, R, 0, 0);
      if (api.seeThrough()) {
        ctx.clearRect(0, 0, W, H);
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);
      }
      for (const f of planted) drawFlower(f.x * W, H, KS * 1.9);  // 小人より少し背が高く、頭の上から花がのぞく
      drawLines();
      if (looseFlower) drawFlower(looseFlower.x, looseFlower.y + 8, KS * 1.1);
      for (const p of people) drawPerson(p, upright);
    }

    // ---------- つっつく・つまんで運ぶ ----------
    // クリックでつっつく。ドラッグでつまみ上げて運び、離すと落ちる
    let held = null;  // { p, x, y, moved, vx, vy, t }
    // offsetX/Y は 3D 変形や縮小を戻したキャンバス内の座標なので、傾けたままでもつまめる
    const hit = (x, y) => {
      let best = null, bd = KR * 1.4;
      for (const p of people) {
        const d = Math.hypot(p.x - x, p.y - KR * 0.3 - y);
        if (d < bd) { best = p; bd = d; }
      }
      return best;
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const p = hit(e.offsetX, e.offsetY);
      canvas.setPointerCapture(e.pointerId);
      if (!p) {
        const l = lineAt(e.offsetX, e.offsetY);
        if (l) {  // 線の上: ダブルクリック (スマホはダブルタップ) なら消す、ドラッグなら動かす
          const now = performance.now();
          if (lastTap && lastTap.line === l && now - lastTap.t < 350) {
            lastTap = null;
            removeLine(l);
            return;
          }
          lastTap = { line: l, t: now };
          lineDrag = { line: l, x: e.offsetX, y: e.offsetY, t: now, moved: false, vx: 0, vy: 0 };
          canvas.style.cursor = 'grabbing';
          return;
        }
        stroke = [[e.offsetX, e.offsetY]];  // 何もない所: 線を引き始める
        return;
      }
      held = { p, x: e.offsetX, y: e.offsetY, sx: e.offsetX, sy: e.offsetY, moved: false, vx: 0, vy: 0, t: performance.now() };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (stroke) {
        const [lx, ly] = stroke[stroke.length - 1];
        if (Math.hypot(e.offsetX - lx, e.offsetY - ly) >= 3) stroke.push([e.offsetX, e.offsetY]);
        return;
      }
      if (lineDrag) {
        moveLine(e.offsetX, e.offsetY);
        return;
      }
      if (!held) {
        // 小人の上はつまむ、線の上はつかんで動かせる、何もない所は線を引ける
        const p = hit(e.offsetX, e.offsetY);
        hoverLine = p ? null : lineAt(e.offsetX, e.offsetY);
        canvas.style.cursor = p || hoverLine ? 'grab' : '';
        canvas.title = hoverLine ? t('lineTip') : '';
        return;
      }
      const { p } = held;
      if (!held.moved && Math.hypot(e.offsetX - held.sx, e.offsetY - held.sy) < 5) return;
      if (!held.moved) {
        held.moved = true;
        if (p === boss) boss = null;
        p.state = 'held';
        p.grounded = false;
        say(p, pick('liftWords'), 1.5);
        canvas.style.cursor = 'grabbing';
      }
      // 指先で頭をつまんでいる位置に小人を置く
      const now = performance.now(), dt = Math.max(1, now - held.t) / 1000;
      held.vx = held.vx * 0.5 + (e.offsetX - held.x) / dt * 0.5;
      held.vy = held.vy * 0.5 + (e.offsetY - held.y) / dt * 0.5;
      held.x = e.offsetX; held.y = e.offsetY; held.t = now;
      p.x = Math.min(W - KR, Math.max(KR, e.offsetX));
      p.y = Math.min(H - KR, Math.max(KR, e.offsetY + KR * 0.9));
    });
    const release = (e) => {
      if (stroke) {
        const pts = stroke;
        stroke = null;
        if (e.type === 'pointerup') finishStroke(pts);
        return;
      }
      if (lineDrag) {
        if (performance.now() - lineDrag.t < FLICK_STOP) launchRiders(lineDrag);  // 振りながら離した
        if (lineDrag.moved) linesChanged();  // 動かした位置を保存する
        lineDrag = null;
        canvas.style.cursor = 'grab';
        return;
      }
      if (!held) return;
      const { p, moved } = held;
      if (!moved) {
        // つっつく: ぴょんと跳ねる
        say(p, pick('pokeWords'), 1.4);
        const g = prevG || { x: 0, y: 1 }, m = Math.hypot(g.x, g.y) || 1;
        p.vx -= g.x / m * 220; p.vy -= g.y / m * 220;
        p.state = 'wave'; p.timer = 1.2;
        p.hopT = 0.8;  // 跳ねている間はあたふたしない
      } else {
        // 離すと落ちる (投げた勢いも少し残す)。止めてから離したときは勢いを残さない
        // (動かしていない間は pointermove が来ないので、最後に動かしたときからの時間で弱める)
        const keep = 0.6 * Math.max(0, 1 - (performance.now() - held.t) / 100);
        p.vx = Math.max(-600, Math.min(600, held.vx * keep));
        p.vy = Math.max(-600, Math.min(600, held.vy * keep));
        p.state = 'panic'; p.timer = 0.6; p.panicT = 0;
      }
      held = null;
      canvas.style.cursor = '';
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', () => { hoverLine = null; });

    // ---------- 引いた線 ----------
    // 何もない所をドラッグすると線を引ける。線は床にも壁にもなり、小人はその上を歩く。
    // 線をタップするとその線だけ消える。引いた線は保存して、次に開いたときも残っている
    let lines = [];           // 線 (点の配列。座標は幅・高さに対する割合)
    try { lines = JSON.parse(localStorage.getItem(LINES_KEY) || '[]'); } catch {}
    let segs = [];            // 当たり判定用の線分 (表示の座標) { ax, ay, dx, dy, len2, line }
    let segsFor = '';         // segs を作ったときの大きさ
    let stroke = null;        // 引いている途中の線 (表示の座標)
    let lineDrag = null;      // つかんで動かしている線 { line, x, y, t, moved }
    let hoverLine = null;     // カーソルを合わせている線 (少し青くする)
    let lastTap = null;       // 直前に線を押したとき (ダブルクリックの判定用) { line, t }
    const fading = [];        // 消えていく線 { pts, t }
    const saveLines = () => {
      const out = lines.map((l) => l.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]));
      try { localStorage.setItem(LINES_KEY, JSON.stringify(out)); } catch {}
    };

    const clearBtn = document.createElement('button');
    clearBtn.className = 'kobito-clear';
    clearBtn.dataset.i18nTitle = 'linesClear';
    clearBtn.title = t('linesClear');
    // ゴミ箱アイコン
    clearBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>`;
    clearBtn.addEventListener('click', () => {
      for (const l of [...lines]) removeLine(l);
    });
    page.appendChild(clearBtn);

    function linesChanged() {
      segsFor = '';
      clearBtn.hidden = !lines.length;
      saveLines();
    }
    clearBtn.hidden = !lines.length;

    // 表示の大きさに合わせて、線を当たり判定用の線分にする
    function buildSegs() {
      if (segsFor === `${W}x${H}`) return;
      segsFor = `${W}x${H}`;
      segs = [];
      for (const l of lines) {
        for (let i = 1; i < l.length; i++) {
          const ax = l[i - 1][0] * W, ay = l[i - 1][1] * H;
          const dx = l[i][0] * W - ax, dy = l[i][1] * H - ay;
          const len2 = dx * dx + dy * dy;
          if (len2 > 0.01) segs.push({ ax, ay, dx, dy, len2, line: l });
        }
      }
    }

    // 線分の上で (x, y) に一番近い点 (k は線分の中の位置。0 と 1 は端)
    function nearest(sg, x, y) {
      const k = Math.max(0, Math.min(1, ((x - sg.ax) * sg.dx + (y - sg.ay) * sg.dy) / sg.len2));
      return [sg.ax + sg.dx * k, sg.ay + sg.dy * k, k];
    }

    // 半径 r の丸 o ({ x, y, vx, vy }) が線にめり込んでいたら押し出し、線に向かう速さを消す (少し跳ね返る)。
    // 触れた線の向き (線から o へ向かう向き) を contacts に入れる。
    // 重力の向き g を渡すと、足元にある線の端は段差として床扱いにする (地面から引いた坂に上れるように)
    function collideLines(o, r, contacts, g) {
      buildSegs();
      const rr = r + LINE_W / 2;
      for (const sg of segs) {
        const [cx, cy, k] = nearest(sg, o.x, o.y);
        let nx = o.x - cx, ny = o.y - cy;
        const d = Math.hypot(nx, ny);
        if (d >= rr) continue;
        if (d < 1e-6) {  // ちょうど線の上: 線に垂直な向きに出す
          const l = Math.sqrt(sg.len2);
          nx = -sg.dy / l; ny = sg.dx / l;
        } else {
          nx /= d; ny /= d;
        }
        // 足元にある線の端は段差: 横に押し返さず、重力と逆向きに持ち上げて上に乗せる
        if (g && (k === 0 || k === 1) && -(nx * g.x + ny * g.y) > 0.3) {
          const a = (cx - o.x) * g.x + (cy - o.y) * g.y;  // 端が中心からどれだけ下にあるか
          const h = -a + Math.sqrt(Math.max(0, a * a + rr * rr - d * d));
          o.x -= g.x * h;
          o.y -= g.y * h;
          const vg = o.vx * g.x + o.vy * g.y;
          if (vg > 0) { o.vx -= g.x * vg; o.vy -= g.y * vg; }
          contacts?.push([-g.x, -g.y, sg.line]);
          continue;
        }
        o.x += nx * (rr - d);
        o.y += ny * (rr - d);
        const vn = o.vx * nx + o.vy * ny;
        if (vn < 0) { o.vx -= nx * vn * 1.25; o.vy -= ny * vn * 1.25; }
        contacts?.push([nx, ny, sg.line]);
      }
    }

    // (x, y) の近くにある線 (つかむ・消す用)。すぐ横から新しい線を引けるよう、範囲は狭め
    function lineAt(x, y) {
      buildSegs();
      let found = null, bd = 8;
      for (const sg of segs) {
        const [cx, cy] = nearest(sg, x, y);
        const d = Math.hypot(x - cx, y - cy);
        if (d < bd) { bd = d; found = sg.line; }
      }
      return found;
    }

    // つかんだ線を (x, y) まで動かす。形はそのままで、枠からははみ出さない。
    // 線の上に立っている小人は一緒に運ぶ (速く動かしすぎると振り落とされる)
    function moveLine(x, y) {
      const d = lineDrag, l = d.line;
      let dx = x - d.x, dy = y - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 3) return;
      d.moved = true;
      lastTap = null;  // 動かしたらダブルクリックとはみなさない
      const xs = l.map((pt) => pt[0] * W), ys = l.map((pt) => pt[1] * H);
      dx = Math.max(-Math.min(...xs), Math.min(W - Math.max(...xs), dx));
      dy = Math.max(-Math.min(...ys), Math.min(H - Math.max(...ys), dy));
      for (const pt of l) { pt[0] += dx / W; pt[1] += dy / H; }
      segsFor = '';  // 当たり判定を作り直す
      // 線の速さ (px/秒)。なめらかにして覚えておき、振ったときに乗っている小人へ渡す
      const now = performance.now(), dtm = Math.max(8, now - d.t) / 1000;
      d.vx = d.vx * 0.5 + dx / dtm * 0.5;
      d.vy = d.vy * 0.5 + dy / dtm * 0.5;
      if (Math.hypot(dx, dy) / dtm > 900) {
        launchRiders(d);  // 速すぎてしがみついていられない: 勢いのまま飛んでいく
      } else {
        for (const p of riders(l)) {
          p.x = Math.min(W - KR, Math.max(KR, p.x + dx));
          p.y = Math.min(H - KR, Math.max(KR, p.y + dy));
        }
      }
      d.x += dx; d.y += dy; d.t = now;
    }

    // ---------- 線を振って、乗っている小人を飛ばす ----------
    // 線をすばやく振って止める・離す・速く振りすぎると、乗っている小人が線の勢いのまま飛んでいく。
    // 下向きの勢いは渡さない (小人は自分の重さで落ちる)
    const FLICK_STOP = 60;    // この時間 (ミリ秒) 線が動かなければ「止めた」とみなす
    const FLICK_MIN = 250;    // これより遅く動かしていたときは飛ばさない (px/秒)
    const FLICK_MAX = 1000;   // 飛ぶ速さの上限 (px/秒)
    const riders = (l) => people.filter((p) => p.groundLine === l && p.state !== 'held');

    function launchRiders(d) {
      let vx = d.vx, vy = d.vy;
      d.vx = d.vy = 0;
      const g = prevG || { x: 0, y: 1 }, m = Math.hypot(g.x, g.y) || 1;
      const gx = g.x / m, gy = g.y / m;
      const down = vx * gx + vy * gy;
      if (down > 0) { vx -= gx * down; vy -= gy * down; }
      const v = Math.hypot(vx, vy);
      if (v < FLICK_MIN) return;
      const k = Math.min(1, FLICK_MAX / v);
      for (const p of riders(d.line)) {
        p.vx = vx * k;
        p.vy = vy * k;
        p.groundLine = null;
        p.grounded = false;
        p.state = 'panic'; p.timer = 0.8; p.panicT = 0;
        p.spin += (Math.random() - 0.5) * 0.6;
        if (p === boss) boss = null;
        say(p, pick('launchWords'), 1.4);
      }
    }

    // 振っていた線を急に止めたか (止めると pointermove が来ないので、毎フレーム時間を見る)
    function checkFlick() {
      const d = lineDrag;
      if (d && d.moved && performance.now() - d.t > FLICK_STOP && (d.vx || d.vy)) launchRiders(d);
    }

    function removeLine(l) {
      lines.splice(lines.indexOf(l), 1);
      if (hoverLine === l) hoverLine = null;
      fading.push({ pts: l, t: 0 });
      linesChanged();
    }

    // 線を引き終えたとき。短すぎるのはタップとみなして何もしない
    function finishStroke(pts) {
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (len < 8) return;
      const simple = simplify(pts, 1.5);
      lines.push(simple.map(([x, y]) => [+(x / W).toFixed(4), +(y / H).toFixed(4)]));
      while (lines.length > MAX_LINES) removeLine(lines[0]);
      linesChanged();
    }

    // 折れ線の点を減らす (Ramer–Douglas–Peucker)。eps より小さいずれは無視する
    function simplify(pts, eps) {
      if (pts.length < 3) return pts;
      const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      let far = 0, idx = 0;
      for (let i = 1; i < pts.length - 1; i++) {
        const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
        if (d > far) { far = d; idx = i; }
      }
      if (far <= eps) return [pts[0], pts[pts.length - 1]];
      return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
    }

    function strokePath(pts, toPx) {
      ctx.beginPath();
      pts.forEach((pt, i) => {
        const [x, y] = toPx ? [pt[0] * W, pt[1] * H] : pt;
        ctx[i ? 'lineTo' : 'moveTo'](x, y);
      });
      ctx.stroke();
    }

    function drawLines() {
      ctx.save();
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.lineWidth = LINE_W;
      for (const l of lines) {
        ctx.strokeStyle = l === lineDrag?.line || l === hoverLine ? '#4a6fd8' : '#5b6170';
        strokePath(l, true);
      }
      ctx.strokeStyle = '#5b6170';
      // 消えていく線
      for (const fl of [...fading]) {
        fl.t += 1 / 60;
        if (fl.t >= 0.3) { fading.splice(fading.indexOf(fl), 1); continue; }
        ctx.globalAlpha = 1 - fl.t / 0.3;
        strokePath(fl.pts, true);
      }
      // 引いている途中の線
      if (stroke) {
        ctx.globalAlpha = 0.6;
        strokePath(stroke, false);
      }
      ctx.restore();
    }

    // ---------- もらった花 ----------
    // 落とした花は地面に落ち、小人が集まって 1 人が拾い、しばらく掲げてから植える。
    // 植えた花は保存して、次に開いたときも咲いている
    const PLANT_KEY = '3d-browser-kobito-flowers';
    let looseFlower = null;   // 落ちてくる途中・地面に落ちている花 { x, y, vx, vy }
    let planted = [];         // 植えた花 { x } (x は幅に対する割合。地面は画面の下)
    try { planted = JSON.parse(localStorage.getItem(PLANT_KEY) || '[]'); } catch {}
    const savePlanted = () => { try { localStorage.setItem(PLANT_KEY, JSON.stringify(planted)); } catch {} };

    // 地面に沿って、p から見て (x, y) がどちら側か (+1 = 体の右)
    const sideOf = (p, x, y) => { const g = prevG || { x: 0, y: 1 }; return Math.sign((x - p.x) * g.y - (y - p.y) * g.x) || 1; };

    api.acceptItem('flower', canvas, (x, y) => {
      looseFlower = { x: Math.min(W - 10, Math.max(10, x)), y, vx: 0, vy: 0 };
      for (const p of people) {
        if (p.state === 'held' || p === boss) continue;
        say(p, t('flowerWow'), 1.2);
        p.state = 'walk'; p.timer = 4; p.flowerRun = true;
        p.dir = sideOf(p, looseFlower.x, looseFlower.y);
      }
    });

    function updateFlowers(dt, g, upright) {
      // 落ちている花: 重力で地面 (面の中の重力の向きの端) まで落ちる
      if (looseFlower) {
        const f = looseFlower;
        if (upright) { f.vx += g.x * GRAVITY * dt; f.vy += g.y * GRAVITY * dt; }
        f.x += f.vx * dt; f.y += f.vy * dt;
        collideLines(f, 8);
        if (f.x < 8) { f.x = 8; f.vx = 0; }
        if (f.x > W - 8) { f.x = W - 8; f.vx = 0; }
        if (f.y < 8) { f.y = 8; f.vy = 0; }
        if (f.y > H - 8) { f.y = H - 8; f.vy = 0; }
        // 一番近くまで来た子が拾う
        const taker = people.find((p) => p.state !== 'held' && p.state !== 'panic' &&
          Math.hypot(p.x - f.x, p.y - f.y) < KR * 1.3);
        if (taker) {
          looseFlower = null;
          taker.carry = rnd(3, 5);
          taker.state = 'wave'; taker.timer = 1.5;
          say(taker, t('flowerGot'), 1.5);
          for (const q of people) {
            if (q === taker) continue;
            q.flowerRun = false;
            if (Math.hypot(q.x - taker.x, q.y - taker.y) < KR * 6 && Math.random() < 0.6) say(q, pick('flowerEnvy'), 1.6);
          }
        } else {
          // 集まってくる子は花の方を向いて歩き続ける
          for (const p of people) {
            if (p.flowerRun && p.state === 'walk') { p.dir = sideOf(p, f.x, f.y); p.timer = Math.max(p.timer, 1); }
          }
        }
      }
      // 掲げている花は、しばらくしたら足元に植える (地面が画面の下のときだけ)
      for (const p of people) {
        if (!p.carry) continue;
        p.carry -= dt;
        if (p.carry <= 0) {
          p.carry = 0;
          if (upright && Math.abs(g.y) > Math.abs(g.x) && g.y > 0 && p.y > H - KR - 2) {
            planted.push({ x: p.x / W });
            savePlanted();
            say(p, t('flowerPlant'), 1.4);
          } else {
            looseFlower = { x: p.x, y: p.y, vx: 0, vy: 0 };  // 植えられないときは置く
          }
        }
      }
    }

    // 小さな花の絵 (根元 x, y、大きさ s)
    function drawFlower(x, y, s, ang = 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.scale(s, s);
      ctx.strokeStyle = '#3a8f3a'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-1, -6, 0, -12); ctx.stroke();
      ctx.fillStyle = '#4caf50';
      ctx.beginPath(); ctx.ellipse(-2.5, -5, 2.5, 1.2, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff7aa8';
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath(); ctx.arc(Math.cos(a) * 3, -14 + Math.sin(a) * 3, 2.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath(); ctx.arc(0, -14, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    let spawned = false;
    api.onFrame((dt) => {
      if (tab.pane.hidden || !canvas.clientWidth) return;  // 裏のタブでは止めておく
      // 表示サイズに合わせる
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w !== W || h !== H) {
        W = w; H = h;
        canvas.width = W * R; canvas.height = H * R;
        if (!spawned) { spawn(); spawned = true; }
      }
      step(dt);
      draw();
    });
  }
  B3D.registerPage({ id: 'kobito', title: 'kobito', info: 'infoKobito', menu: true, featured: true, glass: true, strings: STR, css: CSS, render: renderKobito });
})();
