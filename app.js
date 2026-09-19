"use strict";

const $  = id => document.getElementById(id);
const $$ = sel => [...document.querySelectorAll(sel)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function h(tag, attrs, ...kids){
  const e = document.createElement(tag);
  for(const k in (attrs || {})){
    const v = attrs[k];
    if(v === null || v === undefined || v === false) continue;
    if(k === "class") e.className = v;
    else if(k === "style") e.style.cssText = v;
    else if(k === "text") e.textContent = v;
    else if(k === "html") e.innerHTML = v;
    else if(k.startsWith("on")) e[k] = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for(const k of kids.flat()) if(k !== null && k !== undefined && k !== false)
    e.appendChild(typeof k === "string" ? document.createTextNode(k) : k);
  return e;
}

function parseNum(v){
  const t = String(v).trim().replace(",", ".");
  return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(t) ? t : null;
}

const rgba = c => "rgba(" + Math.round((c[0]||0)*255) + "," + Math.round((c[1]||0)*255) + "," +
                  Math.round((c[2]||0)*255) + "," + (c[3] === undefined ? 1 : c[3]) + ")";
const rgbHex = c => "#" + [0,1,2].map(i => Math.round(Math.min(1,Math.max(0,c[i]||0))*255)
                    .toString(16).padStart(2,"0")).join("");
const hexRgb = s => [1,3,5].map(i => parseInt(s.substr(i,2),16)/255);
const nice = n => { const s = (Math.round(n*10000)/10000).toString(); return s === "-0" ? "0" : s; };

let statusTimer = null;
function status(msg){
  const s = $("status");
  s.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(()=>{ s.textContent = ""; }, 4500);
}

const sim = {
  gametype:4, team:"red",
  health:200, armor:75, ammo:25, weapon:"railgun",
  redScore:5, blueScore:3, myScore:7, redAlive:3, blueAlive:2,
  warmup:false, firstPlace:true, hasFlag:false, chat:true,
  flagRed:"at_base", flagBlue:"taken",
  cvars:{ cg_gametype:4 }
};

const WEAPONS = [
  ["gauntlet","Gauntlet",null], ["machinegun","Machinegun","icona_machinegun"],
  ["shotgun","Shotgun","icona_shotgun"], ["grenade","Grenade","icona_grenade"],
  ["rocket","Rocket","icona_rocket"], ["lightning","Lightning","icona_lightning"],
  ["railgun","Railgun","icona_railgun"], ["plasma","Plasma","icona_plasma"],
  ["bfg","BFG","icona_bfg"]
];

const BACKGROUND_PRESETS = [
  { value: "assets/backgrounds/overkill.jpg", label: "Overkill" },
  { value: "assets/backgrounds/eyetoeye.jpg", label: "Eye to Eye" },
  { value: "assets/backgrounds/dm17.jpg", label: "DM17" },
  { value: "assets/backgrounds/cathedral.jpg", label: "Cathedral" }
];

const HUD_OBJECT_TEMPLATES = [
  { id:"health", label:"Health", name:"health", ownerdraw:"CG_PLAYER_HEALTH", rect:[0,0,96,28], align:"ITEM_ALIGN_LEFT", textscale:"1" },
  { id:"armor", label:"Armor", name:"armor", ownerdraw:"CG_PLAYER_ARMOR_VALUE", rect:[0,0,96,28], align:"ITEM_ALIGN_LEFT", textscale:"1" },
  { id:"ammo", label:"Ammo", name:"ammo", ownerdraw:"CG_PLAYER_AMMO_VALUE", rect:[0,0,96,28], align:"ITEM_ALIGN_RIGHT", textscale:"1" },
  { id:"score", label:"Score", name:"score", ownerdraw:"CG_PLAYER_SCORE", rect:[0,0,96,20], align:"ITEM_ALIGN_RIGHT", textscale:"1" },
  { id:"timer", label:"Timer", name:"timer", ownerdraw:"CG_LEVELTIMER", rect:[0,0,120,20], align:"ITEM_ALIGN_CENTER", textscale:"1" },
  { id:"redScore", label:"Red score", name:"redscore", ownerdraw:"CG_RED_SCORE", rect:[0,0,64,20], align:"ITEM_ALIGN_LEFT", textscale:"1" },
  { id:"blueScore", label:"Blue score", name:"bluescore", ownerdraw:"CG_BLUE_SCORE", rect:[0,0,64,20], align:"ITEM_ALIGN_RIGHT", textscale:"1" },
  { id:"redLives", label:"Red alive", name:"redalive", ownerdraw:"CG_RED_CLAN_PLYRS", rect:[0,0,64,20], align:"ITEM_ALIGN_LEFT", textscale:"1" },
  { id:"blueLives", label:"Blue alive", name:"bluealive", ownerdraw:"CG_BLUE_CLAN_PLYRS", rect:[0,0,64,20], align:"ITEM_ALIGN_RIGHT", textscale:"1" },
  { id:"redFlag", label:"Red flag", name:"redflag", ownerdraw:"CG_RED_FLAGSTATUS", rect:[0,0,32,32], align:"ITEM_ALIGN_LEFT" },
  { id:"blueFlag", label:"Blue flag", name:"blueflag", ownerdraw:"CG_BLUE_FLAGSTATUS", rect:[0,0,32,32], align:"ITEM_ALIGN_RIGHT" },
  { id:"powerup", label:"Powerup", name:"powerup", ownerdraw:"CG_AREA_POWERUP", rect:[0,0,32,32], align:"ITEM_ALIGN_CENTER" },
  { id:"weaponIcon", label:"Weapon icon", name:"weaponicon", ownerdraw:"CG_PLAYER_AMMO_ICON", rect:[0,0,32,32], align:"ITEM_ALIGN_CENTER" },
  { id:"chat", label:"Chat", name:"chat", ownerdraw:"CG_AREA_NEW_CHAT", rect:[0,0,180,20], align:"ITEM_ALIGN_LEFT" },
  { id:"item", label:"Item", name:"item", ownerdraw:"CG_PLAYER_ITEM", rect:[0,0,24,24], align:"ITEM_ALIGN_CENTER" },
  { id:"teamColor", label:"Team color", name:"teamcolor", ownerdraw:"CG_TEAM_COLORIZED", rect:[0,0,96,24], align:"ITEM_ALIGN_LEFT" }
];

const STATE_TOGGLES = [
  ["warmup",     "Warmup"],
  ["firstPlace", "I am leading"],
  ["hasFlag",    "carrying flag"],
  ["chat",       "chat visible"]
];

function ownerdrawValue(od){
  switch(od){
    case "CG_PLAYER_HEALTH":      return sim.health;
    case "CG_PLAYER_ARMOR_VALUE": return sim.armor;
    case "CG_PLAYER_AMMO_VALUE":  return sim.ammo;
    case "CG_PLAYER_SCORE":       return sim.myScore;
    case "CG_RED_SCORE":          return sim.redScore;
    case "CG_BLUE_SCORE":         return sim.blueScore;
    case "CG_1STPLACE":           return Math.max(sim.redScore, sim.blueScore);
    case "CG_2NDPLACE":           return Math.min(sim.redScore, sim.blueScore);
    case "CG_RED_CLAN_PLYRS":     return sim.redAlive;
    case "CG_BLUE_CLAN_PLYRS":    return sim.blueAlive;
    case "CG_RED_OWNED_FLAGS":    return sim.redScore;
    case "CG_BLUE_OWNED_FLAGS":   return sim.blueScore;
    case "CG_TEAM_PLYR_COUNT":    return sim.team === "blue" ? sim.blueAlive : sim.redAlive;
    case "CG_ENEMY_PLYR_COUNT":   return sim.team === "blue" ? sim.redAlive  : sim.blueAlive;
  }
  return null;
}

function ownerdrawText(od){
  const n = ownerdrawValue(od);
  if(n !== null) return String(n);
  switch(od){
    case "CG_LEVELTIMER":  return "12:34";
    case "CG_ROUNDTIMER":  return "0:15";
    case "CG_OVERTIME":    return "OVERTIME";
    case "CG_PLAYER_OBIT": return "player  ⇒  enemy";
    case "CG_RACE_TIMES":  return "1:23.456";
    case "CG_RACE_STATUS": return "RACE";
  }
  return od ? od.replace(/^CG_/,"") : "";
}

const ICON_DRAWS = new Set([
  "CG_PLAYER_AMMO_ICON2D","CG_PLAYER_AMMO_ICON","CG_PLAYER_ITEM","CG_PLAYER_HASKEY",
  "CG_PLAYER_HASFLAG","CG_ONEFLAG_STATUS","CG_RED_FLAGSTATUS","CG_BLUE_FLAGSTATUS",
  "CG_AREA_POWERUP","CG_CTF_POWERUP","CG_HARVESTER_SKULLS","CG_PLAYER_HEAD","CG_SELECTEDPLAYER_HEAD"
]);
const AREA_DRAWS = { CG_AREA_NEW_CHAT:"Chat", CG_TEAM_COLORIZED:"Team color" };

const VALUE_DRAWS = new Set([
  "CG_PLAYER_HEALTH","CG_PLAYER_ARMOR_VALUE","CG_PLAYER_AMMO_VALUE"
]);

function otherFlagOK(f){
  switch(f){
    case "CG_SHOW_IF_PLYR_IS_ON_RED":       return sim.team === "red";
    case "CG_SHOW_IF_PLYR_IS_ON_BLUE":      return sim.team === "blue";
    case "CG_SHOW_HEALTHCRITICAL":          return sim.health <= 25;
    case "CG_SHOW_IF_RED_IS_FIRST_PLACE":   return sim.redScore >= sim.blueScore;
    case "CG_SHOW_IF_BLUE_IS_FIRST_PLACE":  return sim.blueScore > sim.redScore;
    case "CG_SHOW_IF_PLYR_IS_FIRST_PLACE":  return sim.firstPlace;
    case "CG_SHOW_IF_PLYR_IS_NOT_FIRST_PLACE": return !sim.firstPlace;
    case "CG_SHOW_IF_WARMUP":               return sim.warmup;
    case "CG_SHOW_IF_NOT_WARMUP":           return !sim.warmup;
    case "CG_SHOW_IF_PLAYER_HAS_FLAG":      return sim.hasFlag;
    case "CG_SHOW_IF_PLAYER_HAS_NO_FLAG":   return !sim.hasFlag;
    case "CG_SHOW_IF_CHAT_VISIBLE":         return sim.chat;
    case "CG_SHOW_IF_CHAT_HIDDEN":          return !sim.chat;
  }
  return true;
}
const flagsOK = props => (props.ownerdrawflag || []).every(f => GT_FLAGS[f] ? true : otherFlagOK(f));

const cvarVal = cv => sim.cvars[cv] === undefined ? "" : String(sim.cvars[cv]);

function cvarOK(props){
  const cv = props.cvarTest && props.cvarTest[0];
  if(!cv || cv === "cg_gametype") return true;
  const val = cvarVal(cv);
  if(props.showCvar) return props.showCvar.map(String).includes(val);
  if(props.hideCvar) return !props.hideCvar.map(String).includes(val);
  return true;
}

function isVisible(item){
  const p = P(item), mp = P(item.menu);
  if(offSwitch(p.visible) || offSwitch(mp.visible)) return false;
  if(!gtOfProps(mp).has(sim.gametype)) return false;
  if(!gtOfProps(p).has(sim.gametype)) return false;
  if(!flagsOK(mp) || !flagsOK(p)) return false;
  if(!cvarOK(mp) || !cvarOK(p)) return false;
  const c = colorOf(item);
  if(c[3] === 0) return false;
  return true;
}

let docs = [];
const edits = new Edits();
let sel = [];
let zoom = 1.8;
const aspect = 16/9;
let clipProps = null, clipRect = null;
const undoStack = [], redoStack = [];

const screenEl = $("screen");
const stageEl  = $("stage");

const allMenus = () => docs.flatMap(d => d.menus);
const allItems = () => docs.flatMap(d => d.menus.flatMap(m => m.items));
const P = t => edits.eff(t);
const isSel = t => sel.includes(t);
const primary = () => sel[0] || null;
const nameOf = t => { const n = P(t).name; return (n && n.join(" ")) || t.name || "(unnamed)"; };

function pushUndo(){
  undoStack.push(edits.snapshot(allMenus()));
  if(undoStack.length > 120) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
}
function undo(){
  if(!undoStack.length) return;
  redoStack.push(edits.snapshot(allMenus()));
  edits.restore(undoStack.pop());
  sel = sel.filter(t => t.kind === "menu" || t.menu.items.includes(t));
  updateUndoButtons(); refresh(true); status("undone");
}
function redo(){
  if(!redoStack.length) return;
  undoStack.push(edits.snapshot(allMenus()));
  edits.restore(redoStack.pop());
  sel = sel.filter(t => t.kind === "menu" || t.menu.items.includes(t));
  updateUndoButtons(); refresh(true); status("redone");
}
function updateUndoButtons(){
  $("btnUndo").disabled = !undoStack.length;
  $("btnRedo").disabled = !redoStack.length;
}

const VW = 640, VH = 480;
const CAP_PER_SCALE = 35.8;
const ADV_PER_CAP   = 1.034;
const VALUE_BASE    = 48;
const FONT_STACK = '"Segoe UI",Arial,Helvetica,sans-serif';

const fm = (function(){
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = "700 100px " + FONT_STACK;
  const m = ctx.measureText("0");
  const cap = (m.actualBoundingBoxAscent || 71) / 100;
  const adv = (m.width || 55.6) / 100;
  let base = 0.9;
  try{
    const p = document.createElement("div");
    p.style.cssText = "position:absolute;left:-9999px;top:0;line-height:1;visibility:hidden;" +
                      "white-space:pre;font:700 100px " + FONT_STACK;
    p.innerHTML = '0<span style="display:inline-block;width:0;height:0"></span>';
    document.body.appendChild(p);
    const b = (p.lastChild.getBoundingClientRect().bottom - p.getBoundingClientRect().top) / 100;
    if(b > .3 && b < 1.6) base = b;
    p.remove();
  }catch(e){}
  return { ctx, cap, adv, base };
})();
function textWidth(txt, fontSize){
  fm.ctx.font = "700 " + fontSize + "px " + FONT_STACK;
  return fm.ctx.measureText(txt).width;
}

const menuOffset = menu => { const r = rectOf(P(menu)); return r ? [r[0], r[1]] : [0,0]; };
const itemRect   = t => rectOf(P(t));
function absRect(item){
  const r = itemRect(item);
  if(!r) return null;
  const [ox,oy] = menuOffset(item.menu);
  return [r[0]+ox, r[1]+oy, r[2], r[3]];
}
function xform(menu, visW){
  switch(wsMode(P(menu))){
    case "left":   return {s:1, t:0};
    case "right":  return {s:1, t:visW - VW};
    case "center": return {s:1, t:(visW - VW)/2};
    default:       return {s:visW / VW, t:0};
  }
}
const scaleOf = item => numOf((P(item).textscale || [])[0], 0.5) || 0.5;

function alignOf(item){
  const p = P(item);
  const od  = p.ownerdraw && p.ownerdraw[0];
  const key = od ? "align" : (p.textalign ? "textalign" : "align");
  return alignCode(p[key] && p[key][0]);
}
function baselineOf(item, absY){
  const od = (P(item).ownerdraw || [])[0];
  return VALUE_DRAWS.has(od) ? absY + VALUE_BASE * scaleOf(item) : absY;
}

function paintsRect(item){
  const p = P(item);
  const od = (p.ownerdraw || [])[0];
  const style = (p.style || [])[0];
  if(p.background && p.background[0]) return true;
  if(od && (ICON_DRAWS.has(od) || AREA_DRAWS[od])) return true;
  if(p.backcolor && (style === "WINDOW_STYLE_FILLED" || style === "1" || style === "3")) return true;
  if(p.border && p.border[0] !== "0" && p.bordercolor) return true;
  return false;
}
function drawsText(item){
  const p = P(item);
  const od = (p.ownerdraw || [])[0];
  if(p.text && p.text.join(" ").trim()) return true;
  return !!(od && !ICON_DRAWS.has(od) && !AREA_DRAWS[od]);
}
const textOnly = item => drawsText(item) && !paintsRect(item);

const ASSET_BASE = "assets/game/";
const ASSET_MAP = (() => {
  const m = Object.create(null);
  for(const p of (Array.isArray(window.QL_ASSETS) ? window.QL_ASSETS : []))
    m[p.slice(0, p.lastIndexOf(".")).toLowerCase()] = p;
  return m;
})();
const HAS_ART = Object.keys(ASSET_MAP).length > 0;

function assetUrl(ref){
  if(!ref) return null;
  const key = ref.trim().replace(/\\/g, "/").replace(/^\//, "")
                 .replace(/\.(tga|png|jpg|jpeg)$/i, "").toLowerCase();
  const hit = ASSET_MAP[key];
  return hit ? ASSET_BASE + hit : null;
}
const hasAsset = ref => !!assetUrl(ref);

function ownerdrawIcon(od){
  const t  = sim.team === "blue" ? "blue" : "red";
  const wp = WEAPONS.find(w => w[0] === sim.weapon);
  switch(od){
    case "CG_PLAYER_AMMO_ICON2D":
    case "CG_PLAYER_AMMO_ICON":    return wp && wp[2] ? "icons/" + wp[2] : "icons/icona_machinegun";
    case "CG_PLAYER_ITEM":         return "icons/teleporter";
    case "CG_PLAYER_HASKEY":       return "icons/key_gold";
    case "CG_PLAYER_HASFLAG":      return "gfx/2d/flag_status/" + t + "_flag_taken";
    case "CG_ONEFLAG_STATUS":      return "gfx/2d/flag_status/flag_" + sim.flagRed;
    case "CG_RED_FLAGSTATUS":      return "gfx/2d/flag_status/red_flag_" + sim.flagRed;
    case "CG_BLUE_FLAGSTATUS":     return "gfx/2d/flag_status/blue_flag_" + sim.flagBlue;
    case "CG_AREA_POWERUP":
    case "CG_CTF_POWERUP":         return "icons/quad";
    case "CG_HARVESTER_SKULLS":    return "icons/skull_" + t;
    case "CG_PLAYER_HEAD":
    case "CG_SELECTEDPLAYER_HEAD": return "models/players/doom/icon_default";
  }
  return null;
}

const ICON_NAMES = {
  CG_PLAYER_AMMO_ICON2D:"ammo", CG_PLAYER_AMMO_ICON:"ammo", CG_PLAYER_ITEM:"item",
  CG_PLAYER_HASKEY:"key", CG_PLAYER_HASFLAG:"flag", CG_ONEFLAG_STATUS:"flag",
  CG_RED_FLAGSTATUS:"red flag", CG_BLUE_FLAGSTATUS:"blue flag",
  CG_AREA_POWERUP:"powerup", CG_HARVESTER_SKULLS:"skulls",
  CG_PLAYER_HEAD:"head", CG_SELECTEDPLAYER_HEAD:"head", CG_CTF_POWERUP:"powerup"
};
function iconLabel(bg, od){
  if(!bg && ICON_NAMES[od]) return ICON_NAMES[od];
  if(bg){
    const parts = bg.replace(/\.(tga|png|jpg|jpeg)$/i,"").split("/");
    let last = parts.pop() || "";
    if(/^icon/i.test(last) && parts.length) last = parts.pop();
    return last.slice(0,14);
  }
  return (od || "").replace(/^CG_(PLAYER_)?/,"").slice(0,14);
}

function drawPlaceholder(el, bg, od, tint, w, hh){
  const c = tint || [1,1,1,1];
  el.style.background   = rgba([c[0]*.45, c[1]*.45, c[2]*.45, .85]);
  el.style.border       = "1px solid " + rgba([Math.min(c[0]+.25,1), Math.min(c[1]+.25,1),
                                               Math.min(c[2]+.25,1), .9]);
  el.style.borderRadius = (2*zoom) + "px";
  el.style.boxShadow    = "0 0 0 1px rgba(0,0,0,.55)";
  const name = iconLabel(bg, od);
  const bw = Math.max(w,1)*zoom, bh = Math.max(hh,1)*zoom;
  const label = (name || "■").slice(0, 3);
  const fs = Math.max(4, Math.min(bh*.7, (bw-4)/(Math.max(label.length,1)*.58), 12));
  if(bw >= 4 && bh >= 4){
    el.appendChild(h("div", { class:"ico", style:"font:" + fs + "px/1 " + FONT_STACK, text:label }));
  }
}

function colorOf(item){
  const p  = P(item);
  const od = p.ownerdraw && p.ownerdraw[0];
  const v  = od ? ownerdrawValue(od) : null;
  if(v !== null && p.addColorRange){
    const r = pickRange(p.addColorRange, v);
    if(r) return colorOfVals(r.slice(2,6));
    return [1,1,1,1];
  }
  if(p.background && p.backcolor) return colorOfVals(p.backcolor);
  if(p.forecolor) return colorOfVals(p.forecolor);
  return [1,1,1,1];
}

let rafPending = false;
function renderStage(){
  if(rafPending) return;
  rafPending = true;
  requestAnimationFrame(()=>{ rafPending = false; drawStage(); });
}

function drawStage(){
  const visW = VH * aspect;
  screenEl.style.width  = (visW * zoom) + "px";
  screenEl.style.height = (VH * zoom) + "px";
  screenEl.classList.toggle("grid-off", !$("optGrid").checked);
  $("centerV").hidden = !$("optCenter").checked;

  const band = $("band");
  band.hidden = visW <= VW + 1;
  band.style.left  = (((visW - VW)/2) * zoom) + "px";
  band.style.width = (VW * zoom) + "px";

  [...screenEl.querySelectorAll(".el,.hnd,.guide,#origin,#anchor")].forEach(n => n.remove());
  if(!docs.length) return;

  const showBoxes  = $("optBoxes").checked;
  const showHidden = $("optHidden").checked;
  const showArt    = $("optArt").checked && HAS_ART;

  for(const doc of docs) for(const menu of doc.menus){
    try{
      if(!gtOfProps(P(menu)).has(sim.gametype)) continue;
    }catch(e){}
    if(hiddenView.has(menu)) continue;
    const tf = xform(menu, visW);
    for(const item of menu.items){
      if(edits.isRemoved(item) || hiddenView.has(item)) continue;
      const vis = isVisible(item);
      if(!vis && !showHidden) continue;
      const r = absRect(item);
      if(!r) continue;

      const x = r[0]*tf.s + tf.t, y = r[1], w = r[2]*tf.s, hh = r[3];
      const p = P(item);
      const el = h("div", { class:"el" + (isSel(item) ? (item === primary() ? " sel" : " sel sel2") : "") +
                                   (item.isNew ? " isnew" : "") });
      el.style.left   = (x * zoom) + "px";
      el.style.top    = (y * zoom) + "px";
      el.style.width  = (Math.max(w,1) * zoom) + "px";
      el.style.height = (Math.max(hh,1) * zoom) + "px";
      const tint = colorOf(item);
      const alpha = tint[3] === undefined ? 1 : tint[3];
      el.style.opacity = vis ? alpha : .3;
      if(showBoxes) el.style.outline = "1px dashed rgba(74,163,255,.4)";
      el._item = item;

      const paints = paintsRect(item);
      const od    = p.ownerdraw && p.ownerdraw[0];
      const bg    = p.background && p.background[0];
      const back  = p.backcolor ? colorOfVals(p.backcolor) : null;
      const style = p.style && p.style[0];
      const filled = style === "WINDOW_STYLE_FILLED" || style === "1" || style === "3";
      const isIcon = !!bg || (od && ICON_DRAWS.has(od));

      if(filled && back) el.style.background = rgba([back[0],back[1],back[2],1]);
      if(p.border && p.border[0] !== "0" && p.bordercolor){
        el.style.boxShadow = "inset 0 0 0 " + Math.max(1, numOf((p.bordersize||[])[0], 1) * zoom) +
                             "px " + rgba(colorOfVals(p.bordercolor));
      }

      if(isIcon){
        const url = showArt ? assetUrl(bg || ownerdrawIcon(od)) : null;
        el.title = (bg || od || "") + "  " + Math.round(w) + "×" + Math.round(hh);
        if(url) paintArt(el, url, tint, bg, od, w, hh);
        else    drawPlaceholder(el, bg, od, tint, w, hh);
      } else if(od && AREA_DRAWS[od]){
        const ar = h("div", { class:"area", text:AREA_DRAWS[od] });
        if(od === "CG_TEAM_COLORIZED")
          ar.style.background = sim.team === "blue" ? "rgba(70,110,255,.45)" : "rgba(220,60,50,.45)";
        el.appendChild(ar);
      }

      let txt = null;
      if(p.text) txt = p.text.join(" ");
      else if(od && !isIcon && !AREA_DRAWS[od]) txt = ownerdrawText(od);

      if(txt){
        const sc   = scaleOf(item);
        const capU = CAP_PER_SCALE * sc;
        const fsU  = capU / fm.cap;
        const kx   = (ADV_PER_CAP * fm.cap / fm.adv) * tf.s;
        const wU   = textWidth(txt, fsU) * kx;
        const al   = alignOf(item);
        const drawX = al === 1 ? x - wU/2 : al === 2 ? x - wU : x;
        const padU = (fm.base - fm.cap) * fsU;
        const topU = baselineOf(item, r[1]) - capU - padU;
        const t = h("div", { class:"txt", text:txt });
        t.style.left = ((drawX - x) * zoom) + "px";
        t.style.top  = ((topU  - y) * zoom) + "px";
        t.style.font = "700 " + (fsU * zoom) + "px " + FONT_STACK;
        t.style.color = rgba([tint[0],tint[1],tint[2],1]);
        t.style.transform = "scaleX(" + kx + ")";
        const ts = p.textstyle && p.textstyle[0];
        if(ts === "3" || ts === "5" || ts === "6" || ts === "ITEM_TEXTSTYLE_SHADOWED")
          t.style.textShadow = Math.max(1, zoom*.8) + "px " + Math.max(1, zoom*.8) + "px 0 rgba(0,0,0,.6)";
        el.style.overflow = "visible";
        el.appendChild(t);

        if(isSel(item)){
          const mk = h("div", { class:"mark" });
          mk.style.left   = ((drawX - x) * zoom) + "px";
          mk.style.top    = ((baselineOf(item, r[1]) - capU - y) * zoom) + "px";
          mk.style.width  = (wU * zoom) + "px";
          mk.style.height = (capU * zoom) + "px";
          el.appendChild(mk);
        }
      }

      el._paints = paints;
      el.style.pointerEvents = (txt && !paints) ? "none" : "auto";
      screenEl.appendChild(el);
    }
  }
  drawHandles();
}

function paintArt(el, url, tint, bg, od, w, hh){
  const wrap = h("div", { class:"art" });
  const im = h("img", { alt:"", draggable:"false" });
  im.onerror = () => { wrap.remove(); drawPlaceholder(el, bg, od, tint, w, hh); };
  im.src = url;
  wrap.appendChild(im);
  if(tint && (tint[0] < .97 || tint[1] < .97 || tint[2] < .97)){
    const t = h("div", { class:"tint" });
    t.style.background = rgba([tint[0],tint[1],tint[2],1]);
    t.style.webkitMaskImage = t.style.maskImage = "url(" + url + ")";
    wrap.appendChild(t);
  }
  el.appendChild(wrap);
}

function drawHandles(){
  const p = primary();
  if(!p || sel.length !== 1) return;
  const visW = VH * aspect;

  if(p.kind === "menu"){
    const r = rectOf(P(p)) || [0,0,0,0];
    const tf = xform(p, visW);
    const o = h("div", { id:"origin", title:"Block origin – drags the whole block" });
    o.style.left = ((r[0]*tf.s + tf.t) * zoom) + "px";
    o.style.top  = (r[1] * zoom) + "px";
    o._menu = p;
    screenEl.appendChild(o);
    return;
  }
  const r = absRect(p);
  if(!r) return;
  const tf = xform(p.menu, visW);
  const x = (r[0]*tf.s + tf.t) * zoom, y = r[1] * zoom;

  if(textOnly(p)){
    const a = h("div", { id:"anchor", title:"rect.x / rect.y – the text is anchored here " +
      "(y is the baseline). Width and height are in the sidebar." });
    a.style.left = x + "px";
    a.style.top  = y + "px";
    screenEl.appendChild(a);
    return;
  }

  const w = Math.max(r[2]*tf.s, 0) * zoom, hh = Math.max(r[3], 0) * zoom;
  const at = { nw:[0,0], n:[w/2,0], ne:[w,0], e:[w,hh/2], se:[w,hh], s:[w/2,hh], sw:[0,hh], w:[0,hh/2] };
  for(const k in at){
    const el = h("div", { class:"hnd " + k });
    el.style.left = (x + at[k][0]) + "px";
    el.style.top  = (y + at[k][1]) + "px";
    el._resize = k;
    screenEl.appendChild(el);
  }
}

const hiddenView = new Set();
const isHidden = t => hiddenView.has(t) || (t.kind === "item" && hiddenView.has(t.menu));

function toggleEye(t, ev){
  ev.stopPropagation();
  hiddenView.has(t) ? hiddenView.delete(t) : hiddenView.add(t);
  refresh(true);
}

function highlight(t, on){
  for(const el of screenEl.querySelectorAll(".el"))
    if(el._item === t) el.classList.toggle("hl", on);
}

function itemMatches(item, q){
  if(!q) return true;
  const p = P(item);
  const hay = [nameOf(item), (p.ownerdraw||[])[0], (p.background||[])[0], (p.text||[]).join(" "),
               nameOf(item.menu)].join(" ").toLowerCase();
  return hay.includes(q);
}

function eyeBtn(t){
  const off = hiddenView.has(t);
  return h("button", { class:"eye", onclick:e => toggleEye(t, e),
    title:off ? "show again" : "hide in editor (file stays untouched)" },
    off ? "○" : "●");
}

function layerRow(item, withMenu){
  const r = absRect(item);
  const dirty = edits.props.has(item) || item.isNew;
  const p = P(item);
  const what = (p.ownerdraw && p.ownerdraw[0]) || (p.background && p.background[0]) ||
               (p.text && ('"' + p.text.join(" ") + '"')) || "";
  const row = h("div", {
    class:"item" + (isSel(item) ? (item === primary() ? " sel" : " sel sel2") : "") +
          (isVisible(item) ? "" : " hidden-el") + (isHidden(item) ? " off" : "") +
          (edits.isRemoved(item) ? " gone" : "") + (dirty ? " edited" : ""),
    title:nameOf(item.menu) + "  ·  " + what +
          "  –  click selects, double-click shows the properties",
    onclick:e => { pick(item, e); scrollToSel(); },
    ondblclick:()=>showTab("prop")
  },
    eyeBtn(item),
    h("span", { class:"nm" }, item.isNew ? h("span", { class:"nw", text:"＋ " }) : null,
      (withMenu ? nameOf(item.menu) + " · " : "") + nameOf(item)),
    r ? h("span", { class:"rc", text:nice(r[0]) + "," + nice(r[1]) }) : null);
  row.onmouseenter = ()=>highlight(item, true);
  row.onmouseleave = ()=>highlight(item, false);
  return row;
}

function buildTree(){
  const box = $("tree");
  box.innerHTML = "";
  buildStack();
  if(!docs.length) return;
  const q = $("treeFilter").value.trim().toLowerCase();
  const onlyVis  = $("treeOnlyVis").checked;
  const onlyEdit = $("treeOnlyEdit").checked;
  const frag = document.createDocumentFragment();

  for(const doc of [...docs].reverse()){
    const fileRow = h("div", { class:"file" },
      h("span", { text:doc.fileName }),
      h("span", { class:"cnt", style:"color:var(--dim)",
                  text:doc.menus.reduce((n,m)=>n+m.items.length,0) + " items" }));
    if(docs.length > 1)
      fileRow.appendChild(h("button", { class:"mini x", title:"Close file",
        onclick:()=>closeDoc(doc) }, "×"));
    let any = false;
    const block = document.createDocumentFragment();

    for(const menu of [...doc.menus].reverse()){
      const items = menu.items.filter(it =>
        itemMatches(it, q) &&
        (!onlyVis  || isVisible(it)) &&
        (!onlyEdit || edits.props.has(it) || edits.isRemoved(it) || it.isNew)).reverse();
      if(!items.length && !(q && nameOf(menu).toLowerCase().includes(q))) continue;
      any = true;

      const md = h("div", { class:"menu" });
      const head = h("div", {
        class:"mname" + (isSel(menu) ? " sel" : "") + (hiddenView.has(menu) ? " off" : ""),
        title:"Block – click to edit origin and widescreen",
        onclick:e => { pick(menu, e); scrollToSel(); },
        ondblclick:()=>showTab("prop")
      }, eyeBtn(menu), h("span", { class:"nm", text:nameOf(menu) }),
         h("span", { class:"cnt", text:items.length }),
         h("button", { class:"mini", title:"new item in this block",
                       onclick:e => { e.stopPropagation(); newItem(menu); } }, "＋"));
      md.appendChild(head);
      for(const item of items) md.appendChild(layerRow(item));
      block.appendChild(md);
    }
    if(any || !q){ frag.appendChild(fileRow); frag.appendChild(block); }
  }
  box.appendChild(frag);
}

let stack = [];

function elBoxes(el){
  const kids = el.querySelectorAll(".txt, .art, .ico, .area");
  const boxes = (el._paints || !kids.length) ? [el.getBoundingClientRect()] : [];
  for(const k of kids) boxes.push(k.getBoundingClientRect());
  return boxes;
}

function stackAt(clientX, clientY){
  const out = [];
  for(const el of screenEl.querySelectorAll(".el")){
    if(!el._item) continue;
    if(elBoxes(el).some(b => clientX >= b.left - 2 && clientX <= b.right + 2 &&
                             clientY >= b.top  - 2 && clientY <= b.bottom + 2)) out.push(el._item);
  }
  return out.reverse();
}

function setStack(list){ stack = list; buildStack(); }

function buildStack(){
  const box = $("stackList");
  if(!box) return;
  stack = stack.filter(t => t.menu && t.menu.items.includes(t) && !edits.isRemoved(t));
  $("stackGrp").hidden = !stack.length;
  box.innerHTML = "";
  for(const it of stack) box.appendChild(layerRow(it, true));
}

function pick(t, ev){
  const add = ev && (ev.ctrlKey || ev.metaKey || ev.shiftKey);
  if(!t){ sel = []; }
  else if(add){
    if(sel.length && sel[0].kind !== t.kind) sel = [t];
    else if(isSel(t)) sel = sel.filter(x => x !== t);
    else sel = sel.concat([t]);
  } else sel = [t];
  refresh(true);
}

function visRows(item){
  const rows = [];
  const yn = ok => ok ? '<span class="yes">✓</span>' : '<span class="no">✗</span>';
  const p = P(item), mp = P(item.menu);

  if(offSwitch(p.visible))  rows.push(["visible", "0 – switched off " + yn(false)]);
  if(offSwitch(mp.visible)) rows.push(["Block visible", "0 " + yn(false)]);

  const mg = gtOfProps(mp);
  if(!sameSet(mg, setOf(ALL_GT)))
    rows.push(["Block modes", gtLabel(mg) + " " + yn(mg.has(sim.gametype))]);

  const ig = gtOfProps(p);
  rows.push(["Modes", gtLabel(ig) + " " + yn(ig.has(sim.gametype))]);

  for(const [props,label] of [[mp,"Block flag"],[p,"Flag"]])
    for(const f of (props.ownerdrawflag || []))
      if(!GT_FLAGS[f]) rows.push([label, esc(f) + " " + yn(otherFlagOK(f))]);

  for(const [props,label] of [[mp,"Block cvar"],[p,"Cvar"]]){
    const cv = props.cvarTest && props.cvarTest[0];
    if(!cv || cv === "cg_gametype") continue;
    const mode = props.showCvar ? "showCvar" : (props.hideCvar ? "hideCvar" : "—");
    const list = (props.showCvar || props.hideCvar || []).join(",");
    rows.push([label, esc(cv) + " " + mode + " {" + esc(list) + "} · now " +
      (sim.cvars[cv] === undefined ? "not set" : sim.cvars[cv]) + " " + yn(cvarOK(props))]);
  }

  const od = p.ownerdraw && p.ownerdraw[0];
  const v  = od ? ownerdrawValue(od) : null;
  if(v !== null && p.addColorRange){
    const r = pickRange(p.addColorRange, v);
    if(r && numOf(r[5],1) === 0)
      rows.push(["addColorRange", "value " + v + " is in " + r[0] + ".." + r[1] +
                 " with alpha 0 – invisible " + yn(false)]);
    else if(!r)
      rows.push(["addColorRange", "value " + v + " is in no range – white " + yn(true)]);
  }
  if(!rows.length) rows.push(["", "no conditions – always visible"]);
  return rows;
}

function renderSelection(){
  const one = sel.length === 1 ? sel[0] : null;
  $("propEmpty").hidden = sel.length !== 0;
  $("propMulti").hidden = sel.length < 2;
  $("propBody").hidden  = sel.length !== 1;
  renderCopyTo();
  if(sel.length >= 2){ renderMulti(); return; }
  if(!one) return;

  const isMenu = one.kind === "menu";
  $("propName").textContent = (one.isNew ? "＋ " : "") + nameOf(one) +
                              (edits.isRemoved(one) ? "  (deleted)" : "");
  $("propMenu").textContent = isMenu
    ? one.doc.fileName + "  ·  Block  ·  " + wsMode(P(one))
    : nameOf(one.menu) + "  ·  " + one.doc.fileName + "  ·  " + wsMode(P(one.menu));

  const r = itemRect(one) || [0,0,0,0];
  ["pX","pY","pW","pH"].forEach((id,i) => { if(document.activeElement.id !== id) $(id).value = nice(r[i]); });
  if(isMenu){
    $("pAbs").textContent = "Block origin – moves all " + one.items.length + " items";
  } else {
    const [ox,oy] = menuOffset(one.menu);
    $("pAbs").textContent = (ox || oy)
      ? "relative to block (" + nice(ox) + " " + nice(oy) + ")  →  absolute " + nice(r[0]+ox) + " / " + nice(r[1]+oy)
      : "absolute values";
    if(textOnly(one))
      $("pAbs").textContent += "  ·  y is the text baseline; " +
        "w and h only clip it in game – in the preview the text hangs from the x/y point.";
  }

  renderGT(one);

  $("propVis").innerHTML = isMenu
    ? '<div><span class="k">Block</span><span class="v">' + esc(gtLabel(gtOfProps(P(one)))) + "</span></div>"
    : visRows(one).map(([k,v]) => '<div><span class="k">' + esc(k) + '</span><span class="v">' + v + "</span></div>").join("");

  renderPropEditor(one);
  $("btnDel").textContent = edits.isRemoved(one) ? "restore" : "delete";
  $("btnDup").disabled = isMenu;
  $("grpGT").hidden = false;
}

function renderGT(t){
  const grid = $("propGT");
  const cur  = gtOfProps(P(t));
  grid.innerHTML = "";
  for(const g of GAMETYPES){
    grid.appendChild(h("button", {
      text:g.s, title:g.id + " – " + g.n,
      class:(cur.has(g.id) ? "on " : "") + (g.id === sim.gametype ? "cur" : ""),
      onclick:()=>{ const s = new Set(cur); s.has(g.id) ? s.delete(g.id) : s.add(g.id); setGT([t], s); }
    }));
  }
  const plan = gtPlan(P(t), cur);
  const out  = $("gtOut");
  if(!plan.ok){
    out.className = "hint warn";
    out.innerHTML = "⚠ " + esc(plan.why);
  } else {
    const lines = Object.keys(plan.set).flatMap(k => propLines(k, plan.set[k]));
    out.className = "hint";
    out.innerHTML = lines.length
      ? "File gets: " + lines.map(l => "<code>" + esc(l) + "</code>").join(" · ")
      : "no mode condition – appears everywhere";
  }
}

function renderMulti(){
  const items = sel.filter(t => t.kind === "item");
  $("multiCount").textContent = sel.length;
  $("multiList").innerHTML = sel.map((t,i) =>
    '<div><span class="k">' + (i === 0 ? "▸ " : "") + esc(nameOf(t).slice(0,20)) +
    '</span><span class="v">' + (itemRect(t) || []).slice(0,2).map(nice).join(" / ") + "</span></div>").join("");

  const gt = $("multiGT");
  gt.innerHTML = "";
  for(const g of GAMETYPES){
    const on = sel.every(t => gtOfProps(P(t)).has(g.id));
    const some = !on && sel.some(t => gtOfProps(P(t)).has(g.id));
    gt.appendChild(h("button", { text:g.s, title:g.n, class:(on ? "on" : "") + (some ? " part" : "") +
      (g.id === sim.gametype ? " cur" : ""),
      onclick:()=>{ const s = new Set(gtOfProps(P(sel[0]))); s.has(g.id) ? s.delete(g.id) : s.add(g.id); setGT(sel, s); } }));
  }

  const box = $("multiProps");
  box.innerHTML = "";
  const keys = ["visible","forecolor","backcolor","textscale","textstyle","align","style","ownerdraw"];
  for(const k of keys){
    if(!sel.some(t => P(t)[k] !== undefined)) continue;
    const vals = sel.map(t => (P(t)[k] || []).join(" "));
    const same = vals.every(v => v === vals[0]);
    box.appendChild(propRow(sel[0], k, {
      multi:true, label:k + (same ? "" : " *"),
      onSet:(v)=>{ for(const t of sel) v === null ? edits.unset(t,k) : edits.set(t,k,v); }
    }));
  }
  if(!box.children.length) box.appendChild(h("p", { class:"hint", text:"nothing in common." }));
}

const MENU_KEYS = new Set(["name","rect","visible","fullScreen","widescreen","style","backcolor",
  "forecolor","border","bordercolor","bordersize","background","ownerdrawflag","cvarTest",
  "showCvar","hideCvar","font","outOfBoundsClick","popup"]);

const allowedKeys = t => t.kind === "menu"
  ? Object.keys(PROPS).filter(k => MENU_KEYS.has(k))
  : Object.keys(PROPS).filter(k => !PROPS[k].only || PROPS[k].only === "item");

function renderPropEditor(t){
  const box = $("propEdit");
  box.innerHTML = "";
  const p = P(t);
  const uniq = Object.keys(p).filter(k => k !== "rect");

  const byGroup = new Map();
  for(const k of uniq){
    const d = propDef(k);
    if(!byGroup.has(d.group)) byGroup.set(d.group, []);
    byGroup.get(d.group).push(k);
  }
  for(const [g, title] of PROP_GROUPS){
    const list = byGroup.get(g);
    if(!list || !list.length) continue;
    const grp = h("div", { class:"pgroup" }, h("div", { class:"ph", text:title }));
    list.sort();
    for(const k of list) grp.appendChild(propRow(t, k, {}));
    box.appendChild(grp);
  }
  if(!box.children.length)
    box.appendChild(h("p", { class:"hint", text:"This item has no properties besides rect." }));

  const selEl = $("addPropSel");
  selEl.innerHTML = "";
  selEl.appendChild(h("option", { value:"", text:"＋ Property …" }));
  for(const [g, title] of PROP_GROUPS){
    const opts = allowedKeys(t).filter(k => propDef(k).group === g && p[k] === undefined);
    if(!opts.length) continue;
    const og = h("optgroup", { label:title });
    for(const k of opts) og.appendChild(h("option", { value:k, text:k }));
    selEl.appendChild(og);
  }
}

function defaultVal(key){
  const d = propDef(key);
  switch(d.type){
    case "color":  return ["1","1","1","1"];
    case "num":    return [key === "textscale" ? "0.5" : "1"];
    case "enum":   return [d.opts[0][0]];
    case "bool":   return [];
    case "flags":  return ["CG_SHOW_ANYTEAMGAME"];
    case "ranges": return [["0","100","1","1","1","1"]];
    case "rect":   return ["0","0","32","32"];
    case "list":   return ["1"];
    default:       return [""];
  }
}

function propRow(t, key, o){
  o = o || {};
  const d = propDef(key);
  const vals = P(t)[key];
  const dirty = o.multi ? sel.some(x => edits.isDirty(x, key)) : edits.isDirty(t, key);
  const wide = d.type === "flags" || d.type === "ranges";

  let touched = false;
  const apply = (v, isLive) => {
    if(!touched){ pushUndo(); touched = true; }
    if(o.onSet) o.onSet(v);
    else if(v === null) edits.unset(t, key);
    else edits.set(t, key, v);
    if(isLive){ renderStage(); markDirtyRow(row, t, key); updateDirty(); buildTree(); }
    else refresh(true);
  };
  const commit = v => apply(v, false);
  const live   = v => apply(v, true);

  const pv = h("div", { class:"pv" });
  const row = h("div", { class:"prow" + (dirty ? " dirty" : "") + (wide ? " wide" : "") },
    h("span", { class:"pk", title:(d.info || key), text:(o.label || key) }), pv,
    h("span", { class:"pact" },
      dirty ? h("button", { title:"revert to the value from the file", text:"↺",
                            onclick:()=>{ pushUndo(); edits.revert(t, key); refresh(false); } }) : null,
      h("button", { title:"remove property", text:"×", onclick:()=>commit(null) })));

  buildControl(pv, d, vals, live, commit, t, key);
  pv.addEventListener("focusout", ()=>{ touched = false; });
  return row;
}

function markDirtyRow(row, t, key){
  row.classList.toggle("dirty", edits.isDirty(t, key));
}

function buildControl(pv, d, vals, live, commit, t, key){
  const v0 = (vals && vals[0] !== undefined) ? String(vals[0]) : "";

  switch(d.type){

  case "color": {
    const c = colorOfVals(vals);
    const sw = h("button", { class:"swatch", title:"pick color" });
    const inner = h("i"); inner.style.background = rgba(c); sw.appendChild(inner);
    const pick = h("input", { type:"color", value:rgbHex(c) });
    const alpha = h("input", { type:"range", class:"alpha", min:0, max:100, value:Math.round(c[3]*100),
                               title:"Alpha " + nice(c[3]) });
    const txt = h("input", { type:"text", value:(vals || []).join(" "), style:"flex:1;font-family:var(--mono)" });
    const put = (arr, isLive) => {
      inner.style.background = rgba(arr);
      txt.value = arr.map(nice).join(" ");
      (isLive ? live : commit)(arr.map(nice));
    };
    sw.onclick = ()=>pick.click();
    pick.oninput  = ()=>put(hexRgb(pick.value).concat([numOf(alpha.value,100)/100]), true);
    pick.onchange = ()=>put(hexRgb(pick.value).concat([numOf(alpha.value,100)/100]), false);
    alpha.oninput  = ()=>put(hexRgb(pick.value).concat([numOf(alpha.value,100)/100]), true);
    alpha.onchange = ()=>put(hexRgb(pick.value).concat([numOf(alpha.value,100)/100]), false);
    txt.onchange = ()=>{ const a = splitVals(txt.value); if(a.length) commit(a); };
    pv.append(sw, pick, alpha, txt);
    break;
  }

  case "num": {
    const num = h("input", { type:"text", class:"numf", inputmode:"decimal", value:v0 });
    const rng = (d.min !== undefined) ? h("input", { type:"range", class:"alpha",
      min:d.min, max:d.max, step:(d.step || 1), value:numOf(v0, 0) }) : null;
    num.oninput  = ()=>{ const v = parseNum(num.value); if(v === null) return;
                         if(rng) rng.value = v; live([v]); };
    num.onchange = ()=>{ const v = parseNum(num.value);
                         if(v === null){ num.value = v0; return; }
                         num.value = v; commit([v]); };
    if(rng){ rng.oninput  = ()=>{ num.value = rng.value; live([rng.value]); };
             rng.onchange = ()=>commit([rng.value]); }
    pv.append(num);
    if(rng) pv.append(rng);
    break;
  }

  case "enum": {
    const s = h("select");
    const known = d.opts.some(([val]) => val === v0);
    if(v0 === "") s.appendChild(h("option", { value:"", text:"— not set", selected:true }));
    for(const [val,lab] of d.opts) s.appendChild(h("option", { value:val, text:lab }));
    if(!known && v0 !== "") s.appendChild(h("option", { value:v0, text:v0, selected:true }));
    s.value = v0;
    s.onchange = ()=>{ if(s.value !== "") commit([s.value]); };
    pv.append(s);
    break;
  }

  case "bool": {
    const cb = h("input", { type:"checkbox", checked:vals !== undefined });
    cb.onchange = ()=>commit(cb.checked ? [] : null);
    pv.append(h("label", { class:"chip" }, cb, h("span", { text:"set" })));
    break;
  }

  case "flags": {
    const cur = new Set(vals || []);
    const box = h("div", { class:"fchips" });
    const toggle = f => { const s = new Set(cur); s.has(f) ? s.delete(f) : s.add(f);
                          commit(s.size ? [...s] : null); };
    for(const f of ALL_FLAGS.concat([...cur].filter(f => !ALL_FLAGS.includes(f))))
      box.appendChild(h("button", { class:(cur.has(f) ? "on " : "") + (GT_FLAGS[f] ? "gt" : ""),
        title:GT_FLAGS[f] ? "game mode – better set it above under 'Show in'" : f,
        text:f.replace(/^CG_SHOW_/,""), onclick:()=>toggle(f) }));
    pv.append(box);
    break;
  }

  case "asset": {
    const txt = h("input", { type:"text", value:v0, list:"assetList", placeholder:"ui/assets/hud/…" });
    const th = h("div", { class:"thumb" });
    const set = u => { const url = assetUrl(u); th.style.backgroundImage = url ? "url(" + url + ")" : "none";
                       th.title = url ? u : "no file in assets/game"; th.style.borderColor = url ? "" : "var(--warn)"; };
    set(v0);
    txt.oninput  = ()=>{ set(txt.value); live([txt.value]); };
    txt.onchange = ()=>commit([txt.value]);
    pv.append(txt, th);
    break;
  }

  case "ranges": {
    const list = (vals || []).map(r => r.slice());
    const box = h("div", { class:"rangeed" });
    const p = P(t);
    const od = (p.ownerdraw || [])[0];
    const cur = od ? ownerdrawValue(od) : null;
    const act = cur !== null ? pickRange(list, cur) : null;
    const write = ()=>commit(list.length ? list : null);

    list.forEach((r,i)=>{
      const c = colorOfVals(r.slice(2,6));
      const a = h("input", { type:"number", value:r[0], step:1, title:"from" });
      const b = h("input", { type:"number", value:r[1], step:1, title:"to" });
      const sw = h("button", { class:"swatch", title:"Color" });
      const inner = h("i"); inner.style.background = rgba(c); sw.appendChild(inner);
      const pk = h("input", { type:"color", value:rgbHex(c) });
      const al = h("input", { type:"range", class:"alpha", min:0, max:100, value:Math.round(c[3]*100), title:"Alpha" });
      const upd = ()=>{ const nc = hexRgb(pk.value).concat([numOf(al.value,100)/100]);
                        inner.style.background = rgba(nc);
                        list[i] = [a.value, b.value].concat(nc.map(nice)); };
      sw.onclick = ()=>pk.click();
      [a,b].forEach(x => { x.onchange = ()=>{ upd(); write(); }; });
      pk.oninput = ()=>{ upd(); edits.set(t, key, list.map(x=>x.slice())); renderStage(); };
      al.oninput = pk.oninput;
      pk.onchange = al.onchange = ()=>{ upd(); write(); };
      box.appendChild(h("div", { class:"rangerow" + (r === act ? " act" : "") },
        a, h("span", { text:"–" }), b, sw, pk, al,
        h("button", { class:"mini", text:"×", title:"remove range",
                      onclick:()=>{ list.splice(i,1); write(); } })));
    });
    box.appendChild(h("button", { class:"mini", text:"＋ Range",
      onclick:()=>{ list.push(["0","100","1","1","1","1"]); write(); } }));
    if(list.length > 10)
      box.appendChild(h("p", { class:"hint warn",
        text:"⚠ " + list.length + " ranges – the engine only evaluates the first 10" }));
    pv.append(box);
    break;
  }

  case "list": {
    const txt = h("input", { type:"text", value:(vals || []).join(" "),
                             placeholder:"separate values with spaces" });
    txt.onchange = ()=>{ const a = splitVals(txt.value); commit(a.length ? a : null); };
    pv.append(txt);
    break;
  }

  default: {
    const txt = h("input", { type:"text", value:(vals || []).join(" ") });
    txt.oninput  = ()=>{ const a = splitVals(txt.value); if(a.length) live(a); };
    txt.onchange = ()=>{ const a = splitVals(txt.value); commit(a.length ? a : [""]); };
    pv.append(txt);
  }
  }
}

function changeCount(){
  return edits.count() + allItems().filter(i => i.isNew && !edits.props.has(i)).length;
}
function updateDirty(){
  const n = changeCount();
  const dirty = docs.filter(docDirty);
  const save = $("btnSave");
  save.disabled  = !n;
  save.textContent = dirty.length > 1 ? "Save (" + dirty.length + ")" : "Save";
  save.title = !dirty.length ? "nothing to save"
             : dirty.length === 1 ? "download " + dirty[0].fileName
             : "download " + dirty.map(d => d.fileName).join(", ") + " as hud.zip";
  $("btnReset").disabled = !n;
  $("chCount").textContent = n;
  $("changesBar").hidden = !n;
  const b = $("tabBadge");
  b.hidden = !n; b.textContent = n;
}

function setRect(t, r){
  edits.set(t, "rect", r.map(nice));
}

function setGT(targets, set){
  pushUndo();
  let bad = 0;
  for(const t of targets){
    const plan = gtPlan(P(t), set);
    if(!plan.ok){ bad++; status("⚠ " + nameOf(t) + ": " + plan.why.split(".")[0]); continue; }
    for(const k in plan.set) edits.set(t, k, plan.set[k]);
    for(const k of plan.unset) edits.unset(t, k);
  }
  refresh(true);
  if(bad && targets.length > 1) status(bad + " item(s) could not take the mode.");
}

function nudge(dx, dy){
  const targets = sel.filter(t => itemRect(t));
  if(!targets.length) return;
  pushUndo();
  for(const t of targets){ const r = itemRect(t); r[0] += dx; r[1] += dy; setRect(t, r); }
  refresh(false);
}

function duplicateSel(){
  const items = sel.filter(t => t.kind === "item" && !edits.isRemoved(t));
  if(!items.length) return;
  pushUndo();
  const made = [];
  for(const src of items){
    const props = {};
    for(const [k,v] of Object.entries(P(src))) props[k] = Array.isArray(v) ? v.map(x => Array.isArray(x) ? x.slice() : x) : v;
    const r = rectOf(props) || [0,0,0,0];
    props.rect = [r[0]+8, r[1]+8, r[2], r[3]].map(nice);
    const copy = { kind:"item", name:nameOf(src), props, lineOf:{}, isNew:true, after:src,
                   menu:src.menu, doc:src.doc, openIndent:src.openIndent, indent:src.indent,
                   line:src.line, endLine:src.endLine };
    src.menu.items.splice(src.menu.items.indexOf(src) + 1, 0, copy);
    made.push(copy);
  }
  sel = made;
  refresh(true);
  status(made.length + " copy/copies created – they are written to the file on save.");
}

function copyItemsTo(menu, targets, keepScreenPos){
  const items = targets.filter(t => t.kind === "item" && !edits.isRemoved(t));
  if(!menu || !items.length) return;
  pushUndo();

  const visW = VH * aspect;
  const dst  = xform(menu, visW);
  const [dox, doy] = menuOffset(menu);
  const anchor = [...menu.items].reverse().find(it => !it.isNew) || null;
  const last   = menu.items[menu.items.length - 1] || null;

  const made = [];
  for(const src of items){
    const props = {};
    for(const [k,v] of Object.entries(P(src)))
      props[k] = Array.isArray(v) ? v.map(x => Array.isArray(x) ? x.slice() : x) : v;

    const r = rectOf(props);
    if(r && keepScreenPos && src.menu !== menu){
      const s = xform(src.menu, visW);
      const [sox, soy] = menuOffset(src.menu);
      const rest = props.rect.slice(4);
      props.rect = [ ((r[0] + sox) * s.s + s.t - dst.t) / dst.s - dox,
                     r[1] + soy - doy,
                     r[2] * s.s / dst.s,
                     r[3] ].map(nice).concat(rest);
    }

    const copy = { kind:"item", name:nameOf(src), props, lineOf:{}, isNew:true, after:anchor,
                   menu, doc:menu.doc,
                   openIndent: last ? last.openIndent : menu.indent,
                   indent:     last ? last.indent     : menu.indent + "\t",
                   line:menu.endLine, endLine:menu.endLine };
    menu.items.push(copy);
    made.push(copy);
  }

  sel = made;
  refresh(true); showTab("prop"); scrollToSel();
  status(made.length + ' item(s) copied to "' + nameOf(menu) + '" in ' + menu.doc.fileName +
         " – they are written to the file on save.");
}

function renderCopyTo(){
  const grp = $("grpCopyTo");
  if(!grp) return;
  grp.hidden = !sel.length;
  if(!sel.length) return;

  const items  = sel.filter(t => t.kind === "item" && !edits.isRemoved(t));
  const box    = $("copyToSel");
  const prev   = box.value;
  const from   = new Set(items.map(t => t.menu));
  const srcDoc = items.length ? items[0].doc : null;
  let first = "", other = "";
  box.innerHTML = "";
  docs.forEach((d, di) => {
    const g = h("optgroup", { label:d.fileName });
    d.menus.forEach((m, mi) => {
      const v = di + "/" + mi;
      g.appendChild(h("option", { value:v,
        text:(docs.length > 1 ? d.fileName + " › " : "") + nameOf(m) +
             (from.has(m) ? "  (source)" : "") }));
      if(!first) first = v;
      if(!other && d !== srcDoc) other = v;
    });
    if(g.children.length) box.appendChild(g);
  });
  box.value = [...box.options].some(o => o.value === prev) ? prev : (other || first);

  $("copyToBtn").disabled = !items.length;
  $("copyToInfo").textContent = !items.length
    ? "Blocks cannot be copied this way – please select items."
    : docs.length < 2
      ? items.length + " item(s) · for another HUD, load the second .menu with ＋ File at the top."
      : items.length + " item(s) will be created as copies.";
}

function newItem(menu){
  const p = primary();
  menu = menu || (p ? (p.kind === "menu" ? p : p.menu) : (docs[0] && docs[0].menus[0]));
  if(!menu) return;
  pushUndo();
  const last = menu.items[menu.items.length - 1] || null;
  const it = {
    kind:"item", name:"NEW", doc:menu.doc, menu, isNew:true, after:last, lineOf:{},
    props:{ name:["NEW"], rect:["0","0","64","32"], visible:["1"],
            style:["WINDOW_STYLE_FILLED"], backcolor:["1","1","1","0.4"] },
    openIndent: last ? last.openIndent : menu.indent,
    indent:     last ? last.indent     : menu.indent + "\t",
    line: menu.endLine, endLine: menu.endLine
  };
  menu.items.push(it);
  sel = [it];
  refresh(true); showTab("prop"); scrollToSel();
  status('New item created in "' + nameOf(menu) + '".');
}

function getInsertionMenu(){
  const p = primary();
  if(p){
    if(p.kind === "menu") return p;
    if(p.menu) return p.menu;
  }
  return docs[0] && docs[0].menus[0];
}

function insertHudTemplate(template){
  const menu = getInsertionMenu();
  if(!menu) return;
  pushUndo();
  const last = menu.items[menu.items.length - 1] || null;
  const props = {
    name: [template.name || template.label],
    rect: (template.rect || [0,0,64,32]).map(String),
    visible: ["1"],
    textscale: [String(template.textscale || "1")],
    align: [template.align || "ITEM_ALIGN_LEFT"],
    forecolor: ["1","1","1","1"]
  };
  if(template.ownerdraw) props.ownerdraw = [template.ownerdraw];
  if(template.background) props.background = [template.background];
  if(template.style) props.style = [template.style];
  if(template.text) props.text = [template.text];
  if(template.backcolor) props.backcolor = template.backcolor;
  if(template.forecolor) props.forecolor = template.forecolor;
  const it = {
    kind:"item", name: template.label, doc: menu.doc, menu, isNew:true, after:last, lineOf:{},
    props,
    openIndent: last ? last.openIndent : menu.indent,
    indent: last ? last.indent : menu.indent + "\t",
    line: menu.endLine, endLine: menu.endLine
  };
  menu.items.push(it);
  sel = [it];
  refresh(true); showTab("prop"); scrollToSel();
  status('"' + template.label + '" inserted into "' + nameOf(menu) + '".');
}

function renderTemplateList(){
  const box = $("templateList");
  if(!box) return;
  box.innerHTML = "";
  for(const tpl of HUD_OBJECT_TEMPLATES){
    const btn = h("button", {
      class:"tmpl-item",
      text: tpl.label,
      title: tpl.ownerdraw || tpl.background || "insert HUD object",
      onclick: ()=> insertHudTemplate(tpl)
    });
    box.appendChild(btn);
  }
}

function scrollToSel(){
  const p = primary();
  if(!p) return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const el = [...screenEl.querySelectorAll(".el")].find(e => e._item === p) ||
               (p.kind === "menu" ? $("origin") : null);
    if(el) el.scrollIntoView({ block:"nearest", inline:"nearest" });
  }));
}

