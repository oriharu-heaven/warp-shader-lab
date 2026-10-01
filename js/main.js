(function(){
  const cv = document.getElementById('c');
  const gl = cv.getContext('webgl', {preserveDrawingBuffer:true, antialias:false});
  const toast = document.getElementById('toast');
  const say = t => { toast.textContent = t; clearTimeout(say.h); say.h = setTimeout(()=>toast.textContent='', 2500); };
  if(!gl){ say('このブラウザではWebGLが使えません'); return; }

  // ---------- WebGL ----------
  const FRAG = window.WARP_FRAG;
  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  function sh(type, src){ const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; }
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog); gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uCache = {}; const U = n => (n in uCache) ? uCache[n] : (uCache[n] = gl.getUniformLocation(prog, n));

  // ---------- 状態 ----------
  const PRESETS = {
    holo:{mode:0, grid:false, twist:1.4, fold:1.3, oct:3, scale:0.9, warp:2.0, stretch:1.8, angle:35, speed:0.15, contrast:1.15, dot:5, grain:0.08, hue:0, cols:3, rows:5},
    mono:{mode:1, grid:false, twist:0, fold:0, oct:3, scale:0.9, warp:1.5, stretch:1.5, angle:-25, speed:0.1, contrast:2.2, dot:0, grain:0.2, hue:0, cols:3, rows:5},
    soft:{mode:2, grid:true, twist:0, fold:0, oct:2, scale:0.9, warp:1.3, stretch:1.0, angle:0, speed:0.08, contrast:1.1, dot:0, grain:0.14, hue:0.55, cols:3, rows:5}
  };
  const S = Object.assign({}, PRESETS.holo);
  let preset = 'holo', seed = 0.37, t = 0, paused = false, ar = [1,1];
  const off = {x:0, y:0};
  const clamp = (v,a,b) => Math.min(b, Math.max(a, v));

  // ---------- かんたん調整（直感スライダー） ----------
  const KNOBS = [
    {id:'size', name:'形の大きさ', ends:['細かい','大きい'],
      set:x=>{ S.scale = 2.2 - 1.9*x; }, get:()=> (2.2 - S.scale)/1.9},
    {id:'curve', name:'うねり', ends:['ゆるやか','激しい'],
      set:x=>{ S.warp = 0.3 + 3.2*x; S.twist = 2.6*x; if(S.mode===0) S.fold = 0.4 + 1.8*x; }, get:()=> (S.warp - 0.3)/3.2},
    {id:'dir', name:'流れの向き', ends:['← 左に回す','右に回す →'],
      set:x=>{ S.angle = -90 + 180*x; }, get:()=> (S.angle + 90)/180},
    {id:'contrast', name:'メリハリ', ends:['やわらか','くっきり'],
      set:x=>{ S.contrast = 0.7 + 1.7*x; }, get:()=> (S.contrast - 0.7)/1.7},
    {id:'texture', name:()=> S.mode===0 ? '網点' : 'ざらつき', ends:()=> S.mode===0 ? ['なし','粗い'] : ['なめらか','ざらざら'],
      set:x=>{ if(S.mode===0) S.dot = Math.round(24*x)/2; else S.grain = 0.5*x; }, get:()=> S.mode===0 ? S.dot/12 : S.grain/0.5},
    {id:'color', name:'色合い', ends:['基本の色','別の色'], show:()=> S.mode!==1,
      set:x=>{ S.hue = x; }, get:()=> S.hue},
    {id:'motion', name:'動き', ends:['ゆっくり','速い'],
      set:x=>{ S.speed = x; }, get:()=> S.speed},
  ];
  const knobBox = document.getElementById('knobs');
  const knobEls = {};
  function buildKnobs(){
    knobBox.innerHTML = '';
    for(const k of KNOBS){
      if(k.show && !k.show()) continue;
      const name = typeof k.name === 'function' ? k.name() : k.name;
      const ends = typeof k.ends === 'function' ? k.ends() : k.ends;
      const el = document.createElement('div'); el.className = 'knob';
      el.innerHTML = `<div class="top"><label for="k-${k.id}"><span>${name}</span></label></div>
        <input type="range" id="k-${k.id}" min="0" max="1" step="0.005">
        <div class="ends"><span>${ends[0]}</span><span>${ends[1]}</span></div>`;
      const inp = el.querySelector('input');
      inp.addEventListener('input', ()=>{ k.set(+inp.value); syncRaw(); });
      knobBox.appendChild(el);
      knobEls[k.id] = inp;
    }
    syncKnobs();
  }
  function syncKnobs(){
    for(const k of KNOBS){ const inp = knobEls[k.id]; if(inp && inp.isConnected) inp.value = clamp(k.get(), 0, 1); }
  }

  // ---------- 詳細設定（数値スライダー） ----------
  const RAW = {
    shape:[['scale','スケール',0.3,4,0.05],['oct','細かさ',1,6,1],['warp','ワープ量',0,6,0.05],['twist','うねり',0,4,0.05],
           ['fold','折り返し',0,3,0.05],['stretch','引き伸ばし',0.5,4,0.05],['angle','向き',-90,90,1],['speed','速度',0,1,0.01]],
    tex:[['contrast','コントラスト',0.5,3.5,0.05],['dot','網点サイズ',0,14,0.5],['grain','粒子',0,0.6,0.01],['hue','色相シフト',0,1,0.01]],
    gridrows:[['cols','列',1,6,1],['rows','行',1,8,1]]
  };
  const rawEls = {};
  const fmt = (k,v) => k==='dot' && v<0.5 ? 'off' : ['angle','oct','cols','rows'].includes(k) ? String(Math.round(v)) : v.toFixed(2);
  for(const [box, list] of Object.entries(RAW)){
    const host = document.getElementById(box);
    for(const [k,label,min,max,step] of list){
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<label for="s-${k}">${label}</label><input type="range" id="s-${k}" min="${min}" max="${max}" step="${step}"><output for="s-${k}"></output>`;
      host.appendChild(row);
      const inp = row.querySelector('input'), out = row.querySelector('output');
      inp.addEventListener('input', ()=>{ S[k] = +inp.value; out.textContent = fmt(k, S[k]); syncKnobs(); });
      rawEls[k] = {inp, out};
    }
  }
  const gridBox = document.getElementById('grid');
  gridBox.addEventListener('change', ()=>{ S.grid = gridBox.checked; makeCands(); });
  function syncRaw(){ for(const k in rawEls){ rawEls[k].inp.value = S[k]; rawEls[k].out.textContent = fmt(k, S[k]); } gridBox.checked = S.grid; }
  function syncAll(){ syncRaw(); syncKnobs(); }

  // ---------- 描画 ----------
  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if(w && h && (cv.width !== w || cv.height !== h)){ cv.width = w; cv.height = h; }
  }
  function draw(px, fixed){
    if(!fixed) resize();
    gl.viewport(0, 0, cv.width, cv.height);
    px = px || (cv.width / Math.max(cv.clientWidth, 1));
    gl.uniform2f(U('uRes'), cv.width, cv.height);
    gl.uniform1f(U('uTime'), t);
    gl.uniform1f(U('uOct'), S.oct);
    gl.uniform1f(U('uScale'), S.scale); gl.uniform1f(U('uWarp'), S.warp);
    gl.uniform1f(U('uTwist'), S.twist); gl.uniform1f(U('uFold'), S.fold);
    gl.uniform1f(U('uStretch'), S.stretch); gl.uniform1f(U('uAngle'), S.angle*Math.PI/180);
    gl.uniform1f(U('uContrast'), S.contrast);
    gl.uniform1f(U('uDot'), S.dot * px); gl.uniform1f(U('uPx'), px);
    gl.uniform1f(U('uGrain'), S.grain); gl.uniform1f(U('uHue'), S.hue);
    gl.uniform1f(U('uSeed'), seed); gl.uniform1f(U('uMode'), S.mode); gl.uniform1f(U('uGrid'), S.grid?1:0);
    gl.uniform2f(U('uCells'), S.cols, S.rows);
    gl.uniform2f(U('uOffset'), off.x, off.y);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  // 指定サイズで一度だけ描く（候補サムネイル・書き出し用）
  function renderAt(W, H){
    const px = W / Math.max(cv.clientWidth, 1);
    cv.width = W; cv.height = H;
    draw(px, true);
  }

  // ---------- 候補 ----------
  const candBox = document.getElementById('cands');
  const rnd = (a,b) => a + Math.random()*(b-a);
  let cands = [];
  function makeCands(){
    const base = Object.assign({}, S);
    const saved = {S:Object.assign({}, S), seed, off:{...off}};
    cands = [];
    candBox.innerHTML = '';
    const tw = 180, th = Math.round(180 * ar[1] / ar[0]);
    for(let i = 0; i < 4; i++){
      const c = Object.assign({}, base, {
        scale: clamp(base.scale * rnd(0.7, 1.35), 0.3, 4),
        warp:  clamp(base.warp  * rnd(0.7, 1.35), 0, 6),
        twist: clamp(base.twist * rnd(0.6, 1.5), 0, 4),
        fold:  base.fold ? clamp(base.fold * rnd(0.75, 1.3), 0, 3) : 0,
        angle: clamp(base.angle + rnd(-45, 45), -90, 90),
        hue:   S.mode===1 ? base.hue : Math.random()
      });
      const cs = Math.random()*10;
      cands.push({S:c, seed:cs});
      Object.assign(S, c); seed = cs; off.x = off.y = 0;
      renderAt(tw * 2, th * 2);
      const b = document.createElement('button'); b.className = 'cand'; b.setAttribute('aria-label', `候補 ${i+1} を使う`);
      const tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
      tc.getContext('2d').drawImage(cv, 0, 0, tw, th);
      b.appendChild(tc);
      b.addEventListener('click', ()=>{ Object.assign(S, cands[i].S); seed = cands[i].seed; off.x = off.y = 0; syncAll(); say(`候補 ${i+1} を反映しました`); });
      candBox.appendChild(b);
    }
    Object.assign(S, saved.S); seed = saved.seed; off.x = saved.off.x; off.y = saved.off.y;
    resize();
  }
  document.getElementById('more').addEventListener('click', makeCands);

  // ---------- スタイル・サイズ ----------
  function applyPreset(name){
    preset = name;
    Object.assign(S, PRESETS[name]); off.x = off.y = 0;
    document.querySelectorAll('.preset').forEach(x => x.setAttribute('aria-pressed', x.dataset.p===name));
    buildKnobs(); syncRaw(); makeCands();
  }
  document.querySelectorAll('.preset').forEach(b => b.addEventListener('click', ()=> applyPreset(b.dataset.p)));
  document.getElementById('reset').addEventListener('click', ()=>{ applyPreset(preset); say('最初の状態に戻しました'); });
  const stage = document.getElementById('stage');
  document.querySelectorAll('.size').forEach(b => b.addEventListener('click', ()=>{
    ar = [+b.dataset.w, +b.dataset.h];
    stage.style.setProperty('--ar', ar[0] + '/' + ar[1]);
    document.querySelectorAll('.size').forEach(x => x.setAttribute('aria-pressed', x===b));
    requestAnimationFrame(makeCands);
  }));

  // ---------- 画像を直接さわる ----------
  let drag = null;
  cv.addEventListener('pointerdown', e => { drag = {x:e.clientX, y:e.clientY}; cv.setPointerCapture(e.pointerId); cv.classList.add('dragging'); });
  cv.addEventListener('pointermove', e => {
    if(!drag) return;
    const h = cv.clientHeight || 1;
    off.x -= (e.clientX - drag.x) / h;
    off.y += (e.clientY - drag.y) / h;
    drag = {x:e.clientX, y:e.clientY};
  });
  const endDrag = () => { drag = null; cv.classList.remove('dragging'); };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    S.scale = clamp(S.scale * Math.exp(e.deltaY * 0.0015), 0.3, 4);
    syncAll();
  }, {passive:false});
  cv.addEventListener('dblclick', ()=>{ off.x = off.y = 0; });
  cv.addEventListener('keydown', e => {
    const step = 0.05, map = {ArrowLeft:[step,0], ArrowRight:[-step,0], ArrowUp:[0,-step], ArrowDown:[0,step]};
    if(map[e.key]){ off.x += map[e.key][0]; off.y += map[e.key][1]; e.preventDefault(); }
    else if(e.key === '+' || e.key === '='){ S.scale = clamp(S.scale/1.1, 0.3, 4); syncAll(); }
    else if(e.key === '-'){ S.scale = clamp(S.scale*1.1, 0.3, 4); syncAll(); }
  });

  // ---------- 再生・保存・コピー ----------
  const pauseBtn = document.getElementById('pause');
  function setPause(v){ paused = v; pauseBtn.setAttribute('aria-pressed', v); pauseBtn.textContent = v ? '再生' : '一時停止'; }
  pauseBtn.addEventListener('click', ()=> setPause(!paused));
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) setPause(true);

  document.getElementById('save').addEventListener('click', async ()=>{
    const W = 1080, H = Math.round(1080 * ar[1] / ar[0]);
    renderAt(W, H);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const name = `${preset}-${ar[0]}x${ar[1]}-${Date.now().toString(36)}.png`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 10000);
    say('保存しました');
  });
  document.getElementById('copy').addEventListener('click', ()=>{
    navigator.clipboard.writeText(FRAG).then(()=>say('GLSLをコピーしました'), ()=>say('コピーできませんでした。ブラウザの設定を確認してください'));
  });

  // ---------- ループ ----------
  let last = performance.now();
  function loop(now){
    const dt = Math.min((now - last)/1000, 0.1); last = now;
    if(!paused) t += dt * S.speed * 4;
    draw(); requestAnimationFrame(loop);
  }
  applyPreset('holo');
  requestAnimationFrame(loop);
})();
