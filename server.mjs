import http from 'node:http';
import {randomBytes,randomInt} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const rooms=new Map(),limits=new Map();
const token=()=>randomBytes(24).toString('hex'), online=p=>Date.now()-p.seen<5000;
const fail=(m,s=400)=>{throw Object.assign(new Error(m),{status:s});};
function clean(r){for(const p of r.players)if(Date.now()-p.seen>30000)p.left=true;if(!r.players.some(p=>p.id===r.host&&!p.left&&online(p))){const p=r.players.find(p=>!p.left&&online(p));if(p)r.host=p.id;}if(r.phase==='playing'&&r.players.filter(p=>p.active&&!p.left).length<2){r.phase='ended';r.result='Match ended: fewer than two players remain.';}}
function view(r,p){return {code:r.code,me:p.id,host:r.host,phase:r.phase,start:r.start,result:r.result,players:r.players.filter(x=>!x.left).map(x=>({id:x.id,name:x.name,score:x.score,online:online(x),active:x.active})),chat:r.chat,claimed:r.claimed,flips:p.flips.filter(i=>!r.claimed[i]).map(i=>({i,face:r.board[i]}))};}
export const server=http.createServer(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');try{
if(req.method==='GET'&&req.url==='/health'){res.setHeader('Content-Type','application/json');return res.end('{"ok":true}');}
if(req.method==='GET'&&req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(await readFile(new URL('./index.html',import.meta.url)));}
if(req.method!=='POST'||req.url!=='/api')return res.writeHead(404).end();
if(req.headers.origin&&!['http://','https://'].some(s=>req.headers.origin===s+req.headers.host))fail('Origin not allowed',403);
let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)fail('Request too large',413);}const b=JSON.parse(raw);let r,p;
if(['create','join'].includes(b.action)){
const ip=req.socket.remoteAddress,now=Date.now();let l=limits.get(ip);if(!l||now-l.time>60000){l={time:now,n:0};limits.set(ip,l);}if(++l.n>20)fail('Too many attempts. Try again in a minute.',429);
const name=String(b.name||'').trim();if(!name||name.length>18)fail('Choose a nickname of 1–18 characters.');
if(b.action==='create'){let code;do{code=Array.from({length:8},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');}while(rooms.has(code));r={code,players:[],chat:[],phase:'lobby',board:[],claimed:Array(24).fill(null),result:'',start:0};rooms.set(code,r);}else{r=rooms.get(String(b.code||'').trim().toUpperCase());if(!r)fail('Room not found. Check the code.');clean(r);}
if(r.players.filter(x=>!x.left).length>=8)fail('Room is full.');if(r.players.some(x=>!x.left&&x.name.toLowerCase()===name.toLowerCase()))fail('That nickname is taken. Choose another.');
p={id:token(),secret:token(),name,seen:Date.now(),score:0,active:false,left:false,flips:[],lock:0};r.players.push(p);if(!r.host)r.host=p.id;
return res.setHeader('Content-Type','application/json').end(JSON.stringify({secret:p.secret,...view(r,p)}));}
r=rooms.get(b.code);p=r?.players.find(x=>x.secret===b.secret&&!x.left);if(!p)fail('Session expired. Please join again.',401);clean(r);if(p.left)fail('Reconnect window expired. Please join again.',401);p.seen=Date.now();
if(p.flips.length===2&&Date.now()>=p.lock)p.flips=[];
if(b.action==='chat'){const message=String(b.message||'').trim();if(!message||message.length>240)fail('Use 1–240 characters.');if(Date.now()-(p.lastChat||0)<700)fail('Please wait a moment.');p.lastChat=Date.now();r.chat.push({name:p.name,text:message});r.chat=r.chat.slice(-80);}
else if(b.action==='start'){if(r.host!==p.id)fail('Only the host can start.',403);if(r.phase==='playing')fail('Match already running.');const ready=r.players.filter(x=>!x.left&&online(x));if(ready.length<2)fail('Two connected players are needed.');r.board=Array.from({length:24},(_,i)=>i>>1);for(let i=23;i>0;i--){let j=randomInt(i+1);[r.board[i],r.board[j]]=[r.board[j],r.board[i]];}r.claimed=Array(24).fill(null);r.phase='playing';r.start=Date.now()+3000;r.result='';for(const x of r.players){x.score=0;x.flips=[];x.lock=0;x.active=ready.includes(x);}}
else if(b.action==='flip'){if(r.phase!=='playing'||Date.now()<r.start||!p.active)fail('Wait for the next match.');const i=b.index;if(!Number.isInteger(i)||i<0||i>=24)fail('Invalid card.');if(Date.now()<p.lock)fail('Wait for your cards to turn back.');p.flips=p.flips.filter(j=>!r.claimed[j]);if(r.claimed[i]||p.flips.includes(i))fail('Choose an available card.');p.flips.push(i);if(p.flips.length===2){const [a,c]=p.flips;if(r.board[a]===r.board[c]){r.claimed[a]=r.claimed[c]=p.id;p.score++;for(const x of r.players)x.flips=x.flips.filter(j=>j!==a&&j!==c);if(r.claimed.every(Boolean)){r.phase='ended';const ps=r.players.filter(x=>x.active&&!x.left),best=Math.max(...ps.map(x=>x.score)),w=ps.filter(x=>x.score===best);r.result=w.map(x=>x.name).join(' & ')+(w.length>1?' share the win!':' wins!');}}else p.lock=Date.now()+1000;}}
else if(b.action==='leave'){p.left=true;clean(r);}else if(b.action!=='state')fail('Unknown action.');
res.setHeader('Content-Type','application/json').end(JSON.stringify(view(r,p)));
}catch(e){res.writeHead(e.status||400,{'Content-Type':'application/json'}).end(JSON.stringify({error:e.message}));}});
setInterval(()=>{for(const [c,r]of rooms){clean(r);if(r.players.every(p=>p.left))rooms.delete(c);}for(const [ip,l]of limits)if(Date.now()-l.time>60000)limits.delete(ip);},1000).unref();
if(process.env.NODE_ENV!=='test')server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Pals Party listening on port', Number(process.env.PORT)||3000));

