// CORE-START — pure domain core: plain data in, plain data out. No DOM, no I/O, no clock.
const TYPES=['fighter','colony','scout'];
const COST={fighter:15,colony:25,scout:8};
const SHIP={fighter:['Fighter','Fighters'],colony:['Colony ship','Colony ships'],scout:['Scout','Scouts']};
const TECH={
  weapons:{name:'Weapons',max:4,desc:'+10% hit chance per level for your fighters and planetary batteries.'},
  drives:{name:'Hyperdrives',max:2,desc:'Every fleet makes one more jump per turn.'},
  terraform:{name:'Terraforming',max:3,desc:'+1 population cap on every habitable planet you hold.'}
};
const techCost=l=>40+40*l;
// Difficulty shapes only the rivals: what they can see, when they strike, how fast they build, how much they earn.
const DIFF={
  easy:{label:'Easy',fog:true,attackTurn:20,builds:1,income:0.75},
  normal:{label:'Normal',fog:true,attackTurn:10,builds:2,income:1},
  hard:{label:'Hard',fog:false,attackTurn:6,builds:3,income:1.25}
};
const diffOf=s=>DIFF[s.difficulty]||DIFF.normal;
// You are always empire 0. Small galaxies use the first three, medium the first five, large all seven.
const EMP=[{name:'Aurum Concord',color:'#f2b544'},{name:'Veth Hegemony',color:'#4fd1c5'},{name:'Ossari Choir',color:'#ef6f8a'},
  {name:'Kesh Dominion',color:'#a58cff'},{name:'Morrow League',color:'#7ccf6a'},{name:'Thal Assembly',color:'#5aa7ff'},{name:'Iridane Pact',color:'#ff8f4a'}];
// Stars per empire stays about the same, so openings feel alike; the radius grows with the square root of the star count.
const SIZES={
  small:{label:'Small',stars:28,radius:46,empires:3},
  medium:{label:'Medium',stars:48,radius:60,empires:5},
  large:{label:'Large',stars:72,radius:74,empires:7}
};
const sizeOf=s=>SIZES[s.size]||SIZES.small;
// Total: be the last empire standing. Dominance: hold this share of all habitable planets (or be the last standing).
const VICTORY={total:{label:'Total victory'},dominance:{label:'Dominance',share:0.6}};
const habitableCount=s=>s.planets.reduce((n,p)=>n+(p.cap>0?1:0),0);
const dominanceOf=(s,e)=>s.planets.reduce((n,p)=>n+(p.owner===e&&p.cap>0?1:0),0)/Math.max(1,habitableCount(s));
const EXTRA_NAMES=['Acamar','Adhara','Alcyone','Aldhibah','Alrescha','Alsephina','Ankaa','Arneb','Aspidiske','Atria','Azha','Baham','Beid','Botein','Castula','Cebalrai','Chara','Cursa','Dalim','Deneb','Edasich','Electra','Fulu','Gomeisa','Grumium','Heze','Homam','Jishui','Kraz','Lucida','Maasym','Matar','Menkar','Merak','Mirach','Muphrid','Nekkar','Nusakan','Peacock','Pherkad','Pleione','Rotanev','Ruchbah','Sabik','Sargas','Sheliak','Situla','Talitha','Tarazed','Wasat'];
const NAMES=['Achird','Brisa','Caph','Diadem','Elnath','Fawaris','Gienah','Hadar','Izar','Jabbah','Kochab','Lesath','Markab','Nashira','Okab','Phact',
  'Rasalas','Sadr','Tejat','Unuk','Vega','Wezen','Xamidimura','Yed','Zaniah','Alkes','Biham','Celaeno','Dabih','Errai','Furud','Hamal'];

// Stars: 0 blue-white, 1 white, 2 yellow, 3 orange, 4 red.
const STAR_KINDS=['Blue-white','White','Yellow','Orange','Red'];
// Planet habitability is base + a roll below spread; 0 means nobody can live there.
const PLANET_TYPES={
  terran:{name:'Terran',base:5,spread:2},
  ocean:{name:'Ocean',base:4,spread:3},
  arid:{name:'Arid',base:2,spread:3},
  tundra:{name:'Tundra',base:1,spread:3},
  toxic:{name:'Toxic',base:0,spread:2},
  barren:{name:'Barren',base:0,spread:1},
  gas:{name:'Gas giant',base:0,spread:1}
};
// How each kind of star shapes its system: the range of planet counts and the odds of each planet type.
const SYSTEMS=[
  {count:[0,3],odds:{barren:4,gas:3,toxic:2,arid:1}},
  {count:[1,4],odds:{barren:2,gas:2,arid:2,tundra:1,ocean:1,toxic:1}},
  {count:[2,5],odds:{terran:3,ocean:3,arid:2,tundra:1,gas:2,barren:1}},
  {count:[1,5],odds:{terran:1,ocean:2,arid:2,tundra:2,gas:2,barren:2}},
  {count:[0,3],odds:{tundra:3,barren:3,toxic:2,gas:1,arid:1}}
];
const ROMAN=['I','II','III','IV','V','VI'];

