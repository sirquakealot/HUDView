"use strict";

function splitVals(s){
  const out = [], re = /"([^"]*)"|(\S+)/g;
  let m;
  while((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

const stripComment = l => l.replace(/\/\/.*$/, "");

function parseMenu(text, fileName){
  const rawLines = text.split(/\r?\n/);

  const defines = Object.create(null);
  for(const l of rawLines){
    const m = stripComment(l).match(/^\s*#define\s+(\S+)\s+(.+?)\s*$/);
    if(m) defines[m[1]] = m[2].trim();
  }

  function expand(toks, depth){
    if(depth > 8) return toks;
    let changed = false;
    const out = [];
    for(const t of toks){
      if(defines[t] !== undefined){ changed = true; out.push(...splitVals(defines[t])); }
      else out.push(t);
    }
    return changed ? expand(out, depth + 1) : out;
  }

  const menus = [], stack = [];
  let curMenu = null, curItem = null;
  const note = (t,k,i)=>{ (t.lineOf[k] = t.lineOf[k] || []).push(i); };

  for(let i=0;i<rawLines.length;i++){
    const raw  = rawLines[i];
    const line = stripComment(raw).trim();
    if(!line || line.startsWith("#")) continue;

    const inl = line.match(/^(\w+)\s*\{\s*(.*?)\s*\}$/);
    if(inl && !/^(menudef|itemdef|assetglobaldef)$/i.test(inl[1])){
      const t = curItem || curMenu;
      if(t){ setRaw(t, inl[1], expand(splitVals(inl[2]), 0), i); }
      continue;
    }

    const open = line.match(/^(\w*)\s*\{$/);
    if(open){
      const kind = open[1].toLowerCase();
      stack.push(kind);
      if(kind === "menudef"){
        curMenu = { kind:"menu", name:"(unnamed)", props:{}, lineOf:{}, items:[],
                    line:i, endLine:i, indent:null, openIndent:raw.match(/^\s*/)[0], doc:null };
        menus.push(curMenu);
      } else if(kind === "itemdef" && curMenu){
        curItem = { kind:"item", name:"(unnamed)", props:{}, lineOf:{},
                    line:i, endLine:i, indent:null, openIndent:raw.match(/^\s*/)[0], menu:curMenu };
        curMenu.items.push(curItem);
      }
      continue;
    }

    if(line === "}"){
      const kind = stack.pop();
      if(kind === "itemdef" && curItem){ curItem.endLine = i; curItem = null; }
      else if(kind === "menudef" && curMenu){ curMenu.endLine = i; curMenu = null; }
      continue;
    }

    const sp = line.match(/^(\S+)\s*(.*)$/);
    if(!sp) continue;
    const target = curItem || curMenu;
    if(!target) continue;
    if(target.indent === null) target.indent = raw.match(/^\s*/)[0];
    setRaw(target, sp[1], expand(splitVals(sp[2]), 0), i);
  }

  function setRaw(target, key, vals, i){
    note(target, key, i);
    if(key === "name" && vals.length) target.name = vals.join(" ");
    if(key === "addColorRange") (target.props.addColorRange = target.props.addColorRange || []).push(vals);
    else if(key === "ownerdrawflag") (target.props.ownerdrawflag = target.props.ownerdrawflag || []).push(...vals);
    else target.props[key] = vals;
  }

  const doc = { menus, lines: rawLines, defines, fileName: fileName || "hud.menu",
                eol: /\r\n/.test(text) ? "\r\n" : "\n" };
  for(const m of menus){
    m.doc = doc;
    if(m.indent === null) m.indent = m.openIndent + "\t";
    for(const it of m.items){
      it.doc = doc;
      if(it.indent === null) it.indent = it.openIndent + "\t";
    }
  }
  return doc;
}

const GAMETYPES = [
  {id:0,  s:"FFA",  n:"Free For All"},
  {id:1,  s:"Duel", n:"Duel"},
  {id:2,  s:"Race", n:"Race"},
  {id:3,  s:"TDM",  n:"Team Deathmatch"},
  {id:4,  s:"CA",   n:"Clan Arena"},
  {id:5,  s:"CTF",  n:"Capture the Flag"},
  {id:6,  s:"1F",   n:"One Flag CTF"},
  {id:8,  s:"Harv", n:"Harvester"},
  {id:9,  s:"FT",   n:"Freeze Tag"},
  {id:10, s:"Dom",  n:"Domination"},
  {id:11, s:"A&D",  n:"Attack & Defend"},
  {id:12, s:"RR",   n:"Red Rover"}
];
const ALL_GT     = GAMETYPES.map(g=>g.id);
const TEAM_GT    = [3,4,5,6,8,9,10,11,12];
const NONTEAM_GT = ALL_GT.filter(g => !TEAM_GT.includes(g));

const GT_FLAGS = {
  CG_SHOW_ANYTEAMGAME:     TEAM_GT,
  CG_SHOW_ANYNONTEAMGAME:  NONTEAM_GT,
  CG_SHOW_CLAN_ARENA:      [4],
  CG_SHOW_LIMITEDLIVES:    [4],
  CG_SHOW_NOTLIMITEDLIVES: ALL_GT.filter(g=>g!==4),
  CG_SHOW_CTF:             [5],
  CG_SHOW_ONEFLAG:         [6],
  CG_SHOW_HARVESTER:       [8],
  CG_SHOW_DOMINATION:      [10]
};
const WRITE_FLAGS = [
  ["CG_SHOW_CLAN_ARENA",[4]], ["CG_SHOW_CTF",[5]], ["CG_SHOW_ONEFLAG",[6]],
  ["CG_SHOW_HARVESTER",[8]], ["CG_SHOW_DOMINATION",[10]],
  ["CG_SHOW_ANYTEAMGAME",TEAM_GT], ["CG_SHOW_ANYNONTEAMGAME",NONTEAM_GT]
];

const SIM_FLAGS = {
  CG_SHOW_IF_PLYR_IS_ON_RED:          "team",
  CG_SHOW_IF_PLYR_IS_ON_BLUE:         "team",
  CG_SHOW_HEALTHCRITICAL:             "health",
  CG_SHOW_IF_RED_IS_FIRST_PLACE:      "score",
  CG_SHOW_IF_BLUE_IS_FIRST_PLACE:     "score",
  CG_SHOW_IF_PLYR_IS_FIRST_PLACE:     "place",
  CG_SHOW_IF_PLYR_IS_NOT_FIRST_PLACE: "place",
  CG_SHOW_IF_WARMUP:                  "warmup",
  CG_SHOW_IF_NOT_WARMUP:              "warmup",
  CG_SHOW_IF_PLAYER_HAS_FLAG:         "hasFlag",
  CG_SHOW_IF_PLAYER_HAS_NO_FLAG:      "hasFlag",
  CG_SHOW_IF_CHAT_VISIBLE:            "chat",
  CG_SHOW_IF_CHAT_HIDDEN:             "chat"
};

const setOf   = a => new Set(a);
const sameSet = (a,b) => a.size === b.size && [...a].every(x => b.has(x));
const interSet = (a,b) => new Set([...a].filter(x => b.includes(x)));

function gtOfProps(props){
  let s = setOf(ALL_GT);
  for(const f of (props.ownerdrawflag || [])) if(GT_FLAGS[f]) s = interSet(s, GT_FLAGS[f]);
  if(props.cvarTest && props.cvarTest[0] === "cg_gametype"){
    if(props.showCvar)      s = interSet(s, props.showCvar.map(Number));
    else if(props.hideCvar) s = new Set([...s].filter(g => !props.hideCvar.map(Number).includes(g)));
  }
  return s;
}

function gtLabel(set){
  if(sameSet(set, setOf(ALL_GT)))  return "all modes";
  if(sameSet(set, setOf(TEAM_GT))) return "all team modes";
  if(sameSet(set, setOf(NONTEAM_GT))) return "all non-team modes";
  if(!set.size) return "no mode";
  return GAMETYPES.filter(g => set.has(g.id)).map(g => g.s).join(", ");
}

function gtPlan(props, set){
  const flags  = props.ownerdrawflag || [];
  const keep   = flags.filter(f => !GT_FLAGS[f]);
  const cv     = props.cvarTest && props.cvarTest[0];
  const gtCvar = cv === "cg_gametype";
  const out    = { ok:true, why:"", set:{}, unset:[] };

  const put = (k,v) => out.set[k] = v;
  const del = k => out.unset.push(k);

  if(sameSet(set, setOf(ALL_GT))){
    keep.length ? put("ownerdrawflag", keep) : del("ownerdrawflag");
    if(gtCvar){ del("cvarTest"); del("showCvar"); del("hideCvar"); }
    return out;
  }

  const hit = WRITE_FLAGS.find(([,gs]) => sameSet(set, setOf(gs)));
  if(hit){
    put("ownerdrawflag", keep.concat([hit[0]]));
    if(gtCvar){ del("cvarTest"); del("showCvar"); del("hideCvar"); }
    return out;
  }

  if(cv && !gtCvar){
    out.ok  = false;
    out.why = 'This item already has cvarTest "' + cv + '". An item can only have one ' +
              "cvarTest, so only modes with their own ownerdrawflag are possible here " +
              "(CA, CTF, 1F, Harvester, Domination, all team modes, all non-team modes).";
    return out;
  }

  keep.length ? put("ownerdrawflag", keep) : del("ownerdrawflag");
  const inc = [...set].sort((a,b)=>a-b), exc = ALL_GT.filter(g => !set.has(g));
  put("cvarTest", ["cg_gametype"]);
  if(exc.length && exc.length < inc.length){ put("hideCvar", exc.map(String)); del("showCvar"); }
  else { put("showCvar", inc.map(String)); del("hideCvar"); }
  return out;
}

const OWNERDRAWS = [
  ["CG_PLAYER_HEALTH",       "Health",              "value"],
  ["CG_PLAYER_ARMOR_VALUE",  "Armor",               "value"],
  ["CG_PLAYER_AMMO_VALUE",   "Ammo",                "value"],
  ["CG_PLAYER_SCORE",        "Own score",           "value"],
  ["CG_RED_SCORE",           "Red score",           "value"],
  ["CG_BLUE_SCORE",          "Blue score",          "value"],
  ["CG_1STPLACE",            "1st place",           "value"],
  ["CG_2NDPLACE",            "2nd place",           "value"],
  ["CG_RED_CLAN_PLYRS",      "Red alive",           "value"],
  ["CG_BLUE_CLAN_PLYRS",     "Blue alive",          "value"],
  ["CG_TEAM_PLYR_COUNT",     "Own team alive",      "value"],
  ["CG_ENEMY_PLYR_COUNT",    "Enemy alive",         "value"],
  ["CG_RED_OWNED_FLAGS",     "Red points (Dom)",    "value"],
  ["CG_BLUE_OWNED_FLAGS",    "Blue points (Dom)",   "value"],
  ["CG_LEVELTIMER",          "Match time",          "text"],
  ["CG_ROUNDTIMER",          "Round time",          "text"],
  ["CG_OVERTIME",            "Overtime",            "text"],
  ["CG_PLAYER_OBIT",         "Killfeed",            "text"],
  ["CG_RACE_TIMES",          "Race times",          "text"],
  ["CG_RACE_STATUS",         "Race-Status",         "text"],
  ["CG_AREA_NEW_CHAT",       "Chat",                "area"],
  ["CG_TEAM_COLORIZED",      "Team color",          "area"],
  ["CG_PLAYER_AMMO_ICON2D",  "Ammo icon",           "icon"],
  ["CG_PLAYER_AMMO_ICON",    "Ammo icon 3D",        "icon"],
  ["CG_PLAYER_ITEM",         "Item",                "icon"],
  ["CG_PLAYER_HASKEY",       "Key",                 "icon"],
  ["CG_PLAYER_HASFLAG",      "Carrying flag",       "icon"],
  ["CG_ONEFLAG_STATUS",      "One-Flag-Status",     "icon"],
  ["CG_RED_FLAGSTATUS",      "Red flag status",     "icon"],
  ["CG_BLUE_FLAGSTATUS",     "Blue flag status",    "icon"],
  ["CG_AREA_POWERUP",        "Powerup",             "icon"],
  ["CG_CTF_POWERUP",         "Powerup (CTF)",       "icon"],
  ["CG_HARVESTER_SKULLS",    "Skulls",              "icon"],
  ["CG_PLAYER_HEAD",         "Player head",         "icon"],
  ["CG_SELECTEDPLAYER_HEAD", "Head (selected)",     "icon"]
];
const OD_KIND = Object.fromEntries(OWNERDRAWS.map(([id,,k]) => [id,k]));
const OD_NAME = Object.fromEntries(OWNERDRAWS.map(([id,n]) => [id,n]));

const ALL_FLAGS = Object.keys(GT_FLAGS).concat(Object.keys(SIM_FLAGS)).sort();

const PROPS = {
  rect:        { type:"rect",  group:"layout",  label:"rect",        info:"x y width height" },
  visible:     { type:"enum",  group:"layout",  label:"visible",
                 opts:[["1","on"],["0","off"],["MENU_TRUE","on"],["MENU_FALSE","off"]] },
  decoration:  { type:"bool",  group:"layout",  label:"decoration",  info:"ignores mouse clicks" },
  widescreen:  { type:"enum",  group:"layout",  label:"widescreen",  only:"menu",
                 opts:[["WIDESCREEN_LEFT","left"],["WIDESCREEN_CENTER","center"],
                       ["WIDESCREEN_RIGHT","right"],["WIDESCREEN_NONE","stretched"]] },
  fullScreen:  { type:"enum",  group:"layout",  label:"fullScreen",  only:"menu",
                 opts:[["MENU_FALSE","no"],["MENU_TRUE","yes"]] },
  name:        { type:"str",   group:"layout",  label:"name" },

  style:       { type:"enum",  group:"form",   label:"style",
                 opts:[["WINDOW_STYLE_EMPTY","empty (0)"],["WINDOW_STYLE_FILLED","filled (1)"],
                       ["2","gradient (2)"],["3","shader (3)"],["4","team color (4)"]] },
  backcolor:   { type:"color", group:"form",   label:"backcolor",   info:"fill, also tints the image" },
  forecolor:   { type:"color", group:"form",   label:"forecolor",   info:"text color" },
  bordercolor: { type:"color", group:"form",   label:"bordercolor" },
  border:      { type:"enum",  group:"form",   label:"border",
                 opts:[["0","none"],["WINDOW_BORDER_FULL","full (1)"],["2","horizontal"],
                       ["3","vertical"],["4","gradient"]] },
  bordersize:  { type:"num",   group:"form",   label:"bordersize",  min:0, max:8, step:.5 },
  background:  { type:"asset", group:"form",   label:"background" },

  text:        { type:"str",   group:"text",   label:"text" },
  textscale:   { type:"num",   group:"text",   label:"textscale",   min:0, max:3, step:.01 },
  textstyle:   { type:"enum",  group:"text",   label:"textstyle",
                 opts:[["0","normal (0)"],["1","blinking (1)"],["2","pulsing (2)"],
                       ["ITEM_TEXTSTYLE_SHADOWED","shadowed (3)"],["4","outlined (4)"],
                       ["5","outlined + shadowed (5)"],["6","heavy shadow (6)"]] },
  align:       { type:"enum",  group:"text",   label:"align",       info:"ownerdraw aligns by this",
                 opts:[["ITEM_ALIGN_LEFT","left (0)"],["ITEM_ALIGN_CENTER","center (1)"],
                       ["ITEM_ALIGN_RIGHT","right (2)"]] },
  textalign:   { type:"enum",  group:"text",   label:"textalign",   info:"only for plain text items",
                 opts:[["ITEM_ALIGN_LEFT","left (0)"],["ITEM_ALIGN_CENTER","center (1)"],
                       ["ITEM_ALIGN_RIGHT","right (2)"]] },
  textalignx:  { type:"num",   group:"text",   label:"textalignx",  min:-100, max:100, step:1 },
  textaligny:  { type:"num",   group:"text",   label:"textaligny",  min:-100, max:100, step:1 },
  font:        { type:"str",   group:"text",   label:"font" },

  ownerdraw:     { type:"enum",  group:"od", label:"ownerdraw",
                   opts:OWNERDRAWS.map(([id,n]) => [id, n]) },
  ownerdrawflag: { type:"flags", group:"od", label:"ownerdrawflag" },
  special:       { type:"num",   group:"od", label:"special", min:0, max:16, step:1 },

  cvarTest:    { type:"str",  group:"cond", label:"cvarTest" },
  showCvar:    { type:"list", group:"cond", label:"showCvar" },
  hideCvar:    { type:"list", group:"cond", label:"hideCvar" },

  addColorRange:{ type:"ranges", group:"range", label:"addColorRange" }
};

const PROP_GROUPS = [
  ["layout","Layout"],
  ["form",  "Fill & image"],
  ["text",  "Text"],
  ["od",    "Ownerdraw"],
  ["cond",  "Conditions"],
  ["range", "Color ranges"],
  ["rest",  "Other"]
];

const propDef = k => PROPS[k] || { type:"raw", group:"rest", label:k };

const numOf   = (v,d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
const rectOf  = p => p.rect && p.rect.length >= 4 ? p.rect.slice(0,4).map(v=>numOf(v,0)) : null;
const colorOfVals = v => { const c = (v||[]).slice(0,4).map(x=>numOf(x,0)); while(c.length<4) c.push(1); return c; };

const offSwitch = v => !!v && (v[0] === "0" || v[0] === "MENU_FALSE" || v[0] === "0.0");

function alignCode(a){
  if(a === "ITEM_ALIGN_CENTER" || a === "1") return 1;
  if(a === "ITEM_ALIGN_RIGHT"  || a === "2") return 2;
  return 0;
}
function wsMode(props){
  const w = props.widescreen && props.widescreen[0];
  if(w === "WIDESCREEN_LEFT"   || w === "1") return "left";
  if(w === "WIDESCREEN_CENTER" || w === "2") return "center";
  if(w === "WIDESCREEN_RIGHT"  || w === "3") return "right";
  return "stretch";
}

function pickRange(ranges, v){
  for(const r of ranges || []){
    const a = numOf(r[0], NaN), b = numOf(r[1], NaN);
    if(v >= a && v <= b) return r;
  }
  return null;
}

class Edits {
  constructor(){ this.props = new Map(); this.removed = new Set(); this.gen = 1; this._cache = new Map(); }

  bump(){ this.gen++; }

  map(target, make){
    let m = this.props.get(target);
    if(!m && make){ m = new Map(); this.props.set(target, m); }
    return m;
  }
  edited(target, key){
    const m = this.props.get(target);
    return m && m.has(key) ? m.get(key) : undefined;
  }
  isDirty(target, key){ const m = this.props.get(target); return !!(m && m.has(key)); }

  set(target, key, vals){
    const orig = target.props[key];
    if(valsEqual(orig, vals)) return this.revert(target, key);
    this.map(target, true).set(key, vals);
    this.bump();
  }
  unset(target, key){
    if(target.props[key] === undefined) return this.revert(target, key);
    this.map(target, true).set(key, null);
    this.bump();
  }
  revert(target, key){
    const m = this.props.get(target);
    if(!m || !m.has(key)) return;
    m.delete(key);
    if(!m.size) this.props.delete(target);
    this.bump();
  }
  revertTarget(target){ if(this.props.delete(target)) this.bump(); }

  remove(target){ this.removed.add(target); this.bump(); }
  restoreRemoved(target){ this.removed.delete(target); this.bump(); }
  isRemoved(target){ return this.removed.has(target); }

  eff(target){
    const m = this.props.get(target);
    if(!m || !m.size) return target.props;
    const c = this._cache.get(target);
    if(c && c.gen === this.gen) return c.obj;
    const obj = Object.assign(Object.create(null), target.props);
    for(const [k,v] of m){ if(v === null) delete obj[k]; else obj[k] = v; }
    this._cache.set(target, { gen:this.gen, obj });
    return obj;
  }

  count(){
    let n = this.removed.size;
    for(const m of this.props.values()) n += m.size;
    return n;
  }
  targets(){ return new Set([...this.props.keys(), ...this.removed]); }
  clear(){ this.props.clear(); this.removed.clear(); this._cache.clear(); this.bump(); }

  snapshot(menus){
    const props = new Map();
    for(const [t,m] of this.props) props.set(t, new Map([...m].map(([k,v]) => [k, cloneVal(v)])));
    const items = new Map();
    for(const m of menus || []) items.set(m, m.items.slice());
    return { props, removed:new Set(this.removed), items };
  }
  restore(snap){
    this.props = new Map();
    for(const [t,m] of snap.props) this.props.set(t, new Map([...m].map(([k,v]) => [k, cloneVal(v)])));
    this.removed = new Set(snap.removed);
    this._cache.clear();
    for(const [menu,arr] of snap.items) menu.items = arr.slice();
    this.bump();
  }
}

const cloneVal = v => v === null ? null : (Array.isArray(v) ? v.map(x => Array.isArray(x) ? x.slice() : x) : v);

function valsEqual(a, b){
  if(a === undefined || b === undefined) return a === b;
  if(a === null || b === null) return a === b;
  if(a.length !== b.length) return false;
  for(let i=0;i<a.length;i++){
    const x = a[i], y = b[i];
    if(Array.isArray(x) || Array.isArray(y)){
      if(!Array.isArray(x) || !Array.isArray(y) || !valsEqual(x,y)) return false;
    } else if(String(x) !== String(y)) return false;
  }
  return true;
}

const QUOTE_KEYS = new Set(["name","text","cvarTest","background","font","smallFont","bigFont",
                            "cursor","gradientBar","model","shader","cvarStrList","title","tooltip"]);
const BRACE_KEYS = new Set(["showCvar","hideCvar","cvarStrList","action","onFocus","leaveFocus",
                            "mouseEnter","mouseExit","mouseEnterText","mouseExitText","execKey"]);

const isNumeric = t => /^[-+]?(\d+\.?\d*|\.\d+)$/.test(t);

function quoteTok(t){
  const s = String(t);
  return '"' + s.replace(/"/g, "") + '"';
}

function propLine(key, vals, srcLine){
  let braced = BRACE_KEYS.has(key), quoted = QUOTE_KEYS.has(key);
  if(srcLine !== undefined && srcLine !== null){
    const body = stripComment(srcLine).trim().replace(/^\S+\s*/, "");
    braced = /^\{/.test(body);
    quoted = /"/.test(body);
  }
  const toks = vals.map(v => {
    const s = String(v);
    if(braced) return quoteTok(s);
    if(s === "") return '""';
    if(/\s/.test(s)) return quoteTok(s);
    return (quoted && !isNumeric(s)) ? quoteTok(s) : s;
  });
  const body = braced ? "{ " + toks.join(" ") + " }" : toks.join(" ");
  return body ? key + " " + body : key;
}

function propLines(key, vals, srcLine){
  if(vals === null) return [];
  if(key === "addColorRange") return vals.map(r => propLine(key, r, srcLine));
  if(key === "ownerdrawflag") return vals.map(f => propLine(key, [f], srcLine));
  if(key === "decoration")    return vals.length === 0 || vals[0] === "1" ? ["decoration"] : [];
  return [propLine(key, vals, srcLine)];
}

const WRITE_ORDER = ["name","group","rect","visible","decoration","style","border","bordersize",
                     "bordercolor","backcolor","forecolor","background","text","font","textscale",
                     "textstyle","textalign","textalignx","textaligny","align","ownerdraw",
                     "ownerdrawflag","special","cvarTest","showCvar","hideCvar","addColorRange"];

function orderedKeys(props){
  const keys = Object.keys(props);
  const rank = k => { const i = WRITE_ORDER.indexOf(k); return i < 0 ? WRITE_ORDER.length : i; };
  return keys.sort((a,b) => rank(a) - rank(b) || a.localeCompare(b));
}

function itemBlockLines(props, openIndent, indent){
  const out = [openIndent + "itemDef {"];
  for(const k of orderedKeys(props)) for(const l of propLines(k, props[k])) out.push(indent + l);
  out.push(openIndent + "}");
  return out;
}

function buildOutput(doc, edits){
  const orig   = doc.lines;
  const lines  = orig.slice();
  const changed = new Set();
  const drop    = new Set();
  const before  = new Map();
  const after   = new Map();
  const addTo = (map,i,arr) => { const a = map.get(i) || []; a.push(...arr); map.set(i, a); };

  const targets = [];
  for(const menu of doc.menus){
    targets.push(menu);
    for(const it of menu.items) targets.push(it);
  }

  for(const t of targets){
    if(t.isNew) continue;
    if(edits.isRemoved(t)){
      for(let i = t.line; i <= t.endLine; i++) drop.add(i);
      continue;
    }
    const m = edits.props.get(t);
    if(!m) continue;
    for(const [key, vals] of m){
      const at  = t.lineOf[key];
      const src = at && at.length ? orig[at[0]] : undefined;
      const neu = propLines(key, vals, src);

      if(at && at.length){
        for(let i=1;i<at.length;i++) drop.add(at[i]);
        if(!neu.length){ drop.add(at[0]); continue; }
        const ind = src.match(/^\s*/)[0];
        const cmt = src.match(/(\s*)(\/\/.*)$/);
        lines[at[0]] = ind + neu[0] + (cmt ? (cmt[1] || "  ") + cmt[2] : "");
        changed.add(at[0]);
        if(neu.length > 1) addTo(after, at[0], neu.slice(1).map(l => ind + l));
      } else if(neu.length){
        addTo(before, t.endLine, neu.map(l => t.indent + l));
      }
    }
  }

  for(const menu of doc.menus) for(const it of menu.items){
    if(!it.isNew || edits.isRemoved(it)) continue;
    let src = it.after;
    while(src && src.isNew) src = src.after;
    if(src && src.doc !== doc) src = null;
    const anchor = src ? src.endLine : Math.max(menu.line, menu.endLine - 1);
    addTo(after, anchor, itemBlockLines(edits.eff(it), it.openIndent, it.indent));
  }

  const rows = [];
  orig.forEach((l,i)=>{
    for(const x of (before.get(i) || [])) rows.push({ t:"add", text:x });
    if(drop.has(i))            rows.push({ t:"del", old:i+1, text:l });
    else if(changed.has(i)){   rows.push({ t:"del", old:i+1, text:l });
                               rows.push({ t:"add", old:i+1, text:lines[i] }); }
    else                       rows.push({ t:"same", old:i+1, text:l });
    for(const x of (after.get(i) || [])) rows.push({ t:"add", text:x });
  });

  const text = rows.filter(r => r.t !== "del").map(r => r.text).join(doc.eol);
  return { text, rows, dropped:drop, changed };
}

function buildDiff(doc, edits, context){
  const ctx = context === undefined ? 2 : context;
  const res = buildOutput(doc, edits);
  const r   = res.rows;
  const keep = new Set();
  r.forEach((row,i)=>{
    if(row.t === "same") return;
    for(let j=Math.max(0,i-ctx); j<=Math.min(r.length-1,i+ctx); j++) keep.add(j);
  });
  const out = [];
  let gap = 0;
  r.forEach((row,i)=>{
    if(keep.has(i)){ if(gap){ out.push({ t:"gap", n:gap }); gap = 0; } out.push(row); }
    else gap++;
  });
  if(gap) out.push({ t:"gap", n:gap });
  return { rows:out, text:res.text, dirty: r.some(x => x.t !== "same") };
}

function lint(docs, edits, hasAsset){
  const out = [];
  const add = (level, target, msg) => out.push({ level, target, msg });

  for(const doc of docs) for(const menu of doc.menus){
    const mp = edits.eff(menu);
    const seen = new Map();
    if(!menu.props.rect) add("info", menu, "Block without rect - items are positioned absolutely");

    for(const item of menu.items){
      if(edits.isRemoved(item)) continue;
      const p  = edits.eff(item);
      const r  = rectOf(p);
      const nm = (p.name && p.name.join(" ")) || item.name;
      seen.set(nm, (seen.get(nm) || 0) + 1);

      if(!r){ add("warn", item, "no rect - the item is drawn at 0/0"); }
      else {
        const mr = rectOf(mp) || [0,0,0,0];
        const x = r[0] + mr[0], y = r[1] + mr[1];
        if(y < -40 || y > 520 || x < -120 || x > 760)
          add("warn", item, "lies far outside the screen (" + Math.round(x) + " / " + Math.round(y) + ")");
        const filled = (p.style && (p.style[0] === "WINDOW_STYLE_FILLED" || p.style[0] === "1" || p.style[0] === "3"));
        if((p.background || filled) && (r[2] <= 0 || r[3] <= 0))
          add("warn", item, "image or fill with width/height 0 - invisible in game");
      }

      if(p.addColorRange && p.addColorRange.length > 10)
        add("warn", item, p.addColorRange.length + " addColorRange - the engine only evaluates the first 10");

      if(p.background && hasAsset && !hasAsset(p.background[0]))
        add("info", item, 'Image "' + p.background[0] + '" is not in assets/game');

      const ts = p.textscale && numOf(p.textscale[0], NaN);
      if(ts !== undefined && !isNaN(ts) && (ts <= 0 || ts > 4))
        add("warn", item, "textscale " + p.textscale[0] + " - probably not intended in game");

      if(p.cvarTest && !p.showCvar && !p.hideCvar)
        add("warn", item, 'cvarTest "' + p.cvarTest[0] + '" without showCvar/hideCvar - the condition does nothing');
      if((p.showCvar || p.hideCvar) && !p.cvarTest)
        add("warn", item, "showCvar/hideCvar without cvarTest - the condition does nothing");

      const gt = gtOfProps(p), mgt = gtOfProps(mp);
      if(!gt.size)  add("warn", item, "the mode conditions exclude each other - never visible");
      else if(![...gt].some(g => mgt.has(g)))
        add("warn", item, "item modes (" + gtLabel(gt) + ") and block modes (" + gtLabel(mgt) + ") do not overlap");

      if(p.ownerdraw && !OD_KIND[p.ownerdraw[0]])
        add("info", item, "ownerdraw " + p.ownerdraw[0] + " is unknown to the preview - position is right, content is guessed");

      if(p.forecolor && numOf(p.forecolor[3], 1) === 0 && !p.addColorRange)
        add("info", item, "forecolor with alpha 0 - invisible");
    }
    for(const [nm,n] of seen)
      if(n > 3 && nm !== "(unnamed)") add("info", menu, n + "x the same name \"" + nm + "\" in block");
  }
  return out;
}

function crc32(buf){
  let c, crc = 0xFFFFFFFF;
  if(!crc32.tab){
    crc32.tab = new Int32Array(256);
    for(let n=0;n<256;n++){ c = n; for(let k=0;k<8;k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc32.tab[n] = c; }
  }
  for(let i=0;i<buf.length;i++) crc = crc32.tab[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeZip(files){
  const chunks = [], central = [];
  let off = 0;
  const enc = s => { const a = new Uint8Array(s.length); for(let i=0;i<s.length;i++) a[i] = s.charCodeAt(i) & 0xFF; return a; };
  const u16 = n => [n & 255, (n>>8) & 255];
  const u32 = n => [n & 255, (n>>8) & 255, (n>>16) & 255, (n>>24) & 255];

  for(const f of files){
    const nm = enc(f.name), crc = crc32(f.bytes), sz = f.bytes.length;
    const head = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
                                 ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0)]);
    chunks.push(head, nm, f.bytes);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
                                 ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0), ...u16(0),
                                 ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
    off += head.length + nm.length + sz;
  }
  let cLen = 0; for(const c of central) cLen += c.length;
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0),
                              ...u16(files.length), ...u16(files.length), ...u32(cLen), ...u32(off), ...u16(0)]);
  const all = chunks.concat(central, [end]);
  let total = 0; for(const c of all) total += c.length;
  const zip = new Uint8Array(total);
  let p = 0; for(const c of all){ zip.set(c, p); p += c.length; }
  return zip;
}

function latin1Bytes(text){
  const b = new Uint8Array(text.length);
  for(let i=0;i<text.length;i++){ const c = text.charCodeAt(i); b[i] = c < 256 ? c : 63; }
  return b;
}

if(typeof module !== "undefined" && module.exports){
  module.exports = { parseMenu, splitVals, GAMETYPES, ALL_GT, TEAM_GT, NONTEAM_GT, GT_FLAGS,
    SIM_FLAGS, ALL_FLAGS, WRITE_FLAGS, gtOfProps, gtLabel, gtPlan, setOf, sameSet, interSet,
    PROPS, PROP_GROUPS, propDef, OWNERDRAWS, OD_KIND, OD_NAME, numOf, rectOf, colorOfVals,
    offSwitch, alignCode, wsMode, pickRange, Edits, valsEqual, propLine, propLines,
    itemBlockLines, buildOutput, buildDiff, lint, makeZip, latin1Bytes, crc32 };
}