function deleteSel(){
  const items = sel.filter(t => t.kind === "item");
  if(!items.length) return;
  pushUndo();
  for(const it of items){
    if(it.isNew){ const a = it.menu.items; a.splice(a.indexOf(it), 1); edits.revertTarget(it); }
    else if(edits.isRemoved(it)) edits.restoreRemoved(it);
    else edits.remove(it);
  }
  sel = sel.filter(t => t.kind === "menu" || t.menu.items.includes(t));
  refresh(true);
}

function alignSel(mode){
  const items = sel.filter(t => itemRect(t));
  if(items.length < 2) return;
  pushUndo();
  const R = t => itemRect(t);
  const ref = R(items[0]);
  const setR = (t, f) => { const r = R(t); f(r); setRect(t, r); };

  if(mode === "left")    items.forEach(t => setR(t, r => r[0] = ref[0]));
  if(mode === "right")   items.forEach(t => setR(t, r => r[0] = ref[0] + ref[2] - r[2]));
  if(mode === "hcenter") items.forEach(t => setR(t, r => r[0] = ref[0] + (ref[2]-r[2])/2));
  if(mode === "top")     items.forEach(t => setR(t, r => r[1] = ref[1]));
  if(mode === "bottom")  items.forEach(t => setR(t, r => r[1] = ref[1] + ref[3] - r[3]));
  if(mode === "vcenter") items.forEach(t => setR(t, r => r[1] = ref[1] + (ref[3]-r[3])/2));
  if(mode === "sw")      items.forEach(t => setR(t, r => r[2] = ref[2]));
  if(mode === "sh")      items.forEach(t => setR(t, r => r[3] = ref[3]));
  if(mode === "dh" || mode === "dv"){
    const i = mode === "dh" ? 0 : 1, j = i + 2;
    const s = items.slice().sort((a,b) => R(a)[i] - R(b)[i]);
    const lo = R(s[0])[i], hi = R(s[s.length-1])[i];
    const step = (hi - lo) / (s.length - 1);
    s.forEach((t,k) => setR(t, r => r[i] = lo + step*k));
  }
  refresh(false);
}