function makeRng(seed){
  let a=seed>>>0;
  return {
    next(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;},
    int(n){return Math.floor(this.next()*n);},
    get state(){return a;}
  };
}
const adjCache=new WeakMap();
function adjOf(s){
  let a=adjCache.get(s.lanes);
  if(!a){a=s.stars.map(()=>[]);for(const[i,j]of s.lanes){a[i].push(j);a[j].push(i);}adjCache.set(s.lanes,a);}
  return a;
}
function hops(adj,from){
  const d=adj.map(()=>Infinity);d[from]=0;const q=[from];
  for(let k=0;k<q.length;k++){const u=q[k];for(const v of adj[u])if(d[v]===Infinity){d[v]=d[u]+1;q.push(v);}}
  return d;
}
function route(adj,from,to){
  if(from===to)return[];
  const prev=adj.map(()=>-1);prev[from]=from;const q=[from];
  for(let k=0;k<q.length;k++){const u=q[k];if(u===to)break;for(const v of adj[u])if(prev[v]<0){prev[v]=u;q.push(v);}}
  if(prev[to]<0)return null;
  const p=[];for(let v=to;v!==from;v=prev[v])p.push(v);return p.reverse();
}
// A fleet moves at the pace of its slowest ship; scouts are faster only when travelling alone.
const fleetSpeed=(s,f)=>1+s.empires[f.owner].tech.drives+(f.ships.every(x=>x.type==='scout')?1:0);
const countTypes=f=>{const c={fighter:0,colony:0,scout:0};for(const x of f.ships)c[x.type]++;return c;};
const has=(f,t)=>f.ships.some(x=>x.type===t);
const planetsAt=(s,star)=>s.planets.filter(p=>p.star===star);
const capOf=(s,p)=>p.cap>0?p.cap+(p.owner>=0?s.empires[p.owner].tech.terraform:0):0;
const incomeOf=(s,e)=>{const base=2+s.planets.reduce((a,p)=>a+(p.owner===e?p.pop:0),0);return e===0?base:Math.round(base*diffOf(s).income);};

// Sensor range: every star where the empire holds a planet or has a fleet, plus the stars one jump away.
function vision(s,e){
  const adj=adjOf(s),v=s.stars.map(()=>false),src=new Set();
  for(const p of s.planets)if(p.owner===e)src.add(p.star);
  for(const f of s.fleets)if(f.owner===e)src.add(f.at);
  for(const i of src){v[i]=true;for(const j of adj[i])v[j]=true;}
  return v;
}
// Each empire remembers which stars it has charted, and every planet's owner and population as last seen.
function updateIntel(s){
  s.intel=s.intel.map((m,k)=>{
    const v=vision(s,k);
    return {stars:m.stars.map((x,i)=>x||v[i]),planets:s.planets.map(p=>v[p.star]?{owner:p.owner,pop:p.pop}:m.planets[p.id]??null)};
  });
}
// What empire e can know: live detail within sensor range, memories elsewhere, nothing about uncharted stars.
// Rival controllers receive this view, never the full state.
function fogView(s,e){
  const v=vision(s,e),I=s.intel[e];
  return {...s,
    stars:s.stars.map((st,i)=>I.stars[i]||v[i]?{...st}:{...st,unknown:true}),
    planets:s.planets.filter(p=>v[p.star]||I.stars[p.star]).map(p=>v[p.star]||!I.planets[p.id]?{...p}:{...p,owner:I.planets[p.id].owner,pop:I.planets[p.id].pop}),
    fleets:s.fleets.filter(f=>f.owner===e||v[f.at]).map(f=>({...f,ships:f.ships.map(x=>({...x}))}))};
}
const sightOf=(s,e)=>diffOf(s).fog?fogView(s,e):s;

function rollPlanets(rng,st){
  const sys=SYSTEMS[st.kind],n=sys.count[0]+rng.int(sys.count[1]-sys.count[0]+1);
  const odds=Object.entries(sys.odds),total=odds.reduce((a,[,w])=>a+w,0),out=[];
  for(let k=0;k<n;k++){
    let r=rng.next()*total,type=odds[0][0];
    for(const[t,w]of odds){if(r<w){type=t;break;}r-=w;}
    const pt=PLANET_TYPES[type];
    out.push({star:st.id,type,cap:pt.base+rng.int(pt.spread),owner:-1,pop:0});
  }
  return out;
}

