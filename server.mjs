import http from 'node:http';
import {TWO_PLAYER,ticResult,sowGebeta,newDuel,positionKey,raceWinners} from './games.mjs';
import {randomBytes,randomInt} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const rooms=new Map(),limits=new Map();
const token=()=>randomBytes(24).toString('hex'), online=p=>!!p.stream||(!p.disconnected&&Date.now()-p.seen<5000);
const fail=(m,s=400)=>{throw Object.assign(new Error(m),{status:s});};
function clean(r){
 if(!r.players.some(p=>p.id===r.host&&!p.left&&online(p))){const p=r.players.find(p=>!p.left&&online(p));if(p)r.host=p.id;}
 if(r.phase==='playing'){
  const active=r.players.filter(p=>p.active&&!p.left);
  if(TWO_PLAYER.has(r.game)){
   const gone=r.duel.ids.filter(id=>!active.some(p=>p.id===id));
   if(gone.length){r.phase='ended';const winner=active.find(p=>r.duel.ids.includes(p.id));r.result=winner?winner.name+' wins by forfeit.':'Match ended without a winner.';}
   else r.duel.paused=active.some(p=>!online(p));
  }else if(active.length<2){r.phase='ended';r.result='Match ended: fewer than two players remain.';}
  else if(r.game==='memory'&&r.memoryMode==='turn'){const current=r.players.find(p=>p.id===r.turnPlayer);if(!current||current.left){advanceMemory(r);}r.turnPaused=!online(r.players.find(p=>p.id===r.turnPlayer));}
 }
 if(r.players.every(p=>p.left))rooms.delete(r.code);
}
function publish(r){r.revision=(r.revision||0)+1;for(const p of r.players)if(p.stream&&!p.left)p.stream.write('data: '+JSON.stringify(view(r,p))+'\n\n');}
function later(fn,ms){const timer=setTimeout(fn,ms);timer.unref();return timer;}
function reserve(r,p){clearTimeout(p.expiry);p.expiry=later(()=>{if(p.stream)return;p.left=true;clean(r);publish(r);},30000);}
function disconnect(r,p,stream){if(p.stream!==stream)return;p.stream=null;p.disconnected=true;p.seen=Date.now();reserve(r,p);clean(r);publish(r);}
function finishRace(r){if(r.phase!=='playing'||r.game!=='race')return;const contenders=r.players.filter(p=>p.active&&!p.left),w=raceWinners(contenders);r.phase='ended';r.result=w.map(p=>p.name).join(' & ')+(w.length>1?' share the win!':' wins!');publish(r);}
function advanceMemory(r){
 const ids=r.turnOrder||[];let index=ids.indexOf(r.turnPlayer);for(let n=1;n<=ids.length;n++){const id=ids[(index+n)%ids.length];if(r.players.some(p=>p.id===id&&!p.left&&p.active)){r.turnPlayer=id;break;}}r.shared=[];r.turnLock=0;
}
function startTurnMemory(r,p){
 if(r.host!==p.id)fail('Only the host can start.',403);if(r.phase==='playing')fail('Match already running.');const ready=r.players.filter(x=>!x.left&&online(x));if(ready.length<2)fail('Two connected players are needed.');
 r.board=Array.from({length:24},(_,i)=>i>>1);for(let i=23;i>0;i--){const j=randomInt(i+1);[r.board[i],r.board[j]]=[r.board[j],r.board[i]];}
 r.claimed=Array(24).fill(null);r.phase='playing';r.start=Date.now()+3000;r.result='';r.turnOrder=ready.map(x=>x.id);r.turnPlayer=r.turnOrder[randomInt(r.turnOrder.length)];r.shared=[];r.turnLock=0;r.turnPaused=false;
 for(const x of r.players){x.score=0;x.flips=[];x.lock=0;x.active=ready.includes(x);}
}
function flipTurnMemory(r,p,i){
 if(r.phase!=='playing'||Date.now()<r.start||!p.active)fail('Wait for the next match.');if(r.turnPaused)fail('Waiting for the current player.');if(r.turnPlayer!==p.id)fail('It is not your turn.');if(Date.now()<r.turnLock)fail('Wait for the cards to hide.');
 if(!Number.isInteger(i)||i<0||i>=24||r.claimed[i]||r.shared.includes(i))fail('Choose an available card.');r.shared.push(i);
 if(r.shared.length===2){const [a,b]=r.shared;if(r.board[a]===r.board[b]){
  r.claimed[a]=r.claimed[b]=p.id;p.score++;r.shared=[];
  if(r.claimed.every(Boolean)){r.phase='ended';const players=r.players.filter(x=>x.active&&!x.left),best=Math.max(...players.map(x=>x.score)),w=players.filter(x=>x.score===best);r.result=w.map(x=>x.name).join(' & ')+(w.length>1?' share the win!':' wins!');}
 }else{r.turnLock=Date.now()+1000;const lock=r.turnLock,start=r.start;later(()=>{if(r.phase==='playing'&&r.game==='memory'&&r.memoryMode==='turn'&&r.start===start&&r.turnLock===lock){advanceMemory(r);clean(r);publish(r);}},1000);}}
}
function scheduleMemory(r,p){if(p.flips.length===2){const lock=p.lock;later(()=>{if(r.game==='memory'&&p.lock===lock&&p.flips.length===2){p.flips=[];publish(r);}},Math.max(0,lock-Date.now()));}}
function view(r,p){return {serverNow:Date.now(),revision:r.revision||0,game:r.game||'memory',memoryMode:r.memoryMode||'turn',memoryTurn:{player:r.turnPlayer,paused:!!r.turnPaused,locked:Date.now()<r.turnLock},duel:r.duel?{ids:r.duel.ids,turn:r.duel.turn,symbols:r.duel.symbols,cells:r.duel.cells,captured:r.duel.captured,paused:r.duel.paused}:null,endsAt:r.endsAt,code:r.code,me:p.id,host:r.host,phase:r.phase,start:r.start,result:r.result,players:r.players.filter(x=>!x.left).map(x=>({id:x.id,name:x.name,score:x.score,online:online(x),active:x.active})),chat:r.chat,claimed:r.claimed,flips:(r.game==='memory'&&r.memoryMode==='turn'?(r.shared||[]):p.flips).filter(i=>!r.claimed[i]).map(i=>({i,face:r.board[i]}))};}
export const server=http.createServer(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');try{
if(req.method==='GET'&&req.url==='/health'){res.setHeader('Content-Type','application/json');return res.end('{"ok":true}');}
if(req.method==='GET'&&req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(await readFile(new URL('./index.html',import.meta.url)));}
if(req.method!=='POST'||!['/api','/events'].includes(req.url))return res.writeHead(404).end();
if(req.headers.origin&&!['http://','https://'].some(s=>req.headers.origin===s+req.headers.host))fail('Origin not allowed',403);
let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)fail('Request too large',413);}const b=JSON.parse(raw);let r,p;
if(['create','join'].includes(b.action)){
const ip=req.socket.remoteAddress,now=Date.now();let l=limits.get(ip);if(!l||now-l.time>60000){l={time:now,n:0};limits.set(ip,l);}if(++l.n>20)fail('Too many attempts. Try again in a minute.',429);
const name=String(b.name||'').trim();if(!name||name.length>18)fail('Choose a nickname of 1–18 characters.');
if(b.action==='create'){let code;do{code=Array.from({length:8},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');}while(rooms.has(code));r={game:'memory',memoryMode:'turn',shared:[],revision:0,code,players:[],chat:[],phase:'lobby',board:[],claimed:Array(24).fill(null),result:'',start:0};rooms.set(code,r);}else{r=rooms.get(String(b.code||'').trim().toUpperCase());if(!r)fail('Room not found. Check the code.');clean(r);}
if(r.players.filter(x=>!x.left).length>=8)fail('Room is full.');if(r.players.some(x=>!x.left&&x.name.toLowerCase()===name.toLowerCase()))fail('That nickname is taken. Choose another.');
p={id:token(),secret:token(),name,seen:Date.now(),score:0,active:false,left:false,flips:[],lock:0};r.players.push(p);if(!r.host)r.host=p.id;reserve(r,p);publish(r);
return res.setHeader('Content-Type','application/json').end(JSON.stringify({secret:p.secret,...view(r,p)}));}
r=rooms.get(b.code);p=r?.players.find(x=>x.secret===b.secret&&!x.left);if(!p)fail('Session expired. Please join again.',401);clean(r);if(p.left)fail('Reconnect window expired. Please join again.',401);p.seen=Date.now();
if(req.url==='/events'){
 clearTimeout(p.expiry);const old=p.stream;p.stream=res;p.disconnected=false;if(old)old.end();
 res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n');
 clean(r);publish(r);const keepAlive=setInterval(()=>res.write(': keep-alive\n\n'),20000);keepAlive.unref();
 res.on('close',()=>{clearInterval(keepAlive);disconnect(r,p,res);});return;
}
if(p.flips.length===2&&Date.now()>=p.lock)p.flips=[];
if(b.action==='chat'){const message=String(b.message||'').trim();if(!message||message.length>240)fail('Use 1–240 characters.');if(Date.now()-(p.lastChat||0)<700)fail('Please wait a moment.');p.lastChat=Date.now();r.chat.push({name:p.name,text:message});r.chat=r.chat.slice(-80);}
else if(b.action==='memoryMode'){if(r.host!==p.id)fail('Only the host can choose a mode.',403);if(r.phase==='playing')fail('Finish the current game first.');if(!['turn','race'].includes(b.mode))fail('Unknown mode.');r.memoryMode=b.mode;r.phase='lobby';r.shared=[];}
else if(b.action==='select'){
 if(r.host!==p.id)fail('Only the host can choose a game.',403);if(r.phase==='playing')fail('Finish the current game first.');if(!['memory','race','ttt','gebeta'].includes(b.game))fail('Unknown game.');r.game=b.game;r.phase='lobby';r.result='';r.duel=null;
}
else if(b.action==='begin'){
 if(r.host!==p.id)fail('Only the host can start.',403);if(r.phase==='playing')fail('Match already running.');if(!['race','ttt','gebeta'].includes(r.game))fail('Select a game first.');
 const ready=r.players.filter(x=>!x.left&&online(x));let chosen=ready;
 if(TWO_PLAYER.has(r.game)){if(!Array.isArray(b.ids)||b.ids.length!==2||new Set(b.ids).size!==2)fail('Select two different players.');chosen=b.ids.map(id=>ready.find(x=>x.id===id));if(chosen.some(x=>!x))fail('Select two connected players.');}
 if(chosen.length<2)fail('Two connected players are needed.');for(const x of r.players){x.active=chosen.includes(x);x.score=0;x.taps=[];x.flips=[];}
 r.phase='playing';r.result='';r.start=Date.now()+3000;r.endsAt=null;r.raceFinishBucket=null;
 if(TWO_PLAYER.has(r.game)){r.duel=newDuel(r,r.game,chosen.map(x=>x.id));r.duel.history.add(positionKey(r.duel));}
 else {r.duel=null;r.endsAt=r.start+60000;const end=r.endsAt;later(()=>{if(r.endsAt===end)finishRace(r);},end-Date.now());}
 const start=r.start;later(()=>{if(r.start===start&&r.phase==='playing')publish(r);},3000);
}
else if(b.action==='tap'){
 if(r.game!=='race'||r.phase!=='playing'||!p.active||Date.now()<r.start)fail('Wait for the race.');const now=Date.now();if(now>=r.endsAt){finishRace(r);fail('Race finished.');}
 if(r.raceFinishBucket!=null&&Math.floor(now/50)!==r.raceFinishBucket){finishRace(r);fail('Race finished.');}
 p.taps=p.taps.filter(t=>now-t<1000);if(p.taps.length>=10)fail('Maximum 10 steps per second.');if(p.score>=100)fail('Already finished.');p.taps.push(now);p.score++;
 if(p.score===100&&r.raceFinishBucket==null){r.raceFinishBucket=Math.floor(now/50);later(()=>finishRace(r),50-now%50);}
}
else if(b.action==='move'){
 if(!TWO_PLAYER.has(r.game)||r.phase!=='playing'||Date.now()<r.start)fail('Wait for the game.');const d=r.duel;if(d.paused)fail('Waiting for the other player to reconnect.');if(d.ids[d.turn]!==p.id)fail('It is not your turn.');const side=d.turn,i=b.index;
 if(r.game==='ttt'){
  if(!Number.isInteger(i)||i<0||i>8||d.cells[i])fail('Choose an empty square.');d.cells[i]=d.symbols[side];const result=ticResult(d.cells);
  if(result){r.phase='ended';r.result=result==='draw'?'It’s a draw!':p.name+' wins!';if(result!=='draw')p.score=1;}else d.turn=1-side;
 }else {
  if(!Number.isInteger(i)||i<side*6||i>=side*6+6||!d.cells[i])fail('Choose a nonempty pit on your side.');const next=sowGebeta(d.cells,d.captured,side,i);d.cells=next.board;d.captured=next.captured;d.turn=1-side;
  for(let k=0;k<2;k++)r.players.find(x=>x.id===d.ids[k]).score=d.captured[k];
  if(next.loop){r.phase='ended';r.result='Repeated sowing position — draw.';}
  else if(d.cells.slice(d.turn*6,d.turn*6+6).every(n=>n===0)){
   d.captured[side]+=d.cells.reduce((a,c)=>a+c,0);d.cells.fill(0);for(let k=0;k<2;k++)r.players.find(x=>x.id===d.ids[k]).score=d.captured[k];r.phase='ended';r.result=d.captured[0]===d.captured[1]?'It’s a draw!':r.players.find(x=>x.id===d.ids[d.captured[0]>d.captured[1]?0:1]).name+' wins!';
  }else{const key=positionKey(d);if(d.history.has(key)){r.phase='ended';r.result='Repeated board and turn — draw.';}else d.history.add(key);}
 }
}
else if(b.action==='start'&&r.game==='memory'&&r.memoryMode==='turn'){startTurnMemory(r,p);}
else if(b.action==='flip'&&r.game==='memory'&&r.memoryMode==='turn'){flipTurnMemory(r,p,b.index);}
else if(b.action==='start'&&r.game!=='memory')fail('Use the selected game’s start button.');
else if(b.action==='flip'&&r.game!=='memory')fail('Memory Match is not selected.');
else if(b.action==='start'){if(r.host!==p.id)fail('Only the host can start.',403);if(r.phase==='playing')fail('Match already running.');const ready=r.players.filter(x=>!x.left&&online(x));if(ready.length<2)fail('Two connected players are needed.');r.board=Array.from({length:24},(_,i)=>i>>1);for(let i=23;i>0;i--){let j=randomInt(i+1);[r.board[i],r.board[j]]=[r.board[j],r.board[i]];}r.claimed=Array(24).fill(null);r.phase='playing';r.start=Date.now()+3000;r.result='';for(const x of r.players){x.score=0;x.flips=[];x.lock=0;x.active=ready.includes(x);}}
else if(b.action==='flip'){if(r.phase!=='playing'||Date.now()<r.start||!p.active)fail('Wait for the next match.');const i=b.index;if(!Number.isInteger(i)||i<0||i>=24)fail('Invalid card.');if(Date.now()<p.lock)fail('Wait for your cards to turn back.');p.flips=p.flips.filter(j=>!r.claimed[j]);if(r.claimed[i]||p.flips.includes(i))fail('Choose an available card.');p.flips.push(i);if(p.flips.length===2){const [a,c]=p.flips;if(r.board[a]===r.board[c]){r.claimed[a]=r.claimed[c]=p.id;p.score++;for(const x of r.players)x.flips=x.flips.filter(j=>j!==a&&j!==c);if(r.claimed.every(Boolean)){r.phase='ended';const ps=r.players.filter(x=>x.active&&!x.left),best=Math.max(...ps.map(x=>x.score)),w=ps.filter(x=>x.score===best);r.result=w.map(x=>x.name).join(' & ')+(w.length>1?' share the win!':' wins!');}}else p.lock=Date.now()+1000;}}
else if(b.action==='leave'){p.left=true;clean(r);}else if(b.action!=='state')fail('Unknown action.');
if(b.action==='flip')scheduleMemory(r,p);
if(b.action==='start'){const start=r.start;later(()=>{if(r.start===start&&r.phase==='playing')publish(r);},3000);}
if(b.action==='leave'&&p.stream){const stream=p.stream;p.stream=null;stream.end();}
clean(r);publish(r);
res.setHeader('Content-Type','application/json').end(JSON.stringify(view(r,p)));
}catch(e){res.writeHead(e.status||400,{'Content-Type':'application/json'}).end(JSON.stringify({error:e.message}));}});
// Room changes, reconnect expiry and game deadlines trigger updates; no state polling loop.
if(process.env.NODE_ENV!=='test')server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Pals Party listening on port', Number(process.env.PORT)||3000));

