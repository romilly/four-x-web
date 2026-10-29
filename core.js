// CORE-START — pure domain core: plain data in, plain data out. No DOM, no I/O, no clock.
const TYPES=['fighter','colony','scout'];
const COST={fighter:15,colony:25,scout:8};
const SHIP={fighter:['Fighter','Fighters'],colony:['Colony ship','Colony ships'],scout:['Scout','Scouts']};
const TECH={
  weapons:{name:'Weapons',max:4,desc:'+10% hit chance per level for your fighters and colony batteries.'},
  drives:{name:'Hyperdrives',max:2,desc:'Every fleet makes one more jump per turn.'},
  terraform:{name:'Terraforming',max:3,desc:'+1 population cap at every colony you hold.'}
};
const techCost=l=>40+40*l;
// Difficulty shapes only the rivals: what they can see, when they strike, how fast they build, how much they earn.
const DIFF={
  easy:{label:'Easy',fog:true,attackTurn:20,builds:1,income:0.75},
  normal:{label:'Normal',fog:true,attackTurn:10,builds:2,income:1},
  hard:{label:'Hard',fog:false,attackTurn:6,builds:3,income:1.25}
};
const diffOf=s=>DIFF[s.difficulty]||DIFF.normal;
const EMP=[{name:'Aurum Concord',color:'#f2b544'},{name:'Veth Hegemony',color:'#4fd1c5'},{name:'Ossari Choir',color:'#ef6f8a'}];
const NAMES=['Achird','Brisa','Caph','Diadem','Elnath','Fawaris','Gienah','Hadar','Izar','Jabbah','Kochab','Lesath','Markab','Nashira','Okab','Phact',
  'Rasalas','Sadr','Tejat','Unuk','Vega','Wezen','Xamidimura','Yed','Zaniah','Alkes','Biham','Celaeno','Dabih','Errai','Furud','Hamal'];

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
const capOf=(s,st)=>st.cap>0?st.cap+(st.owner>=0?s.empires[st.owner].tech.terraform:0):0;
const incomeOf=(s,e)=>{const base=2+s.stars.reduce((a,st)=>a+(st.owner===e?st.pop:0),0);return e===0?base:Math.round(base*diffOf(s).income);};

function vision(s,e){
  const adj=adjOf(s),v=s.stars.map(()=>false),src=new Set();
  for(const st of s.stars)if(st.owner===e)src.add(st.id);
  for(const f of s.fleets)if(f.owner===e)src.add(f.at);
  for(const i of src){v[i]=true;for(const j of adj[i])v[j]=true;}
  return v;
}

// Each empire remembers every star as it last saw it: null until seen, then {owner,pop}.
function updateIntel(s){
  s.intel=s.empires.map((e,k)=>{const v=vision(s,k);return s.intel[k].map((m,i)=>v[i]?{owner:s.stars[i].owner,pop:s.stars[i].pop}:m);});
}
// What empire e can know: live detail within sensor range, memories elsewhere, nothing at unseen stars.
// Rival controllers receive this view, never the full state.
function fogView(s,e){
  const v=vision(s,e),mem=s.intel[e];
  return {...s,
    stars:s.stars.map((st,i)=>v[i]?{...st}:mem[i]?{...st,owner:mem[i].owner,pop:mem[i].pop}:{...st,cap:0,owner:-1,pop:0,unknown:true}),
    fleets:s.fleets.filter(f=>f.owner===e||v[f.at]).map(f=>({...f,ships:f.ships.map(x=>({...x}))}))};
}

const sightOf=(s,e)=>diffOf(s).fog?fogView(s,e):s;