let drag = null, guides = [];

function clearGuides(){ guides.forEach(g => g.remove()); guides = []; }
function addGuide(cls, pos){
  const g = h("div", { class:"guide " + cls });
  if(cls === "v") g.style.left = pos + "px"; else g.style.top = pos + "px";
  screenEl.appendChild(g); guides.push(g);
}

function snapTargets(exclude){
  const visW = VH * aspect;
  const xs = [0, visW/2, visW, (visW-VW)/2, (visW+VW)/2];
  const ys = [0, VH/2, VH];
  for(const doc of docs) for(const menu of doc.menus){
    const tf = xform(menu, visW);
    for(const it of menu.items){
      if(exclude.includes(it) || edits.isRemoved(it) || isHidden(it)) continue;
      const r = absRect(it);
      if(!r) continue;
      const x = r[0]*tf.s + tf.t, w = r[2]*tf.s;
      xs.push(x, x + w/2, x + w);
      ys.push(r[1], r[1] + r[3]/2, r[1] + r[3]);
    }
  }
  return { xs, ys };
}

function applySnap(cands, edgesX, edgesY){
  const tol = 4.5;
  let bx = null, by = null;
  for(const e of edgesX) for(const c of cands.xs){
    const d = c - e;
    if(Math.abs(d) <= tol && (bx === null || Math.abs(d) < Math.abs(bx.d))) bx = { d, at:c };
  }
  for(const e of edgesY) for(const c of cands.ys){
    const d = c - e;
    if(Math.abs(d) <= tol && (by === null || Math.abs(d) < Math.abs(by.d))) by = { d, at:c };
  }
  return { bx, by };
}

