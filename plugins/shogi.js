// about:shogi — ふつうの将棋 (合成なし。本将棋のルール: 二歩・打ち歩詰め・王手放置の禁止、詰みで終わり、千日手は引き分け)。
// 9 列 × 27 段 (最初の盤。9 × 9 の通常、9 × 81 の長盤も選べて、両陣営の間に平原が広がる)。人と CPU は、どちらの陣営もいつでも切り替えられる。
// 盤の描画、オート (再生と速さ)、動いた跡、取った駒が飛ぶ演出、音、戻す / 進む、開発モード。再生のボタンは動画プレイヤー風に 1 行 (▶ ⏪ ⏩ ×1)。最初はどちらの陣営も CPU。
// ガラスのスマホ (見た目がガラスのもの) の中では、ふつうの 9 × 9 でガラスの盤になる
(() => {
  const COLS = 9, TALL_ROWS = 81;  // 長盤の段数 (ガラスのスマホの中ではふつうの 9 段、lPhone などの中は画面にちょうど入る段数)。対局の段数は盤 (board.length) から決まる
  const ZONE = 3;  // 敵陣 (成れる段) の深さ

  const CSS = `
  .sg { position: absolute; inset: 0; background: #2a1f14; user-select: none; }
  .sg.sg-glass { background: transparent; }
  .sg canvas { display: block; width: 100%; height: 100%; touch-action: none; }
  .sg-over button {
    height: 28px; padding: 0 10px; border: 1px solid rgba(255,255,255,.35); border-radius: 999px;
    background: rgba(0,0,0,.25); color: #f4e4c4; font: 600 12px/1 system-ui, sans-serif; cursor: pointer;
  }
  /* 箱の外に飛び出す操作パネル (api.floatPanel) の中身: 自動 (陣営ごとの CPU / 人)・再生のバー・手番・最初から、表示、盤・演出 (音・残像) */
  .sg-panel { display: grid; grid-template-columns: auto auto; gap: 8px 10px; align-items: center; }
  .sg-panel .sg-seg { display: flex; gap: 4px; }
  .sg-panel button {
    height: 26px; padding: 0 9px; border: 1px solid rgba(150,225,255,.45); border-radius: 999px;
    background: rgba(150,225,255,.08); color: #e8f7ff; font: 600 12px/1 system-ui, sans-serif; cursor: pointer;
  }
  .sg-panel button:disabled { opacity: .4; cursor: default; }
  .sg-panel button[data-board-fixed] { opacity: 1; }  /* スマホの中の今の盤 (押せないが、薄くしない) */
  .sg-panel button.on { background: rgba(150,225,255,.85); color: #0d2233; border-color: transparent; text-shadow: none; }
  /* オン / オフのスイッチ (自動 = CPU / 人、音 あり / なし、残像 あり / なし): オンはつまみが右で明るい水色 (選んだボタンと同じ)、オフはつまみが左で暗い。
     (人の陣営の名前の金色と混ざらないように、スイッチは金色にしない) */
  .sg-panel button.sg-sw { position: relative; width: 60px; height: 22px; padding: 0; border-color: rgba(150,225,255,.25);
    background: rgba(255,255,255,.1); color: #b9cdd8; transition: background .15s; }
  .sg-panel button.sg-sw.on { background: rgba(150,225,255,.85); color: #0d2233; border-color: transparent; }
  .sg-sw .k { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #e8f7ff;
    box-shadow: 0 1px 3px rgba(0,0,0,.5); transition: left .15s; }
  .sg-sw.on .k { left: 40px; background: #fff; }
  .sg-sw .t { position: absolute; inset: 0 4px 0 20px; display: flex; align-items: center; justify-content: center; font-size: 11px; }
  .sg-sw.on .t { inset: 0 20px 0 4px; }
  .sg-panel .sg-who.me { color: #ffd76a; }
  /* 自動 の行 (対局のいちばん上): 先手・後手の名前とスイッチを 2 組 (演出の行も同じ並べ方。3 組なので、盤の行の幅で折り返す) */
  .sg-panel .sg-sides { display: flex; gap: 6px 14px; align-items: center; }
  /* 音・残像・取ったコマ数・停止時の移動 のスイッチ: 盤の行の下に 1 行ずつ縦に並べ、字は左・スイッチは右の列でそろえる (見出しはない) */
  .sg-panel .sg-fx { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr auto; gap: 8px 12px; align-items: center; }  /* 字は左の端 (盤の字とそろえる)、スイッチは右の端 */
  .sg-panel .sg-opt { display: contents; }  /* 字とスイッチをそれぞれの列に */
  .sg-panel .sg-sides .sg-who { margin-right: -10px; }
  /* 自動 の行: 先手・後手を 1 行ずつ、名前・人 / CPU のスイッチ・CPU の強さ (人のときは薄く押せない) の 3 列 */
  .sg-panel .sg-auto { display: grid; grid-template-columns: auto auto auto; gap: 6px 8px; align-items: center; justify-content: start; }
  .sg-panel .sg-auto .sg-who { margin-right: 0; }
  .sg-panel .sg-auto select:disabled { opacity: .35; }
  .sg-panel .sg-debug { grid-column: 1 / -1; text-align: center; color: #ff9f6a; font-size: 11px; }
  .sg-panel .sg-debug button { height: 20px; padding: 0 7px; margin-left: 4px; font-size: 10px; border-color: rgba(255,159,106,.5); color: #ffd1b8; }
  .sg-panel .sg-turn { grid-column: 1 / -1; text-align: center; color: #ffe08a; }
  /* 最初の表示: 盤の真ん中に大きく「はじめる」「詳細設定」(api.floatOver で箱の手前。主にスマホ用。盤を触るか、どちらかを押すと消える) */
  .sg-begin { display: flex; flex-direction: column; align-items: center; gap: 14px; white-space: nowrap; }  /* 縦 2 段 (スマホの細い盤に収まるように)。(画面の真ん中に置く fixed の要素は幅が右半分に制限されるので、折り返さない) */
  .sg-begin button { min-width: 180px; }
  .sg-begin[hidden] { display: none; }
  .sg-begin button {
    height: 56px; padding: 0 26px; border: 1px solid rgba(150,225,255,.6); border-radius: 999px; cursor: pointer;
    background: rgba(18,36,56,.75); color: #e8f7ff; font: 700 19px/1 system-ui, sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,.5); backdrop-filter: blur(4px);
  }
  .sg-begin button[data-begin] { background: #ffd76a; color: #3a2a12; border-color: transparent; }
  /* まとまりの見出し (対局 / 表示 / 設定): 薄い文字と細い線 */
  .sg-panel .sg-head { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; margin: 2px 0 -2px; font-size: 10px; letter-spacing: .1em; color: rgba(150,225,255,.6); }
  .sg-panel .sg-head::before, .sg-panel .sg-head::after { content: ''; flex: 1; height: 1px; background: rgba(150,225,255,.25); }
  /* 再生 の行 (動画プレイヤー風のバー): ▶ / ⏸、⏪ 戻す、⏩ 進む は印だけの丸いボタン。右端に倍率 ×1 */
  .sg-panel .sg-bar { display: flex; gap: 6px; align-items: center; }
  .sg-panel .sg-bar button.sg-ic { width: 34px; height: 34px; padding: 0; font-size: 16px; }
  /* 再生 / 停止: ▶ と ⏸ の両方の印を並べ、いま押すと効くほうを明るく (再生中は .on で水色)。大きさは印だけの分 */
  .sg-panel .sg-bar button.sg-play { height: 34px; padding: 0 10px; font-size: 16px; display: inline-flex; align-items: center; gap: 2px; }
  .sg-play .i { opacity: .4; }
  .sg-play .i.now { opacity: 1; }
  /* 始める前にパネルを開いたとき、再生ボタンのまわりに光の輪を 3 回広げる (.hint、約 3 秒) */
  .sg-panel .sg-bar button.sg-play { position: relative; }
  .sg-panel .sg-play.hint::after { content: ''; position: absolute; inset: -1px; border-radius: inherit; pointer-events: none; animation: sg-ping 1s ease-out 3; }
  @keyframes sg-ping { from { box-shadow: 0 0 0 0 rgba(150,225,255,.9); } to { box-shadow: 0 0 0 12px rgba(150,225,255,0); } }
  /* 速さのドロップボックス (再生のバーの右端) */
  .sg-panel select {
    height: 30px; margin-left: 4px; padding: 0 22px 0 10px; border: 1px solid rgba(150,225,255,.45); border-radius: 999px; cursor: pointer;
    background: rgba(150,225,255,.08) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0h10L5 6z' fill='%23e8f7ff'/%3E%3C/svg%3E") no-repeat right 8px center;
    color: #e8f7ff; font: 600 12px/1 system-ui, sans-serif; appearance: none; -webkit-appearance: none;
  }
  .sg-panel select option { background: #0d2233; color: #e8f7ff; }
  .sg-panel .sg-acts { grid-column: 1 / -1; display: flex; gap: 6px; justify-content: center; }  /* 幅いっぱいに真ん中寄せの行 (最初から、表示のボタン) */
  /* 勝敗の表示 (api.floatOver で箱の手前、画面の上に出す。位置は本体の .float-over) */
  .sg-over {
    display: flex; flex-direction: column; align-items: center; gap: 10px; white-space: nowrap;
    color: #fff; font: 700 22px/1.3 system-ui, sans-serif; text-shadow: 0 2px 4px #000;
  }
  .sg-over[hidden] { display: none; }
  .sg-over button { height: 34px; padding: 0 18px; font-size: 14px; background: #f4e4c4; color: #3a2a12; }
  /* 取った数の表 (勝敗の下): 列は陣営、行は駒 (多い順)。人が指した陣営の名前は金色 */
  .sg-caps { display: grid; grid-template-columns: auto auto; justify-items: center; gap: 8px 28px; padding: 10px 20px; border-radius: 12px; background: rgba(0,0,0,.45); font: 600 18px/1.45 system-ui, sans-serif; text-shadow: 0 1px 2px #000; }
  .sg-caps[hidden] { display: none; }
  .sg-caps .h { grid-column: 1 / -1; font-size: 15px; color: rgba(255,255,255,.75); }  /* 見出し「取った駒の数ランキング」(2 列にまたがる。flex の折り返しだと、箱の右寄りに出たとき列が縦に並んでしまう) */
  .sg-caps .c { display: flex; flex-direction: column; align-items: center; min-width: 96px; }
  .sg-caps b { margin-bottom: 4px; font-size: 20px; color: #e8f7ff; }
  .sg-caps b.me { color: #ffd76a; }
  .sg-caps i { font-style: normal; color: rgba(255,255,255,.6); }
  /* いちばん取った駒の MVP の札 */
  .sg-caps em { margin-left: 7px; padding: 1px 7px; border-radius: 999px; background: #ffd76a; color: #3a2a12; font: 700 11px/1.5 system-ui, sans-serif; font-style: normal; text-shadow: none; vertical-align: 2px; }
  .sg-promo { position: absolute; display: flex; gap: 6px; z-index: 2; }
  /* 開発用: 盤面の文字の枠 (placeOver で、見えている盤の真ん中に画面と同じ大きさで) */
  .sg-text {
    position: absolute; z-index: 3; width: 360px; max-width: 92vw; display: flex; flex-direction: column; gap: 6px; padding: 10px; box-sizing: border-box;
    border-radius: 10px; background: rgba(13,34,51,.96); border: 1px solid rgba(150,225,255,.45); color: #e8f7ff; font: 12px/1.3 system-ui, sans-serif;
  }
  .sg-text[hidden] { display: none; }
  .sg-text textarea { width: 100%; height: 84px; box-sizing: border-box; resize: vertical; border: 1px solid rgba(150,225,255,.35); border-radius: 6px; background: rgba(0,0,0,.35); color: #e8f7ff; font: 12px/1.3 ui-monospace, Consolas, monospace; }
  .sg-text-msg { min-height: 1.3em; color: #ffd76a; }
  .sg-text-btns { display: flex; gap: 6px; flex-wrap: wrap; }
  .sg-text-btns button { height: 26px; padding: 0 10px; border: 1px solid rgba(150,225,255,.45); border-radius: 999px; background: rgba(150,225,255,.08); color: #e8f7ff; font: 600 12px/1 system-ui, sans-serif; cursor: pointer; }
  .sg-promo[hidden] { display: none; }
  .sg-promo button { width: 54px; height: 34px; border: 0; border-radius: 8px; cursor: pointer;
    font: 700 15px/1 system-ui, sans-serif; box-shadow: 0 2px 6px rgba(0,0,0,.5); }
  .sg-promo .yes { background: #c0392b; color: #fff; }
  .sg-promo .no { background: #f4e4c4; color: #3a2a12; }
`;

  // 画面に出る文字。[日本語, English]
  const STR = {
    shogi: ['ナガ将棋', 'Naga Shogi'],
    shogiPhone: ['将棋', 'Shogi'],  // スマホのホーム画面の名前
    infoShogi: ['縦に長い将棋 (CPU と対戦。盤は最大 9×81)', 'Tall shogi vs CPU (board up to 9×81)'],
    sgSente: ['先手', 'Black'],
    sgGote: ['後手', 'White'],
    sgHuman: ['人', 'You'],
    sgTurn: [(s) => `▶ ${s}の番`, (s) => `▶ ${s} to move`],
    sgPromote: ['成', 'Promote'],
    sgStay: ['不成', 'Stay'],
    sgCpu: ['CPU', 'CPU'],
    sgEasy: ['よわい', 'Weak'],
    sgNormal: ['ふつう', 'Normal'],
    sgStrong: ['強い', 'Strong'],
    sgLevelHint: ['CPU の強さ (よわい: 1 手だけ読む / ふつう・強い: 先を読む)。対局の途中でも変えられます', 'CPU strength (Weak: looks 1 move ahead / Normal, Strong: search deeper). Can be changed during a game'],
    sgSpeedHint: ['速さ', 'Speed'],
    sgBoard: ['盤', 'Board'],
    sgBoardHint: ['対局を始める前だけ選べます', 'Only before the game starts'],
    sgBoardFixed: ['スマホの画面に合わせた盤 (変えられません)', "Fitted to the phone's screen (fixed)"],
    sgPause: ['停止', 'Pause'],
    sgPlay: ['再生', 'Play'],
    sgPlayRow: ['再生', 'Play'],
    sgAuto: ['自動', 'Auto'],
    sgGroupGame: ['対局', 'Game'],
    sgGroupSetup: ['設定', 'Setup'],
    sgView: ['表示', 'View'],
    sgWhole: ['全体', 'Whole'],
    sgMine: ['自軍', 'My side'],
    sgTheirs: ['敵軍', 'Their side'],
    sgHoldStep: ['1 手進む (長押しで早送り)', 'One move (hold to fast-forward)'],
    sgHoldUndo: ['1 手戻す (長押しで早戻し)', 'Back one move (hold to rewind)'],
    sgWatch: [(n) => `観戦中 · ${n} 手目`, (n) => `Watching · move ${n}`],
    sgRestart: ['最初から', 'Restart'],
    sgBegin: ['▶ はじめる', '▶ Start'],
    sgConfig: ['詳細設定', 'Settings'],
    sgWin: [(s) => `${s}の勝ち`, (s) => `${s} wins`],
    sgDraw: ['千日手 (引き分け)', 'Draw (repetition)'],
    sgCheck: [' · 王手', ' · check'],
    sgAgain: ['もう一局', 'New game'],
    sgCapsTitle: ['取った駒の数ランキング', 'Captures ranking'],
    sgCapsTotal: [(n) => `${n} 枚`, (n) => `${n} taken`],
    sgCapsNone: ['取った駒なし', 'no captures'],
    sgSound: ['音', 'Sound'],
    sgOff: ['なし', 'Off'],
    sgOn: ['あり', 'On'],
    sgTrail: ['残像', 'Trails'],
    sgCapsSw: ['取ったコマ数を表示', 'Show captured counts'],
    sgMoveSw: ['停止時にコマを動かせる', 'Move pieces while paused'],
    // スイッチのツールチップ
    sgSoundHint: ['指す音・取る音・決着の音 (×4 からは指す音は鳴らさない)', 'Move, capture and game-end sounds (no move sound from ×4)'],
    sgTrailHint: ['動いた駒の跡を少しの間見せる', 'Show the trail of each move for a moment'],
    sgCapsHint: ['対局が終わったとき、どの駒が相手の駒を何枚取ったかの表 (取った駒の数ランキング) を出す', 'When the game ends, show the table of captures by each piece (captures ranking)'],
    sgMoveHint: ['止めている間、盤の駒や持ち駒をドラッグで好きな所に置き直せる (手番に関係なく。局面を作るのに)', 'While paused, drag any piece on the board or in hand anywhere (regardless of turn, to set up a position)'],
    sgDebug: ['開発モード', 'Debug mode'],
    sgBoardText: ['盤面の文字', 'Board text'],
    sgCopy: ['コピー', 'Copy'],
    sgCopyUrl: ['URL をコピー', 'Copy URL'],
    sgLoad: ['再現', 'Load'],
    sgClose: ['閉じる', 'Close'],
    sgCopied: ['コピーしました', 'Copied'],
    sgCopyFail: ['コピーできませんでした (選んであるので Ctrl+C で)', 'Could not copy (selected: press Ctrl+C)'],
    sgLoadFail: [(e) => `読めませんでした: ${e}`, (e) => `Could not read: ${e}`],
  };

  // ---------- 駒 ----------
  // 種類: K 玉 / R 飛 / B 角 / G 金 / S 銀 / N 桂 / L 香 / P 歩。成ると +
  const NAMES = { K: '玉', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩' };
  const PROMOTED = { R: '竜', B: '馬', S: '全', N: '圭', L: '杏', P: 'と' };
  const VALUE = { K: 10000, R: 900, B: 800, G: 500, S: 450, N: 300, L: 320, P: 100 };
  const PROMO_VALUE = { R: 1200, B: 1050, S: 500, N: 500, L: 500, P: 450 };
  // 駒の動きは、10 の向き (8 方向と桂馬の 2 つの跳び先) それぞれに何回進めるか (reach) で表す。Infinity はどこまでも。
  // 向きは先手から見て (上が前)。同じ向きに 2 回以上進めるときは、途中のマスが空いていないと先へ行けない
  const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [1, -2], [-1, -2]];
  const I = Infinity;
  const REACH = {
    K: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    R: [I, 0, I, 0, I, 0, I, 0, 0, 0],
    B: [0, I, 0, I, 0, I, 0, I, 0, 0],
    G: [1, 1, 1, 0, 1, 0, 1, 1, 0, 0],
    S: [1, 1, 0, 1, 0, 1, 0, 1, 0, 0],
    N: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    L: [I, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    P: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
  const PROMO_REACH = {
    R: [I, 1, I, 1, I, 1, I, 1, 0, 0], B: [1, I, 1, I, 1, I, 1, I, 0, 0],
    S: REACH.G, N: REACH.G, L: REACH.G, P: REACH.G,
  };
  const reachOf = (p) => (p.promoted ? PROMO_REACH : REACH)[p.type];
  const value = (p) => (p.promoted ? PROMO_VALUE[p.type] : VALUE[p.type]);

  // ---------- 持ち駒 ----------
  // 持ち駒は陣営ごとに { 種類: { spec, n } } (spec は持ち駒の中身 { type }。盤に出すときに pieceOf で駒にする)。取った駒はすぐ打てる
  const specOf = (p) => ({ type: p.type });  // 成っていても表に戻る
  const keyOf = (s) => s.type;
  const pieceOf = (s, owner) => ({ type: s.type, owner, promoted: false });
  function handAdd(hand, s, n = 1) {
    const k = keyOf(s);
    (hand[k] ||= { spec: s, n: 0 }).n += n;
  }
  function handTake(hand, k) {
    const e = hand[k];
    if (!e) return null;
    if (--e.n <= 0) delete hand[k];
    return e.spec;
  }
  // 並べる順: 強い駒から
  const handList = (hand) => Object.entries(hand).map(([key, e]) => ({ key, ...e }))
    .sort((a, b) => value(b.spec) - value(a.spec) || (a.key < b.key ? -1 : 1));
  const label = (p) => (p.promoted ? PROMOTED[p.type] : p.owner === 1 && p.type === 'K' ? '王' : NAMES[p.type]);

  // 動きの向き (先手 = 0 は上へ、後手 = 1 は下へ)
  const fwd = (owner) => (owner === 0 ? 1 : -1);
  // 駒 p が (x, y) から動ける先 [[x, y], …]。味方の駒の手前で止まる。敵の駒は取ってそこで止まる
  function targets(board, p, x, y) {
    const out = [], f = fwd(p.owner), reach = reachOf(p);
    DIRS.forEach(([dx, dy], i) => {
      for (let k = 1; k <= reach[i]; k++) {
        const tx = x + dx * k * f, ty = y + dy * k * f;
        if (tx < 0 || tx >= COLS || ty < 0 || ty >= board.length) break;
        const q = board[ty][tx];
        if (q && q.owner === p.owner) break;
        out.push([tx, ty]);
        if (q) break;
      }
    });
    return out;
  }
  const promoteOf = (p) => ({ ...p, promoted: true });
  const inZone = (owner, y, rows) => (owner === 0 ? y < ZONE : y >= rows - ZONE);
  // 成らないと、もう動けなくなるか (歩・香の最後の段、桂の最後の 2 段)
  const mustType = (t, last) => (t === 'P' || t === 'L') && last === 0 || t === 'N' && last <= 1;
  const mustPromote = (p, y, rows) => mustType(p.type, p.owner === 0 ? y : rows - 1 - y);
  // 成れるか: 成っていない、成れる種類の駒で、敵陣に入る・出る・中で動く
  const canPromote = (p, fy, ty, rows) => !p.promoted && !!PROMOTED[p.type] && (inZone(p.owner, fy, rows) || inZone(p.owner, ty, rows));

  function newGame(ROWS) {
    const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const back = ['L', 'N', 'S', 'G', 'K', 'G', 'S', 'N', 'L'];
    const put = (x, y, type, owner) => { board[y][x] = { type, owner, promoted: false }; };
    back.forEach((t, x) => { put(x, ROWS - 1, t, 0); put(x, 0, t, 1); });
    put(1, ROWS - 2, 'B', 0); put(7, ROWS - 2, 'R', 0);
    put(1, 1, 'R', 1); put(7, 1, 'B', 1);
    for (let x = 0; x < COLS; x++) { put(x, ROWS - 3, 'P', 0); put(x, 2, 'P', 1); }
    const g = { board, hands: [{}, {}], turn: 0, last: null, winner: null, moves: 0, caps: [{}, {}], hist: {}, recent: [[], []] };
    g.hist[positionKey(g)] = 1;  // (千日手用。最初の局面も 1 回)
    return g;
  }

  // ---------- 盤面の文字 (開発用のコピー / 貼り付け / URL) ----------
  // 将棋の SFEN に似た詰めた形。URL にそのまま入る文字 (英数字と . _ ~ -) だけ。「盤-手番-持ち駒-手数」。
  // 盤: 段を . で区切り、駒は 1 字 (先手は大文字、後手は小文字)、空きは数、成りは _ を前に。空の段が 2 つ以上続けば ~N。
  // 手番: b 先手 / w 後手。持ち駒: 先手.後手 (数は 2P のように前。空なら何も書かない)
  // 例: lnsgkgsnl.1r5b1.ppppppppp.~3.PPPPPPPPP.1B5R1.LNSGKGSNL-b-.-0
  const TYPES = 'KRBGSNLP';
  function dumpGame(g) {
    const rows = [];
    for (let y = 0; y < g.board.length; y++) {
      let row = '', empty = 0;
      for (let x = 0; x < COLS; x++) {
        const p = g.board[y][x];
        if (!p) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        row += (p.promoted ? '_' : '') + (p.owner === 1 ? p.type.toLowerCase() : p.type);
      }
      rows.push(row + (empty || ''));
    }
    const segs = [], blank = String(COLS);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] !== blank) { segs.push(rows[i]); continue; }
      let j = i;
      while (j + 1 < rows.length && rows[j + 1] === blank) j++;
      segs.push(j > i ? `~${j - i + 1}` : blank);
      i = j;
    }
    const hand = (h) => handList(h).map((e) => (e.n > 1 ? e.n : '') + e.key).join('');
    return `${segs.join('.')}-${g.turn ? 'w' : 'b'}-${hand(g.hands[0])}.${hand(g.hands[1])}-${g.moves}`;
  }
  // 文字から対局の状態を作る (形が違えば Error)
  function parseGame(text) {
    const m = /^([^-]*)-([bw])-([^-]*)-(\d+)$/.exec(String(text).trim());
    if (!m) throw new Error('form');
    const typeOf = (ch) => { const u = ch.toUpperCase(); if (!TYPES.includes(u)) throw new Error(`piece ${ch}`); return u; };
    // 盤
    const rows = [];
    for (const seg of m[1].split('.')) {
      const run = /^~(\d+)$/.exec(seg);
      if (run) { for (let i = 0; i < +run[1]; i++) rows.push([]); continue; }
      const cells = [], re = /(\d+)|(_?)([A-Za-z])/g;
      let r, pos = 0;
      while ((r = re.exec(seg))) {
        if (r.index !== pos) break;
        pos = re.lastIndex;
        if (r[1]) { for (let i = 0; i < +r[1]; i++) cells.push(null); continue; }
        const q = { type: typeOf(r[3]), owner: r[3] === r[3].toLowerCase() ? 1 : 0, promoted: !!r[2] };
        if (q.promoted && !PROMOTED[q.type]) throw new Error(`promoted ${r[0]}`);
        cells.push(q);
      }
      if (pos !== seg.length || cells.length !== COLS) throw new Error(`row ${seg}`);
      rows.push(cells);
    }
    if (!rows.length) throw new Error('rows');
    const board = rows.map((cells) => (cells.length ? cells : Array(COLS).fill(null)));
    // 持ち駒
    const hs = m[3].split('.');
    if (hs.length !== 2) throw new Error('hands');
    const hands = [{}, {}];
    hs.forEach((h, i) => {
      const re = /(\d*)([A-Za-z])/g;
      let r, pos = 0;
      while ((r = re.exec(h))) {
        if (r.index !== pos) break;
        pos = re.lastIndex;
        const type = typeOf(r[2]);
        if (type === 'K') throw new Error('king in hand');
        handAdd(hands[i], { type }, +(r[1] || 1));
      }
      if (pos !== h.length) throw new Error(`hand ${h}`);
    });
    const g = { board, hands, turn: m[2] === 'w' ? 1 : 0, last: null, winner: null, moves: +m[4], caps: [{}, {}], hist: {}, recent: [[], []] };  // (取った数・局面の回数・直近の手は文字に入れない。0 から)
    g.hist[positionKey(g)] = 1;
    return g;
  }

  // 手番の陣営が指せる手を全部 { from: [x, y] | null, drop: 持ち駒の種類, to: [x, y], promote }
  function allMoves(g, owner) {
    const list = [], ROWS = g.board.length;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const p = g.board[y][x];
      if (!p || p.owner !== owner) continue;
      for (const [tx, ty] of targets(g.board, p, x, y)) {
        if (mustPromote(p, ty, ROWS) && !p.promoted) { list.push({ from: [x, y], to: [tx, ty], promote: true }); continue; }
        list.push({ from: [x, y], to: [tx, ty], promote: false });
        if (canPromote(p, y, ty, ROWS)) list.push({ from: [x, y], to: [tx, ty], promote: true });
      }
    }
    for (const key of Object.keys(g.hands[owner])) {
      const p = pieceOf({ type: key }, owner);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (g.board[y][x] || mustPromote(p, y, ROWS)) continue;
        list.push({ drop: key, to: [x, y] });
      }
    }
    return list;
  }
  // 手 mv で取る駒 (なければ null)
  const captureOf = (board, mv) => (mv.drop ? null : board[mv.to[1]][mv.to[0]]);
  // 手を指す。取った駒を [{ p, at }] で返す (at はそのマス)。玉を取れば勝ち (反則を除いていれば起きないが、開発モードの置き直しでは起きる)、そのあと千日手と詰みを見る
  function play(g, mv) {
    const taken = [], [tx, ty] = mv.to;
    if (mv.drop) {
      g.board[ty][tx] = pieceOf(handTake(g.hands[g.turn], mv.drop), g.turn);
    } else {
      const [fx, fy] = mv.from, p = g.board[fy][fx], q = g.board[ty][tx];
      g.board[fy][fx] = null;
      if (q) {
        taken.push({ p: q, at: [tx, ty] });
        if (q.type === 'K') g.winner = g.turn;
        else handAdd(g.hands[g.turn], specOf(q));
        // 取った数 (取った側の駒の種類ごと。成り駒は元の駒に合算 (竜は飛に)。古い状態には caps がないこともある)
        if (g.caps) g.caps[g.turn][p.type] = (g.caps[g.turn][p.type] || 0) + 1;
      }
      g.board[ty][tx] = mv.promote ? promoteOf(p) : p;
    }
    g.last = { ...mv };
    // 陣営ごとの直近の手 (CPU が同じ駒を行ったり来たりさせないように。4 手まで)。古い状態には recent がないこともある
    if (g.recent) { const r = g.recent[g.turn]; r.push({ from: mv.drop ? null : mv.from, to: mv.to }); if (r.length > RECENT) r.shift(); }
    g.moves++;
    g.turn = 1 - g.turn;
    if (g.winner === null) {
      // 千日手: 同じ局面 (盤・持ち駒・手番) が 4 回目なら引き分け (winner = -1。連続王手の千日手は見ない)。古い状態には hist がないこともある
      if (g.hist) { const k = positionKey(g); g.hist[k] = (g.hist[k] || 0) + 1; if (g.hist[k] >= 4) g.winner = -1; }
      // 詰み: 手番の側に指せる手がなければ (王手されていてもいなくても)、指した側の勝ち。玉のない側は見ない (開発モードの置き直し)
      if (g.winner === null && kingAt(g.board, g.turn) && !legalMoves(g, g.turn).length) g.winner = 1 - g.turn;
    }
    return taken;
  }

  const RECENT = 4;  // 直近の手を何手まで覚えるか (行ったり来たりを避けるのに使う)

  // ---------- 本将棋のルール (反則の手を除く) ----------
  // 局面の文字 (盤・手番・持ち駒。手数は含めない。千日手の数えに使う)
  const positionKey = (g) => dumpGame(g).replace(/-\d+$/, '');
  // owner の玉が相手の利きにあるか (玉がなければ false)
  function inCheck(board, owner) {
    const k = kingAt(board, owner);
    return !!k && attacked(board, 1 - owner).has(k[1] * COLS + k[0]);
  }
  // 手 mv を指したあとの盤 (写し。持ち駒は見ない)
  function after(board, mv, owner) {
    const b = board.map((r) => r.slice()), [tx, ty] = mv.to;
    if (mv.drop) b[ty][tx] = pieceOf({ type: mv.drop }, owner);
    else { const p = b[mv.from[1]][mv.from[0]]; b[mv.from[1]][mv.from[0]] = null; b[ty][tx] = mv.promote ? promoteOf(p) : p; }
    return b;
  }
  // owner の玉に王手している相手の駒の場所 [[x, y], …]
  function checkers(board, owner) {
    const k = kingAt(board, owner), out = [];
    if (!k) return out;
    for (let y = 0; y < board.length; y++) for (let x = 0; x < COLS; x++) {
      const p = board[y][x];
      if (p && p.owner !== owner && targets(board, p, x, y).some(([tx, ty]) => tx === k[0] && ty === k[1])) out.push([x, y]);
    }
    return out;
  }
  // (ax, ay) と (bx, by) の間のマス (番号 y * COLS + x)。同じ筋・段・斜めでなければ空
  function between(ax, ay, bx, by) {
    const dx = Math.sign(bx - ax), dy = Math.sign(by - ay), out = [];
    if (!(dx === 0 || dy === 0 || Math.abs(bx - ax) === Math.abs(by - ay))) return out;
    for (let x = ax + dx, y = ay + dy; x !== bx || y !== by; x += dx, y += dy) out.push(y * COLS + x);
    return out;
  }
  const aligned = ([x, y], [kx, ky]) => x === kx || y === ky || Math.abs(x - kx) === Math.abs(y - ky);
  // 二歩: その筋に owner の (成っていない) 歩があるか
  const pawnOnFile = (board, owner, x) => board.some((r) => r[x] && r[x].owner === owner && r[x].type === 'P' && !r[x].promoted);
  // 指せる手 (allMoves から反則を除く): 二歩、玉を相手の利きに残す手 (王手放置・自殺手)、打ち歩詰め。行き所のない駒は allMoves で除いてある。
  // 玉がなければ (開発モードの置き直し) 玉の安全は見ない。
  // 速さのため、指したあとの盤を調べるのは 玉を動かす手・王手を受けているときの手・玉と筋 / 段 / 斜めで並ぶ駒の手 だけ (打つ手は王手を受けていなければ大丈夫)。
  // 王手を受けているとき、玉以外の手で助かるのは 王手している駒を取る か 玉との間に入る 手だけ (両王手なら玉が動くしかない)。
  // depth: 打ち歩詰めを調べるため相手の応手を見る再帰 (相手の打ち歩詰めまでは見ない)
  function legalMoves(g, owner, depth = 0) {
    const board = g.board, k = kingAt(board, owner), chk = k ? checkers(board, owner) : [];
    const save = chk.length === 1 ? new Set([chk[0][1] * COLS + chk[0][0], ...between(chk[0][0], chk[0][1], k[0], k[1])]) : null;
    const out = [];
    for (const mv of allMoves(g, owner)) {
      const [tx, ty] = mv.to, p = mv.drop ? null : board[mv.from[1]][mv.from[0]], isKing = !!p && p.type === 'K';
      if (mv.drop === 'P' && pawnOnFile(board, owner, tx)) continue;
      if (k) {
        if (!isKing && chk.length >= 2) continue;
        if (!isKing && save && !save.has(ty * COLS + tx)) continue;
        if ((isKing || chk.length || (p && aligned(mv.from, k))) && inCheck(after(board, mv, owner), owner)) continue;
      }
      if (mv.drop === 'P' && depth < 1) {
        // 打ち歩詰め: 打った歩で王手になり、相手に指せる手がなければ反則
        const b = after(board, mv, owner), ok = kingAt(b, 1 - owner);
        if (ok && ok[0] === tx && ok[1] === ty - fwd(owner) && !legalMoves({ board: b, hands: g.hands }, 1 - owner, depth + 1).length) continue;
      }
      out.push(mv);
    }
    return out;
  }

  // ---------- CPU: 1 手先だけ読む、香車と飛車を突っ込ませがちな弱い CPU ----------
  // owner の駒の利きが届くマス (noKing: 玉の利きは除く)
  function attacked(board, owner, noKing = false) {
    const set = new Set();
    for (let y = 0; y < board.length; y++) for (let x = 0; x < COLS; x++) {
      const p = board[y][x];
      if (p && p.owner === owner && !(noKing && p.type === 'K')) for (const [tx, ty] of targets(board, p, x, y)) set.add(ty * COLS + tx);
    }
    return set;
  }
  // 玉の場所 [x, y] (なければ null)
  function kingAt(board, owner) {
    for (let y = 0; y < board.length; y++) for (let x = 0; x < COLS; x++) { const p = board[y][x]; if (p && p.type === 'K' && p.owner === owner) return [x, y]; }
    return null;
  }
  // CPU の手: 指せる手を全部点数づけして一番よい手 (1 手だけ読む)。取れる駒、成り、相手の玉への圧力 (近づく・王手・逃げ場をふさぐ・詰み)、
  // 指したあと取られないか、自分の玉が取られないか
  function cpuMove(g) {
    const me = g.turn, you = 1 - me, list = legalMoves(g, me);
    const king = kingAt(g.board, you);
    const dist = (x, y) => (king ? Math.max(Math.abs(x - king[0]), Math.abs(y - king[1])) : 0);  // 相手の玉までの遠さ (縦と横の大きいほう。斜めの 1 歩も 1。前は 縦 + 横 で、角だけ 2 倍近づけた)
    // 盤 b の (x, y) の駒に、味方の利きがあるか (その駒をどけて利きを調べる。利きは味方の駒のマスには届かないので)
    const guarded = (b, x, y) => {
      const q = b[y][x];
      b[y][x] = null;
      const hit = attacked(b, me).has(y * COLS + x);
      b[y][x] = q;
      return hit;
    };
    // 自分の駒を、直近の手でいたマスへ戻す手 (行ったり来たり) は減点する。王手を受けているときは見ない (逃げるのが先)
    const recent = !inCheck(g.board, me) && g.recent?.[me];
    const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
    const threat = recent && attacked(g.board, you);  // 相手に狙われているマス (そこにいる駒が逃げる手は減点しない)
    const LONG = { B: 1, R: 1 };  // 長い利きの駒 (角・飛車。成った馬・竜も)
    // 駒が直近の手でいたマス (今いるマス from から、自分の直近の手をさかのぼる)。いちばん最近のものが先
    const visited = (from) => {
      const out = [];
      let s = from;
      for (let k = recent.length - 1; k >= 0; k--) {
        if (!same(recent[k].to, s)) continue;
        if (!recent[k].from) break;  // 打った駒
        out.push(recent[k].from); s = recent[k].from;
      }
      return out;
    };
    let best = null, bestScore = -Infinity;
    for (const mv of list) {
      // 持ち駒を打つ手は多すぎるので、相手の玉の近くは全部、ほかは少しだけ考える
      if (mv.drop && dist(...mv.to) > 4 && Math.random() > 0.06) continue;
      const [tx, ty] = mv.to;
      const p = mv.drop ? pieceOf(g.hands[me][mv.drop].spec, me) : g.board[mv.from[1]][mv.from[0]];
      // 取れる駒の価値
      const cap = captureOf(g.board, mv), kingTaken = cap?.type === 'K';
      let score = cap ? value(cap) * 1.2 : 0;
      if (kingTaken) score = 1e6;
      if (mv.promote) score += value(promoteOf(p)) - value(p) + 40;
      // 相手の玉に近づくほどよい (玉は前に出ない)。前へ進むのも少し (香・飛は特に)
      if (!mv.drop) {
        const adv = (mv.from[1] - ty) * fwd(me);
        score += adv * (p.type === 'K' ? -8 : p.type === 'L' || p.type === 'R' ? 3 : 1);
        if (p.type !== 'K') score += (dist(...mv.from) - dist(tx, ty)) * 5;
      } else {
        // 持ち駒は進んだ所へ積極的に打つ
        score += 40 + value(p) * 0.05 + Math.min(40, me === 0 ? g.board.length - 1 - ty : ty) * 2;
      }
      // 指したあと、取られてしまうなら引く (玉は特に)。盤を写して試す
      const b = g.board.map((r) => r.slice());
      if (mv.from) b[mv.from[1]][mv.from[0]] = null;
      const moved = mv.promote ? promoteOf(p) : p;
      b[ty][tx] = moved;
      // 指したあとの利きの広さ (届くマスの数 × 1.5)。長い盤では飛車・香・角の長い利きが生きる所を選ぶ (玉は除く)
      if (moved.type !== 'K') score += targets(b, moved, tx, ty).length * 1.5;
      // 行ったり来たり: 駒を取らない手で、直前に動かしてきた元のマスへ戻すなら −40、直近の手の間にいたマスへ戻るなら −15 (王手になる手は減点しない。下で戻す)
      // うろうろ: 狙われていない駒で、駒を取らない手のうち、長い利きの駒 (角・飛車・馬・竜) が後ろへ下がる手は 10 + 下がる段 × 6 (40 まで)、
      // 直前の自分の手で動かした駒をまた動かす手は −12 (ジグザグに出たり下がったりしないように。王手になる手は減点しない)
      let shuttle = 0;
      if (recent && !mv.drop && !cap) {
        const v = visited(mv.from), i = v.findIndex((q) => same(q, mv.to));
        if (i >= 0) shuttle = i === 0 && same(recent[recent.length - 1]?.to, mv.from) ? 40 : 15;
        if (!threat.has(mv.from[1] * COLS + mv.from[0])) {
          const back = -(mv.from[1] - ty) * fwd(me);
          if (LONG[p.type] && back > 0) shuttle += Math.min(40, 10 + back * 6);
          if (same(recent[recent.length - 1]?.to, mv.from)) shuttle += 12;
        }
        score -= shuttle;
      }
      // 前にあった局面に戻る手は避ける (千日手になりにくく)。打つ手・取る手も、持ち駒の変化まで含めて見る。
      // 同じ局面が 4 回目になる (千日手になる) 手は、ほかに手がある限り指さない (王手の繰り返しもこれで止まる)
      if (g.hist) {
        let hands = g.hands;
        if (mv.drop || cap) {
          const h = Object.fromEntries(Object.entries(g.hands[me]).map(([k, e]) => [k, { ...e }]));
          if (mv.drop) handTake(h, mv.drop);
          if (cap && !kingTaken) handAdd(h, specOf(cap));
          hands = me === 0 ? [h, g.hands[1]] : [g.hands[0], h];
        }
        const seen = g.hist[positionKey({ board: b, hands, turn: you, moves: 0 })];
        if (seen >= 3) score -= 1e7;
        else if (seen) score -= 60 * seen;
      }
      // (玉にしか取られない駒は、味方の利きがあれば取られない)
      const danger = attacked(b, you);
      let others = null;  // 相手の玉以外の利き (要るときだけ)
      if (danger.has(ty * COLS + tx)) {
        others = attacked(b, you, true);
        if (p.type === 'K' || others.has(ty * COLS + tx) || !guarded(b, tx, ty)) score -= value(moved) * (p.type === 'K' ? 10 : 0.9);
      }
      // 自分の玉が取られる形は避ける
      const myKing = kingAt(b, me);
      if (myKing && danger.has(myKing[1] * COLS + myKing[0]) && !kingTaken) score -= 5000;
      // 相手の玉への圧力: 王手、玉の逃げ先 (周り 8 マス) に利かせる。逃げ場がなく、王手した駒を取り返せないなら詰み (合駒は見ない)
      if (king && !kingTaken) {
        const mine = attacked(b, me);
        const kk = king[1] * COLS + king[0], check = mine.has(kk);
        let esc = 0, cover = 0;
        for (const [dx, dy] of DIRS.slice(0, 8)) {
          const nx = king[0] + dx, ny = king[1] + dy;
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= b.length) continue;
          const q = b[ny][nx];
          if (q && q.owner === you) continue;  // 味方の駒がいる所へは逃げられない
          if (q ? guarded(b, nx, ny) : mine.has(ny * COLS + nx)) cover++; else esc++;  // 自分の駒がいる所は、利きがあれば取れない
        }
        score += cover * 25 + (check ? 120 : 0);
        if (check) score += shuttle;  // 王手になる手は、行ったり来たりでも減点しない
        if (check && esc === 0) {
          // 王手している駒を、玉以外の駒で取れるか。玉で取れるのは、その駒に味方の利きがないとき
          others ||= attacked(b, you, true);
          let safe = true;
          for (let y = 0; y < b.length && safe; y++) for (let x = 0; x < COLS && safe; x++) {
            const a = b[y][x];
            if (!a || a.owner !== me || !targets(b, a, x, y).some(([ax, ay]) => ay * COLS + ax === kk)) continue;
            if (others.has(y * COLS + x)) safe = false;
            else if (Math.max(Math.abs(x - king[0]), Math.abs(y - king[1])) === 1 && !guarded(b, x, y)) safe = false;
          }
          if (safe) score += 3000;
        }
      }
      score += Math.random() * 10;
      if (score > bestScore) { bestScore = score; best = mv; }
    }
    return best || list[0];
  }

  // ---------- 先を読む CPU (ふつう・強い) ----------
  // アルファベータ (ネガマックス) + 反復深化 + 時間制限 + 駒を取る手の静止探索。searchMove(g, ms) は、ms ミリ秒の中で読めた深さの一番よい手を返す
  // (返すのは legalMoves の要素そのもの)。よわいは上の cpuMove (1 手だけ読む)
  function makeSearch(H) {
    const { legalMoves, parseGame, value, COLS, ZONE } = H;
    // ---------- 駒の番号 ----------
    // 種類 (kind): 玉 0 飛 1 角 2 金 3 銀 4 桂 5 香 6 歩 7。成り駒は +8 (竜 9 馬 10 全 12 圭 13 杏 14)。
    // 盤のマスの数 = 1 + kind + 16 × 陣営 (0 は空き)
    const TYPES = 'KRBGSNLP';
    const KIND = { K: 0, R: 1, B: 2, G: 3, S: 4, N: 5, L: 6, P: 7 };
    const codeOf = (kind, owner) => 1 + kind + 16 * owner;
    const ownerOf = (c) => (c - 1) >> 4;
    const kindOf = (c) => (c - 1) & 15;
    const baseOf = (k) => k & 7;
    const CAN_PROMO = [0, 1, 1, 0, 1, 1, 1, 1];
    // 駒の点 (ゲームの value をそのまま使う)
    const VAL = new Array(16).fill(0);
    for (let k = 0; k < 8; k++) {
      VAL[k] = value({ type: TYPES[k], promoted: false });
      if (CAN_PROMO[k]) VAL[k + 8] = value({ type: TYPES[k], promoted: true });
    }
    VAL[0] = 0;  // 玉は点に入れない (取られることはない。詰みで見る)
    // 動き: shogi.js と同じ 10 の向き (先手から見て。後手は反対向き) と、進める回数 (0 / 1 / どこまでも)
    const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [1, -2], [-1, -2]];
    const I = 99;
    const REACH = [
      [1, 1, 1, 1, 1, 1, 1, 1, 0, 0],  // K
      [I, 0, I, 0, I, 0, I, 0, 0, 0],  // R
      [0, I, 0, I, 0, I, 0, I, 0, 0],  // B
      [1, 1, 1, 0, 1, 0, 1, 1, 0, 0],  // G
      [1, 1, 0, 1, 0, 1, 0, 1, 0, 0],  // S
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1],  // N
      [I, 0, 0, 0, 0, 0, 0, 0, 0, 0],  // L
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],  // P
    ];
    const G_ = REACH[3];
    const PROMO_REACH = { 1: [I, 1, I, 1, I, 1, I, 1, 0, 0], 2: [1, I, 1, I, 1, I, 1, I, 0, 0], 4: G_, 5: G_, 6: G_, 7: G_ };
    const reachK = (k) => (k >= 8 ? PROMO_REACH[k - 8] : REACH[k]);
    // 陣営と種類ごとの動き [[dx, dy, 回数], …] (盤の上での向き)
    const STEPS = [[], []];
    // 盤の向き i (DIRS の 0..7 を先手の向きとして) に、陣営 o の駒 c が何マス届くか (利きを調べるのに使う)
    const ATK = [];
    for (let o = 0; o < 2; o++) for (let k = 0; k < 16; k++) {
      const r = k >= 8 && !CAN_PROMO[k - 8] ? null : reachK(k);
      const f = o === 0 ? 1 : -1;
      STEPS[o][k] = r ? DIRS.map(([dx, dy], i) => [dx * f, dy * f, r[i]]).filter((s) => s[2] > 0) : [];
      const a = new Array(8).fill(0);
      // 盤の向き i (先手の向き DIRS[i]) は、後手の駒にとっては DIRS[(i + 4) % 8]
      if (r) for (let i = 0; i < 8; i++) a[i] = o === 0 ? r[i] : r[(i + 4) % 8];
      ATK[codeOf(k, o)] = a;
    }

    // ---------- 局面 (探索用) ----------
    let R = 9, N = 81;               // 段数・マスの数
    let bd = new Int8Array(N);        // 盤
    const hand = new Int8Array(16);  // 持ち駒 hand[陣営 × 8 + 種類 (1..7)]
    let pawnFile = new Int8Array(18); // 筋ごとの歩の数 (二歩用) pawnFile[陣営 × 9 + x]
    const kingSq = [-1, -1];
    let side = 0, mat = 0;            // 手番、駒の点 (先手から見て。持ち駒も含む)
    let h1 = 0, h2 = 0;               // 局面の印 (ゾブリスト。2 つの 32 ビット)
    // ゾブリストの乱数 (固定の種で作る。盤のマスの表は盤の大きさごとに作って取っておく (大きさを行き来しても、局面の印が変わらないように))
    let seed = 0x9e3779b9 | 0;
    const rnd32 = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };  // (xorshift32)
    let ZB1 = null, ZB2 = null, zN = 0;
    const ZH1 = new Int32Array(16 * 41), ZH2 = new Int32Array(16 * 41);
    for (let i = 0; i < 16 * 41; i++) { ZH1[i] = rnd32(); ZH2[i] = rnd32(); }
    const ZS1 = rnd32(), ZS2 = rnd32();
    const zTables = new Map();
    function zobrist(n) {
      if (zN === n) return;
      let t = zTables.get(n);
      if (!t) {
        let z = (0x2545f491 ^ n) | 0;
        const r = () => { z ^= z << 13; z ^= z >>> 17; z ^= z << 5; return z | 0; };
        t = [new Int32Array(33 * n), new Int32Array(33 * n)];
        for (let i = 0; i < 33 * n; i++) { t[0][i] = r(); t[1][i] = r(); }
        zTables.set(n, t);
      }
      zN = n; [ZB1, ZB2] = t;
    }
    const key = () => (h1 >>> 0) + (h2 & 0xfffff) * 4294967296;

    // ゲームの状態 g (またはその盤と持ち駒と手番) を探索用に写す
    function load(g) {
      R = g.board.length; N = R * COLS;
      zobrist(N);
      if (bd.length !== N) bd = new Int8Array(N);
      hand.fill(0); pawnFile.fill(0); kingSq[0] = kingSq[1] = -1;
      mat = 0; h1 = 0; h2 = 0;
      for (let y = 0; y < R; y++) for (let x = 0; x < COLS; x++) {
        const p = g.board[y][x], s = y * COLS + x;
        if (!p) { bd[s] = 0; continue; }
        const k = KIND[p.type] + (p.promoted ? 8 : 0), c = codeOf(k, p.owner);
        bd[s] = c;
        h1 ^= ZB1[c * N + s]; h2 ^= ZB2[c * N + s];
        mat += (p.owner === 0 ? 1 : -1) * VAL[k];
        if (k === 0) kingSq[p.owner] = s;
        if (k === 7) pawnFile[p.owner * 9 + x]++;
      }
      for (let o = 0; o < 2; o++) for (const t of Object.keys(g.hands[o])) {
        const b = KIND[t], n = g.hands[o][t].n;
        hand[o * 8 + b] = n;
        h1 ^= ZH1[(o * 8 + b) * 41 + n]; h2 ^= ZH2[(o * 8 + b) * 41 + n];
        mat += (o === 0 ? 1 : -1) * VAL[b] * n;
      }
      side = g.turn;
      if (side) { h1 ^= ZS1; h2 ^= ZS2; }
    }

    // ---------- 手 ----------
    // 手は数 1 つ: from + to × 1024 + 成り × 2^20 + 打つ駒の種類 × 2^21 (打つ手は from = to)
    const mFrom = (m) => m & 1023, mTo = (m) => (m >> 10) & 1023, mPro = (m) => (m >> 20) & 1, mDrop = (m) => m >> 21;
    const mk = (f, t, p, d) => f | (t << 10) | (p << 20) | (d << 21);
    const inZone = (o, y) => (o === 0 ? y < ZONE : y >= R - ZONE);
    // 成らないと動けなくなる段か (歩・香の最後の段、桂の最後の 2 段)。lastY は陣営から見た残りの段 (0 が最後)
    const mustB = (b, last) => ((b === 7 || b === 6) && last === 0) || (b === 5 && last <= 1);
    const lastOf = (o, y) => (o === 0 ? y : R - 1 - y);

    // 取った駒の記録 (戻すため)
    const capStack = new Int8Array(512);
    let sp = 0;
    function make(m) {
      const t = mTo(m), d = mDrop(m), o = side, sg = o === 0 ? 1 : -1;
      if (d) {
        const c = codeOf(d, o), hi = o * 8 + d, n = hand[hi];
        h1 ^= ZH1[hi * 41 + n] ^ ZH1[hi * 41 + n - 1]; h2 ^= ZH2[hi * 41 + n] ^ ZH2[hi * 41 + n - 1];
        hand[hi] = n - 1;
        bd[t] = c; h1 ^= ZB1[c * N + t]; h2 ^= ZB2[c * N + t];
        if (d === 7) pawnFile[o * 9 + t % COLS]++;
        capStack[sp++] = 0;
      } else {
        const f = mFrom(m), c = bd[f], k = kindOf(c), q = bd[t];
        capStack[sp++] = q;
        if (q) {
          const qk = kindOf(q), b = baseOf(qk), hi = o * 8 + b, n = hand[hi];
          h1 ^= ZB1[q * N + t]; h2 ^= ZB2[q * N + t];
          h1 ^= ZH1[hi * 41 + n] ^ ZH1[hi * 41 + n + 1]; h2 ^= ZH2[hi * 41 + n] ^ ZH2[hi * 41 + n + 1];
          hand[hi] = n + 1;
          mat += sg * (VAL[qk] + VAL[b]);  // 相手の駒が消え (−(−))、持ち駒が増える
          if (qk === 7) pawnFile[(1 - o) * 9 + t % COLS]--;
          if (qk === 0) kingSq[1 - o] = -1;
        }
        const nc = mPro(m) ? c + 8 : c;
        bd[f] = 0; bd[t] = nc;
        h1 ^= ZB1[c * N + f] ^ ZB1[nc * N + t]; h2 ^= ZB2[c * N + f] ^ ZB2[nc * N + t];
        if (mPro(m)) { mat += sg * (VAL[k + 8] - VAL[k]); if (k === 7) pawnFile[o * 9 + f % COLS]--; }
        if (k === 0) kingSq[o] = t;
      }
      side = 1 - side; h1 ^= ZS1; h2 ^= ZS2;
    }
    function unmake(m) {
      side = 1 - side; h1 ^= ZS1; h2 ^= ZS2;
      const t = mTo(m), d = mDrop(m), o = side, sg = o === 0 ? 1 : -1;
      const q = capStack[--sp];
      if (d) {
        const c = codeOf(d, o), hi = o * 8 + d, n = hand[hi];
        h1 ^= ZH1[hi * 41 + n] ^ ZH1[hi * 41 + n + 1]; h2 ^= ZH2[hi * 41 + n] ^ ZH2[hi * 41 + n + 1];
        hand[hi] = n + 1;
        bd[t] = 0; h1 ^= ZB1[c * N + t]; h2 ^= ZB2[c * N + t];
        if (d === 7) pawnFile[o * 9 + t % COLS]--;
      } else {
        const f = mFrom(m), nc = bd[t], c = mPro(m) ? nc - 8 : nc, k = kindOf(c);
        bd[t] = q; bd[f] = c;
        h1 ^= ZB1[c * N + f] ^ ZB1[nc * N + t]; h2 ^= ZB2[c * N + f] ^ ZB2[nc * N + t];
        if (mPro(m)) { mat -= sg * (VAL[k + 8] - VAL[k]); if (k === 7) pawnFile[o * 9 + f % COLS]++; }
        if (k === 0) kingSq[o] = f;
        if (q) {
          const qk = kindOf(q), b = baseOf(qk), hi = o * 8 + b, n = hand[hi];
          h1 ^= ZB1[q * N + t]; h2 ^= ZB2[q * N + t];
          h1 ^= ZH1[hi * 41 + n] ^ ZH1[hi * 41 + n - 1]; h2 ^= ZH2[hi * 41 + n] ^ ZH2[hi * 41 + n - 1];
          hand[hi] = n - 1;
          mat -= sg * (VAL[qk] + VAL[b]);
          if (qk === 7) pawnFile[(1 - o) * 9 + t % COLS]++;
          if (qk === 0) kingSq[1 - o] = t;
        }
      }
    }

    // マス s に、陣営 by の駒の利きがあるか (s から外へ 8 方向を見て最初の駒と、桂馬の 2 マス)
    function attackedBy(s, by) {
      const x = s % COLS, y = (s / COLS) | 0;
      for (let i = 0; i < 8; i++) {
        // 外へ向かう向き: DIRS[i] の反対。そこにいる駒が DIRS[i] の向き (盤の上で) に k マス以上届けば利いている
        const dx = -DIRS[i][0], dy = -DIRS[i][1];
        let nx = x + dx, ny = y + dy, k = 1;
        while (nx >= 0 && nx < COLS && ny >= 0 && ny < R) {
          const c = bd[ny * COLS + nx];
          if (c) { if (ownerOf(c) === by && ATK[c][i] >= k) return true; break; }
          nx += dx; ny += dy; k++;
        }
      }
      // 桂馬: 先手の桂は (±1, −2) へ跳ぶので、(x ∓ 1, y + 2) から利く。後手は反対
      const ky = by === 0 ? y + 2 : y - 2, kn = codeOf(5, by);
      if (ky >= 0 && ky < R) {
        if (x > 0 && bd[ky * COLS + x - 1] === kn) return true;
        if (x < COLS - 1 && bd[ky * COLS + x + 1] === kn) return true;
      }
      return false;
    }
    const inCheckNow = (o) => kingSq[o] >= 0 && attackedBy(kingSq[o], 1 - o);
    // 指した側 (side の反対) の玉が取られる形か (反則)
    const leftInCheck = () => { const o = 1 - side; return kingSq[o] >= 0 && attackedBy(kingSq[o], side); };

    // 盤の上の駒の手を list に足す (capsOnly: 駒を取る手だけ)。成れる歩・角・飛は成る手だけ (成らない手はほぼ損なので省く)
    function genBoard(list, capsOnly) {
      const o = side;
      for (let s = 0; s < N; s++) {
        const c = bd[s];
        if (!c || ownerOf(c) !== o) continue;
        const k = kindOf(c), x = s % COLS, y = (s / COLS) | 0, steps = STEPS[o][k];
        const promotable = k < 8 && CAN_PROMO[k], fz = promotable && inZone(o, y);
        for (let j = 0; j < steps.length; j++) {
          const st = steps[j], dx = st[0], dy = st[1], n = st[2];
          let nx = x + dx, ny = y + dy;
          for (let r = 0; r < n && nx >= 0 && nx < COLS && ny >= 0 && ny < R; r++, nx += dx, ny += dy) {
            const t = ny * COLS + nx, q = bd[t];
            if (q && ownerOf(q) === o) break;
            if (q || !capsOnly) {
              if (promotable && (fz || inZone(o, ny))) {
                list.push(mk(s, t, 1, 0));
                if (!mustB(k, lastOf(o, ny)) && k !== 7 && k !== 1 && k !== 2) list.push(mk(s, t, 0, 0));
              } else list.push(mk(s, t, 0, 0));
            }
            if (q) break;
          }
        }
      }
    }
    // 打つ手。マスの印 (stamp) を付けたマスにだけ打つ
    const stamp = new Int32Array(729);
    let stampN = 1;
    function markRing(s, rad) {
      if (s < 0) return;
      const x = s % COLS, y = (s / COLS) | 0;
      for (let yy = Math.max(0, y - rad); yy <= Math.min(R - 1, y + rad); yy++)
        for (let xx = Math.max(0, x - rad); xx <= Math.min(COLS - 1, x + rad); xx++) stamp[yy * COLS + xx] = stampN;
    }
    // 玉 s から 8 方向に、空いているマスを駒に当たるまで印 (王手の合駒、遠くからの王手)
    function markRays(s) {
      if (s < 0) return;
      const x = s % COLS, y = (s / COLS) | 0;
      for (let i = 0; i < 8; i++) {
        const dx = DIRS[i][0], dy = DIRS[i][1];
        for (let nx = x + dx, ny = y + dy; nx >= 0 && nx < COLS && ny >= 0 && ny < R; nx += dx, ny += dy) {
          const t = ny * COLS + nx;
          if (bd[t]) break;
          stamp[t] = stampN;
        }
      }
      // 桂馬で王手できるマス (両方の陣営の向きの 4 マス。多めでよい)
      for (const [dx, dy] of [[1, 2], [-1, 2], [1, -2], [-1, -2]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < R) stamp[ny * COLS + nx] = stampN;
      }
    }
    function genDrops(list) {
      const o = side;
      let any = false;
      for (let b = 1; b < 8; b++) if (hand[o * 8 + b]) any = true;
      if (!any) return;
      for (let s = 0; s < N; s++) {
        if (stamp[s] !== stampN || bd[s]) continue;
        const x = s % COLS, last = lastOf(o, (s / COLS) | 0);
        for (let b = 1; b < 8; b++) {
          if (!hand[o * 8 + b] || mustB(b, last)) continue;
          if (b === 7 && pawnFile[o * 9 + x]) continue;
          list.push(mk(s, s, 0, b));
        }
      }
    }
    // 打ち歩詰め: 歩を打って王手し、相手に指せる手がないか (打つ手では歩の王手は防げないので、盤の上の手だけ見る)
    function pawnDropMate(m) {
      const o = 1 - side, t = mTo(m), ek = kingSq[side];  // (歩を打ったあと。side は相手)
      if (ek < 0 || ek !== t + (o === 0 ? -COLS : COLS)) return false;
      const list = [];
      genBoard(list, false);
      for (const mv of list) { make(mv); const bad = leftInCheck(); unmake(mv); if (!bad) return false; }
      return true;
    }
    // 手番の側に指せる手があるか (打つ手は全部のマスで見る。詰みの確認用)
    function hasLegal() {
      const list = [];
      genBoard(list, false);
      stampN++; stamp.fill(stampN, 0, N);
      genDrops(list);
      for (const mv of list) {
        make(mv); const bad = leftInCheck() || (mDrop(mv) === 7 && pawnDropMate(mv)); unmake(mv);
        if (!bad) return true;
      }
      return false;
    }

    // ---------- 形勢の点 (手番から見て) ----------
    // 駒の点 + 相手の玉への近さ (遠い盤でも前へ出る) + 玉の周り 2 マスに入った駒 + 持ち駒 (攻めに使える) + 自分の玉の守り
    const NEAR = [60, 45, 25, 10];
    function evaluate() {
      let s = mat;
      const k0 = kingSq[0], k1 = kingSq[1];
      const kx = [k0 % COLS, k1 % COLS], ky = [(k0 / COLS) | 0, (k1 / COLS) | 0];
      for (let q = 0; q < N; q++) {
        const c = bd[q];
        if (!c) continue;
        const k = kindOf(c);
        if (k === 0) continue;
        const o = ownerOf(c), e = 1 - o, sg = o === 0 ? 1 : -1;
        const x = q % COLS, y = (q / COLS) | 0;
        let v = 0;
        if (kingSq[e] >= 0) {
          const d = Math.max(Math.abs(x - kx[e]), Math.abs(y - ky[e]));
          v += (R - d) * 2 + (d <= 3 ? NEAR[d] : 0);
        }
        // 金・銀は自分の玉のそばにいると少しよい (守り)
        if ((k === 3 || k === 4) && kingSq[o] >= 0 && Math.max(Math.abs(x - kx[o]), Math.abs(y - ky[o])) <= 1) v += 15;
        s += sg * v;
      }
      for (let b = 1; b < 8; b++) s += (hand[b] - hand[8 + b]) * 15;
      return side === 0 ? s : -s;
    }

    // ---------- 探索 ----------
    const MATE = 1000000, MAXPLY = 64;
    const tt = new Map();  // 局面の印 → { depth, score, flag (0 ちょうど 1 下限 2 上限), move }
    const killers = Array.from({ length: MAXPLY + 1 }, () => [0, 0]);
    const path = new Float64Array(MAXPLY + 2);
    let hist = new Map();  // ゲームで出た局面の印 → 回数
    let nodes = 0, deadline = 0, aborted = false;
    const ABORT = {};
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const lists = Array.from({ length: MAXPLY + 2 }, () => []);
    const keysA = Array.from({ length: MAXPLY + 2 }, () => []);

    // 手の順の点: 駒を取る手 (取られる駒が高く、取る駒が安いほど先)、成り、キラー、玉に近づく手
    function orderKey(m, ttm, ply) {
      if (m === ttm) return 1e9;
      const t = mTo(m), d = mDrop(m), q = bd[t];
      if (q) return 1e7 + VAL[kindOf(q)] * 16 - (d ? 0 : VAL[kindOf(bd[mFrom(m)])] / 16);
      if (mPro(m)) return 5e6 + VAL[kindOf(bd[mFrom(m)]) + 8];
      const kl = killers[ply];
      if (m === kl[0]) return 4e6;
      if (m === kl[1]) return 3.9e6;
      const ek = kingSq[1 - side];
      if (ek < 0) return 0;
      const ex = ek % COLS, ey = (ek / COLS) | 0, tx = t % COLS, ty = (t / COLS) | 0;
      const dt = Math.max(Math.abs(tx - ex), Math.abs(ty - ey));
      if (d) return 1000 - dt * 50;
      const f = mFrom(m), fx = f % COLS, fy = (f / COLS) | 0;
      return 500 + (Math.max(Math.abs(fx - ex), Math.abs(fy - ey)) - dt) * 30;
    }
    // list の i 番目から後ろで一番よい手を i 番目へ (選びながら並べる)
    function pick(list, keys, i) {
      let b = i;
      for (let j = i + 1; j < list.length; j++) if (keys[j] > keys[b]) b = j;
      if (b !== i) { let t = list[i]; list[i] = list[b]; list[b] = t; t = keys[i]; keys[i] = keys[b]; keys[b] = t; }
    }
    // 千日手の形 (探索の道筋か、ゲームですでに出た局面) なら引き分け (0)
    function repeated(ply) {
      const k = path[ply];
      for (let j = ply - 2; j >= 0; j -= 2) if (path[j] === k) return true;
      return hist.has(k);
    }

    function qsearch(alpha, beta, ply, qply) {
      if ((++nodes & 1023) === 0 && now() > deadline) throw ABORT;
      const check = inCheckNow(side);
      if (ply >= MAXPLY) return evaluate();
      const list = lists[ply], keys = keysA[ply];
      list.length = 0; keys.length = 0;
      let best;
      if (check) {
        // 王手を受けているときは逃げ方を全部 (打つ手は玉の筋 / 段 / 斜めの合駒だけ)。深すぎれば止める
        if (qply >= 4) return evaluate();
        genBoard(list, false);
        stampN++; markRays(kingSq[side]); genDrops(list);
        best = -MATE + ply;
      } else {
        best = evaluate();
        if (best >= beta) return best;
        if (best > alpha) alpha = best;
        genBoard(list, true);
      }
      for (let i = 0; i < list.length; i++) keys.push(orderKey(list[i], 0, ply));
      for (let i = 0; i < list.length; i++) {
        pick(list, keys, i);
        const m = list[i];
        make(m);
        if (leftInCheck() || (mDrop(m) === 7 && pawnDropMate(m))) { unmake(m); continue; }
        const sc = -qsearch(-beta, -alpha, ply + 1, qply + 1);
        unmake(m);
        if (sc > best) { best = sc; if (sc > alpha) { alpha = sc; if (sc >= beta) break; } }
      }
      return best;
    }

    function search(depth, alpha, beta, ply) {
      if ((++nodes & 1023) === 0 && now() > deadline) throw ABORT;
      path[ply] = key();
      if (ply > 0 && repeated(ply)) return 0;
      const check = inCheckNow(side);
      if (check && ply < MAXPLY - 8) depth++;  // 王手を受けたら 1 手延ばす
      if (depth <= 0 || ply >= MAXPLY - 4) return qsearch(alpha, beta, ply, 0);
      const k = path[ply], e = tt.get(k);
      let ttm = 0;
      if (e) {
        ttm = e.move;
        if (e.depth >= depth && ply > 0) {
          if (e.flag === 0) return e.score;
          if (e.flag === 1 && e.score >= beta) return e.score;
          if (e.flag === 2 && e.score <= alpha) return e.score;
        }
      }
      const list = [], keys = [];
      genBoard(list, false);
      // 打つ手: 王手を受けていれば玉の筋 / 段 / 斜め (合駒)。そうでなければ相手の玉の周り 2 マスと、相手の玉への王手になる筋
      stampN++;
      if (check) markRays(kingSq[side]);
      else { markRing(kingSq[1 - side], 2); markRays(kingSq[1 - side]); }
      genDrops(list);
      for (let i = 0; i < list.length; i++) keys.push(orderKey(list[i], ttm, ply));
      const a0 = alpha;
      let best = -MATE + ply, bestM = 0, legal = 0;
      for (let i = 0; i < list.length; i++) {
        pick(list, keys, i);
        const m = list[i];
        make(m);
        if (leftInCheck() || (mDrop(m) === 7 && pawnDropMate(m))) { unmake(m); continue; }
        legal++;
        let sc;
        if (legal === 1) sc = -search(depth - 1, -beta, -alpha, ply + 1);
        else {
          sc = -search(depth - 1, -alpha - 1, -alpha, ply + 1);  // (PVS: まず窓を狭く)
          if (sc > alpha && sc < beta) sc = -search(depth - 1, -beta, -alpha, ply + 1);
        }
        unmake(m);
        if (sc > best) {
          best = sc; bestM = m;
          if (sc > alpha) {
            alpha = sc;
            if (sc >= beta) {
              if (!bd[mTo(m)] && !mDrop(m) && killers[ply][0] !== m) { killers[ply][1] = killers[ply][0]; killers[ply][0] = m; }
              break;
            }
          }
        }
      }
      if (!legal) {
        // 指せる手がない: 王手を受けていれば詰み。王手でなくても、省いた打つ手を含めて本当に手がなければ負け (ゲームのルール)
        if (check || !hasLegal()) return -MATE + ply;
        return evaluate();
      }
      if (tt.size > 300000) tt.clear();
      tt.set(k, { depth, score: best, flag: best >= beta ? 1 : best <= a0 ? 2 : 0, move: bestM });
      return best;
    }

    // ゲームの局面の文字 (g.hist の鍵) → 印。何度も使うので覚えておく
    const histCache = new Map();
    function histKey(s) {
      let v = histCache.get(s);
      if (v === undefined) {
        // (今の局面を取っておいて読み込み、印を取ったら戻す。盤の大きさが違う局面でもよいよう、盤の配列と大きさごと戻す)
        const save = { R, N, bd: bd.slice(), hand: hand.slice(), pawnFile: pawnFile.slice(), k0: kingSq[0], k1: kingSq[1], side, mat, h1, h2 };
        load(parseGame(s + '-0'));
        v = key();
        R = save.R; N = save.N; zobrist(N); bd = save.bd;
        hand.set(save.hand); pawnFile.set(save.pawnFile); kingSq[0] = save.k0; kingSq[1] = save.k1;
        side = save.side; mat = save.mat; h1 = save.h1; h2 = save.h2;
        if (histCache.size > 20000) histCache.clear();
        histCache.set(s, v);
      }
      return v;
    }

    // ゲームの手 → 探索の手
    const toInt = (mv) => (mv.drop ? mk(mv.to[1] * COLS + mv.to[0], mv.to[1] * COLS + mv.to[0], 0, KIND[mv.drop])
      : mk(mv.from[1] * COLS + mv.from[0], mv.to[1] * COLS + mv.to[0], mv.promote ? 1 : 0, 0));

    // CPU の手: 指せる手 (legalMoves) から、時間 timeMs の間 深さを 1 つずつ増やして読み、一番よい手を返す。
    // 返す手は必ず legalMoves の中の手。info に読んだ深さ・点・局面の数を入れる
    let lastInfo = null;
    function searchMove(g, timeMs = 30) {
      const t0 = now();
      const me = g.turn, all = legalMoves(g, me);
      if (all.length <= 1) { lastInfo = { depth: 0, score: 0, nodes: 0, ms: now() - t0 }; return all[0] || null; }
      zobrist(g.board.length * COLS);
      // ゲームで出た局面
      hist = new Map();
      if (g.hist) for (const [s, n] of Object.entries(g.hist)) hist.set(histKey(s), n);
      load(g);
      sp = 0;
      const check = inCheckNow(me);
      // 根の打つ手は、相手の玉の周り 3 マス、自分の玉の周り 2 マス、相手の玉への王手の筋、王手を受けていれば合駒 (全部)
      stampN++;
      if (check) markRays(kingSq[me]);
      else { markRing(kingSq[1 - me], 3); markRing(kingSq[me], 2); markRays(kingSq[1 - me]); }
      let root = [];
      for (const mv of all) {
        const m = toInt(mv);
        if (mv.drop && stamp[mTo(m)] !== stampN) continue;
        // 成れる歩・角・飛の成らない手は省く (行き所のない駒は legalMoves で除いてある)
        if (!mv.drop && !mv.promote) {
          const k = kindOf(bd[mFrom(m)]);
          if ((k === 7 || k === 1 || k === 2) && all.some((o) => o.promote && o.from[0] === mv.from[0] && o.from[1] === mv.from[1] && o.to[0] === mv.to[0] && o.to[1] === mv.to[1])) continue;
        }
        // 同じ局面が 4 回目になる (千日手) 手は、ほかに手がある限り指さない
        make(m);
        const seen = hist.get(key()) || 0;
        unmake(m);
        root.push({ mv, m, seen, score: 0 });
      }
      if (!root.length) root = all.map((mv) => ({ mv, m: toInt(mv), seen: 0, score: 0 }));
      const ok = root.filter((r) => r.seen < 3);
      if (ok.length) root = ok;
      // 同じ点の手からはばらばらに選ぶ (並べ替えの前に混ぜる)
      for (let i = root.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [root[i], root[j]] = [root[j], root[i]]; }
      for (const r of root) r.score = orderKey(r.m, 0, 0);
      root.sort((a, b) => b.score - a.score);
      for (const k of killers) k[0] = k[1] = 0;
      nodes = 0; deadline = t0 + timeMs;
      let best = root[0], bestScore = -Infinity, depth = 0;
      try {
        for (let d = 1; d <= 20; d++) {
          let alpha = -MATE - 1, iterBest = null;
          path[0] = key();
          for (let i = 0; i < root.length; i++) {
            const r = root[i];
            make(r.m);
            let sc;
            if (i === 0) sc = -search(d - 1, -MATE - 1, -alpha, 1);
            else {
              sc = -search(d - 1, -alpha - 1, -alpha, 1);
              if (sc > alpha) sc = -search(d - 1, -MATE - 1, -alpha, 1);
            }
            unmake(r.m);
            r.score = sc;
            if (sc > alpha) { alpha = sc; iterBest = r; }
            // (途中で時間切れになっても、最初の手 (前の深さの一番) を読み終えていれば、ここまでの一番を使う)
            if (i === 0) { best = r; bestScore = sc; } else if (iterBest === r) { best = r; bestScore = sc; }
          }
          depth = d;
          // 次の深さのため、点の順に並べ替える (読み終えなかった手は後ろ)
          root.sort((a, b) => b.score - a.score);
          if (bestScore >= MATE - 100) break;  // 詰みが見えた
          if (now() - t0 > timeMs * 0.45) break;  // 次の深さはたぶん間に合わない
        }
      } catch (e) {
        if (e !== ABORT) throw e;
        // 盤を元に戻す (探索の途中で止まったので、ゲームから写し直す)
        load(g);
      }
      lastInfo = { depth, score: bestScore, nodes, ms: now() - t0 };
      return best.mv;
    }
    return { searchMove, info: () => lastInfo, evaluateGame: (g) => { load(g); return evaluate(); } };
  }
  const searcher = makeSearch({ legalMoves, parseGame, value, COLS, ZONE });
  const LEVEL_MS = { normal: 30, strong: 100 };  // CPU の強さごとの考える時間 (ミリ秒)。easy は cpuMove
  // (先を読む CPU は「玉は取られない (詰みで決まる)」として読むので、置き直しなどで玉が取れる形なら、強さによらずまず玉を取る)
  function levelMove(g, level) {
    if (!LEVEL_MS[level]) return cpuMove(g);
    const take = legalMoves(g, g.turn).find((mv) => captureOf(g.board, mv)?.type === 'K');
    return take || searcher.searchMove(g, LEVEL_MS[level]);
  }

  // ---------- ページ ----------
  // 効果音: 駒を打つ「パチッ」をその場で作る (音声ファイルは使わない)。短いノイズ (打った瞬間) に木の響き (短い減衰音) と低い音 (盤の鳴り) を重ねる。
  // tap: 指す、take: 取る (低く重く)、win: 勝敗が決まった (短い 2 音)。
  // ブラウザの決まりで、ページを一度も触っていないうちは音が出せない (最初の pointerdown / keydown で準備し、止まっていたら動かす)。
  // 音の あり / なし は全部の盤で共通で、なしにしたことを localStorage に覚える
  const SOUND_KEY = '3d-browser-ns-sound';
  let soundOn = localStorage.getItem(SOUND_KEY) !== 'off';
  let actx = null, lastSfx = -1;
  const SFX_GAP = 1 / 12;  // 続けて鳴らすときの最短の間 (秒。×8 や早送りで鳴りすぎないように)
  function audio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!actx) actx = new AC();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (soundOn) audio(); }, { capture: true, passive: true });
  function setSound(on) {
    soundOn = on;
    if (on) localStorage.removeItem(SOUND_KEY); else localStorage.setItem(SOUND_KEY, 'off');
  }
  // 音を鳴らす。vol: 大きさ (0〜1)
  function sfx(kind, vol = 1) {
    if (!soundOn) return;
    const c = audio();
    if (!c || c.state !== 'running') return;
    const t0 = c.currentTime;
    if (kind !== 'win') { if (t0 - lastSfx < SFX_GAP) return; lastSfx = t0; }
    // 減衰する音を 1 つ鳴らす (freq → freq × slide まで下がりながら、dur 秒で消える)
    const tone = (type, freq, slide, dur, gain, at = 0) => {
      const o = c.createOscillator(), gn = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0 + at); o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + at + dur);
      gn.gain.setValueAtTime(gain * vol, t0 + at); gn.gain.exponentialRampToValueAtTime(0.001, t0 + at + dur);
      o.connect(gn).connect(c.destination); o.start(t0 + at); o.stop(t0 + at + dur + 0.02);
    };
    // 短いノイズ (dur 秒、freq より上だけ)
    const click = (dur, freq, gain) => {
      const n = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain();
      src.buffer = buf; f.type = 'highpass'; f.frequency.value = freq; gn.gain.value = gain * vol;
      src.connect(f).connect(gn).connect(c.destination); src.start(t0); src.stop(t0 + dur + 0.02);
    };
    if (kind === 'tap') { click(0.012, 2500, 0.5); tone('triangle', 1400, 0.6, 0.05, 0.35); tone('sine', 190, 0.5, 0.07, 0.4); }
    else if (kind === 'take') { click(0.018, 1800, 0.6); tone('triangle', 900, 0.5, 0.08, 0.4); tone('sine', 140, 0.5, 0.11, 0.55); }
    else if (kind === 'win') { tone('sine', 660, 1, 0.14, 0.22, 0.15); tone('sine', 880, 1, 0.28, 0.22, 0.29); }  // 取った音のあとに
  }

  function renderShogi(tab, api) {
    const { t } = api;
    const page = document.createElement('div');
    page.className = 'sg';
    page.innerHTML = `<canvas></canvas>
      <div class="sg-promo" hidden><button class="yes"></button><button class="no"></button></div>
      <div class="sg-over" hidden><span></span><div class="sg-caps"></div><button></button></div>
      <div class="sg-begin" hidden><button data-begin></button><button data-config></button></div>
      <div class="sg-text" hidden><textarea spellcheck="false"></textarea><div class="sg-text-msg"></div><div class="sg-text-btns"><button data-act="copy"></button><button data-act="url"></button><button data-act="load"></button><button data-act="close"></button></div></div>`;
    tab.pane.appendChild(page);
    const canvas = page.querySelector('canvas'), ctx = canvas.getContext('2d');
    // 正面のブラウザで開いたら、箱の高さを盤に合わせて全体を見せる (スマホの中ならそのまま)
    // 盤の種類: 中盤 (9 × 27。最初はこれ)、通常 (9 × 9)、長盤 (9 × 81。箱 3718 で盤はちょうど入る)。パネルで選べるのは正面のブラウザのときだけで、対局を始める前 (0 手目) だけ。
    // h: 幅 420 で盤がちょうど入る高さ (段 ×43.56 + 190)。長盤は入りきらない (10,775) ので、箱は [全体] の上限の高さにして、盤は帯の間でスクロール
    const BOARDS = { normal: { rows: 9, h: 582 }, mid: { rows: 27, h: 1366 }, tall: { rows: TALL_ROWS, h: 3718 } };  // (高さは 段 × 43.56 + 190)
    const front = api.face()?.classList.contains('front') && !api.look();
    let board = 'mid';
    // 箱の大きさ (正面のブラウザだけ)。全体を見せるときは画面の高さの 96% まで使う (上下がぎりぎりまで大きく)。
    // 幅の狭い画面 (スマホ) では箱が画面の上下のボタンに重なるので、本体と同じ 85%
    const FILL = matchMedia('(min-width: 700px)').matches ? 0.96 : 0.85;
    if (front) api.setBoxSize(420, BOARDS[board].h, FILL);
    // ガラスのスマホの中では、ふつうの 9 × 9 でガラスの盤 (盤の外も透明で、透けた本体の上に盤が浮いて見える)
    const glass = api.lookGlass();
    let ROWS = glass ? 9 : BOARDS[board].rows;
    // lPhone など (ガラスでないスマホ) の中: 画面にちょうど入る段数の盤 (正方形のマス)。段数は画面の大きさがわかってから決める (fitRows)
    const fit = !front && !glass && !!api.look();
    page.classList.toggle('sg-glass', glass);
    const q = (s) => page.querySelector(s);
    const R = 2;

    let g = newGame(ROWS);
    // 陣営ごとに、人か CPU か (cpu[side]: true なら CPU)。最初はどちらも CPU (観戦。指したい陣営をスイッチで人にする)
    const cpu = [true, true];
    const debug = !!api.debug?.();  // 開発モード (?debug)
    // 表示 (全体 / 自軍 / 敵軍) のボタンは今は出さない (機能は保留。URL に views があれば出す。テスト用)
    const views = new URLSearchParams(location.search).has('views');
    const humanTurn = () => g.winner === null && !cpu[g.turn];  // 人が指す番
    // 速さ: 再生 / 停止 (paused) と倍率 (rate: ×1 〜 ×32。ドロップボックスで選ぶ。最初は ×8)。停止で始める (人が指せば動き出す)。
    // speed: いまの倍率 (停止中は 0)、sel: 人が選んでいる持ち駒 { side, key }、
    // pick: 人が選んでいる盤の駒 { from: [x, y] }、pending: 成るか成らないかを選んでいる手
    let paused = true, rate = 8, speed = 0, wait = 0, sel = null, pick = null, pending = null;
    // 指した手の前の状態 (コマ戻し用)。手を指す直前に対局の状態をまるごと写して積む (500 手まで)
    let past = [];
    const PAST_MAX = 500;
    const setSpeed = () => { speed = paused ? 0 : rate; };
    const RATES = [1, 2, 4, 8, 16, 32];
    const showPlan = () => speed <= 2;  // ×1・×2 は動かす駒を見せてから指す。×4 からはすぐ指す
    const watching = () => cpu[0] && cpu[1];  // 全部 CPU に任せて眺めている
    let plan = null;  // CPU が指そうとしている手 { mv, wait } (動かす駒を見せてから指す)
    // 駒が動いた軌跡 { mv, side, age: 指してからの秒数 }。TRAIL_HOLD 秒ははっきり見せ、そのあと TRAIL_FADE 秒で薄くして消す。
    // 速さの倍率によらず実際の秒数で消す (×8 では何本か重なって、駒の流れが見える)。多すぎないよう TRAIL_MAX 本まで
    let trails = [];
    const TRAIL_HOLD = 0.5, TRAIL_FADE = 2.5, TRAIL_MAX = 24;
    // 残像の あり / なし (パネルのスイッチ。なしにしたことを localStorage に覚える)
    const TRAIL_KEY = '3d-browser-sg-trails';
    let trailsOn = localStorage.getItem(TRAIL_KEY) !== 'off';
    // 取ったコマ数を表示 (勝敗のときの取った数の表。前の名は駒カウント・戦績表) の あり / なし (同じく localStorage に覚える。数えるのはいつも)
    // CPU の強さ (よわい / ふつう / 強い) を陣営ごとに [先手, 後手]。どちらもふつうでなければ localStorage に「先手,後手」で覚える
    const LEVEL_KEY = '3d-browser-sg-cpu', LEVELS = ['easy', 'normal', 'strong'];
    const level = (localStorage.getItem(LEVEL_KEY) || '').split(',').concat('normal', 'normal').slice(0, 2).map((v) => (LEVELS.includes(v) ? v : 'normal'));
    const saveLevel = () => { if (level.every((v) => v === 'normal')) localStorage.removeItem(LEVEL_KEY); else localStorage.setItem(LEVEL_KEY, level.join(',')); };
    const CAPS_KEY = '3d-browser-sg-caps';
    let capsOn = localStorage.getItem(CAPS_KEY) !== 'off';
    // 停止時にコマを動かせる (停止中に盤の駒や持ち駒をドラッグで自由に置き直せる。開発モードと同じ仕組み。前の名はコマ移動・自由配置)。最初はなし (覚えない)
    let moveOn = false;
    // 取られた駒のアニメーション { p: 取られた駒, side: 取った側, at: マス, dir: 取った駒の進んだ向き (長さ 1), age, t1, t2, t3 }。
    // t1 秒で吹っ飛び (回りながら、手前へ跳ねたように大きく)、t2 秒で取った側の持ち駒の置き場所へ弧を描いて飛び (途中で向きが変わり、成り駒は元に戻る)、
    // t3 秒で置き場所で弾む。着くまでは、持ち駒の帯でその駒を数えない。玉は置き場所へ行かず、吹っ飛んで消える
    let flights = [];
    const flying = (side, key) => flights.filter((f) => f.side === side && f.key === key).length;
    let W = 0, H = 0, L = null;  // L: 盤の位置 { ox, oy, cw, ch, top, bottom }

    // ---------- 操作パネル (箱の外に飛び出す): 再生、1 手、表示、何手目、最初から、盤、陣営ごとの人 / CPU、音 ----------
    const panel = document.createElement('div');
    panel.className = 'sg-panel';
    const panelBox = api.floatPanel(panel, { icon: '☗', closed: true });  // 最初は出さない (PC でも)。「詳細設定」か右の縁のつまみで出す
    // 最初の表示: 盤の真ん中に大きく「はじめる」(再生と同じ) と「詳細設定」(操作パネルを開く。スマホではつまみの中にあるので)。
    // どちらかを押すか、盤を触るか、再生が始まると消える (一度きり)
    const begin = api.floatOver(q('.sg-begin'), canvas);
    begin.querySelector('[data-begin]').textContent = t('sgBegin');
    begin.querySelector('[data-config]').textContent = t('sgConfig');
    begin.hidden = false;
    begin.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      begin.hidden = true;
      if ('begin' in b.dataset) { if (paused) { paused = false; setSpeed(); controls(); } }
      else { panelBox.floatOpen?.(true); playHint(); }
    });
    page.addEventListener('pointerdown', () => { begin.hidden = true; }, true);  // 盤 (ページの中) を触ったら消す
    panelBox.addEventListener('floatopen', () => { begin.hidden = true; playHint(); });  // 右の縁のつまみで操作パネルを出したときも消す
    // 始める前 (停止中で 0 手目) にパネルを開いたら、再生ボタンを約 3 秒だけ光らせる (どこから始めるかわかるように)。パネルを触ったらすぐやめる
    let hintUntil = 0;
    function playHint() {
      if (!paused || g.moves) return;
      hintUntil = performance.now() + 3000;
      controls();
      clearTimeout(playHint.timer);
      playHint.timer = setTimeout(stopHint, 3000);
    }
    function stopHint() {
      hintUntil = 0;
      panel.querySelector('.sg-play')?.classList.remove('hint');
    }
    panel.addEventListener('pointerdown', stopHint, true);
    // 縦長の盤 (9×27・9×81) で開いたときは回転禁止にしておく (うっかり回さないように。盤を切り替えても付け外しはしない。レバーのダブルクリックや 🔒 で解除)
    if (front && board !== 'normal') api.noRotate(true);
    // 勝敗の表示 (取った数の表つき) は箱の手前、画面に見えている盤の真ん中に出す (縦長の盤を小さく見せていても読める大きさ)
    const over = api.floatOver(q('.sg-over'), canvas);
    function controls() {
      const seg = (attrs, label, on) => `<button ${attrs}${on ? ' class="on"' : ''}>${label}</button>`;
      // 陣営ごとの 自動 (CPU) のスイッチ: オン (つまみが右) が CPU、オフが人
      const sw = (side) => `<button class="sg-sw${cpu[side] ? ' on' : ''}" role="switch" aria-checked="${cpu[side]}" data-player="${side}">` +
        `<span class="t">${t(cpu[side] ? 'sgCpu' : 'sgHuman')}</span><span class="k"></span></button>`;
      // 陣営の名前 (人が指すなら金色) と 自動 のスイッチ。先手・後手を「自動」の行に並べ、対局のいちばん上 (再生の行の上) に置く
      const who = (side) => `<span class="sg-who${cpu[side] ? '' : ' me'}" data-who="${side}">${t(side === 0 ? 'sgSente' : 'sgGote')}</span><span class="sg-seg">${sw(side)}</span>` +
        `<select data-level="${side}" title="${t('sgLevelHint')}"${cpu[side] ? '' : ' disabled'}>` +
        LEVELS.map((k) => `<option value="${k}"${level[side] === k ? ' selected' : ''}>${t({ easy: 'sgEasy', normal: 'sgNormal', strong: 'sgStrong' }[k])}</option>`).join('') + '</select>';
      // 再生の行 (動画プレイヤー風のバー。左から): ▶⏸ 再生 / 停止 (両方の印。効くほうを明るく)、⏪ 戻す、⏩ 進む (1 手ずつ。長押しで早戻し・早送り。再生中に押せば止めてから)、
      // 速さ ×1 (ドロップボックスで ×1 〜 ×32 から選ぶ。止まっていれば次の再生から、再生中ならすぐ)。字は印だけで、説明はツールチップ
      // 3 つのまとまり: 「対局」(対局中に触るもの: 自動・再生・何手目・最初から)、「表示」(全体 / 自軍 / 敵軍。今は ?views のときだけ)、「設定」(最初に決めるもの: 盤、そして 音・残像・取ったコマ数を表示・停止時にコマを動かせる のスイッチ)
      const head = (key) => `<span class="sg-head">${t(key)}</span>`;
      panel.innerHTML = (debug ? `<span class="sg-debug">${t('sgDebug')}<button data-text>${t('sgBoardText')}</button></span>` : '') +
        head('sgGroupGame') +
        `<span>${t('sgAuto')}</span><span class="sg-auto">${who(0)}${who(1)}</span>` +  // 先手が上
        `<span>${t('sgPlayRow')}</span><span class="sg-bar">` +
        // (印のあとの ︎ は、絵文字 (色付きの四角) でなく字として出す指定)
        `<button class="sg-play${paused ? '' : ' on'}${performance.now() < hintUntil ? ' hint' : ''}" data-play title="${t(paused ? 'sgPlay' : 'sgPause')}">` +
        `<span class="i${paused ? ' now' : ''}">▶︎</span><span class="i${paused ? '' : ' now'}">⏸︎</span></button>` +
        `<button class="sg-ic sg-undo" title="${t('sgHoldUndo')}">⏪︎</button>` +
        `<button class="sg-ic sg-step" title="${t('sgHoldStep')}">⏩︎</button>` +
        `<select data-rate="${rate}" title="${t('sgSpeedHint')}">${RATES.map((r) => `<option value="${r}"${r === rate ? ' selected' : ''}>×${r}</option>`).join('')}</select></span>` +
        `<span class="sg-turn"></span>` +
        `<span class="sg-acts"><button class="sg-restart">${t('sgRestart')}</button></span>` +
        // 表示 (まとまり): 盤の全体 / 自分の陣地 / 相手の陣地のアップ (正面のブラウザのときだけ。ガラスのスマホは全体が見えていて、lPhone の中では拡大しないので、見出しごと出さない。
        // 今は ?views のときだけ出す)
        (!views || api.look() ? '' : head('sgView') + `<span class="sg-acts">` +
          `<button data-view="whole">${t('sgWhole')}</button><button data-view="mine">${t('sgMine')}</button><button data-view="theirs">${t('sgTheirs')}</button></span>`) +
        head('sgGroupSetup') +
        (front ? `<span>${t('sgBoard')}</span><span class="sg-seg" title="${t('sgBoardHint')}">` +
        Object.keys(BOARDS).map((k) => seg(`data-board="${k}"`, `9×${BOARDS[k].rows}`, board === k)).join('') + '</span>' :
        // スマホの中: 今の盤だけを見せる (選べない)
        `<span>${t('sgBoard')}</span><span class="sg-seg" title="${t('sgBoardFixed')}"><button class="on" data-board-fixed disabled>9×${ROWS}</button></span>`) +
        // スイッチの行 (盤の下に 1 行ずつ): 音 あり / なし (全部の盤で共通)、残像、取ったコマ数を表示 (取った数の表)、停止時にコマを動かせる (自由な置き直し)
        `<span class="sg-sides sg-fx"><span class="sg-opt" title="${t('sgSoundHint')}"><span>${t('sgSound')}</span><button class="sg-sw${soundOn ? ' on' : ''}" role="switch" aria-checked="${soundOn}" data-sound>` +
        `<span class="t">${t(soundOn ? 'sgOn' : 'sgOff')}</span><span class="k"></span></button></span>` +
        `<span class="sg-opt" title="${t('sgTrailHint')}"><span>${t('sgTrail')}</span><button class="sg-sw${trailsOn ? ' on' : ''}" role="switch" aria-checked="${trailsOn}" data-trail>` +
        `<span class="t">${t(trailsOn ? 'sgOn' : 'sgOff')}</span><span class="k"></span></button></span>` +
        `<span class="sg-opt" title="${t('sgCapsHint')}"><span>${t('sgCapsSw')}</span><button class="sg-sw${capsOn ? ' on' : ''}" role="switch" aria-checked="${capsOn}" data-caps>` +
        `<span class="t">${t(capsOn ? 'sgOn' : 'sgOff')}</span><span class="k"></span></button></span>` +
        `<span class="sg-opt" title="${t('sgMoveHint')}"><span>${t('sgMoveSw')}</span><button class="sg-sw${moveOn ? ' on' : ''}" role="switch" aria-checked="${moveOn}" data-move>` +
        `<span class="t">${t(moveOn ? 'sgOn' : 'sgOff')}</span><span class="k"></span></button></span></span>`;
      turnLabel();
    }
    // 何手目かの表示 (指すたびにパネルごと作り直すと、速いときにボタンが押せなくなるので、ここだけ書き換える)
    function turnLabel() {
      // 人が指す陣営があれば手番、全部 CPU なら観戦中
      panel.querySelector('.sg-turn').textContent = g.winner !== null ? ''
        : (watching() ? t('sgWatch', g.moves) : t('sgTurn', t(g.turn === 0 ? 'sgSente' : 'sgGote'))) + (inCheck(g.board, g.turn) ? t('sgCheck') : '');
      const step = panel.querySelector('.sg-step');
      if (step) step.disabled = g.winner !== null;
      const undo = panel.querySelector('.sg-undo');
      if (undo) undo.disabled = !past.length;
      for (const b of panel.querySelectorAll('[data-board]')) b.disabled = g.moves > 0;
    }
    // 速さ: ドロップボックスで選んだらすぐ (止まっていれば次の再生から)
    panel.addEventListener('change', (e) => {
      const lv = e.target.closest('select[data-level]');
      if (lv) { level[+lv.dataset.level] = lv.value; saveLevel(); return; }  // CPU の強さ (次の CPU の手から効く)
      const sel = e.target.closest('select[data-rate]');
      if (!sel) return;
      rate = +sel.value; setSpeed();
      sel.dataset.rate = rate;
    });
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if ('player' in b.dataset) {
        const side = +b.dataset.player;
        cpu[side] = !cpu[side];
        // CPU に任せたら、選んでいた駒や成るかの選択はやめる (その陣営の番だったら、CPU がすぐ考える)
        if (cpu[side]) { if (sel?.side === side) sel = null; if (g.turn === side) { pick = null; cancelPromo(); wait = 0; } }
        else if (g.turn === side) plan = null;
        // パネルを作り直さず、その場で切り替える (つまみが滑るように)
        b.classList.toggle('on', cpu[side]);
        b.setAttribute('aria-checked', cpu[side]);
        b.querySelector('.t').textContent = t(cpu[side] ? 'sgCpu' : 'sgHuman');
        panel.querySelector(`[data-who="${side}"]`).classList.toggle('me', !cpu[side]);
        panel.querySelector(`select[data-level="${side}"]`).disabled = !cpu[side];  // 人のときは強さを選べない
        return turnLabel();
      }
      else if ('play' in b.dataset) { paused = !paused; setSpeed(); drag = null; }
      else if ('text' in b.dataset) return openText();
      else if ('sound' in b.dataset) {
        setSound(!soundOn);
        b.classList.toggle('on', soundOn);
        b.setAttribute('aria-checked', soundOn);
        b.querySelector('.t').textContent = t(soundOn ? 'sgOn' : 'sgOff');
        if (soundOn) sfx('tap');  // ありにしたら、どんな音か 1 つ鳴らす
        return;
      }
      else if ('trail' in b.dataset) {
        trailsOn = !trailsOn;
        if (trailsOn) localStorage.removeItem(TRAIL_KEY); else { localStorage.setItem(TRAIL_KEY, 'off'); trails = []; }  // なしにしたら、出ている残像もすぐ消す
        b.classList.toggle('on', trailsOn);
        b.setAttribute('aria-checked', trailsOn);
        b.querySelector('.t').textContent = t(trailsOn ? 'sgOn' : 'sgOff');
        return;
      }
      else if ('caps' in b.dataset) {
        capsOn = !capsOn;
        if (capsOn) localStorage.removeItem(CAPS_KEY); else localStorage.setItem(CAPS_KEY, 'off');
        b.classList.toggle('on', capsOn);
        b.setAttribute('aria-checked', capsOn);
        b.querySelector('.t').textContent = t(capsOn ? 'sgOn' : 'sgOff');
        over.querySelector('.sg-caps').hidden = !capsOn;  // 勝敗の表示が出ていれば、その場で出し入れ
        return;
      }
      else if ('move' in b.dataset) {
        moveOn = !moveOn;
        b.classList.toggle('on', moveOn);
        b.setAttribute('aria-checked', moveOn);
        b.querySelector('.t').textContent = t(moveOn ? 'sgOn' : 'sgOff');
        drag = null;
        return;
      }
      else if (b.dataset.board) { if (board !== b.dataset.board && !g.moves) setBoard(b.dataset.board); return; }
      else if (b.classList.contains('sg-step') || b.classList.contains('sg-undo')) {
        // 長押しで続けて動かしたあとは、離したときのクリックでもう 1 手動かさない
        const held = hold?.fired;
        hold = null;
        if (held) return;
        drag = null;
        if (!paused) { paused = true; setSpeed(); controls(); }
        return b.classList.contains('sg-step') ? step() : undo();
      }
      else if (b.dataset.view) return b.dataset.view === 'whole' ? viewWhole() : viewSide(b.dataset.view === 'theirs');
      else if (b.classList.contains('sg-restart')) return restart();
      controls();
    });
    // 全体: 盤の全体を見せる。盤が帯の間に入りきらない (スクロールしている) なら、箱の高さを盤がちょうど入る高さにしてから
    // (幅はそのまま)。それでは箱が高すぎて画面に入らない (本体の縮小の下限) ほど広いときは、入る高さから幅を決め直す。
    // それでも箱の幅の下限 (本体の 320) より狭くなる (とても低く広い箱) なら、盤の全体は一度に見せられないので、箱の大きさはそのままで画面に収めるだけ。
    // 入りきっていれば、本体の「全体」と同じく画面に収めるだけ
    function viewWhole() {
      if (!front || !L.over) return api.fitView();
      const { w, h } = api.boxSize();
      const need = Math.ceil(h + L.max);
      if (need <= WHOLE_MAX_H) { scroll = 0; return api.setBoxSize(w, need); }
      const cell = (WHOLE_MAX_H - (h - H) - 8 - BAR * 2) / ROWS;  // 帯の間 (上下 4 ずつの余白) にちょうど入るマス
      const nw = Math.floor(cell * COLS + 12 + (w - W));
      if (nw < 320) return api.fitView();
      scroll = 0;
      api.setBoxSize(nw, WHOLE_MAX_H);
    }
    // 自分の陣地 (盤の端と持ち駒の帯) を幅いっぱいに拡大する。帯は画面の端寄り (先手は下、後手は上。端のボタンに隠れない所)。
    // 自軍: 人が指す陣営 (両方なら、どちらでもなければ先手)。theirs (敵軍) なら、その反対の側
    function viewSide(theirs) {
      const mine = cpu[0] && !cpu[1] ? 1 : 0, side = theirs ? 1 - mine : mine;
      if (L.over) { scroll = side === 1 ? 0 : L.max; layout(); }  // はみ出しているときは、盤をその端まで送ってから
      // 倍率は、マスが画面で VIEW_CELL px に見える決まった値 (箱の幅によらず。狭い画面では幅いっぱい。何度押しても同じ表示)
      api.magnify(canvas, 0.5, ((side === 1 ? L.top : L.bottom) + BAR / 2) / H, [0.5, side === 1 ? 0.15 : 0.85], W / L.cw * VIEW_CELL);
    }
    // コマ送り: 1 手だけ指させる (見せている手があればそれを)。人の番でも、CPU が代わりに 1 手指す (選んでいた駒や成るかの確認はやめる)
    function step() {
      if (g.winner !== null) return;
      if (humanTurn()) { pick = null; sel = null; cancelPromo(); }
      const mv = plan && canPlay(plan.mv) ? plan.mv : levelMove(g, level[g.turn]);
      plan = null;
      doMove(mv);
    }
    // 戻す・進むの長押し: 0.4 秒押し続けると、1 秒に 10 手 (さらに 1.5 秒たつと 20 手) ずつ続けて戻す・進める。
    // 離すか、押せなくなったら (0 手目・勝負がついた) 止まる。hold: { btn, t0, timer, fired: 続けて動かしたか }
    let hold = null;
    function holdTick() {
      if (!hold) return;
      if (hold.btn.disabled || !hold.btn.isConnected) return clearTimeout(hold.timer);
      hold.fired = true;
      if (hold.btn.classList.contains('sg-undo')) undo(); else step();
      hold.timer = setTimeout(holdTick, performance.now() - hold.t0 > 1900 ? 50 : 100);
    }
    panel.addEventListener('pointerdown', (e) => {
      const b = e.button === 0 && e.target.closest('.sg-undo, .sg-step');
      if (!b || b.disabled) return;
      if (hold) clearTimeout(hold.timer);
      hold = { btn: b, t0: performance.now(), fired: false, timer: setTimeout(holdTick, 400) };
    });
    const endHold = () => { if (hold) clearTimeout(hold.timer); };
    addEventListener('pointerup', endHold, true);
    addEventListener('pointercancel', endHold, true);
    api.onCleanup(() => {
      endHold();
      removeEventListener('pointerup', endHold, true);
      removeEventListener('pointercancel', endHold, true);
    });
    // コマ戻し: 1 手前 (その手を指す直前) の状態に戻す。飛んでいる駒・動きの跡・CPU の予告・選んでいる駒は消す
    function undo() {
      const prev = past.pop();
      if (!prev) return;
      g = prev;
      sel = null; pick = null; plan = null; wait = 0.5; trails = []; flights = [];
      cancelPromo();
      drag = null; back = null;
      canvas.dataset.moves = g.moves;  // 確認用
      over.hidden = true;
      turnLabel();
    }
    // 盤の種類を変える: 箱の大きさを合わせて (全体が見えるまで引く)、最初から
    function setBoard(kind) {
      board = kind; ROWS = BOARDS[kind].rows;
      api.setBoxSize(420, BOARDS[kind].h, FILL);
      restart();
    }
    // 対局を片付けて g から始める (最初から・再現)。止めずに、選んでいた駒・飛んでいる駒・跡・履歴を消す
    function reset(ng) {
      g = ng; sel = null; pick = null; plan = null; wait = 0.5; trails = []; flights = []; past = [];
      cancelPromo();
      scroll = 0;
      if (W) layout();
      drag = null; back = null;
      canvas.dataset.moves = g.moves;  // 確認用
      over.hidden = true;
      controls();
    }
    // 開発用: 文字から盤面を再現する (parseGame)。段数が盤の種類と合えば盤も切り替える (正面のブラウザだけ)。止めて、最初からと同じに片付ける
    function loadGame(text) {
      const ng = parseGame(text);
      const kind = Object.keys(BOARDS).find((k) => BOARDS[k].rows === ng.board.length);
      if (ng.board.length !== ROWS) {
        if (!kind || !front) throw new Error(`rows ${ng.board.length}`);
        board = kind; ROWS = BOARDS[kind].rows; api.setBoxSize(420, BOARDS[kind].h, FILL);
      }
      paused = true; setSpeed();
      reset(ng);
    }
    if (debug) B3D.shogi = { dump: () => dumpGame(g), load: loadGame };  // 開発用 (テストから)
    // 開発用: 「盤面の文字」の枠。今の盤面の文字を見せて、コピー / URL をコピー / 貼った文字から再現。クリップボードは読まない (書くだけ)
    const textBox = q('.sg-text'), textArea = textBox.querySelector('textarea'), textMsg = textBox.querySelector('.sg-text-msg');
    function openText() {
      for (const [act, key] of [['copy', 'sgCopy'], ['url', 'sgCopyUrl'], ['load', 'sgLoad'], ['close', 'sgClose']]) textBox.querySelector(`[data-act="${act}"]`).textContent = t(key);
      textArea.value = dumpGame(g); textMsg.textContent = '';
      textBox.hidden = false;
      textArea.focus(); textArea.select();
    }
    // 今のアドレスに board= を付けた URL (前の board= は外す)
    function boardUrl(text) {
      let u = location.href.replace(/#.*$/, '').replace(/[?&]board=[^&#]*/, '');
      if (!u.includes('?')) u = u.replace('&', '?');
      return u + (u.includes('?') ? '&' : '?') + 'board=' + text;
    }
    // 文字をクリップボードへ (書けなければ、入力欄に入れて選んでおく)
    function copyText(text) {
      textArea.value = text; textArea.focus(); textArea.select();
      const ok = () => { textMsg.textContent = t('sgCopied'); }, ng = () => { textMsg.textContent = t('sgCopyFail'); };
      const fallback = () => { try { if (document.execCommand('copy')) ok(); else ng(); } catch { ng(); } };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
    }
    textBox.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'close') textBox.hidden = true;
      else if (act === 'copy') copyText(textArea.value.trim());
      else if (act === 'url') copyText(boardUrl(dumpGame(g)));
      else if (act === 'load') { try { loadGame(textArea.value); textBox.hidden = true; } catch (err) { textMsg.textContent = t('sgLoadFail', err.message); } }
    });
    textBox.addEventListener('pointerdown', (e) => e.stopPropagation());  // 枠の中のドラッグで箱を回さない
    // 最初から (もう一局も同じ): 再生 / 停止はそのまま (再生中なら新しい対局がすぐ動き出す)
    const restart = () => reset(newGame(ROWS));
    controls();
    canvas.dataset.moves = 0;  // 確認用
    over.querySelector('button').addEventListener('click', restart);
    // 開発用の盤面の文字の枠は、画面に見えている盤の範囲の真ん中に置く (自軍・敵軍で端に寄せていても見える所に)。
    // 大きさは画面の上でいつも同じ (全体表示で小さく縮んで見えるときは、その分だけ大きく)。視点が動いても追うよう毎フレーム
    // (勝敗の表示は前はここで置いていたが、今は api.floatOver で箱の手前に出す)
    function placeOver(over) {
      if (over.hidden) return;
      const r = canvas.getBoundingClientRect(), k = r.width / W;
      if (!k) return;
      const mid = (a, b, lo, hi) => { const x0 = Math.max(a, lo), x1 = Math.min(b, hi); return x1 > x0 ? (x0 + x1) / 2 : (a + b) / 2; };
      over.style.left = `${(mid(r.left, r.right, 0, innerWidth) - r.left) / k}px`;
      over.style.top = `${(mid(r.top, r.bottom, 0, innerHeight) - r.top) / k}px`;
      over.style.transform = `translate(-50%, -50%) scale(${(1 / Math.min(k * (devicePixelRatio || 1), 1)).toFixed(3)})`;
    }

    // ---------- 盤の位置 (表示の大きさに合わせる) ----------
    // 持ち駒の帯は陣営ごとに 1 段 (先手は盤の下、後手は上)。高さ ROW_H
    const ROW_H = 44, BAR = ROW_H;
    const VIEW_CELL = 55;  // [自軍] [敵軍] で見せるマスの大きさ (画面の px)
    const WHOLE_MAX_H = 4200;  // [全体] で箱をこれより高くしない (本体の縮小の下限 0.15 で画面に入る高さ。高さで決まる画面でも 4359 まで)
    // 盤のスクロール (正面のブラウザで、盤が帯の間に入りきらないとき)。scroll: 上へ隠れている px。
    // 箱の大きさは自由 (右下の角で幅も高さも変えられる)。マスは正方形で幅はブラウザの幅いっぱいなので、箱を低くすると盤がはみ出す
    let scroll = 0;
    const PHONE_TOP = 64, PHONE_BOTTOM = 40;  // スマホの中で空ける上下 (ステータスバーとホームバー)
    // lPhone などの中で、画面にちょうど入る段数 (正方形のマスで、幅はいっぱい。9 段より少なくはしない)
    const fitRows = () => Math.max(9, Math.floor((H - PHONE_TOP - PHONE_BOTTOM - BAR * 2) / ((W - 12) / COLS)));
    function layout() {
      // 上下の余白は、スマホ (lPhone など) の中ならステータスバーとホームバーの分を空ける。BAR: 持ち駒の帯
      const phone = !!api.look();
      const TOP = phone ? PHONE_TOP : 4, BOTTOM = phone ? PHONE_BOTTOM : 4, avail = Math.max(0, H - TOP - BOTTOM - BAR * 2);  // 帯の間の高さ
      // 正面のブラウザ: マスは正方形で、幅は表示の幅いっぱい (左右 6 の余白)。入りきらない分は帯の間でスクロール。
      // lPhone などの中 (fit): 正方形のマスで、幅と高さの両方に収まる大きさ (段数を画面に合わせてあるので、ふつうは幅いっぱい)。
      // それ以外 (ガラスのスマホの中など): 幅と高さの両方に収まる大きさ (マスは少し縦長。盤が低いときは横幅もそれに合わせて細くする)
      const fw = (W - 12) / COLS;
      const ch = Math.max(3, front ? fw : fit ? Math.min(fw, avail / ROWS) : Math.min(Math.min(46, fw) * 1.1, avail / ROWS));
      const cw = front || fit ? ch : Math.min(46, fw, ch * 1.2);
      const boardH = ch * ROWS, over = boardH > avail + 0.5;
      // 盤が帯の間に収まれば、帯ごと縦の真ん中に置く。はみ出すなら帯を上下の端に固定して、間で盤をスクロール
      const top = TOP + (over ? 0 : (avail - boardH) / 2), view0 = top + BAR;
      const max = over ? boardH - avail : 0;
      scroll = Math.max(0, Math.min(max, scroll));
      const ox = (W - cw * COLS) / 2, oy = view0 - scroll, bottom = over ? view0 + avail : oy + boardH;
      L = { ox, oy, cw, ch, top, bottom, over, max, view0 };
      canvas.dataset.layout = JSON.stringify({ ...L, scroll });  // 確認用
    }
    // (x, y) のマス。スクロールで帯の下に隠れている所は null
    const cellAt = (x, y) => {
      if (L.over && (y < L.view0 || y >= L.bottom)) return null;
      const cx = Math.floor((x - L.ox) / L.cw), cy = Math.floor((y - L.oy) / L.ch);
      return cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS ? [cx, cy] : null;
    };
    // 盤を dy px スクロールする (はみ出しているときだけ)
    function scrollBy(dy) {
      if (!L?.over) return;
      scroll = Math.max(0, Math.min(L.max, scroll + dy));
      layout();
    }
    // 持ち駒の帯の上端 (後手は盤の上、先手は盤の下)
    const rowY = (side) => (side === 1 ? L.top : L.bottom);
    const HAND_X = 44;  // 陣営の名前の右から並べる
    // 持ち駒の場所 [{ side, key, spec, n, x, y, s }]。同じ駒はまとめて「×2」。並びきらないときは間を詰める
    function handSlots(side) {
      const list = handList(g.hands[side]), s = 34, y = rowY(side) + 5;
      const gap = Math.min(s + 10, (W - HAND_X - 12 - s) / Math.max(1, list.length - 1));
      return list.map((e, j) => ({ side, key: e.key, spec: e.spec, n: e.n, x: HAND_X + j * gap, y, s }));
    }
    // 持ち駒の場所に、もう着いている駒の数 (飛んでいる途中の駒は数えない)
    const arrived = (h) => h.n - flying(h.side, h.key);

    // ---------- 人の操作 ----------
    // 盤の上のドラッグは本体に回して箱を動かす (.pass-drag。拡大中はパン、全体が見えているときは回転)。
    // 盤が帯の間に入りきらないときは、盤の上の上下のドラッグとホイールは盤のスクロール (帯の上のドラッグは箱を動かす)。
    // 駒を選ぶ・指すのはタップ (押して、ほとんど動かさずに離す) のときだけ。ダブルタップでもリセットしない
    canvas.classList.add('pass-drag', 'no-dblclick-reset');
    let scrolling = null;  // 盤をドラッグでスクロールしている { id, y, moved }
    canvas.addEventListener('wheel', (e) => {
      if (!L?.over || e.ctrlKey) return;  // 入りきっているときや Ctrl+ホイールは本体に回す (3D の拡大縮小)
      e.preventDefault(); e.stopPropagation();
      scrollBy(e.deltaY);
    }, { passive: false });
    let press = null;  // 押した所 { id, cx, cy: 画面の位置, x, y: 盤の中の位置 }
    // 駒のドラッグ。人の番なら、自分の持ち駒を盤の打てるマスへドラッグして打てる。それ以外で離すと元の場所へ戻る。
    // 開発モード (?debug) で停止中は、どちらの陣営の駒も、盤の駒も動かせる (dropAt)。
    // drag: { id, src: { kind: 'board', x, y } か { kind: 'hand', side, key }, p: 駒, x, y: 駒の位置 (盤の中), lift, moved, debug }
    // タッチでは、指で隠れないよう駒を指の少し上 (lift) に描き、置く所もその位置で決める
    let drag = null;
    let back = null;  // 置けなかった駒が元の場所へ戻るところ { src, p, x, y: 離した位置, age }
    const BACK_T = 0.15;
    // 停止中に駒を自由に置き直せるか (「停止時にコマを動かせる」のスイッチ、または開発モード)
    const canDrag = () => (moveOn || debug) && paused && g.winner === null;
    const hit = (h, x, y, m = 0) => x >= h.x - m && x < h.x + h.s + m && y >= h.y - m && y < h.y + h.s + m;
    canvas.addEventListener('pointerdown', (e) => {
      press = e.button === 0 ? { id: e.pointerId, cx: e.clientX, cy: e.clientY, x: e.offsetX, y: e.offsetY } : null;
      const dbg = !!press && canDrag(), src = press && (dbg ? grabAt(e.offsetX, e.offsetY) : grabHand(e.offsetX, e.offsetY));
      if (!src) {
        // 駒をつかまず、はみ出した盤の上なら、ドラッグで盤をスクロール (本体には渡さない)
        if (press && L.over && e.offsetY >= L.view0 && e.offsetY < L.bottom) {
          e.stopPropagation();
          canvas.setPointerCapture(e.pointerId);
          scrolling = { id: e.pointerId, y: e.clientY };
        }
        return;
      }
      // 駒をつかんだら、本体に渡さない (箱を動かさない)。指が離れるまで、このキャンバスで受ける
      e.stopPropagation();
      canvas.setPointerCapture(e.pointerId);
      const lift = e.pointerType === 'touch' ? -30 : 0;
      drag = { id: e.pointerId, src, p: src.p, x: e.offsetX, y: e.offsetY + lift, lift, moved: false, debug: dbg };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (scrolling && e.pointerId === scrolling.id) { scrollBy(scrolling.y - e.clientY); scrolling.y = e.clientY; return; }
      if (!drag || e.pointerId !== drag.id) return;
      drag.x = e.offsetX; drag.y = e.offsetY + drag.lift;
      if (press && Math.hypot(e.clientX - press.cx, e.clientY - press.cy) >= 10) drag.moved = true;
    });
    // 離したときは、本体がドラッグのために指をつかまえているので、window で受ける
    const onUp = (e) => {
      if (scrolling && e.pointerId === scrolling.id) scrolling = null;  // 動かさずに離したら、下のタップの処理へ
      if (drag && e.pointerId === drag.id) {
        const d = drag;
        drag = null;
        if (d.moved) {
          press = null;
          release(d);
          canvas.dataset.sel = sel ? JSON.stringify(sel) : '';  // 確認用
          return;
        }
      }
      if (!press || e.pointerId !== press.id) return;
      const { cx, cy, x, y } = press;
      press = null;
      if (Math.hypot(e.clientX - cx, e.clientY - cy) < 10) tap(x, y);
      canvas.dataset.sel = sel ? JSON.stringify(sel) : '';  // 確認用
      canvas.dataset.pick = pick ? JSON.stringify(pick) : '';
    };
    // 押している間に別の指が触れたら (2 本指で拡大縮小)、タップにもドラッグにもしない
    const onOtherDown = (e) => {
      if (press && e.pointerId !== press.id) press = null;
      if (drag && e.pointerId !== drag.id) drag = null;
      if (scrolling && e.pointerId !== scrolling.id) scrolling = null;
    };
    addEventListener('pointerup', onUp, true);
    addEventListener('pointerdown', onOtherDown, true);
    api.onCleanup(() => {
      removeEventListener('pointerup', onUp, true);
      removeEventListener('pointerdown', onOtherDown, true);
    });
    // (x, y) にある、人が打てる持ち駒 (自分の番の、自分の持ち駒。飛んでいる途中の駒は、着いてから)
    function grabHand(x, y) {
      if (!humanTurn() || pending) return null;
      const h = handSlots(g.turn).find((h) => hit(h, x, y) && arrived(h) > 0);
      return h ? { kind: 'hand', side: h.side, key: h.key, p: pieceOf(h.spec, h.side) } : null;
    }
    // ドラッグしている持ち駒を盤へ打てるか: 人の番で、自分の持ち駒で、成るかの確認を出していないとき
    const canBoardDrop = (s) => s.kind === 'hand' && humanTurn() && s.side === g.turn && !pending;
    // 人が持ち駒 key を打てるマス (番号 y * COLS + x の Set。空いたマスで、行き所のない駒・二歩・打ち歩詰め・王手放置でないもの)
    const dropSquares = (key) => new Set(legalMoves(g, g.turn).filter((m) => m.drop === key).map((m) => m.to[1] * COLS + m.to[0]));
    const srcSpec = (s) => g.hands[s.side][s.key]?.spec;
    // ドラッグしている駒を盤で離したときに置く所 { x, y, ok } (置けるか)。駒が盤の外なら null。開発モードはどのマスでもよい (dropAt)
    function landing(d) {
      const c = cellAt(d.x, d.y);
      if (!c) return null;
      if (d.debug) return { x: c[0], y: c[1], ok: true };
      const s = d.src.kind === 'hand' && srcSpec(d.src);
      if (!s) return null;
      return { x: c[0], y: c[1], ok: canBoardDrop(d.src) && dropSquares(d.src.key).has(c[1] * COLS + c[0]) };
    }
    // ドラッグしている持ち駒を打てるマス (打てなければ null)
    const boardTarget = (d) => { const l = !d.debug && landing(d); return l?.ok ? l : null; };
    // 離した: 盤の打てるマスなら打つ、開発モードなら dropAt。置けなければ元の場所へ戻す
    function release(d) {
      const bd = boardTarget(d);
      if (bd) { sel = null; pick = null; plan = null; humanMove({ drop: d.src.key, to: [bd.x, bd.y] }); }
      else if (!d.debug || !dropAt(d, d.x, d.y)) back = { src: d.src, p: d.p, x: d.x, y: d.y, age: 0 };
      syncSel();
    }
    // 元の場所の真ん中 (戻る先)
    function homeOf(src) {
      if (src.kind === 'board') return [L.ox + (src.x + 0.5) * L.cw, L.oy + (src.y + 0.5) * L.ch];
      const h = handSlots(src.side).find((h) => h.key === src.key);
      return h && [h.x + h.s / 2, h.y + h.s / 2];
    }
    const homeSize = (src) => (src.kind === 'board' ? Math.min(L.cw, L.ch * 1.05) : 34);
    // ドラッグ中・戻る途中で、元の場所に描かない駒
    const hiddenSrc = () => (drag?.moved ? drag.src : back?.src);
    // (x, y) にある、つかめる駒 (開発モード): 盤の駒か、持ち駒 (飛んでいる途中の駒は、着いてから)
    function grabAt(x, y) {
      const h = [0, 1].flatMap((side) => handSlots(side)).find((h) => hit(h, x, y) && arrived(h) > 0);
      if (h) return { kind: 'hand', side: h.side, key: h.key, p: pieceOf(h.spec, h.side) };
      const c = cellAt(x, y);
      if (!c || !g.board[c[1]][c[0]]) return null;
      return { kind: 'board', x: c[0], y: c[1], p: g.board[c[1]][c[0]] };
    }
    // (x, y) が置ける所: 盤のマス { kind: 'board', x, y } か、持ち駒の帯 { kind: 'hand', side }
    function dropTarget(x, y) {
      const c = cellAt(x, y);
      if (c) return { kind: 'board', x: c[0], y: c[1] };
      for (const side of [0, 1]) {
        const top = rowY(side);
        if (y >= top && y < top + ROW_H) return { kind: 'hand', side };
      }
      return null;
    }
    // 置く (開発モード): 空いたマスへは移し、駒があれば入れ替える (置かれていた駒は、つかんだ駒の元の場所へ)。持ち駒の帯へは、その陣営の持ち駒に (表に戻る)。
    // 玉は持ち駒にできない (元に戻す)。手数・手番・直前の手は変えない (対局の外の並べ替え)
    function dropAt(d, x, y) {
      const to = dropTarget(x, y), src = d.src;
      if (!to || !canDrag()) return false;
      // つかんだ駒を元の場所から外す
      const p = src.kind === 'board' ? g.board[src.y][src.x] : pieceOf(handTake(g.hands[src.side], src.key), src.side);
      if (src.kind === 'board') g.board[src.y][src.x] = null;
      // 元の場所へ戻す (入れ替えの相手を置くときにも使う)。玉を持ち駒にしようとしたら false
      const putBack = (q) => {
        if (src.kind === 'board') { g.board[src.y][src.x] = q; return true; }
        if (q.type === 'K') return false;
        handAdd(g.hands[src.side], specOf(q));
        return true;
      };
      if (to.kind === 'board') {
        const q = g.board[to.y][to.x];
        // 玉を持ち駒の帯へは入れ替えられない
        if (q && !putBack(q)) { putBack(p); return false; }
        g.board[to.y][to.x] = p;
      } else {
        if (p.type === 'K') { putBack(p); return false; }
        handAdd(g.hands[to.side], specOf(p));
      }
      sel = null; pick = null; plan = null; cancelPromo();
      return true;
    }
    // 人の操作 (タップ)。自分の番に、盤の駒を選んで行き先を押して指す。持ち駒を選んで空いたマスを押すと打つ。
    // sel: 選んでいる持ち駒 { side, key }
    const canSelect = (h) => !cpu[h.side];  // 人が選べる持ち駒: 人の陣営のもの
    function tap(x, y) {
      const slot = [0, 1].flatMap((side) => handSlots(side)).filter(canSelect).find((h) => hit(h, x, y) && arrived(h) > 0);
      if (slot) {
        pick = null;
        // 選んでいる駒をもう一度押したら、選ぶのをやめる
        sel = sel && sel.side === slot.side && sel.key === slot.key ? null : { side: slot.side, key: slot.key };
        return;
      }
      const c = humanTurn() && !pending && cellAt(x, y);
      if (c) {
        const [cx, cy] = c, p = g.board[cy][cx];
        // 自分の駒を選ぶ (選んでいる駒をもう一度押したら、選ぶのをやめる)
        if (p && p.owner === g.turn) {
          pick = pick && pick.from[0] === cx && pick.from[1] === cy ? null : { from: [cx, cy] };
          sel = null;
          return;
        }
        const from = humanFrom();
        if (from) {
          const legal = movesOf(from).filter((m) => m.to[0] === cx && m.to[1] === cy);
          pick = null;
          if (legal.length === 1) return humanMove(legal[0]);  // 打ったあとも、同じ持ち駒が残っていれば選んだまま
          if (legal.length > 1) return askPromo(legal, cx, cy);
        }
      }
      sel = null; pick = null;
    }
    // 人が動かす番に選んでいるもの: 盤の駒 { from } か、自分の持ち駒 { drop }
    const humanFrom = () => (!humanTurn() ? null : pick || (sel && sel.side === g.turn ? { drop: sel.key } : null));
    // 選んでいるものが指せる手
    const movesOf = (s) => legalMoves(g, g.turn).filter((m) => (s.drop ? m.drop === s.drop : m.from && m.from[0] === s.from[0] && m.from[1] === s.from[1]));
    // 成るか成らないかを選ぶ
    const promo = q('.sg-promo');
    function askPromo(legal, cx, cy) {
      pending = legal;
      promo.querySelector('.yes').textContent = t('sgPromote');
      promo.querySelector('.no').textContent = t('sgStay');
      promo.style.left = `${Math.min(W - 120, Math.max(4, L.ox + cx * L.cw - 40))}px`;
      promo.style.top = `${L.oy + cy * L.ch - 40}px`;
      promo.hidden = false;
    }
    function cancelPromo() { pending = null; promo.hidden = true; }
    promo.querySelector('.yes').addEventListener('click', () => choosePromo(true));
    promo.querySelector('.no').addEventListener('click', () => choosePromo(false));
    function choosePromo(yes) {
      const mv = pending?.find((m) => !!m.promote === yes);
      cancelPromo();
      if (mv && humanTurn()) humanMove(mv);
    }
    // 人が指した: 止まっていて相手が CPU なら、そこから動き出す (停止は CPU を待たせるもの。人が指せば再生)
    function humanMove(mv) {
      doMove(mv);
      if (paused && cpu[g.turn] && g.winner === null) { paused = false; setSpeed(); controls(); }
    }
    // 選んでいた持ち駒がなくなったら (打った・CPU に任せた)、選ぶのをやめる
    function syncSel() {
      if (sel && (cpu[sel.side] || (g.hands[sel.side][sel.key]?.n || 0) - flying(sel.side, sel.key) <= 0)) sel = null;
    }
    const canPlay = (mv) => !mv.drop || !!g.hands[g.turn][mv.drop];
    // 取った数の表 (勝敗の下)。見出し「取った駒の数ランキング」の下に、列は 先手 / 後手 (人が指したなら金色)、行は駒 (多い順、同じなら駒の価値順。先頭に MVP の札)。取っていない駒は出さない
    function capsTable() {
      return `<div class="h">${t('sgCapsTitle')}</div>` + [0, 1].map((side) => {
        const caps = g.caps?.[side] || {};
        const rows = Object.keys(caps).sort((a, b) => caps[b] - caps[a] || valueOfKey(b) - valueOfKey(a));
        const total = rows.reduce((n, k) => n + caps[k], 0);
        return `<div class="c"><b${cpu[side] ? '' : ' class="me"'}>${t(side === 0 ? 'sgSente' : 'sgGote')} · ${t('sgCapsTotal', total)}</b>` +
          (rows.length ? rows.map((k, i) => `<span>${nameOfKey(k, side)} ×${caps[k]}${i ? '' : '<em>MVP</em>'}</span>`).join('') : `<i>${t('sgCapsNone')}</i>`) + '</div>';
      }).join('');
    }
    // 取った数のキー (駒の種類) の名前と価値
    const nameOfKey = (k, side) => label({ type: k, promoted: false, owner: side });
    const valueOfKey = (k) => VALUE[k];
    function doMove(mv) {
      const mover = g.turn;
      past.push(structuredClone(g));  // コマ戻し用
      if (past.length > PAST_MAX) past.shift();
      const taken = play(g, mv);
      pick = null;
      if (trailsOn) { trails.push({ mv: g.last, side: mover, age: 0 }); if (trails.length > TRAIL_MAX) trails.shift(); }
      // 取った駒を飛ばす。×2 からは速さに合わせて短くする (最短で合わせて 0.3 秒)
      for (const { p, at } of taken) {
        const dx = mv.to[0] - mv.from[0], dy = mv.to[1] - mv.from[1], d = Math.hypot(dx, dy);
        const f = Math.max(1 / Math.max(1, speed), 0.3 / 1.5);
        flights.push({ p, key: keyOf(specOf(p)), side: mover, at, dir: [dx / d, dy / d], age: 0, t1: 0.35 * f, t2: 0.85 * f, t3: 0.3 * f });
      }
      canvas.dataset.moves = g.moves;  // 確認用
      // 効果音: 取ったら重く (速いほど小さく)、指したら軽く (×4 からは鳴らさない。最初の速さが ×4 なので、はじめて開いた人に音が続いて驚かせない)。決着なら、そのあとに 2 音
      if (taken.length || speed < 4) sfx(taken.length ? 'take' : 'tap', speed >= 8 ? 0.5 : speed >= 4 ? 0.7 : 1);
      if (g.winner !== null) sfx('win');
      // 次の手は少し待ってから考える
      wait = showPlan() ? 0.4 / Math.max(1, speed) : 1.2 / speed;
      turnLabel();
      if (g.winner !== null) {
        over.querySelector('span').textContent = g.winner === -1 ? t('sgDraw') : t('sgWin', t(g.winner === 0 ? 'sgSente' : 'sgGote'));
        over.querySelector('.sg-caps').innerHTML = capsTable();
        over.querySelector('.sg-caps').hidden = !capsOn;
        over.querySelector('button').textContent = t('sgAgain');
        over.hidden = false;
      }
    }

    // ---------- 描く ----------
    // 駒を c (キャンバスの描画先) に描く。back なら裏の面 (成った字を赤で。成っている駒は元の字を黒で。金・玉は無地)。
    // 裏は透過モードで面の裏から透けて見るときに使うので、透けて左右が戻るよう、字を左右反転して描く
    // spin: さらに回す角度 (取られて飛んでいる駒)
    function piece(c, p, cx, cy, size, back = false, spin = 0) {
      c.save();
      c.translate(cx, cy);
      if (p.owner === 1) c.rotate(Math.PI);
      if (spin) c.rotate(spin);
      if (back) c.scale(-1, 1);
      const w = size * 0.82, h = size * 0.92;
      c.beginPath();
      c.moveTo(0, -h / 2); c.lineTo(w / 2, -h / 2 + h * 0.22); c.lineTo(w * 0.42, h / 2);
      c.lineTo(-w * 0.42, h / 2); c.lineTo(-w / 2, -h / 2 + h * 0.22); c.closePath();
      c.fillStyle = back ? '#ecd09a' : '#f6deae';
      c.fill();
      c.strokeStyle = '#8a6a36'; c.lineWidth = 1; c.stroke();
      const red = back ? !p.promoted : p.promoted;
      const text = !back ? label(p) : p.promoted ? NAMES[p.type] : PROMOTED[p.type];
      if (text) {
        c.fillStyle = red ? '#c0392b' : '#1c140a';
        c.font = `700 ${Math.round(size * 0.52)}px "Yu Mincho", "Hiragino Mincho ProN", serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(text, 0, h * 0.06);
      }
      c.restore();
    }
    function draw() {
      // 透過モードで裏から透けて見ているときは、駒を裏向きに描く (面が真横を向いた所で切り替わるので、目立たない)
      // (ガラスのスマホで裏からも見えるようにして裏返したときも同じ。オフなら裏から画面は見えないので、描き方は関係ない)
      const face = api.face(), rev = !!face && (api.seeThrough() || glass) && api.faceFacing(face) < 0;
      ctx.setTransform(R, 0, 0, R, 0, 0);
      // ガラスの盤 (ガラスのスマホの中) は、盤の外を透明にし、盤は水色がかった半透明の板に白い線
      const C = glass
        ? { board: 'rgba(170,225,255,.14)', zone: 'rgba(150,215,255,.12)', line: 'rgba(255,255,255,.6)', star: 'rgba(220,245,255,.95)', bar: 'rgba(10,25,40,.38)', barMine: 'rgba(150,215,255,.26)' }
        : { board: '#e3bd78', zone: 'rgba(160,90,30,.12)', line: 'rgba(60,35,10,.7)', star: 'rgba(60,35,10,.8)', bar: 'rgba(0,0,0,.15)', barMine: 'rgba(255,220,120,.18)' };
      if (glass) ctx.clearRect(0, 0, W, H);
      else { ctx.fillStyle = '#2a1f14'; ctx.fillRect(0, 0, W, H); }
      const { ox, oy, cw, ch } = L;
      // はみ出している盤は、帯の間だけに描く (帯の下に隠す)
      ctx.save();
      if (L.over) { ctx.beginPath(); ctx.rect(0, L.view0, W, L.bottom - L.view0); ctx.clip(); }
      // 盤
      ctx.fillStyle = C.board;
      ctx.fillRect(ox, oy, cw * COLS, ch * ROWS);
      // 敵陣の色
      ctx.fillStyle = C.zone;
      ctx.fillRect(ox, oy, cw * COLS, ch * ZONE);
      ctx.fillRect(ox, oy + ch * (ROWS - ZONE), cw * COLS, ch * ZONE);
      // 直前の手・CPU が動かそうとしている手
      const mark = (x, y, color) => { ctx.fillStyle = color; ctx.fillRect(ox + x * cw, oy + y * ch, cw, ch); };
      if (g.last) {
        if (g.last.from) mark(...g.last.from, 'rgba(255,220,90,.35)');
        mark(...g.last.to, 'rgba(255,200,40,.55)');
      }
      // CPU が動かそうとしている駒と行き先
      if (plan) {
        mark(...(plan.mv.from || plan.mv.to), 'rgba(255,120,60,.5)');
        if (plan.mv.from) mark(...plan.mv.to, 'rgba(255,120,60,.22)');
      }
      // 人が動かす番: 選んでいる駒と、動ける先 (持ち駒なら打てるマス)。持ち駒を盤へドラッグしている間は、その駒を打てるマスに点
      const dot = (x, y) => { ctx.beginPath(); ctx.arc(ox + (x + 0.5) * cw, oy + (y + 0.5) * ch, Math.min(cw, ch) * 0.16, 0, Math.PI * 2); ctx.fill(); };
      const dragS = drag?.moved && !drag.debug && canBoardDrop(drag.src) && srcSpec(drag.src);
      const from = !dragS && humanFrom();
      ctx.fillStyle = 'rgba(40,120,255,.55)';
      if (dragS) {
        const ok = dropSquares(drag.src.key);
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (ok.has(y * COLS + x)) dot(x, y);
      }
      if (from) {
        if (from.from) mark(...from.from, 'rgba(80,160,255,.45)');
        ctx.fillStyle = 'rgba(40,120,255,.55)';
        for (const m of movesOf(from)) dot(...m.to);
      }
      // 線と星。全体表示のように小さく縮んで見えるときは、画面の上で 1 点より細くならないよう太くする
      // (細いまま縮むと、ブラウザが点を飛ばし飛ばし拾うので、消える線が出る)
      const box = canvas.getBoundingClientRect();
      const shown = Math.sqrt(box.width * box.height / (W * H)) * (devicePixelRatio || 1);
      const lw = Math.min(6, Math.max(1, Math.round(1.3 / shown * 2) / 2));
      canvas.dataset.lw = lw;  // 確認用
      ctx.strokeStyle = C.line; ctx.lineWidth = lw;
      ctx.beginPath();
      for (let i = 0; i <= COLS; i++) { ctx.moveTo(ox + i * cw, oy); ctx.lineTo(ox + i * cw, oy + ch * ROWS); }
      for (let j = 0; j <= ROWS; j++) { ctx.moveTo(ox, oy + j * ch); ctx.lineTo(ox + cw * COLS, oy + j * ch); }
      ctx.stroke();
      ctx.fillStyle = C.star;
      if (glass) { ctx.shadowColor = 'rgba(150,225,255,.9)'; ctx.shadowBlur = 6; }  // ガラスの星は小さく光る
      for (let j = 3; j < ROWS; j += 3) for (const i of [3, 6]) {
        ctx.beginPath(); ctx.arc(ox + i * cw, oy + j * ch, 1 + lw, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      // 駒が動いた軌跡 (線の上、駒の下)。先手は水色、後手は赤紫。動いた手は元のマスから着いたマスへ矢印、打った手は着いたマスに広がる輪。
      // 線と同じく、小さく縮んで見えるときは画面の上で細くなりすぎないよう太くする
      const tw = Math.max(Math.min(cw, ch) * 0.1, 3 / shown), cs = Math.min(cw, ch);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const tr of trails) {
        ctx.globalAlpha = Math.min(1, (TRAIL_HOLD + TRAIL_FADE - tr.age) / TRAIL_FADE);
        ctx.strokeStyle = ctx.fillStyle = tr.side === 0 ? '#2ee6d0' : '#ff4fa3';
        if (glass) { ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 8; }
        const [tx, ty] = [ox + (tr.mv.to[0] + 0.5) * cw, oy + (tr.mv.to[1] + 0.5) * ch];
        ctx.lineWidth = tw;
        if (tr.mv.from) {
          const [fx, fy] = [ox + (tr.mv.from[0] + 0.5) * cw, oy + (tr.mv.from[1] + 0.5) * ch];
          const a = Math.atan2(ty - fy, tx - fx), hs = Math.max(tw * 2.5, cs * 0.3);  // 矢じりの長さ
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx - Math.cos(a) * hs * 0.6, ty - Math.sin(a) * hs * 0.6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tx, ty);
          ctx.lineTo(tx - Math.cos(a - 0.45) * hs, ty - Math.sin(a - 0.45) * hs);
          ctx.lineTo(tx - Math.cos(a + 0.45) * hs, ty - Math.sin(a + 0.45) * hs);
          ctx.closePath(); ctx.fill();
        } else {
          const k = tr.age / (TRAIL_HOLD + TRAIL_FADE);
          ctx.beginPath(); ctx.arc(tx, ty, Math.max(cs * (0.3 + 0.4 * k), tw * 3 * (1 + k)), 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      // 駒 (ドラッグ中・戻る途中の駒は、元の場所に描かない)
      const hid = hiddenSrc(), hidP = hid?.kind === 'board' ? g.board[hid.y]?.[hid.x] : null;
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const p = g.board[y][x];
        if (p && p !== hidP) piece(ctx, p, ox + (x + 0.5) * cw, oy + (y + 0.5) * ch, Math.min(cw, ch * 1.05), rev);
      }
      ctx.restore();
      // 持ち駒の帯 (陣営ごとに 1 段)。人が指す陣営は帯を明るく、名前を金色に
      for (const side of [1, 0]) {
        const human = !cpu[side], y = rowY(side);
        ctx.fillStyle = human ? C.barMine : C.bar;
        ctx.fillRect(0, y, W, ROW_H);
        // 陣営の名前 (左端)
        ctx.fillStyle = human ? '#ffd76a' : 'rgba(244,228,196,.7)';
        ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(t(side === 0 ? 'sgSente' : 'sgGote'), 8, y + ROW_H / 2);
        for (const h of handSlots(side)) {
          // 飛んでいる途中の駒はまだ数えない (初めての種類なら、置き場所だけ空けておく)。つかんでいる駒は引く
          const held = hid?.kind === 'hand' && hid.side === side && hid.key === h.key;
          const n = arrived(h) - (held ? 1 : 0);
          if (n > 0) piece(ctx, pieceOf(h.spec, side), h.x + h.s / 2, h.y + h.s / 2, h.s, rev);
          if (sel && sel.side === side && sel.key === h.key) {
            ctx.strokeStyle = '#4aa3ff'; ctx.lineWidth = 2; ctx.strokeRect(h.x - 2, h.y - 2, h.s + 4, h.s + 4);
          }
          if (n > 1) {
            ctx.fillStyle = '#f4e4c4'; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'left';
            ctx.fillText(`×${n}`, h.x + h.s - 2, h.y + h.s - 4);
          }
        }
      }
      // つかんでいる駒 (少し大きく)。盤の上では、置く所に駒の影と金の枠、置けなければ赤い点線の枠。つかんでいる駒はマスの大きさで半分透かす。
      // 開発モードで帯の上なら、帯の全体を光らせる
      const big = Math.max(Math.min(cw, ch * 1.05), 34) * 1.3;
      if (drag?.moved) {
        const land = landing(drag), to = !land && drag.debug && dropTarget(drag.x, drag.y);
        canvas.dataset.land = land ? JSON.stringify(land) : '';  // 確認用
        ctx.fillStyle = 'rgba(255,215,90,.35)';
        if (land) {
          const rx = ox + land.x * cw, ry = oy + land.y * ch;
          if (land.ok) {
            ctx.fillRect(rx, ry, cw, ch);
            ctx.globalAlpha = 0.45;
            piece(ctx, drag.p, rx + cw / 2, ry + ch / 2, Math.min(cw, ch * 1.05), rev);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 3; ctx.strokeRect(rx, ry, cw, ch);
          } else {
            ctx.strokeStyle = 'rgba(225,50,40,.9)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
            ctx.strokeRect(rx + 1, ry + 1, cw - 2, ch - 2);
            ctx.setLineDash([]);
          }
        } else if (to?.kind === 'hand') ctx.fillRect(0, rowY(to.side), W, ROW_H);
        ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6;
        if (land) ctx.globalAlpha = 0.5;
        piece(ctx, drag.p, drag.x, drag.y, land ? Math.min(cw, ch * 1.05) : big, rev);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      }
      // 置けなかった駒が、元の場所へ戻るところ
      const home = back && homeOf(back.src);
      if (home) {
        const k = Math.min(1, back.age / BACK_T), e = 1 - (1 - k) ** 2;
        piece(ctx, back.p, back.x + (home[0] - back.x) * e, back.y + (home[1] - back.y) * e, big + (homeSize(back.src) - big) * e, rev);
      }
      // 取られた駒 (いちばん上に描く)。飛んでいる間は、取った側の色の短い尾を引く
      for (const fl of flights) {
        const s = flightAt(fl, fl.age);
        if (!s) continue;
        const color = fl.side === 0 ? '#2ee6d0' : '#ff4fa3';
        if (fl.age > fl.t1 && fl.age < fl.t1 + fl.t2) {
          ctx.lineCap = 'round'; ctx.strokeStyle = color;
          let prev = s;
          for (let i = 1; i <= 6; i++) {
            const q = flightAt(fl, Math.max(fl.t1, fl.age - fl.t2 * 0.04 * i));
            ctx.globalAlpha = s.alpha * (1 - i / 7) * 0.8; ctx.lineWidth = Math.max(s.size * 0.3, tw) * (1 - i / 8);
            ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke();
            prev = q;
          }
          ctx.lineCap = 'butt';
        }
        if (s.ring) {  // 置き場所に着いて光る
          ctx.globalAlpha = 1 - s.ring; ctx.strokeStyle = color; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.size * (0.5 + 0.5 * s.ring), 0, Math.PI * 2); ctx.stroke();
        }
        // 手前へ跳ね上がったように、大きくなっている間は影を付ける
        ctx.globalAlpha = s.alpha;
        if (s.lift) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = s.size * 0.3 * s.lift; ctx.shadowOffsetY = s.size * 0.18 * s.lift; }
        piece(ctx, { type: fl.p.type, owner: fl.side, promoted: s.promoted }, s.x, s.y, s.size, rev, s.spin);
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.globalAlpha = 1;
      }
    }
    // 取られた駒の、指してから age 秒の様子 { x, y, size, spin, promoted, alpha, lift: 跳ね上がり 0〜1, ring: 着いてから 0〜1 }
    function flightAt(fl, age) {
      const { ox, oy, cw, ch } = L, cs = Math.min(cw, ch * 1.05), big = 1.5;
      const x0 = ox + (fl.at[0] + 0.5) * cw, y0 = oy + (fl.at[1] + 0.5) * ch;
      const x1 = x0 + fl.dir[0] * cs * 1.6, y1 = y0 + fl.dir[1] * cs * 1.6;  // 吹っ飛んだ先
      // 回る角度: 取られた側の向き (取った側から見て半回転) から、ぐるぐる回って取った側の向きに落ち着く
      const u = Math.min(1, age / (fl.t1 + fl.t2)), spin = Math.PI * 5 * (1 - u) ** 3;
      const promoted = fl.p.promoted && u < 0.5;
      if (age < fl.t1) {
        const k = age / fl.t1, e = 1 - (1 - k) ** 2, lift = Math.sin(k * Math.PI / 2);
        return { x: x0 + (x1 - x0) * e, y: y0 + (y1 - y0) * e, size: cs * (1 + (big - 1) * lift), spin, promoted, alpha: 1, lift };
      }
      const k = Math.min(1, (age - fl.t1) / fl.t2), e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) ** 2;
      // 玉は置き場所へ行かず、そのまま飛んで消える
      if (fl.p.type === 'K') {
        if (k >= 1) return null;
        return { x: x1 + fl.dir[0] * cs * 3 * e, y: y1 + fl.dir[1] * cs * 3 * e, size: cs * big * (1 + e), spin: spin + k * 6, promoted, alpha: 1 - k, lift: 1 };
      }
      const h = handSlots(fl.side).find((s) => s.key === fl.key);
      if (!h) return null;
      const x2 = h.x + h.s / 2, y2 = h.y + h.s / 2;
      if (k < 1) {
        // 弧を描く (先手と後手で反対側にふくらむ)
        const d = Math.hypot(x2 - x1, y2 - y1), sg = fl.side === 0 ? 1 : -1;
        const mx = (x1 + x2) / 2 - (y2 - y1) / d * d * 0.2 * sg, my = (y1 + y2) / 2 + (x2 - x1) / d * d * 0.2 * sg;
        const a = (1 - e) ** 2, b = 2 * (1 - e) * e, c = e * e;
        return { x: a * x1 + b * mx + c * x2, y: a * y1 + b * my + c * y2, size: cs * big + (h.s - cs * big) * e, spin, promoted, alpha: 1, lift: 1 - e };
      }
      // 着いて弾む
      const r = Math.min(1, (age - fl.t1 - fl.t2) / fl.t3);
      return { x: x2, y: y2, size: h.s * (1 + 0.25 * Math.sin(r * Math.PI)), spin: 0, promoted: false, alpha: 1, lift: 0, ring: r };
    }

    api.onFrame((dt) => {
      if (tab.pane.hidden || !canvas.clientWidth) return;  // 裏のタブでは止めておく
      placeOver(q('.sg-text'));
      if (!begin.hidden && !paused) begin.hidden = true;  // 再生が始まったら「はじめる」は消す
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w !== W || h !== H) {
        W = w; H = h;
        canvas.width = W * R; canvas.height = H * R;
        // lPhone などの中: 画面の大きさがわかったら、まだ指していなければ画面にちょうど入る段数で始め直す
        if (fit && g.moves === 0 && !past.length && fitRows() !== ROWS) { ROWS = fitRows(); reset(newGame(ROWS)); }
        layout();
      }
      // CPU の番なら、少し待ってから手を決め、動かす駒を見せてから指す。×4 からはすぐ指す。停止中と、人の番は待つ
      if (g.winner === null && speed) {
        if (humanTurn()) plan = null;
        else if (plan) {
          if (!canPlay(plan.mv)) { plan = null; wait = 0; }
          else if ((plan.wait -= dt) <= 0) { const mv = plan.mv; plan = null; doMove(mv); }
        } else if ((wait -= dt) <= 0) {
          const mv = levelMove(g, level[g.turn]);
          if (!showPlan()) doMove(mv);
          else plan = { mv, wait: 0.6 / speed };
        }
      }
      if (back && (back.age += dt) >= BACK_T) back = null;
      for (const tr of trails) tr.age += dt;
      trails = trails.filter((tr) => tr.age < TRAIL_HOLD + TRAIL_FADE);
      for (const fl of flights) fl.age += dt;
      flights = flights.filter((fl) => fl.age < fl.t1 + fl.t2 + fl.t3);
      canvas.dataset.flights = flights.length;  // 確認用 (と、最初の 1 つの位置)
      const f0 = flights[0] && flightAt(flights[0], flights[0].age);
      canvas.dataset.flight = f0 ? JSON.stringify([Math.round(f0.x), Math.round(f0.y), Math.round(f0.size)]) : '';
      canvas.dataset.trails = trails.length;  // 確認用 (と、持ち駒の数 [先手, 後手])
      canvas.dataset.hands = JSON.stringify(g.hands.map((h) => handList(h).reduce((n, e) => n + e.n, 0)));
      // 開発モードでは盤の中身も (1 マス 2 文字: ^ 先手 / v 後手 と駒の種類 (成っていれば小文字)、.. は空き。段を / で区切る)
      canvas.dataset.board = g.board.map((r) => r.map((p) => (p ? (p.owner ? 'v' : '^') + (p.promoted ? p.type.toLowerCase() : p.type) : '..')).join('')).join('/');
      syncSel();
      const pickText = pick ? JSON.stringify(pick) : '';  // 確認用
      if (canvas.dataset.pick !== pickText) canvas.dataset.pick = pickText;
      draw();
    });
    // 開発用: URL の board= にある盤面で始める (読めなければそのまま)
    if (debug) {
      const bm = /[?&]board=([^&#]*)/.exec(location.search);
      if (bm) try { loadGame(decodeURIComponent(bm[1])); } catch (e) { console.warn(e); }
    }
  }

  // ページのアイコン: 木の色の駒の形に「歩」(まとめのフォルダの窓やスマホのホーム画面に、文字の大きさで出る。☗ は真っ黒に見えたので)
  const ICON = '<svg viewBox="0 0 100 100" width="1em" height="1em" style="vertical-align:-0.12em">' +
    '<polygon points="50,4 81,17 92,96 8,96 19,17" fill="#f0d39a" stroke="#5a3a14" stroke-width="5" stroke-linejoin="round"/>' +
    '<text x="50" y="80" text-anchor="middle" font-size="50" font-weight="700" fill="#2a1a08" font-family="\'Yu Mincho\',\'Hiragino Mincho ProN\',serif">歩</text></svg>';
  B3D.registerPage({
    id: 'shogi', title: 'shogi', phoneTitle: 'shogiPhone', icon: ICON, appBg: 'linear-gradient(135deg, #f0d39a, #b8873c)', info: 'infoShogi', menu: true, glass: 'look',
    group: { id: 'arcade', icon: '🕹️', title: ['アーケード', 'Arcade'], info: ['ブラウザで遊べるゲーム', 'Games to play in the browser'] },
    strings: STR, css: CSS, render: renderShogi,
  });
})();