function newGame(seed,difficulty='normal'){
  const rng=makeRng(seed),N=28,R=46,stars=[];
  for(let tries=0;stars.length<N&&tries<6000;tries++){
    const ang=rng.next()*Math.PI*2,r=Math.sqrt(rng.next())*R;
    const x=Math.cos(ang)*r,y=Math.sin(ang)*r*0.78;
    if(stars.every(s=>Math.hypot(s.x-x,s.y-y)>9.5))stars.push({id:stars.length,x,y});
  }
  const names=NAMES.slice();
  for(let i=names.length-1;i>0;i--){const j=rng.int(i+1);[names[i],names[j]]=[names[j],names[i]];}
  for(const st of stars){
    st.name=names[st.id];
    st.cap=rng.next()<0.24?0:1+rng.int(6);
    st.kind=rng.int(5);
    st.owner=-1;st.pop=0;
  }
  // Hyperlanes: the Gabriel graph — a lane joins two stars when no third star sits inside the circle they span.
  const n=stars.length,d2=(i,j)=>(stars[i].x-stars[j].x)**2+(stars[i].y-stars[j].y)**2,lanes=[];
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    const d=d2(i,j);let ok=true;
    for(let k=0;k<n&&ok;k++)if(k!==i&&k!==j&&d2(i,k)+d2(j,k)<d)ok=false;
    if(ok)lanes.push([i,j]);
  }
  const D=(a,b)=>Math.sqrt(d2(a,b)),argmax=f=>{let b=0,bv=-Infinity;for(let i=0;i<n;i++){const v=f(i);if(v>bv){bv=v;b=i;}}return b;};
  let h0=rng.int(n);const h1=argmax(i=>D(h0,i));h0=argmax(i=>D(h1,i));
  const h2=argmax(i=>Math.min(D(h0,i),D(h1,i)));
  const homes=[h0,h1,h2];
  const s={seed,difficulty:DIFF[difficulty]?difficulty:'normal',turn:1,rngState:rng.state,stars,lanes,fleets:[],nextFleet:1,nextShip:1,explored:stars.map(()=>false),events:[],over:null,
    empires:EMP.map((e,i)=>({id:i,name:e.name,color:e.color,credits:20,tech:{weapons:0,drives:0,terraform:0},alive:true,home:homes[i]}))};
  const adj=adjOf(s);
  homes.forEach((h,i)=>{
    Object.assign(stars[h],{cap:6,owner:i,pop:3,kind:2});
    if(!adj[h].some(j=>stars[j].cap>=2&&!homes.includes(j))){const j=adj[h].find(j=>!homes.includes(j));if(j!=null)stars[j].cap=3;}
    s.fleets.push({id:s.nextFleet++,owner:i,at:h,dest:null,
      ships:['fighter','fighter','colony','scout'].map(type=>({id:s.nextShip++,type}))});
  });
  s.explored=vision(s,0);
  s.intel=s.empires.map(()=>stars.map(()=>null));
  updateIntel(s);
  s.events=[{msg:`${stars[h0].name} awaits orders. Split your colony ship off the home fleet and send it to a nearby habitable star.`,kind:'colony',star:h0}];
  return s;
}

const clone=s=>({...s,stars:s.stars.map(x=>({...x})),empires:s.empires.map(e=>({...e,tech:{...e.tech}})),
  fleets:s.fleets.map(f=>({...f,ships:f.ships.map(x=>({...x}))})),explored:s.explored.slice(),events:[]});