screenEl.addEventListener("mousedown", e=>{
  if(e.button !== 0) return;
  if(panning) return;

  const hnd = e.target.closest(".hnd");
  if(hnd){
    const t = primary();
    const r = itemRect(t);
    if(!r) return;
    pushUndo();
    drag = { mode:"resize", dir:hnd._resize, targets:[t], start:[r.slice()],
             sx:e.clientX, sy:e.clientY, s:xform(t.menu, VH*aspect).s };
    e.preventDefault();
    return;
  }
  const org = e.target.closest("#origin");
  if(org){
    const m = org._menu, r = rectOf(P(m)) || [0,0,0,0];
    pushUndo();
    drag = { mode:"move", targets:[m], start:[r.slice()], sx:e.clientX, sy:e.clientY,
             s:xform(m, VH*aspect).s };
    e.preventDefault();
    return;
  }

  setStack(stackAt(e.clientX, e.clientY));

  const el = e.target.closest(".el");
  if(!el){
    const b = screenEl.getBoundingClientRect();
    drag = { mode:"marquee", x0:(e.clientX-b.left)/zoom, y0:(e.clientY-b.top)/zoom,
             box:h("div", { id:"marquee" }), add:e.ctrlKey || e.metaKey || e.shiftKey };
    screenEl.appendChild(drag.box);
    if(!drag.add) pick(null);
    e.preventDefault();
    return;
  }

  const item = el._item;
  const add = e.ctrlKey || e.metaKey || e.shiftKey;
  let after = null;
  if(!isSel(item)) pick(item, e);
  else if(add) after = "toggleOff";
  else if(sel.length > 1) after = "only";
  if(!$("pane-tree").classList.contains("on")) showTab("prop");
  const targets = sel.filter(t => itemRect(t));
  if(!targets.length) return;
  pushUndo();
  drag = { mode:"move", targets, start:targets.map(t => itemRect(t)), item, after,
           sx:e.clientX, sy:e.clientY, s:xform(item.menu, VH*aspect).s, moved:false };
  e.preventDefault();
});

