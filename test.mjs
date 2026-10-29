import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ticResult,sowGebeta,raceWinners} from './games.mjs';
process.env.NODE_ENV='test';const {server,settleOutcome}=await import('./server.mjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('new game rules: wins, draws, captures, relay sowing and conservation',()=>{
 assert.equal(ticResult(['X','X','X',null,'O',null,'O',null,null]),'X');
 assert.equal(ticResult(['X','O','X','X','O','O','O','X','X']),'draw');
 assert.equal(ticResult(Array(9).fill(null)),null);
 const terminal=sowGebeta([1,8,4,4,4,4,4,4,4,4,4,3],[0,0],0,0);assert.equal(terminal.captured[0],4);assert.equal(terminal.board[11],0);
 const ownership=sowGebeta([2,0,0,0,0,0,0,0,0,0,0,3],[0,0],0,0);assert.equal(ownership.captured[1],4);assert.equal(ownership.board[10],1);
 const empty=sowGebeta([1,0,0,0,0,0,0,0,0,0,0,0],[0,0],0,0);assert.equal(empty.board[11],1);
 assert.equal(empty.frames[0].kind,'pickup');assert.equal(empty.frames[1].at,200);assert.equal(empty.duration,700);
 assert.equal(terminal.frames.at(-1).kind,'capture');assert.equal(terminal.frames.at(-1).at-terminal.frames.at(-2).at,500);
 const relay=sowGebeta(Array(12).fill(4),[0,0],0,0);for(let i=1;i<relay.frames.length;i++){const f=relay.frames[i],previous=relay.frames[i-1];if(f.kind==='land')assert.equal(f.at-previous.at,200);if(f.kind==='pickup')assert.equal(f.at-previous.at,500);assert.equal(f.cells.reduce((a,b)=>a+b,0)+f.captured.reduce((a,b)=>a+b,0)+f.hand,48);}
 assert.deepEqual(relay.frames.at(-1).cells,relay.board);
 let board=Array(12).fill(4),captured=[0,0],turn=0;for(let n=0;n<200;n++){const pits=board.map((v,i)=>v&&i>=turn*6&&i<turn*6+6?i:-1).filter(i=>i>=0);if(!pits.length)break;const next=sowGebeta(board,captured,turn,pits[n%pits.length]);assert.equal(next.board.reduce((a,b)=>a+b,0)+next.captured.reduce((a,b)=>a+b,0),48);if(next.loop)break;board=next.board;captured=next.captured;turn=1-turn;}
 assert.equal(raceWinners([{score:9},{score:9},{score:8}]).length,2);
});
test('HTTP + private push streams across all four games',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,streams=[];const realNow=Date.now;let now=realNow();Date.now=()=>now;
 async function request(action,session={},extra={}){const response=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...session,action,...extra})});return {status:response.status,...await response.json()};}
 async function stream(session){const abort=new AbortController(),events=[];streams.push(abort);const response=await fetch(base+'/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(session),signal:abort.signal});assert.equal(response.status,200);const reader=response.body.getReader();let buffer='';(async()=>{try{while(true){const {done,value}=await reader.read();if(done)break;buffer+=new TextDecoder().decode(value);let i;while((i=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,i);buffer=buffer.slice(i+2);if(event.startsWith('data: '))events.push(JSON.parse(event.slice(6)));}}}catch{}})();return {abort,events};}
 async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await sleep(10);}assert.fail('Expected push update did not arrive');}
 try{
 assert.equal((await request('create',{}, {name:'A',roomName:' '})).status,400);
 const a=await request('create',{}, {name:'A',roomName:'Friday Court'});assert.equal(a.roomName,'Friday Court');const sa={code:a.code,secret:a.secret};let pa=await stream(sa);
 const b=await request('join',{}, {name:'B',code:a.code}),sb={code:b.code,secret:b.secret};let pb=await stream(sb);
 await until(()=>pa.events.at(-1)?.players.length===2);
 assert.equal((await request('join',{}, {name:'a',code:a.code})).status,400);
 assert.equal((await request('state',{code:a.code,secret:'bad'})).status,401);
 await request('chat',sa,{message:'Private hello'});await until(()=>pb.events.at(-1)?.chat.length===1);
 assert.equal(pb.events.at(-1).chat[0].text,'Private hello');const count=pb.events.length;await sleep(180);assert.equal(pb.events.length,count,'Idle room must not emit state on a timer');
 // Turn Memory is the default. Shared reveals, extra turns, mismatch delay and expiry are server-enforced.
 let turnState=await request('start',sa);assert.equal(turnState.memoryMode,'turn');now+=3001;
 const turnSessions={[a.me]:sa,[b.me]:sb},firstTurn=turnState.memoryTurn.player;
 assert.equal((await request('flip',turnSessions[firstTurn===a.me?b.me:a.me],{index:0})).status,400);
 let mismatch=false;
 for(let i=0;i<24&&turnState.phase==='playing';i+=2){
  const actor=turnState.memoryTurn.player,session=turnSessions[actor];
  turnState=await request('flip',session,{index:i});
  const observer=await request('state',turnSessions[actor===a.me?b.me:a.me]);assert.deepEqual(observer.flips,turnState.flips);
  turnState=await request('flip',session,{index:i+1});
  if(turnState.memoryTurn.locked){mismatch=true;assert.equal((await request('flip',session,{index:(i+2)%24})).status,400);await sleep(1050);turnState=await request('state',session);assert.notEqual(turnState.memoryTurn.player,actor);assert.equal(turnState.flips.length,0);break;}
  assert.equal(turnState.memoryTurn.player,actor,'Matching pair keeps the turn');
 }
 if(mismatch){
  const actor=turnState.memoryTurn.player,connection=actor===a.me?pa:pb;connection.abort.abort();await until(()=>((actor===a.me?pb:pa).events.at(-1)?.memoryTurn?.paused));if(actor===a.me)pa=await stream(sa);else pb=await stream(sb);
  // Leaving during a turn ends a two-player match cleanly.
 }
 await request('leave',sb);turnState=await request('state',sa);assert.equal(turnState.phase,'ended');
 const replacement=await request('join',{}, {name:'B',code:a.code});sb.secret=replacement.secret;b.me=replacement.me;pb=await stream(sb);
 await request('memoryMode',sa,{mode:'race'});await request('start',sa);now+=3001;
 let s=await request('flip',sa,{index:0});assert.equal(s.flips.length,1);await until(()=>pb.events.at(-1)?.phase==='playing');assert.equal(pb.events.at(-1).flips.length,0);
 // Learn a matching pair using legal moves and time advancement.
 const known=new Map(s.flips.map(f=>[f.i,f.face]));let pair;
 for(let i=1;i<24&&!pair;i++){s=await request('flip',sa,{index:i});for(const f of s.flips||[])known.set(f.i,f.face);for(const [j,f]of known)for(const [k,g]of known)if(j<k&&f===g)pair=[j,k];now+=1001;await request('state',sa);}
 // A discovered pair may already be claimed; total score still equals unique claims.
 s=await request('state',sa);assert.equal(s.players.reduce((n,p)=>n+p.score,0),s.claimed.filter(Boolean).length/2);
 await request('leave',sb);s=await request('state',sa);assert.equal(s.phase,'ended');
 const c=await request('join',{}, {name:'C',code:a.code}),sc={code:c.code,secret:c.secret};const pc=await stream(sc);
 // Tic-Tac-Toe starts with exactly two chosen players, rejects spectators and out-of-turn moves.
 const watcher=await request('join',{}, {name:'Watcher',code:a.code}),sw={code:watcher.code,secret:watcher.secret};await stream(sw);
 await request('select',sa,{game:'ttt'});assert.equal((await request('begin',sa,{ids:[a.me,a.me]})).status,400);
 s=await request('begin',sa,{ids:[a.me,c.me]});now+=3001;const initial=s.duel.turn;
 const sessions=[sa,sc];assert.equal((await request('move',sw,{index:0})).status,400);assert.equal((await request('move',sessions[1-initial],{index:0})).status,400);
 for(const i of [0,3,1,4,2]){s=await request('move',sessions[s.duel.turn],{index:i});assert.equal(s.status,200);}
 assert.equal(s.phase,'ended');assert.match(s.result,/wins/);
 s=await request('begin',sa,{ids:[a.me,c.me]});assert.equal(s.duel.turn,1-initial);now+=3001;
 pc.abort.abort();await until(()=>pa.events.at(-1)?.duel?.paused);assert.equal((await request('move',sessions[s.duel.turn],{index:0})).status,400);
 const reconnected=await stream(sc);await until(()=>pa.events.at(-1)?.duel?.paused===false);assert.equal((await request('state',sc)).me,c.me);
 await request('leave',sc);s=await request('state',sa);assert.match(s.result,/forfeit/);
 const d=await request('join',{}, {name:'D',code:a.code}),sd={code:d.code,secret:d.secret};await stream(sd);
 await request('select',sa,{game:'gebeta'});s=await request('begin',sa,{ids:[a.me,d.me]});now+=3001;const gs=[sa,sd];assert.equal((await request('move',gs[s.duel.turn],{index:(1-s.duel.turn)*6})).status,400);
 const side=s.duel.turn,pit=side*6;const expected=sowGebeta(s.duel.cells,s.duel.captured,side,pit);s=await request('move',gs[side],{index:pit});assert.equal(s.status,200);assert.equal(s.duel.animation.hand,4);assert.equal(s.duel.cells[pit],0);
 assert.equal((await request('move',gs[side],{index:pit+1})).status,400);assert.equal((await request('move',gs[1-side],{index:(1-side)*6})).status,400);
 await sleep(250);s=await request('state',sa);assert.equal(s.duel.animation.kind,'land');assert.equal(s.duel.animation.hand,3);assert.equal(s.duel.cells[(pit+11)%12],5);
 // A refreshed/reconnected player receives the actual intermediate position.
 await stream(sd);s=await request('state',sd);assert.ok(s.duel.animation);assert.equal(s.duel.cells.reduce((a,b)=>a+b,0)+s.duel.captured.reduce((a,b)=>a+b,0)+s.duel.animation.hand,48);
 await sleep(expected.duration-200+100);s=await request('state',sa);assert.equal(s.duel.animation,null);assert.deepEqual(s.duel.cells,expected.board);assert.deepEqual(s.duel.captured,expected.captured);assert.equal(s.duel.turn,1-side);
 if(s.phase==='playing')await request('leave',sd);
 const e=await request('join',{}, {name:'E',code:a.code}),se={code:e.code,secret:e.secret};await stream(se);
 await request('select',sa,{game:'race'});s=await request('begin',sa);assert.equal((await request('tap',sa)).status,400);now+=3001;
 for(let n=0;n<10;n++)assert.equal((await request('tap',sa)).status,200);assert.equal((await request('tap',sa)).status,400);now+=1001;
 // Equal finishing steps in the same server window share first place.
 // Watcher also races but remains at zero.
 for(let n=0;n<90;n++){assert.equal((await request('tap',sa)).status,200);if(n%10===9)now+=1001;}
 // Separate race validates timeout tie without waiting a real minute.
 await sleep(70);s=await request('state',sa);assert.equal(s.phase,'ended');assert.match(s.result,/A wins/);
 // Both players finish within one fixed 50 ms server window.
 s=await request('begin',sa);now+=3001;
 for(let n=0;n<99;n++){assert.equal((await request('tap',sa)).status,200);assert.equal((await request('tap',se)).status,200);if(n%10===9)now+=1001;}
 now=Math.ceil(now/50)*50;const finishes=await Promise.all([request('tap',sa),request('tap',se)]);finishes.forEach(r=>assert.equal(r.status,200));await sleep(70);s=await request('state',sa);assert.match(s.result,/A & E share the win/);
 s=await request('begin',sa);now=s.endsAt;await request('tap',sa);s=await request('state',sa);assert.equal(s.phase,'ended');assert.match(s.result,/share the win/);
 }finally{Date.now=realNow;for(const s of streams)s.abort();server.closeAllConnections();await new Promise(r=>server.close(r));}
});