// Applies one empire's orders, in the order given, to a (cloned) state.
// Orders: research{tech} · move{fleet,to} · split{fleet,ships:{type:n},to} · merge{star} · build{star,kind}
// Builds run last, so ships ordered this turn join a fleet parked at that star but cannot move until next turn.
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
      const f=mineF(o.fleet);if(f)f.dest=o.to===f.at?null:o.to;
    }else if(o.t==='split'){
      const f=mineF(o.fleet);if(!f)continue;
      const take=[];
      for(const t of TYPES){
        let n=o.ships[t]||0;
        for(let i=f.ships.length-1;i>=0&&n>0;i--)if(f.ships[i].type===t){take.unshift(...f.ships.splice(i,1));n--;}
      }
      if(!take.length)continue;
      const dest=o.to===f.at?null:o.to;
      if(!f.ships.length){f.ships=take;f.dest=dest;continue;}
      s.fleets.push({id:s.nextFleet++,owner:e,at:f.at,dest,ships:take});
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
    if(!st||st.owner!==e||!c||emp.credits<c)continue;
    emp.credits-=c;
    let f=s.fleets.find(f=>f.owner===e&&f.at===o.star&&f.dest==null);
    if(!f){f={id:s.nextFleet++,owner:e,at:o.star,dest:null,ships:[]};s.fleets.push(f);}
    f.ships.push({id:s.nextShip++,type:o.kind});
    if(e===0)say(`${SHIP[o.kind][0]} launched at ${st.name} and joined Fleet ${f.id}.`,'build',st.id);
  }
}
// What the state looks like once an empire's movement and research orders are applied (no builds, no turn).
function previewOrders(state,e,orders){const s=clone(state);s.events=state.events;applyOrders(s,e,orders,()=>{},false);return s;}

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
  // 3. Combat and sieges
  const hitP=e=>0.4+0.1*s.empires[e].tech.weapons;
  for(const st of s.stars){
    const fl=s.fleets.filter(f=>f.at===st.id);
    let here=[];for(const f of fl)for(const x of f.ships)here.push({id:x.id,type:x.type,owner:f.owner});
    const planet=st.owner>=0&&st.pop>0?st.owner:-1;
    const parties=new Set(here.map(h=>h.owner));if(planet>=0)parties.add(planet);
    if(parties.size<2)continue;
    const before={};for(const h of here)before[h.owner]=(before[h.owner]||0)+1;
    let fought=false;
    for(let r=0;r<6;r++){
      const shooters=here.filter(h=>h.type==='fighter').map(h=>h.owner);
      if(r===0&&planet>=0)for(let k=0;k<1+Math.floor(st.pop/3);k++)shooters.push(planet);
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
    if(st.owner>=0){
      const defended=here.some(h=>h.owner===st.owner&&h.type==='fighter'),atk={};
      for(const h of here)if(h.owner!==st.owner&&h.type==='fighter')atk[h.owner]=(atk[h.owner]||0)+1;
      const keys=Object.keys(atk).map(Number);
      if(!defended&&keys.length){
        const a=keys.sort((x,y)=>atk[y]-atk[x]||x-y)[0],prev=st.owner;
        st.pop-=Math.ceil(atk[a]/2);
        if(st.pop<=0){
          st.owner=a;st.pop=1;
          if(a===0||prev===0||seeNow[st.id])say(a===0?`You captured ${st.name} from ${s.empires[prev].name}.`:`${s.empires[a].name} captured ${st.name}${prev===0?' from you':''}.`,'capture',st.id);
        }else if(a===0||prev===0||seeNow[st.id])say(`${st.name} is under siege by ${nm(a)}. Population ${st.pop}.`,'siege',st.id);
      }
    }
  }
  s.fleets=s.fleets.filter(f=>f.ships.length);
  // 4. Colonisation: an arrived fleet carrying a colony ship settles an unclaimed habitable star, unless enemy fighters are present
  for(const st of s.stars){
    if(st.owner>=0||st.cap<=0)continue;
    const f=s.fleets.find(f=>f.at===st.id&&f.dest==null&&has(f,'colony')&&
      !s.fleets.some(g=>g.at===st.id&&g.owner!==f.owner&&has(g,'fighter')));
    if(!f)continue;
    f.ships.splice(f.ships.findIndex(x=>x.type==='colony'),1);
    st.owner=f.owner;st.pop=1;
    if(f.owner===0)say(`New colony founded at ${st.name}.`,'colony',st.id);
    else if(seeNow[st.id])say(`${s.empires[f.owner].name} settled ${st.name}.`,'colony',st.id);
  }
  s.fleets=s.fleets.filter(f=>f.ships.length);
  // 5. Growth and income
  for(const st of s.stars){
    if(st.owner<0)continue;
    const cap=capOf(s,st);
    if(st.pop<cap&&(s.turn+st.id)%2===0)st.pop++;
    if(st.pop>cap)st.pop=cap;
  }
  for(const emp of s.empires)if(emp.alive)emp.credits+=incomeOf(s,emp.id);
  // 6. Elimination
  for(const emp of s.empires){
    if(!emp.alive)continue;
    const alive=s.stars.some(st=>st.owner===emp.id)||s.fleets.some(f=>f.owner===emp.id&&has(f,'colony'));
    if(!alive){emp.alive=false;s.fleets=s.fleets.filter(f=>f.owner!==emp.id);say(emp.id===0?'Your empire has fallen.':`The ${emp.name} has fallen.`,'fall');}
  }
  const left=s.empires.filter(e=>e.alive);
  if(!s.empires[0].alive)s.over={win:false,turn:s.turn};
  else if(left.length===1)s.over={win:true,turn:s.turn};
  // 7. Charting
  const fresh=[];
  s.explored=s.explored.map((x,i)=>{if(!x&&seeNow[i])fresh.push(i);return x||seeNow[i];});
  if(fresh.length)say('Charted '+fresh.map(i=>`${s.stars[i].name} (${s.stars[i].cap?'hab '+s.stars[i].cap:'barren'})`).join(', ')+'.','chart',fresh[0]);
  updateIntel(s);
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
  const mine=v.stars.filter(st=>st.owner===e),fleets=v.fleets.filter(f=>f.owner===e);
  const claimed=new Set(fleets.filter(f=>f.dest!=null&&has(f,'colony')).map(f=>f.dest));
  const free=v.stars.filter(st=>st.owner<0&&st.cap>0);
  let colonyShips=0;
  for(const f of fleets){
    const n=countTypes(f).colony;colonyShips+=n;
    if(f.dest!=null)continue;
    const d=hops(adj,f.at);
    for(let k=0;k<n;k++){
      let best=null,bs=Infinity;
      for(const st of free){if(claimed.has(st.id)||d[st.id]===Infinity||st.id===f.at)continue;const sc=d[st.id]*2-st.cap;if(sc<bs){bs=sc;best=st;}}
      if(!best)break;
      claimed.add(best.id);out.push({t:'split',fleet:f.id,ships:{colony:1},to:best.id});
    }
  }
  const yard=mine.slice().sort((a,b)=>b.pop-a.pop||a.id-b.id)[0];
  if(yard){
    const open=free.filter(st=>!claimed.has(st.id)).length;
    if(open>0&&colonyShips<2&&cash>=COST.colony){out.push({t:'build',star:yard.id,kind:'colony'});cash-=COST.colony;}
    const reserve=s.turn>6&&nextTech?Math.min(techCost(emp.tech[nextTech]),60):0;
    for(let k=0;k<diffOf(s).builds&&cash-COST.fighter>=reserve;k++){out.push({t:'build',star:yard.id,kind:'fighter'});cash-=COST.fighter;}
  }
  const targets=v.stars.filter(st=>st.owner>=0&&st.owner!==e);
  if(s.turn>=diffOf(s).attackTurn&&targets.length){
    const need=3+Math.floor(s.turn/25);
    for(const f of fleets){
      if(f.dest!=null)continue;
      const n=countTypes(f).fighter;if(n<need)continue;
      const d=hops(adj,f.at);let best=null,bs=Infinity;
      for(const st of targets){const sc=d[st.id]*3+st.pop;if(sc<bs){bs=sc;best=st;}}
      const send=n-(v.stars[f.at].owner===e?1:0);
      if(best&&send>0)out.push({t:'split',fleet:f.id,ships:{fighter:send},to:best.id});
    }
  }
  // Exploration: scouts head for the nearest unseen star; idle strike stacks do too once nothing hostile is known.
  const scouted=new Set(fleets.filter(f=>f.dest!=null).map(f=>f.dest));
  const nearestUnknown=at=>{const d=hops(adj,at);let best=null,bd=Infinity;
    for(const st of v.stars)if(st.unknown&&!scouted.has(st.id)&&d[st.id]<bd){bd=d[st.id];best=st.id;}return best;};
  for(const f of fleets){
    if(f.dest!=null)continue;
    const c=countTypes(f);
    if(c.scout){const to=nearestUnknown(f.at);out.push({t:'split',fleet:f.id,ships:{scout:c.scout},to:to??rng.int(v.stars.length)});if(to!=null)scouted.add(to);}
    if(!targets.length&&s.turn>=diffOf(s).attackTurn&&c.fighter>=3+Math.floor(s.turn/25)){
      const to=nearestUnknown(f.at);if(to!=null){scouted.add(to);out.push({t:'split',fleet:f.id,ships:{fighter:c.fighter-(v.stars[f.at].owner===e?1:0)},to});}
    }
  }
  return out;
}
// CORE-END
if(typeof module!=='undefined')module.exports={TYPES,COST,SHIP,TECH,techCost,DIFF,diffOf,EMP,makeRng,adjOf,hops,route,fleetSpeed,countTypes,has,capOf,incomeOf,vision,updateIntel,fogView,sightOf,newGame,applyOrders,previewOrders,resolveTurn,aiOrders};