window.addEventListener("mousemove", e=>{
  if(!drag) return;

  if(drag.mode === "marquee"){
    const b = screenEl.getBoundingClientRect();
    const x1 = (e.clientX-b.left)/zoom, y1 = (e.clientY-b.top)/zoom;
    const x = Math.min(drag.x0,x1), y = Math.min(drag.y0,y1);
    const w = Math.abs(x1-drag.x0), hh = Math.abs(y1-drag.y0);
    Object.assign(drag.box.style, { left:(x*zoom)+"px", top:(y*zoom)+"px",
                                    width:(w*zoom)+"px", height:(hh*zoom)+"px" });
    drag.rect = [x,y,w,hh];
    return;
  }

  const snapOn = $("optSnap").checked && !e.altKey;
  const dxRaw = (e.clientX - drag.sx) / zoom / drag.s;
  const dyRaw = (e.clientY - drag.sy) / zoom;
  clearGuides();

  if(drag.mode === "move"){
    let dx = Math.round(dxRaw), dy = Math.round(dyRaw);
    if(snapOn && drag.targets[0].kind === "item"){
      const t0 = drag.targets[0], r0 = drag.start[0];
      const tf = xform(t0.menu, VH*aspect);
      const [ox,oy] = menuOffset(t0.menu);
      const x = (r0[0]+dx+ox)*tf.s + tf.t, w = r0[2]*tf.s;
      const y = r0[1]+dy+oy, hh = r0[3];
      const { bx, by } = applySnap(snapTargets(drag.targets), [x, x+w/2, x+w], [y, y+hh/2, y+hh]);
      if(bx){ dx += bx.d / tf.s; addGuide("v", bx.at * zoom); }
      if(by){ dy += by.d;        addGuide("h", by.at * zoom); }
    }
    drag.targets.forEach((t,i)=>{
      const r = drag.start[i].slice();
      r[0] += dx; r[1] += dy;
      setRect(t, r);
    });
    drag.moved = dx !== 0 || dy !== 0;
    const r = itemRect(drag.targets[0]);
    status(nameOf(drag.targets[0]) + "  →  " + nice(r[0]) + " / " + nice(r[1]));
  }

  if(drag.mode === "resize"){
    const r = drag.start[0].slice();
    const d = drag.dir;
    let dx = Math.round(dxRaw), dy = Math.round(dyRaw);
    if(d.includes("w")){ r[0] += dx; r[2] -= dx; }
    if(d.includes("e")){ r[2] += dx; }
    if(d.includes("n")){ r[1] += dy; r[3] -= dy; }
    if(d.includes("s")){ r[3] += dy; }
    r[2] = Math.max(0, r[2]); r[3] = Math.max(0, r[3]);
    setRect(drag.targets[0], r);
    status(nameOf(drag.targets[0]) + "  →  " + nice(r[2]) + " × " + nice(r[3]));
  }

  renderStage();
  syncPosFields();
});