function newGame(seed,difficulty='normal',size='small',victory='total'){
  if(!SIZES[size])size='small';if(!VICTORY[victory])victory='total';
  const Z=SIZES[size],rng=makeRng(seed),N=Z.stars,R=Z.radius,stars=[];
  for(let tries=0;stars.length<N&&tries<6000*N/28;tries++){
    const ang=rng.next()*Math.PI*2,r=Math.sqrt(rng.next())*R;
    const x=Math.cos(ang)*r,y=Math.sin(ang)*r*0.78;
    if(stars.every(s=>Math.hypot(s.x-x,s.y-y)>9.5))stars.push({id:stars.length,x,y});
  }
  const names=NAMES.slice();
  for(let i=names.length-1;i>0;i--){const j=rng.int(i+1);[names[i],names[j]]=[names[j],names[i]];}
  if(N>names.length){// larger galaxies draw more names; small ones use the random stream exactly as before
    const extra=EXTRA_NAMES.slice();
    for(let i=extra.length-1;i>0;i--){const j=rng.int(i+1);[extra[i],extra[j]]=[extra[j],extra[i]];}
    names.push(...extra);
  }
  for(const st of stars){st.name=names[st.id];st.kind=rng.int(5);}
  // Hyperlanes: the Gabriel graph — a lane joins two stars when no third star sits inside the circle they span.
  const n=stars.length,d2=(i,j)=>(stars[i].x-stars[j].x)**2+(stars[i].y-stars[j].y)**2,lanes=[];
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    const d=d2(i,j);let ok=true;
    for(let k=0;k<n&&ok;k++)if(k!==i&&k!==j&&d2(i,k)+d2(j,k)<d)ok=false;
    if(ok)lanes.push([i,j]);
  }
  const D=(a,b)=>Math.sqrt(d2(a,b)),argmax=f=>{let b=0,bv=-Infinity;for(let i=0;i<n;i++){const v=f(i);if(v>bv){bv=v;b=i;}}return b;};
  // Homeworlds as far apart as possible: start from two extreme stars, then keep adding the star farthest from every home so far.
  let h0=rng.int(n);const h1=argmax(i=>D(h0,i));h0=argmax(i=>D(h1,i));
  const homes=[h0,h1];
  while(homes.length<Z.empires)homes.push(argmax(i=>homes.includes(i)?-1:Math.min(...homes.map(h=>D(h,i)))));
  for(const h of homes)stars[h].kind=2;
  const bySystem=stars.map(st=>rollPlanets(rng,st));
  const s={seed,difficulty:DIFF[difficulty]?difficulty:'normal',size,victory,turn:1,rngState:0,stars,lanes,planets:[],fleets:[],nextFleet:1,nextShip:1,events:[],over:null,
    empires:EMP.slice(0,Z.empires).map((e,i)=>({id:i,name:e.name,color:e.color,credits:20,tech:{weapons:0,drives:0,terraform:0},alive:true,home:homes[i]}))};
  const adj=adjOf(s);
  homes.forEach((h,i)=>{
    // Every homeworld is a rich terran planet, and a habitable free planet waits within one jump.
    const sys=bySystem[h];
    if(!sys.length)sys.push({star:h});
    Object.assign(sys[0],{type:'terran',cap:6,owner:i,pop:3});
    const near=[h,...adj[h].filter(j=>!homes.includes(j))];
    if(!near.some(j=>bySystem[j].some(p=>p.owner<0&&p.cap>=2))){
      const j=near[1]??h;bySystem[j].push({star:j,type:'ocean',cap:3,owner:-1,pop:0});
    }
    s.fleets.push({id:s.nextFleet++,owner:i,at:h,dest:null,target:null,
      ships:['fighter','fighter','colony','scout'].map(type=>({id:s.nextShip++,type}))});
  });
  for(const sys of bySystem)sys.forEach((p,k)=>s.planets.push({id:s.planets.length,star:p.star,name:`${stars[p.star].name} ${ROMAN[k]}`,type:p.type,cap:p.cap,owner:p.owner,pop:p.pop}));
  s.rngState=rng.state;
  s.intel=s.empires.map(()=>({stars:stars.map(()=>false),planets:s.planets.map(()=>null)}));
  updateIntel(s);
  s.events=[{msg:`${stars[h0].name} awaits orders. Tap ${stars[h0].name} twice to see its planets, then pick one for your colony ship with Colonise.`,kind:'colony',star:h0}];
  return s;
}