test('floating chat unread counts ignore history and own messages and clear on open',()=>{
 const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8'),source=html.slice(html.indexOf('let chatRoom=null'),html.indexOf("$('chatToggle').onclick="));
 const nodes={chatToggle:{setAttribute(k,v){this[k]=v}},chatPanel:{open:false},chatBadge:{},chatAnnouncement:{textContent:''}};
 const context=vm.createContext({$:id=>nodes[id]});vm.runInContext(source,context);
 const base={code:'ROOM',me:'a',players:[{id:'a',name:'Alex'}]},history={id:'1',name:'Blair',text:'Hello'};
 context.updateChatBadge({...base,chat:[history]});assert.equal(nodes.chatBadge.hidden,true);
 context.updateChatBadge({...base,chat:[history,{...history,id:'2'}]});assert.equal(nodes.chatBadge.textContent,'1');
 context.updateChatBadge({...base,chat:[history,{...history,id:'2'},{...history,id:'3'}]});assert.equal(nodes.chatBadge.textContent,'2');
 context.updateChatBadge({...base,chat:[history,{...history,id:'2'},{...history,id:'3'},{id:'4',name:'Alex',text:'Mine'}]});assert.equal(nodes.chatBadge.textContent,'2');
 nodes.chatPanel.open=true;context.updateChatBadge({...base,chat:[history]});assert.equal(nodes.chatBadge.hidden,true);
 nodes.chatPanel.open=false;context.updateChatBadge({...base,code:'OTHER',chat:[history]});assert.equal(nodes.chatBadge.hidden,true);
});