window.addEventListener("mouseup", ()=>{
  if(!drag) return;
  if(drag.mode === "marquee"){
    const rct = drag.rect;
    drag.box.remove();
    if(rct && (rct[2] > 2 || rct[3] > 2)){
      const b = screenEl.getBoundingClientRect();
      const L = b.left + rct[0]*zoom, T = b.top + rct[1]*zoom;
      const R = L + rct[2]*zoom, B = T + rct[3]*zoom;
      const hit = [];
      for(const el of screenEl.querySelectorAll(".el")){
        if(!el._item || edits.isRemoved(el._item)) continue;
        if(elBoxes(el).some(x => x.left < R && x.right > L && x.top < B && x.bottom > T))
          hit.push(el._item);
      }
      sel = drag.add ? [...new Set(sel.concat(hit))] : hit;
      if(hit.length) showTab("prop");
    } else if(!drag.add) sel = [];
    drag = null;
    clearGuides();
    refresh(true);
    return;
  }
  if(drag.mode === "move" && !drag.moved){
    if(undoStack.length) undoStack.pop();
    if(drag.after === "toggleOff") sel = sel.filter(x => x !== drag.item);
    else if(drag.after === "only") sel = [drag.item];
  }
  drag = null;
  clearGuides();
  updateUndoButtons();
  refresh(true);
});

screenEl.addEventListener("mousemove", e=>{
  const b = screenEl.getBoundingClientRect();
  $("coord").textContent = Math.round((e.clientX-b.left)/zoom) + " / " + Math.round((e.clientY-b.top)/zoom);
});
screenEl.addEventListener("mouseleave", ()=>{ $("coord").textContent = ""; });

let panning = false, spaceDown = false, panStart = null;
stageEl.addEventListener("mousedown", e=>{
  if(e.button === 1 || (e.button === 0 && spaceDown)){
    panning = true; panStart = { x:e.clientX, y:e.clientY, l:stageEl.scrollLeft, t:stageEl.scrollTop };
    stageEl.classList.add("panning");
    e.preventDefault();
  }
});
window.addEventListener("mousemove", e=>{
  if(!panning) return;
  stageEl.scrollLeft = panStart.l - (e.clientX - panStart.x);
  stageEl.scrollTop  = panStart.t - (e.clientY - panStart.y);
});
window.addEventListener("mouseup", ()=>{ panning = false; stageEl.classList.remove("panning"); });

stageEl.addEventListener("wheel", e=>{
  if(!e.ctrlKey) return;
  e.preventDefault();
  const b = screenEl.getBoundingClientRect();
  const ux = (e.clientX - b.left)/zoom, uy = (e.clientY - b.top)/zoom;
  setZoom(zoom * (e.deltaY < 0 ? 1.12 : 1/1.12));
  requestAnimationFrame(()=>{
    const nb = screenEl.getBoundingClientRect();
    stageEl.scrollLeft += (nb.left + ux*zoom) - e.clientX;
    stageEl.scrollTop  += (nb.top  + uy*zoom) - e.clientY;
  });
}, { passive:false });

function setZoom(z){
  zoom = Math.min(4, Math.max(.4, z));
  $("simZoom").value = Math.round(zoom*100);
  $("vZoom").textContent = Math.round(zoom*100) + "%";
  renderStage();
  saveView();
}
function fitZoom(){
  const w = stageEl.clientWidth - 48, hh = stageEl.clientHeight - 48;
  setZoom(Math.min(w / (VH*aspect), hh / VH));
}

window.addEventListener("keydown", e=>{
  const inField = e.target.matches("input,select,textarea,summary");
  const mod = e.ctrlKey || e.metaKey;

  if(mod && e.key.toLowerCase() === "z" && !e.shiftKey){ e.preventDefault(); return undo(); }
  if(mod && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))){ e.preventDefault(); return redo(); }
  if(mod && e.key.toLowerCase() === "s"){ e.preventDefault(); return saveAll(); }
  if(inField) return;

  if(mod && e.key.toLowerCase() === "d"){ e.preventDefault(); return duplicateSel(); }
  if(mod && e.key.toLowerCase() === "c"){ copyProps(); return; }
  if(mod && e.key.toLowerCase() === "v"){ pasteProps(); return; }
  if(mod && e.key.toLowerCase() === "a"){
    e.preventDefault();
    sel = allItems().filter(it => !edits.isRemoved(it) && ($("optHidden").checked || isVisible(it)));
    return refresh(true);
  }
  if(e.key === " "){ spaceDown = true; stageEl.classList.add("pan"); e.preventDefault(); return; }
  if(e.key === "Delete" || e.key === "Backspace"){ e.preventDefault(); return deleteSel(); }
  if(e.key === "Escape"){ pick(null); return; }
  if(e.key.toLowerCase() === "f"){ fitZoom(); return; }

  if(e.key === "ArrowLeft")  { nudge(-1,0); e.preventDefault(); }
  if(e.key === "ArrowRight") { nudge(1,0);  e.preventDefault(); }
  if(e.key === "ArrowUp")    { nudge(0,-1); e.preventDefault(); }
  if(e.key === "ArrowDown")  { nudge(0,1);  e.preventDefault(); }
});
window.addEventListener("keyup", e=>{
  if(e.key === " "){ spaceDown = false; stageEl.classList.remove("pan"); }
});