const clone=s=>({...s,stars:s.stars.map(x=>({...x})),planets:s.planets.map(x=>({...x})),empires:s.empires.map(e=>({...e,tech:{...e.tech}})),
  fleets:s.fleets.map(f=>({...f,ships:f.ships.map(x=>({...x}))})),intel:s.intel.map(m=>({stars:m.stars.slice(),planets:m.planets.slice()})),events:[]});

// Applies one empire's orders, in the order given, to a (cloned) state.
// Orders: research{tech} · move{fleet,to,target?} · split{fleet,ships:{type:n},to,target?} · target{fleet,planet} · merge{star} · build{star,kind}
// A target is a planet: colony ships settle it (only when ordered), fighters besiege it. Builds run last, so new ships cannot move until next turn.
function applyOrders(s,e,orders,say,withBuilds){
  const emp=s.empires[e];if(!emp.alive)return;
  const mineF=id=>s.fleets.find(f=>f.id===id&&f.owner===e);
  for(const o of orders){
    if(o.t==='research'){
      const l=emp.tech[o.tech];
      if(TECH[o.tech]&&l<TECH[o.tech].max&&emp.credits>=techCost(l)){
        emp.credits-=techCost(l);emp.tech[o.tech]=l+1;
        if(e===0)say(`Research complete: ${TECH[o.tech].name} ${l+1}.`,'tech');
      }
    }else if(o.t==='move'){
      const f=mineF(o.fleet);if(f){f.dest=o.to===f.at?null:o.to;f.target=o.target??null;}
    }else if(o.t==='target'){
      const f=mineF(o.fleet);if(f)f.target=o.planet??null;
    }else if(o.t==='split'){
      const f=mineF(o.fleet);if(!f)continue;
      const take=[];
      for(const t of TYPES){
        let n=o.ships[t]||0;
        for(let i=f.ships.length-1;i>=0&&n>0;i--)if(f.ships[i].type===t){take.unshift(...f.ships.splice(i,1));n--;}
      }
      if(!take.length)continue;
      const dest=o.to===f.at?null:o.to,target=o.target??null;
      if(!f.ships.length){f.ships=take;f.dest=dest;f.target=target;continue;}
      s.fleets.push({id:s.nextFleet++,owner:e,at:f.at,dest,target,ships:take});
    }else if(o.t==='merge'){
      const fs=s.fleets.filter(f=>f.owner===e&&f.at===o.star&&f.dest==null).sort((a,b)=>a.id-b.id);
      if(fs.length<2)continue;
      for(const f of fs.slice(1)){fs[0].ships.push(...f.ships);f.ships=[];}
      s.fleets=s.fleets.filter(f=>f.ships.length);
    }
  }
  if(!withBuilds)return;
  for(const o of orders){
    if(o.t!=='build')continue;
    const st=s.stars[o.star],c=COST[o.kind];
    if(!st||!s.planets.some(p=>p.star===o.star&&p.owner===e)||!c||emp.credits<c)continue;
    emp.credits-=c;
    let f=s.fleets.find(f=>f.owner===e&&f.at===o.star&&f.dest==null);
    if(!f){f={id:s.nextFleet++,owner:e,at:o.star,dest:null,target:null,ships:[]};s.fleets.push(f);}
    f.ships.push({id:s.nextShip++,type:o.kind});
    if(e===0)say(`${SHIP[o.kind][0]} launched at ${st.name} and joined Fleet ${f.id}.`,'build',st.id);
  }
}
// What the state looks like once an empire's movement and research orders are applied (no builds, no turn).
function previewOrders(state,e,orders){const s=clone(state);s.events=state.events;applyOrders(s,e,orders,()=>{},false);return s;}

// The planet a parked fleet with a colony ship will settle this turn, or null. Settling is never automatic: it needs a target.
function settleChoice(s,f){
  if(f.dest!=null||!has(f,'colony'))return null;
  if(s.fleets.some(g=>g.at===f.at&&g.owner!==f.owner&&has(g,'fighter')))return null;
  return planetsAt(s,f.at).find(p=>p.id===f.target&&p.owner<0&&p.cap>0)||null;
}