test('nickname-first entry gates Create and Join and reveals the selected fields',()=>{
 const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8'),source=html.slice(html.indexOf('function validNickname(){'),html.indexOf("$('create').onclick=()=>chooseEntry"));
 const node=()=>({value:'',hidden:false,disabled:false,textContent:'',focus(){this.focused=true;},setAttribute(k,v){this[k]=v}}),nodes=Object.fromEntries(['nickname','roomcode','roomNameInput','create','join','confirmCreate','confirmJoin','nicknameHint','createFields','joinFields'].map(k=>[k,node()]));
 const context=vm.createContext({$:id=>nodes[id],busy:false});context.validCode=undefined;vm.runInContext(source,context);
 context.refreshEntry();assert.equal(nodes.create.disabled,true);assert.equal(nodes.join.disabled,true);
 nodes.nickname.value='   ';context.refreshEntry();assert.equal(nodes.create.disabled,true);
 nodes.nickname.value='Alex';context.refreshEntry();assert.equal(nodes.create.disabled,false);assert.equal(nodes.join.disabled,false);
 context.chooseEntry('create');assert.equal(nodes.createFields.hidden,false);assert.equal(nodes.joinFields.hidden,true);assert.equal(nodes.confirmCreate.disabled,true);
 nodes.roomNameInput.value='Friends’ Court';context.refreshEntry();assert.equal(nodes.confirmCreate.disabled,false);
 context.chooseEntry('join');assert.equal(nodes.createFields.hidden,true);assert.equal(nodes.joinFields.hidden,false);assert.equal(nodes.confirmJoin.disabled,true);
 nodes.roomcode.value='ab7cd8ef';context.refreshEntry();assert.equal(nodes.confirmJoin.disabled,false);
 nodes.roomcode.value='AB7';context.refreshEntry();assert.equal(nodes.confirmJoin.disabled,true);
 nodes.nickname.value='';context.refreshEntry();assert.equal(nodes.confirmCreate.disabled,true);assert.equal(nodes.confirmJoin.disabled,true);
});

test('authoritative Gebeta series outcomes, draws, shared wins and cancellation settle once',()=>{
 const r={game:'gebeta',phase:'ended',roundId:1,result:'A wins!',players:[{id:'a',name:'A',score:28},{id:'b',name:'B',score:20}],duel:{ids:['a','b']},series:{ids:['a','b'],names:['A','B'],wins:[0,0],round:1,complete:false}};
 settleOutcome(r);assert.deepEqual(r.series.wins,[1,0]);assert.equal(r.outcome.kind,'round');settleOutcome(r);assert.deepEqual(r.series.wins,[1,0]);
 r.roundId++;r.series.round++;r.result='It’s a draw!';r.players.forEach(p=>p.score=24);settleOutcome(r);assert.deepEqual(r.series.wins,[1,0]);assert.equal(r.outcome.kind,'draw');
 r.roundId++;r.series.round++;r.result='A wins!';r.players[0].score=32;r.players[1].score=16;settleOutcome(r);assert.deepEqual(r.series.wins,[2,0]);assert.equal(r.series.complete,true);assert.equal(r.outcome.kind,'series');
 const shared={game:'memory',phase:'ended',roundId:1,result:'A & B share the win!',players:[{id:'a',name:'A',score:6,active:true},{id:'b',name:'B',score:6,active:true}]};settleOutcome(shared);assert.equal(shared.outcome.kind,'shared');assert.equal(shared.outcome.winnerIds.length,2);
 shared.roundId++;shared.result='Match ended: fewer than two players remain.';settleOutcome(shared);assert.equal(shared.outcome.kind,'cancelled');assert.equal(shared.outcome.winnerIds.length,0);
});
test('best-of-three lifecycle with spectator, draws, refresh, rematch and forfeits',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,controllers=[];const realNow=Date.now;let now=realNow();Date.now=()=>now;
 async function req(action,session={},extra={}){const response=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...session,action,...extra})});return {status:response.status,...await response.json()};}
 async function stream(session){const abort=new AbortController();controllers.push(abort);const response=await fetch(base+'/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(session),signal:abort.signal});const reader=response.body.getReader();(async()=>{try{while(!(await reader.read()).done){}}catch{}})();return abort;}
 try{
 const a=await req('create',{}, {name:'Series A'}),sa={code:a.code,secret:a.secret};await stream(sa);
 const b=await req('join',{}, {name:'Series B',code:a.code}),sb={code:b.code,secret:b.secret};let bs=await stream(sb);
 const v=await req('join',{}, {name:'Spectator',code:a.code}),sv={code:v.code,secret:v.secret};await stream(sv);
 const sessions={[a.me]:sa,[b.me]:sb};await req('select',sa,{game:'ttt'});assert.equal((await req('seriesFormat',sv,{mode:'best3'})).status,403);await req('seriesFormat',sa,{mode:'best3'});
 let state=await req('begin',sa,{ids:[a.me,b.me]});now+=3001;const first=state.duel.turn;
 assert.equal((await req('move',sv,{index:0})).status,400);
 async function winA(){const wanted=state.duel.ids.indexOf(a.me),moves=state.duel.turn===wanted?[0,3,1,4,2]:[3,0,4,1,8,2];for(const index of moves)state=await req('move',sessions[state.duel.ids[state.duel.turn]],{index});}
 await winA();assert.equal(state.outcome.kind,'round');assert.deepEqual(state.series.wins,[1,0]);assert.deepEqual((await req('state',sv)).outcome,state.outcome);
 for(let n=0;n<3;n++)await req('state',sa);assert.deepEqual((await req('state',sa)).series.wins,[1,0]);
 assert.equal((await req('begin',sa,{ids:[a.me,v.me]})).status,400);assert.equal((await req('nextRound',sv)).status,403);
 state=await req('nextRound',sa);assert.equal(state.duel.turn,1-first);assert.deepEqual(state.series.ids,[a.me,b.me]);now+=3001;
 assert.equal((await req('nextRound',sa)).status,400);
 for(const index of [0,1,2,4,3,5,7,6,8])state=await req('move',sessions[state.duel.ids[state.duel.turn]],{index});
 assert.equal(state.outcome.kind,'draw');assert.deepEqual(state.series.wins,[1,0]);
 // Reconnecting keeps the same competitor identity and series progress.
 bs.abort();bs=await stream(sb);assert.deepEqual((await req('state',sb)).series.wins,[1,0]);
 state=await req('nextRound',sa);assert.equal(state.duel.turn,first);now+=3001;await winA();assert.equal(state.outcome.kind,'series');assert.equal(state.series.complete,true);assert.deepEqual(state.series.wins,[2,0]);
 assert.deepEqual((await req('state',sv)).outcome,state.outcome);assert.equal((await req('nextRound',sa)).status,400);
 state=await req('replay',sa);assert.deepEqual(state.series.wins,[0,0]);assert.equal(state.series.round,1);now+=3001;
 await req('leave',sb);state=await req('state',sa);assert.equal(state.outcome.kind,'forfeit');assert.equal(state.series.complete,true);const wins=[...state.series.wins];await req('state',sv);assert.deepEqual((await req('state',sa)).series.wins,wins);
 await req('lobby',sa);state=await req('state',sa);assert.equal(state.series,null);assert.equal(state.outcome,null);assert.equal(state.phase,'lobby');assert.equal(state.seriesMode,'single');
 // Expiring the reconnect grace period forfeits once, even between rounds.
 const c=await req('join',{}, {name:'Series C',code:a.code}),sc={code:c.code,secret:c.secret};const cs=await stream(sc);await req('seriesFormat',sa,{mode:'best3'});state=await req('begin',sa,{ids:[a.me,c.me]});now+=3001;
 const moves=state.duel.turn===0?[0,3,1,4,2]:[3,0,4,1,8,2];for(const index of moves)state=await req('move',state.duel.turn===0?sa:sc,{index});assert.equal(state.phase,'ended');assert.deepEqual(state.series.wins,[1,0]);
 cs.abort();await sleep(30150);state=await req('state',sa);assert.equal(state.outcome.kind,'forfeit');assert.equal(state.series.complete,true);assert.deepEqual(state.series.wins,[1,0]);assert.equal((await req('state',sc)).status,401);
 }finally{Date.now=realNow;controllers.forEach(c=>c.abort());server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('host cancellation and loser-requested Best of 3 require the right permissions and consent',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,controllers=[];const realNow=Date.now;let now=realNow()+120000;Date.now=()=>now;
 async function req(action,session={},extra={}){const response=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...session,action,...extra})});return {status:response.status,...await response.json()};}
 async function stream(session){const controller=new AbortController();controllers.push(controller);const response=await fetch(base+'/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(session),signal:controller.signal});const reader=response.body.getReader();(async()=>{try{while(!(await reader.read()).done){}}catch{}})();}
 try{
 const a=await req('create',{}, {name:'Host A'}),sa={code:a.code,secret:a.secret};await stream(sa);
 const b=await req('join',{}, {code:a.code,name:'B'}),sb={code:b.code,secret:b.secret};await stream(sb);
 const v=await req('join',{}, {code:a.code,name:'Observer'}),sv={code:v.code,secret:v.secret};await stream(sv);
 await req('chat',sa,{message:'Chat stays open'});await req('start',sa);now+=3001;
 assert.equal((await req('endGame',sb)).status,403);let state=await req('endGame',sa);assert.equal(state.phase,'lobby');assert.equal(state.outcome,null);assert.equal(state.series,null);assert.match(state.roomNotice.text,/everyone stays in the room/i);assert.equal(state.chat[0].text,'Chat stays open');assert.equal(state.players.length,3);
 assert.deepEqual((await req('state',sv)).roomNotice,state.roomNotice);assert.equal((await req('endGame',sa)).status,400);
 async function winA(){const moves=state.duel.turn===0?[0,3,1,4,2]:[3,0,4,1,8,2];for(const index of moves)state=await req('move',state.duel.turn===0?sa:sb,{index});}
 await req('select',sa,{game:'ttt'});state=await req('begin',sa,{ids:[a.me,b.me]});now+=3001;const first=state.duel.turn;await winA();const initial=structuredClone(state.outcome);
 assert.equal((await req('offerSeries',sa)).status,403);assert.equal((await req('offerSeries',sv)).status,403);
 state=await req('offerSeries',sb);assert.equal(state.seriesOffer.status,'pending');assert.equal(state.series,null);assert.equal((await req('offerSeries',sb)).status,400);
 assert.equal((await req('answerSeries',sb,{answer:'accept'})).status,403);assert.equal((await req('answerSeries',sv,{answer:'accept'})).status,403);
 state=await req('answerSeries',sa,{answer:'accept'});assert.deepEqual(state.series.wins,[1,0]);assert.deepEqual(state.series.ids,[a.me,b.me]);assert.equal(state.series.round,1);assert.equal(state.outcome.kind,'round');assert.deepEqual((await req('state',sv)).series.wins,[1,0]);assert.equal((await req('answerSeries',sa,{answer:'accept'})).status,400);
 state=await req('nextRound',sa);assert.equal(state.duel.turn,1-first);assert.equal(state.seriesOffer,null);assert.deepEqual(state.series.wins,[1,0]);
 state=await req('endGame',sa);assert.equal(state.phase,'lobby');assert.equal(state.series,null);assert.equal(state.outcome,null);assert.equal(state.players.every(p=>p.score===0),true);
 await req('select',sa,{game:'ttt'});state=await req('begin',sa,{ids:[a.me,b.me]});now+=3001;await winA();const result=structuredClone(state.outcome);await req('offerSeries',sb);
 state=await req('answerSeries',sa,{answer:'decline'});assert.equal(state.series,null);assert.equal(state.seriesOffer.status,'declined');assert.deepEqual(state.outcome,result);assert.equal((await req('offerSeries',sb)).status,400);
 await req('lobby',sa);assert.equal((await req('state',sa)).seriesOffer,null);
 // Cancellation invalidates queued Gebeta animation frames and keeps room membership/chat.
 await req('select',sa,{game:'gebeta'});state=await req('begin',sa,{ids:[a.me,b.me]});now+=3001;const side=state.duel.turn;state=await req('move',side===0?sa:sb,{index:side*6});assert.ok(state.duel.animation);
 state=await req('endGame',sa);assert.equal(state.phase,'lobby');await sleep(350);state=await req('state',sa);assert.equal(state.duel,null);assert.equal(state.phase,'lobby');assert.equal(state.outcome,null);assert.equal(state.chat[0].text,'Chat stays open');
 // A pending request closes when a competitor leaves, without rewriting the original result.
 await req('select',sa,{game:'ttt'});state=await req('begin',sa,{ids:[a.me,b.me]});now+=3001;await winA();await req('offerSeries',sb);const finalResult=structuredClone(state.outcome);await req('leave',sa);state=await req('state',sv);assert.equal(state.seriesOffer.status,'closed');assert.equal(state.series,null);assert.deepEqual(state.outcome,finalResult);
 }finally{Date.now=realNow;controllers.forEach(c=>c.abort());server.closeAllConnections();await new Promise(r=>server.close(r));}
});