function copyProps(){
  const t = primary();
  if(!t) return;
  clipProps = {};
  for(const [k,v] of Object.entries(P(t)))
    if(k !== "rect" && k !== "name") clipProps[k] = Array.isArray(v) ? v.map(x => Array.isArray(x) ? x.slice() : x) : v;
  status(Object.keys(clipProps).length + " properties copied.");
}
function pasteProps(){
  if(!clipProps || !sel.length) return;
  pushUndo();
  for(const t of sel) for(const k in clipProps) edits.set(t, k, clipProps[k]);
  refresh(true);
  status("Properties applied to " + sel.length + " item(s).");
}

function syncPosFields(){
  if(sel.length !== 1) return;
  const r = itemRect(sel[0]);
  if(!r) return;
  ["pX","pY","pW","pH"].forEach((id,i) => { if(document.activeElement.id !== id) $(id).value = nice(r[i]); });
}

function updateChanges(){
  const box = $("changes");
  const out = [];
  for(const [t,m] of edits.props){
    const what = [...m.keys()].join(", ");
    out.push(h("div", { class:"ch", onclick:()=>{ sel = [t]; refresh(true); showTab("prop"); } },
      h("b", { text:nameOf(t) }), " " + what));
  }
  for(const t of edits.removed)
    out.push(h("div", { class:"ch", style:"color:var(--err)",
      onclick:()=>{ sel = [t]; refresh(true); showTab("prop"); } }, h("b", { text:nameOf(t) }), " deleted"));
  for(const it of allItems()) if(it.isNew && !edits.props.has(it))
    out.push(h("div", { class:"ch", style:"color:var(--ok)",
      onclick:()=>{ sel = [it]; refresh(true); showTab("prop"); } }, h("b", { text:nameOf(it) }), " new"));
  box.innerHTML = "";
  out.forEach(o => box.appendChild(o));
}

function docDirty(doc){
  if([...edits.props.keys()].some(t => t.doc === doc)) return true;
  if([...edits.removed].some(t => t.doc === doc)) return true;
  return doc.menus.some(m => m.items.some(i => i.isNew));
}

let filePaneStale = true;
function renderFilePane(force){
  if(!force && !$("pane-file").classList.contains("on")){ filePaneStale = true; return; }
  filePaneStale = false;
  const box = $("lintList");
  box.innerHTML = "";
  const w = docs.length ? lint(docs, edits, hasAsset) : [];
  const warns = w.filter(x => x.level === "warn").length;
  $("lintCount").textContent = w.length ? warns + " warning(s), " + (w.length-warns) + " note(s)" : "no issues";
  for(const x of w.slice(0, 200))
    box.appendChild(h("div", { class:"lintrow " + x.level, onclick:()=>{ sel = [x.target]; refresh(true); showTab("prop"); } },
      h("span", { class:"lv", text:x.level === "warn" ? "⚠" : "ℹ" }),
      h("span", { class:"lt", html:"<b>" + esc(nameOf(x.target)) + "</b> – " + esc(x.msg) })));
  if(w.length > 200) box.appendChild(h("p", { class:"hint", text:"… and " + (w.length-200) + " more" }));

  const fl = $("fileList");
  fl.innerHTML = "";
  for(const doc of docs){
    const dirty = docDirty(doc);
    const d = buildDiff(doc, edits, 2);
    const blk = h("div", { class:"fileblock" },
      h("div", { class:"fh" },
        h("span", { class:"fn", text:doc.fileName }),
        dirty ? h("span", { class:"cnt", text:"changed" }) : h("span", { class:"cnt", style:"color:var(--dim)", text:"unchanged" }),
        h("button", { class:"mini", text:"save", onclick:()=>saveDoc(doc) })));
    if(dirty){
      const dv = h("div", { class:"diff" });
      for(const r of d.rows.slice(0, 400)){
        if(r.t === "gap") dv.appendChild(h("div", { class:"gap", text:"⋯ " + r.n + " lines" }));
        else dv.appendChild(h("div", { class:r.t },
          h("span", { class:"n", text:r.old || "" }),
          (r.t === "add" ? "+ " : r.t === "del" ? "− " : "  ") + r.text));
      }
      blk.appendChild(dv);
    }
    fl.appendChild(blk);
  }
  if(!docs.length) fl.appendChild(h("p", { class:"hint", text:"No file loaded." }));
}

function download(name, bytes, mime){
  const a = h("a", { download:name });
  a.href = URL.createObjectURL(new Blob([bytes], { type:mime || "text/plain" }));
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
}

function saveDoc(doc){
  const out = buildOutput(doc, edits);
  download(doc.fileName, latin1Bytes(out.text));
  status(doc.fileName + " saved.");
}

function saveAll(){
  const dirty = docs.filter(docDirty);
  if(!dirty.length) return;
  if(dirty.length === 1) return saveDoc(dirty[0]);
  const files = dirty.map(d => ({ name:d.fileName, bytes:latin1Bytes(buildOutput(d, edits).text) }));
  download("hud.zip", makeZip(files), "application/zip");
  status(dirty.length + " files saved as hud.zip.");
}

function buildCvarPanel(){
  const grp = $("cvarGrp"), box = $("cvarList");
  const map = new Map();
  for(const doc of docs) for(const m of doc.menus) for(const o of [m].concat(m.items)){
    const cv = P(o).cvarTest && P(o).cvarTest[0];
    if(!cv || cv === "cg_gametype") continue;
    const s = map.get(cv) || new Set(["0","1"]);
    (P(o).showCvar || []).forEach(v => s.add(String(v)));
    (P(o).hideCvar || []).forEach(v => s.add(String(v)));
    map.set(cv, s);
  }
  box.innerHTML = "";
  [...grp.parentNode.querySelectorAll("p.hint")].forEach(p => { if(p.dataset.cv) p.remove(); });
  grp.hidden = !map.size;
  cvarNames = [...map.keys()];
  for(const [cv,vals] of [...map].sort((a,b)=>a[0].localeCompare(b[0]))){
    const seg = h("div", { class:"seg" });
    [null].concat([...vals].sort((a,b)=>a-b)).forEach(v=>{
      const b = h("button", { text:v === null ? "–" : v,
        title:v === null ? "not set" : cv + " " + v,
        class:(v === null ? sim.cvars[cv] === undefined : String(sim.cvars[cv]) === v) ? "on" : "",
        onclick:()=>{
          if(v === null) delete sim.cvars[cv]; else sim.cvars[cv] = parseInt(v,10);
          [...seg.children].forEach(c => c.classList.toggle("on", c === b));
          refresh(true); saveView();
        } });
      seg.appendChild(b);
    });
    box.appendChild(h("div", { class:"cvrow" }, h("span", { class:"nm", title:cv, text:cv }), seg));
  }
  if(map.size){
    const p = h("p", { class:"hint", html:'An unset <b>–</b> is empty in game: items with ' +
      '<code>showCvar {"1"}</code> stay invisible until the cvar is set in a cfg.' });
    p.dataset.cv = "1";
    box.after(p);
  }
}
let cvarNames = [];

function buildStatePanel(){
  const box = $("simState");
  box.innerHTML = "";
  for(const [k,label] of STATE_TOGGLES)
    box.appendChild(h("button", { class:sim[k] ? "on" : "", text:label,
      onclick:()=>{ sim[k] = !sim[k]; buildStatePanel(); refresh(true); saveView(); } }));
  const needsFlag = allItems().some(it => /FLAGSTATUS|ONEFLAG/.test((P(it).ownerdraw || [])[0] || ""));
  if(needsFlag) for(const [side,key] of [["Red","flagRed"],["Blue","flagBlue"]]){
    const cyc = ["at_base","taken","dropped","stolen"];
    box.appendChild(h("button", { text:side + " flag: " + sim[key],
      onclick:()=>{ sim[key] = cyc[(cyc.indexOf(sim[key])+1) % cyc.length]; buildStatePanel(); refresh(true); } }));
  }
}

function addDoc(text, name){
  const doc = parseMenu(text, name);
  docs.push(doc);
  return doc;
}

function loadText(text, name){
  docs = [];
  edits.clear(); sel = []; undoStack.length = 0; redoStack.length = 0;
  addDoc(text, name);
  afterLoad();
}

function loadMany(list, append){
  if(!append){
    docs = [];
    edits.clear(); sel = []; undoStack.length = 0; redoStack.length = 0;
  }
  for(const f of list) addDoc(f.text, f.name);
  afterLoad();
}

function afterLoad(){
  hiddenView.clear();
  stack = [];
  $("drop").classList.add("hide");
  $("restore").hidden = true;
  $("fname").textContent = docs.map(d => d.fileName).join(", ");
  buildCvarPanel(); buildStatePanel();
  updateUndoButtons();
  refresh(true);
  const items = docs.reduce((n,d) => n + d.menus.reduce((k,m)=>k+m.items.length,0), 0);
  const menus = docs.reduce((n,d) => n + d.menus.length, 0);
  status(docs.length + " file(s), " + menus + " blocks, " + items + " items loaded.");
  saveSession();
}

function closeDoc(doc){
  if(docs.length < 2) return;
  for(const m of doc.menus){ edits.revertTarget(m); for(const i of m.items){ edits.revertTarget(i); edits.restoreRemoved(i); } }
  docs = docs.filter(d => d !== doc);
  sel = sel.filter(t => t.doc !== doc);
  afterLoad();
}

function readFiles(fileList, append){
  const wanted = [...fileList].filter(f => /\.(menu|txt|cfg)$/i.test(f.name));
  if(!wanted.length) return;
  let left = wanted.length;
  const got = new Array(wanted.length);
  wanted.forEach((f,i)=>{
    const rd = new FileReader();
    rd.onload = ()=>{
      got[i] = { name:f.name, text:rd.result };
      if(--left === 0) loadMany(got.filter(Boolean), append);
    };
    rd.onerror = ()=>{ if(--left === 0) loadMany(got.filter(Boolean), append); };
    rd.readAsText(f, "ISO-8859-1");
  });
}

const LS_VIEW = "menuview.view", LS_SESSION = "menuview.session";

function saveView(){
  try{
    localStorage.setItem(LS_VIEW, JSON.stringify({
      zoom, sim,
      opt:["optGrid","optCenter","optBoxes","optHidden","optArt","optSnap"].map(id => $(id).checked)
    }));
  }catch(e){}
}
function loadView(){
  try{
    const v = JSON.parse(localStorage.getItem(LS_VIEW) || "null");
    if(!v) return;
    Object.assign(sim, v.sim || {});
    ["optGrid","optCenter","optBoxes","optHidden","optArt","optSnap"].forEach((id,i)=>{
      if(v.opt && v.opt[i] !== undefined) $(id).checked = v.opt[i];
    });
    setZoom(v.zoom || zoom);
  }catch(e){}
}

const pathOf = t => {
  const di = docs.indexOf(t.doc);
  const menu = t.kind === "menu" ? t : t.menu;
  const mi = t.doc.menus.indexOf(menu);
  return t.kind === "menu" ? di + "/" + mi : di + "/" + mi + "/" + menu.items.indexOf(t);
};
function targetAt(path){
  const a = path.split("/").map(Number);
  const doc = docs[a[0]]; if(!doc) return null;
  const menu = doc.menus[a[1]]; if(!menu) return null;
  return a.length === 2 ? menu : menu.items[a[2]];
}