function resolveTurn(state,ordersBy,rng){
  const s=clone(state),adj=adjOf(s),ev=[];
  const say=(msg,kind,star)=>ev.push(star==null?{msg,kind}:{msg,kind,star});
  // 1. Orders, empire by empire
  for(const e of Object.keys(ordersBy).map(Number).sort((a,b)=>a-b))applyOrders(s,e,ordersBy[e]||[],say,true);
  // 2. Fleets jump along lanes
  for(const f of s.fleets){
    if(f.dest==null)continue;
    const p=route(adj,f.at,f.dest);
    if(!p||!p.length){f.dest=null;continue;}
    f.at=p[Math.min(fleetSpeed(s,f),p.length)-1];
    if(f.at===f.dest)f.dest=null;
  }
  const seeNow=vision(s,0);
  const nm=e=>e===0?'you':s.empires[e].name;
  // 3. Combat, then sieges. Every inhabited planet has batteries that fire on hostile ships in its system.
  const hitP=e=>0.4+0.1*s.empires[e].tech.weapons;
  for(const st of s.stars){
    const fl=s.fleets.filter(f=>f.at===st.id),pl=planetsAt(s,st.id).filter(p=>p.owner>=0);
    let here=[];for(const f of fl)for(const x of f.ships)here.push({id:x.id,type:x.type,owner:f.owner});
    if(!here.length)continue;
    const parties=new Set(here.map(h=>h.owner));for(const p of pl)parties.add(p.owner);
    if(parties.size<2)continue;
    const before={};for(const h of here)before[h.owner]=(before[h.owner]||0)+1;
    let fought=false;
    for(let r=0;r<6;r++){
      const shooters=here.filter(h=>h.type==='fighter').map(h=>h.owner);
      if(r===0)for(const p of pl)for(let k=0;k<1+Math.floor(p.pop/3);k++)shooters.push(p.owner);
      const dead=new Set();let any=false;
      for(const o of shooters){
        const foes=here.filter(h=>h.owner!==o);if(!foes.length)continue;
        const war=foes.filter(h=>h.type==='fighter'),pool=war.length?war:foes;any=true;
        if(rng.next()<hitP(o))dead.add(pool[rng.int(pool.length)].id);
      }
      if(!any)break;fought=true;
      here=here.filter(h=>!dead.has(h.id));
    }
    if(fought){
      const alive=new Set(here.map(h=>h.id));
      for(const f of fl)f.ships=f.ships.filter(x=>alive.has(x.id));
      const after={};for(const h of here)after[h.owner]=(after[h.owner]||0)+1;
      const losses=Object.keys(before).map(Number).map(o=>[o,before[o]-(after[o]||0)]).filter(x=>x[1]>0);
      if(losses.length&&(parties.has(0)||seeNow[st.id]))
        say(`Battle at ${st.name}: `+losses.map(([o,l])=>`${o===0?'you lost':s.empires[o].name+' lost'} ${l}`).join(', ')+'.','battle',st.id);
    }
    // Fighters besiege one hostile planet per turn: their fleet's target, else the weakest. Planets whose owner has fighters here are defended.
    const fighters={};for(const h of here)if(h.type==='fighter')fighters[h.owner]=(fighters[h.owner]||0)+1;
    for(const a of Object.keys(fighters).map(Number).sort((x,y)=>fighters[y]-fighters[x]||x-y)){
      const hostile=planetsAt(s,st.id).filter(p=>p.owner>=0&&p.owner!==a&&!fighters[p.owner]);
      if(!hostile.length)continue;
      const wanted=new Set(fl.filter(f=>f.owner===a&&f.target!=null&&f.ships.length).map(f=>f.target));
      const p=hostile.find(p=>wanted.has(p.id))||hostile.sort((x,y)=>x.pop-y.pop||x.id-y.id)[0];
      const prev=p.owner,tell=a===0||prev===0||seeNow[st.id];
      p.pop-=Math.ceil(fighters[a]/2);
      if(p.pop<=0){
        p.owner=a;p.pop=1;
        if(tell)say(a===0?`You captured ${p.name} from ${s.empires[prev].name}.`:`${s.empires[a].name} captured ${p.name}${prev===0?' from you':''}.`,'capture',st.id);
      }else if(tell)say(`${p.name} is under siege by ${nm(a)}. Population ${p.pop}.`,'siege',st.id);
    }
  }
  s.fleets=s.fleets.filter(f=>f.ships.length);
  // 4. Colonisation: a parked fleet carrying a colony ship settles the free planet it was ordered to
  for(const f of s.fleets.slice()){
    const p=settleChoice(s,f);if(!p)continue;
    f.ships.splice(f.ships.findIndex(x=>x.type==='colony'),1);
    p.owner=f.owner;p.pop=1;if(f.target===p.id)f.target=null;
    if(f.owner===0)say(`New colony founded on ${p.name}.`,'colony',p.star);
    else if(seeNow[p.star])say(`${s.empires[f.owner].name} settled ${p.name}.`,'colony',p.star);
  }
  s.fleets=s.fleets.filter(f=>f.ships.length);
  // 5. Growth and income
  for(const p of s.planets){
    if(p.owner<0)continue;
    const cap=capOf(s,p);
    if(p.pop<cap&&(s.turn+p.id)%2===0)p.pop++;
    if(p.pop>cap)p.pop=cap;
  }
  for(const emp of s.empires)if(emp.alive)emp.credits+=incomeOf(s,emp.id);
  // 6. Elimination
  for(const emp of s.empires){
    if(!emp.alive)continue;
    const alive=s.planets.some(p=>p.owner===emp.id)||s.fleets.some(f=>f.owner===emp.id&&has(f,'colony'));
    if(!alive){emp.alive=false;s.fleets=s.fleets.filter(f=>f.owner!==emp.id);say(emp.id===0?'Your empire has fallen.':`The ${emp.name} has fallen.`,'fall');}
  }
  const left=s.empires.filter(e=>e.alive);
  if(!s.empires[0].alive)s.over={win:false,turn:s.turn,how:'total'};
  else if(left.length===1)s.over={win:true,turn:s.turn,how:'total'};
  else if(s.victory==='dominance'){
    const need=VICTORY.dominance.share,top=left.map(e=>[e.id,dominanceOf(s,e.id)]).sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0];
    if(top[1]>=need){
      s.over={win:top[0]===0,turn:s.turn,how:'dominance',by:top[0]};
      say(top[0]===0?`You hold ${Math.round(top[1]*100)}% of the habitable planets. The Reach is yours.`:`The ${s.empires[top[0]].name} holds ${Math.round(top[1]*100)}% of the habitable planets and dominates the Reach.`,'fall');
    }
  }
  // 7. Targets that no longer make sense are dropped
  for(const f of s.fleets){
    if(f.target==null)continue;
    const p=s.planets[f.target];
    if(!p||p.owner===f.owner||(p.star!==f.at&&p.star!==f.dest))f.target=null;
  }
  // 8. Charting
  const was=state.intel[0].stars;
  updateIntel(s);
  const fresh=s.intel[0].stars.map((x,i)=>x&&!was[i]?i:-1).filter(i=>i>=0);
  if(fresh.length)say('Charted '+fresh.map(i=>{
    const ps=planetsAt(s,i),best=Math.max(0,...ps.map(p=>p.cap));
    return `${s.stars[i].name} (${ps.length?`${ps.length} ${ps.length===1?'planet':'planets'}${best?', best hab '+best:', none habitable'}`:'no planets'})`;
  }).join(', ')+'.','chart',fresh[0]);
  s.turn++;s.events=ev;
  return {state:s,events:ev};
}

// Scripted rival controller. Call it with sightOf(state,e): it plans only from what that empire may see.
function aiOrders(s,e,rng){
  const emp=s.empires[e];if(!emp.alive)return[];
  const out=[];
  // Gather parked fleets at each star into one, then plan against that merged view.
  const parked=s.fleets.filter(f=>f.owner===e&&f.dest==null);
  for(const at of new Set(parked.map(f=>f.at)))if(parked.filter(f=>f.at===at).length>1)out.push({t:'merge',star:at});
  const v=previewOrders(s,e,out),adj=adjOf(v);let cash=emp.credits;
  const prio=['weapons','terraform','drives'];
  const opts=Object.keys(TECH).filter(k=>emp.tech[k]<TECH[k].max).sort((a,b)=>emp.tech[a]-emp.tech[b]||prio.indexOf(a)-prio.indexOf(b));
  const nextTech=opts[0];
  if(s.turn>6&&nextTech&&cash>=techCost(emp.tech[nextTech])){out.push({t:'research',tech:nextTech});cash-=techCost(emp.tech[nextTech]);}
  const mine=v.planets.filter(p=>p.owner===e),myStars=new Set(mine.map(p=>p.star));
  const fleets=v.fleets.filter(f=>f.owner===e);
  const claimed=new Set(fleets.filter(f=>has(f,'colony')&&f.target!=null).map(f=>f.target));
  const free=v.planets.filter(p=>p.owner<0&&p.cap>0);
  let colonyShips=0;
  for(const f of fleets){
    const n=countTypes(f).colony;colonyShips+=n;
    if(f.dest!=null)continue;
    const d=hops(adj,f.at);
    for(let k=0;k<n;k++){
      let best=null,bs=Infinity;
      for(const p of free){if(claimed.has(p.id)||d[p.star]===Infinity)continue;const sc=d[p.star]*2-p.cap;if(sc<bs){bs=sc;best=p;}}
      if(!best)break;
      claimed.add(best.id);out.push({t:'split',fleet:f.id,ships:{colony:1},to:best.star,target:best.id});
    }
  }
  const popAt={};for(const p of mine)popAt[p.star]=(popAt[p.star]||0)+p.pop;
  const yard=Object.keys(popAt).map(Number).sort((a,b)=>popAt[b]-popAt[a]||a-b)[0];
  if(yard!=null){
    const open=free.filter(p=>!claimed.has(p.id)).length;
    if(open>0&&colonyShips<2&&cash>=COST.colony){out.push({t:'build',star:yard,kind:'colony'});cash-=COST.colony;}
    const reserve=s.turn>6&&nextTech?Math.min(techCost(emp.tech[nextTech]),60):0;
    for(let k=0;k<diffOf(s).builds&&cash-COST.fighter>=reserve;k++){out.push({t:'build',star:yard,kind:'fighter'});cash-=COST.fighter;}
  }
  const targets=v.planets.filter(p=>p.owner>=0&&p.owner!==e);
  if(s.turn>=diffOf(s).attackTurn&&targets.length){
    const need=3+Math.floor(s.turn/25);
    for(const f of fleets){
      if(f.dest!=null)continue;
      const n=countTypes(f).fighter;if(n<need)continue;
      const d=hops(adj,f.at);let best=null,bs=Infinity;
      for(const p of targets){const sc=d[p.star]*3+p.pop;if(sc<bs){bs=sc;best=p;}}
      const send=n-(myStars.has(f.at)?1:0);
      if(best&&send>0)out.push({t:'split',fleet:f.id,ships:{fighter:send},to:best.star,target:best.id});
    }
  }
  // Exploration: scouts head for the nearest uncharted star; idle strike stacks do too once nothing hostile is known.
  const scouted=new Set(fleets.filter(f=>f.dest!=null).map(f=>f.dest));
  const nearestUnknown=at=>{const d=hops(adj,at);let best=null,bd=Infinity;
    for(const st of v.stars)if(st.unknown&&!scouted.has(st.id)&&d[st.id]<bd){bd=d[st.id];best=st.id;}return best;};
  for(const f of fleets){
    if(f.dest!=null)continue;
    const c=countTypes(f);
    if(c.scout){const to=nearestUnknown(f.at);out.push({t:'split',fleet:f.id,ships:{scout:c.scout},to:to??rng.int(v.stars.length)});if(to!=null)scouted.add(to);}
    if(!targets.length&&s.turn>=diffOf(s).attackTurn&&c.fighter>=3+Math.floor(s.turn/25)){
      const to=nearestUnknown(f.at);if(to!=null){scouted.add(to);out.push({t:'split',fleet:f.id,ships:{fighter:c.fighter-(myStars.has(f.at)?1:0)},to});}
    }
  }
  return out;
}
// ---------- saved games ----------
// A save is plain data: a format name, a version and the whole game state, plus any orders queued but not yet run.
// Bump SAVE_VERSION whenever the shape of the state changes, and add a migration from the old version if one is possible.
const SAVE_FORMAT='gabriels-reach-save';
const SAVE_VERSION=2;
// version n -> function turning a version-n save into a version n+1 save
const MIGRATIONS={
  // 1 -> 2: galaxy size and victory condition were added; every version-1 game was a small galaxy played to total victory.
  1:d=>({...d,version:2,size:'small',victory:'total',game:{...d.game,size:'small',victory:'total'}})
};
const SAVE_YAML={flowLevel:3,lineWidth:-1,noRefs:true};// js-yaml options: one line per star, planet, fleet and lane
const ORDER_TYPES=['research','move','split','target','merge','build'];
function toSave(game,orders=[]){
  return {format:SAVE_FORMAT,version:SAVE_VERSION,galaxy:game.seed,size:game.size,victory:game.victory,difficulty:game.difficulty,turn:game.turn,orders,game};
}
// Returns {game,orders} or throws an Error whose message can be shown to the player as it is.
function fromSave(d){
  if(!d||typeof d!=='object'||Array.isArray(d)||d.format!==SAVE_FORMAT)throw new Error("This file isn't a Gabriel's Reach save.");
  if(!Number.isInteger(d.version))throw new Error('This save has no version, so it cannot be loaded safely.');
  if(d.version>SAVE_VERSION)throw new Error(`This save was made by a newer version of the game (save format ${d.version}; this game reads format ${SAVE_VERSION}). Reload the page to get the latest version, then try again.`);
  while(d.version<SAVE_VERSION){
    const step=MIGRATIONS[d.version];
    if(!step)throw new Error(`This save uses an older format (${d.version}) that this version of the game can no longer read.`);
    d=step(d);
  }
  const problem=checkSave(d.game,d.orders??[]);
  if(problem)throw new Error(`The save file is damaged: ${problem}.`);
  return {game:d.game,orders:d.orders??[]};
}
// Structural checks, so a hand-edited or truncated file is refused instead of breaking the game. Returns a problem or null.
function checkSave(g,orders){
  const int=x=>Number.isInteger(x),num=x=>typeof x==='number'&&Number.isFinite(x),arr=Array.isArray,obj=x=>x&&typeof x==='object'&&!arr(x);
  if(!obj(g))return 'the game section is missing';
  if(!int(g.seed)||!int(g.turn)||g.turn<1||!int(g.rngState))return 'the galaxy number, turn or random state is not a whole number';
  if(!DIFF[g.difficulty])return `the difficulty "${g.difficulty}" is unknown`;
  if(!SIZES[g.size])return `the galaxy size "${g.size}" is unknown`;
  if(!VICTORY[g.victory])return `the victory condition "${g.victory}" is unknown`;
  const E=SIZES[g.size].empires;
  const S=arr(g.stars)?g.stars.length:0;
  if(S<2||!g.stars.every((st,i)=>obj(st)&&st.id===i&&num(st.x)&&num(st.y)&&typeof st.name==='string'&&int(st.kind)&&st.kind>=0&&st.kind<STAR_KINDS.length))return 'a star entry is invalid';
  const star=i=>int(i)&&i>=0&&i<S;
  if(!arr(g.lanes)||!g.lanes.every(l=>arr(l)&&l.length===2&&star(l[0])&&star(l[1])))return 'a lane joins stars that do not exist';
  if(!arr(g.empires)||g.empires.length!==E)return `there should be ${E} empires in a ${g.size} galaxy`;
  for(const [i,e] of g.empires.entries()){
    if(!obj(e)||e.id!==i||!num(e.credits)||typeof e.alive!=='boolean'||!star(e.home)||!obj(e.tech))return `empire ${i} is invalid`;
    for(const k of Object.keys(TECH))if(!int(e.tech[k])||e.tech[k]<0||e.tech[k]>TECH[k].max)return `empire ${i} has an impossible ${TECH[k].name} level`;
  }
  const owner=o=>int(o)&&o>=-1&&o<E;
  if(!arr(g.planets)||!g.planets.every((p,i)=>obj(p)&&p.id===i&&star(p.star)&&PLANET_TYPES[p.type]&&typeof p.name==='string'&&int(p.cap)&&p.cap>=0&&owner(p.owner)&&int(p.pop)&&p.pop>=0))return 'a planet entry is invalid';
  const P=g.planets.length;
  let maxF=0,maxS=0;
  if(!arr(g.fleets))return 'the fleet list is missing';
  for(const f of g.fleets){
    if(!obj(f)||!int(f.id)||!owner(f.owner)||f.owner<0||!star(f.at)||!(f.dest==null||star(f.dest))||!(f.target==null||(int(f.target)&&f.target<P))
      ||!arr(f.ships)||!f.ships.length||!f.ships.every(x=>obj(x)&&int(x.id)&&TYPES.includes(x.type)))return `fleet ${f&&f.id} is invalid`;
    maxF=Math.max(maxF,f.id);for(const x of f.ships)maxS=Math.max(maxS,x.id);
  }
  if(!int(g.nextFleet)||g.nextFleet<=maxF||!int(g.nextShip)||g.nextShip<=maxS)return 'the fleet or ship counters are behind the fleets';
  if(!arr(g.intel)||g.intel.length!==E||!g.intel.every(m=>obj(m)&&arr(m.stars)&&m.stars.length===S&&arr(m.planets)&&m.planets.length===P))return 'the empires\' maps are invalid';
  if(!arr(g.events))return 'the turn report is missing';
  if(!(g.over==null||obj(g.over)))return 'the game-over record is invalid';
  if(!arr(orders)||!orders.every(o=>obj(o)&&ORDER_TYPES.includes(o.t)))return 'a queued order is invalid';
  return null;
}
// CORE-END
if(typeof module!=='undefined')module.exports={TYPES,COST,SHIP,TECH,techCost,DIFF,diffOf,EMP,SIZES,sizeOf,VICTORY,habitableCount,dominanceOf,STAR_KINDS,PLANET_TYPES,SYSTEMS,makeRng,adjOf,hops,route,
  fleetSpeed,countTypes,has,planetsAt,capOf,incomeOf,vision,updateIntel,fogView,sightOf,newGame,applyOrders,previewOrders,settleChoice,resolveTurn,aiOrders,
  SAVE_FORMAT,SAVE_VERSION,SAVE_YAML,toSave,fromSave,checkSave};