let sessionTimer = null;
function saveSession(){
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(()=>{
    try{
      if(!docs.length) return localStorage.removeItem(LS_SESSION);
      const news = [];
      docs.forEach((d,di) => d.menus.forEach((m,mi) => m.items.forEach((it,ii) => {
        if(it.isNew) news.push({ at:di+"/"+mi+"/"+ii, after:m.items.indexOf(it.after),
                                 props:it.props, name:nameOf(it) });
      })));
      const props = [];
      for(const [t,m] of edits.props) props.push([pathOf(t), [...m]]);
      localStorage.setItem(LS_SESSION, JSON.stringify({
        when: Date.now(),
        files: docs.map(d => ({ name:d.fileName, text:d.lines.join(d.eol) })),
        news, props, removed:[...edits.removed].map(pathOf)
      }));
    }catch(e){ }
  }, 700);
}

function offerRestore(){
  let s = null;
  try{ s = JSON.parse(localStorage.getItem(LS_SESSION) || "null"); }catch(e){}
  if(!s || !s.files || !s.files.length) return;
  const n = (s.props || []).length + (s.removed || []).length + (s.news || []).length;
  $("restoreTxt").textContent = s.files.map(f=>f.name).join(", ") +
    (n ? " · " + n + " change(s)" : "") + " · " + new Date(s.when).toLocaleString("en-GB");
  $("restore").hidden = false;
  $("btnRestore").onclick = ()=>{
    loadMany(s.files);
    for(const nw of (s.news || [])){
      const a = nw.at.split("/").map(Number);
      const menu = docs[a[0]] && docs[a[0]].menus[a[1]];
      if(!menu) continue;
      const src = menu.items[nw.after] || menu.items[0];
      menu.items.splice(a[2], 0, { kind:"item", name:nw.name, props:nw.props, lineOf:{}, isNew:true,
        after:src, menu, doc:menu.doc, openIndent:src ? src.openIndent : "\t\t",
        indent:src ? src.indent : "\t\t\t", line:src ? src.line : menu.line,
        endLine:src ? src.endLine : menu.endLine });
    }
    for(const [path, entries] of (s.props || [])){
      const t = targetAt(path); if(!t) continue;
      for(const [k,v] of entries) v === null ? edits.unset(t,k) : edits.set(t,k,v);
    }
    for(const path of (s.removed || [])){ const t = targetAt(path); if(t) edits.remove(t); }
    refresh(true);
    status("Session restored.");
  };
  $("btnRestoreNo").onclick = ()=>{ $("restore").hidden = true; localStorage.removeItem(LS_SESSION); };
}

function refresh(full){
  renderStage();
  buildTree();
  updateDirty();
  updateChanges();
  if(full !== false) renderSelection();
  renderFilePane();
  saveSession();
}

const fileInput = $("file");
let addMode = false;
fileInput.onchange = e => { readFiles(e.target.files, addMode); fileInput.value = ""; };
const pickFiles = add => { addMode = !!add; fileInput.click(); };
$("btnOpen").onclick = ()=>pickFiles(false);
$("btnAdd").onclick  = ()=>pickFiles(true);
$("btnPick").onclick = ()=>pickFiles(false);
$("drop").onclick = e=>{ if(e.target.id === "drop") pickFiles(false); };

const dropEl = $("drop");
["dragenter","dragover"].forEach(ev=>{
  window.addEventListener(ev, e=>{ e.preventDefault(); dropEl.classList.remove("hide"); dropEl.classList.add("over"); });
});
window.addEventListener("dragleave", e=>{
  if(e.clientX || e.clientY) return;
  dropEl.classList.remove("over");
  if(docs.length) dropEl.classList.add("hide");
});
window.addEventListener("drop", e=>{
  e.preventDefault(); dropEl.classList.remove("over");
  if(e.dataTransfer.files.length) readFiles(e.dataTransfer.files);
  else if(docs.length) dropEl.classList.add("hide");
});

$("btnSave").onclick  = saveAll;
$("btnUndo").onclick  = undo;
$("btnRedo").onclick  = redo;
$("btnReset").onclick = ()=>{
  pushUndo();
  for(const doc of docs) for(const m of doc.menus) m.items = m.items.filter(i => !i.isNew);
  edits.clear();
  sel = sel.filter(t => t.kind === "menu" || t.menu.items.includes(t));
  refresh(true);
  status("Changes discarded.");
};
$("chClear").onclick = ()=>$("btnReset").click();

function showTab(name){
  $$(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
  $$(".pane").forEach(p => p.classList.toggle("on", p.id === "pane-"+name));
  if(name === "file" && filePaneStale) renderFilePane(true);
}
$$(".tabs button").forEach(b => b.onclick = ()=>showTab(b.dataset.tab));
$("treeFilter").oninput = buildTree;
$("treeClear").onclick = ()=>{ $("treeFilter").value = ""; buildTree(); };
$("btnNew").onclick = ()=>newItem();
$("treeOnlyVis").onchange = buildTree;
$("treeOnlyEdit").onchange = buildTree;
$("eyeAllOn").onclick = ()=>{
  if(!hiddenView.size) return status("Nothing is hidden.");
  hiddenView.clear(); refresh(true); status("All layers shown again.");
};
$("stackClear").onclick = ()=>setStack([]);

["pX","pY","pW","pH"].forEach((id,i)=>{
  const el = $(id);
  let started = false;
  el.addEventListener("focus", ()=>{ started = false; });
  el.addEventListener("input", ()=>{
    if(sel.length !== 1) return;
    const r = itemRect(sel[0]); if(!r) return;
    const v = parseNum(el.value);
    if(v === null) return;
    if(!started){ pushUndo(); started = true; }
    r[i] = parseFloat(v); setRect(sel[0], r); renderStage(); updateDirty(); buildTree();
  });
  el.addEventListener("change", ()=>{ started = false; refresh(true); });
});

$("posCenterH").onclick = ()=>{
  const t = primary(); if(!t) return;
  const r = itemRect(t); if(!r) return;
  pushUndo();
  const [ox] = menuOffset(t.kind === "menu" ? t : t.menu);
  const visW = wsMode(P(t.kind === "menu" ? t : t.menu)) === "stretch" ? VW : VH*aspect;
  r[0] = nice((visW - r[2])/2 - (t.kind === "menu" ? 0 : ox));
  setRect(t, r); refresh(true);
};
$("posCopy").onclick  = ()=>{ const t = primary(); if(t){ clipRect = itemRect(t); status("Position copied."); } };
$("posPaste").onclick = ()=>{
  if(!clipRect || !sel.length) return;
  pushUndo();
  for(const t of sel) setRect(t, clipRect);
  refresh(true);
};

$("gtAll").onclick  = ()=> sel.length && setGT(sel, setOf(ALL_GT));
$("gtTeam").onclick = ()=> sel.length && setGT(sel, setOf(TEAM_GT));
$("gtCur").onclick  = ()=> sel.length && setGT(sel, setOf([sim.gametype]));
$("gtAllM").onclick  = ()=> sel.length && setGT(sel, setOf(ALL_GT));
$("gtTeamM").onclick = ()=> sel.length && setGT(sel, setOf(TEAM_GT));
$("gtCurM").onclick  = ()=> sel.length && setGT(sel, setOf([sim.gametype]));

$("btnDup").onclick = duplicateSel;
$("btnDel").onclick = deleteSel;
$("mDup").onclick = duplicateSel;
$("mDel").onclick = deleteSel;
$("btnCopyProps").onclick = copyProps;
$("btnPasteProps").onclick = pasteProps;
$("copyToBtn").onclick = ()=>{
  const menu = targetAt($("copyToSel").value || "");
  if(!menu || menu.kind !== "menu") return status("No target block selected.");
  copyItemsTo(menu, sel, $("copyToKeep").checked);
};
$$(".alignbar button").forEach(b => b.onclick = ()=>alignSel(b.dataset.al));

$("addPropBtn").onclick = ()=>{
  const k = $("addPropSel").value;
  const t = primary();
  if(!k || !t) return;
  pushUndo();
  edits.set(t, k, defaultVal(k));
  refresh(true);
};
$("addPropSel").onchange = ()=>{ if($("addPropSel").value) $("addPropBtn").click(); };

function bindRange(id, key, out){
  const el = $(id), o = $(out);
  el.oninput = ()=>{ sim[key] = parseInt(el.value,10); o.textContent = el.value; refresh(true); saveView(); };
}
bindRange("simHealth","health","vHealth");
bindRange("simArmor","armor","vArmor");
bindRange("simAmmo","ammo","vAmmo");
bindRange("simRedScore","redScore","vRedScore");
bindRange("simBlueScore","blueScore","vBlueScore");
bindRange("simMyScore","myScore","vMyScore");
bindRange("simRedAlive","redAlive","vRedAlive");
bindRange("simBlueAlive","blueAlive","vBlueAlive");

const gtSel = $("simGametype");
GAMETYPES.forEach(g=>{
  gtSel.appendChild(h("option", { value:g.id, text:g.id + " – " + g.n, selected:g.id === sim.gametype }));
});
gtSel.onchange = e=>{
  sim.gametype = parseInt(e.target.value,10);
  sim.cvars.cg_gametype = sim.gametype;
  refresh(true); saveView();
};
const wpSel = $("simWeapon");
WEAPONS.forEach(w => wpSel.appendChild(h("option", { value:w[0], text:w[1], selected:w[0] === sim.weapon })));
wpSel.onchange = ()=>{ sim.weapon = wpSel.value; refresh(true); saveView(); };

$$("#simTeam button").forEach(b => b.onclick = ()=>{
  $$("#simTeam button").forEach(x=>x.classList.remove("on"));
  b.classList.add("on"); sim.team = b.dataset.team;
  refresh(true); saveView();
});
$("simZoom").oninput = e => setZoom(parseInt(e.target.value,10)/100);
$("btnFit").onclick = fitZoom;
["optGrid","optCenter","optBoxes","optHidden","optArt","optSnap"].forEach(id =>
  $(id).onchange = ()=>{ renderStage(); buildTree(); saveView(); });

$("cvAllOn").onclick  = ()=>{ cvarNames.forEach(c => sim.cvars[c] = 1); buildCvarPanel(); refresh(true); };
$("cvAllOff").onclick = ()=>{ cvarNames.forEach(c => delete sim.cvars[c]); buildCvarPanel(); refresh(true); };

$("btnShot").onclick = ()=>$("shotFile").click();
$("shotFile").onchange = e=>{
  const f = e.target.files[0];
  if(!f) return;
  const rd = new FileReader();
  rd.onload = ()=>{
    const img = $("backdrop");
    img.src = rd.result; img.hidden = false;
    img.style.opacity = numOf($("shotAlpha").value, 55)/100;
    screenEl.classList.add("has-shot");
    $("shotAlpha").hidden = false; $("btnShotOff").hidden = false;
  };
  rd.readAsDataURL(f);
};
$("shotAlpha").oninput = ()=>{ $("backdrop").style.opacity = numOf($("shotAlpha").value, 55)/100; };
$("btnShotOff").onclick = ()=>{
  $("backdrop").hidden = true; $("backdrop").src = "";
  screenEl.classList.remove("has-shot");
  $("shotAlpha").hidden = true; $("btnShotOff").hidden = true;
};

(function(){
  const g = $("gutter"), aside = document.querySelector("aside");
  let on = false;
  g.addEventListener("mousedown", e=>{ on = true; e.preventDefault(); });
  window.addEventListener("mousemove", e=>{
    if(!on) return;
    aside.style.width = Math.min(720, Math.max(300, window.innerWidth - e.clientX)) + "px";
  });
  window.addEventListener("mouseup", ()=>{ on = false; });
})();

(function(){
  const dl = $("assetList");
  const list = (Array.isArray(window.QL_ASSETS) ? window.QL_ASSETS : []);
  for(const p of list) dl.appendChild(h("option", { value:p.replace(/\.(png|jpg|jpeg)$/i,"") }));
})();

function buildBackgroundSelect(){
  const sel = $("bgPreset");
  if(!sel) return;
  sel.innerHTML = '<option value="">Default</option>' + BACKGROUND_PRESETS.map(p =>
    '<option value="' + p.value + '">' + p.label + '</option>'
  ).join("");
  sel.onchange = ()=>{
    const v = sel.value;
    const img = $("backdrop");
    if(!v){
      img.hidden = true; img.src = ""; screenEl.classList.remove("has-shot");
      $("shotAlpha").hidden = true; $("btnShotOff").hidden = true;
      return;
    }
    img.src = v;
    img.hidden = false;
    img.style.opacity = 1;
    screenEl.classList.add("has-shot");
    $("shotAlpha").hidden = true; $("btnShotOff").hidden = true;
  };
}

buildBackgroundSelect();
renderTemplateList();
loadView();
buildStatePanel();
refresh(true);
offerRestore();
