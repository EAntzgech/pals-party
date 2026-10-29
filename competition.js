/* Saba_Party competition interface. No game rules are reimplemented here. */
function showEntryError(error,action){
 for(const id of ['nicknameError','createError','joinError']){$(id).hidden=true;$(id).textContent='';}
 const text=error?.message||'Unable to connect. Please try again.';
 const id=/nickname|name.*taken/i.test(text)?'nicknameError':action==='create'?'createError':'joinError';
 $(id).textContent=text;$(id).hidden=false;
 const field=id==='nicknameError'?$('nickname'):action==='join'?$('roomcode'):$('roomNameInput');field.setAttribute('aria-invalid','true');field.setAttribute('aria-errormessage',id);field.focus();
}
for(const [input,error] of [['nickname','nicknameError'],['roomcode','joinError'],['roomNameInput','createError']])$(input).addEventListener('input',()=>{$(error).hidden=true;$(input).removeAttribute('aria-invalid');});
const invitedCode=new URL(location.href).searchParams.get('room');
if(invitedCode&&/^[A-HJ-NP-Z2-9]{8}$/i.test(invitedCode)){
 $('roomcode').value=invitedCode.toUpperCase();$('joinFields').hidden=false;$('createFields').hidden=true;$('join').setAttribute('aria-pressed','true');
 $('nicknameHint').textContent='Your invitation is ready. Enter a nickname, then join.';
 $('nickname').addEventListener('input',()=>{if(validNickname()){$('joinFields').hidden=false;$('createFields').hidden=true;$('join').setAttribute('aria-pressed','true');$('create').setAttribute('aria-pressed','false');refreshEntry();}});
}else if(invitedCode){$('joinFields').hidden=false;$('joinError').hidden=false;$('joinError').textContent='This invitation has an invalid room code. Ask your friend for a new link.';}
$('roomcode').addEventListener('input',()=>{if($('roomcode').value.length>=8&&!validCode()){$('joinError').hidden=false;$('joinError').textContent='Use eight letters or numbers. Codes do not use I, O, 0, or 1.';$('roomcode').setAttribute('aria-invalid','true');}});
function roomInvitation(code){const url=new URL(location.pathname,location.origin);url.searchParams.set('room',code);return url.href;}
function inviteMessage(code){return 'Join me in Saba_Party!\nRoom code: '+code+'\nOpen this link: '+roomInvitation(code);}
async function copyRoomText(text,label){
 try{if(!navigator.clipboard?.writeText)throw Error('Unavailable');await navigator.clipboard.writeText(text);$('shareStatus').textContent=label+' copied.';$('copyFallback').hidden=true;}
 catch{$('copyFallback').value=text;$('copyFallback').hidden=false;$('copyFallback').focus();$('copyFallback').select();$('shareStatus').textContent='Select and copy the '+label.toLowerCase()+' above.';}
}
$('copyCode').onclick=()=>state&&copyRoomText(state.code,'Room code');
$('shareInvite').onclick=async()=>{if(!state)return;const text=inviteMessage(state.code);if(navigator.share){try{await navigator.share({title:'Play Saba_Party',text});$('shareStatus').textContent='Invitation shared with room code and link.';return;}catch(e){if(e.name==='AbortError')return;}}await copyRoomText(text,'Invite message');};
$('copyInvite').onclick=()=>state&&copyRoomText(inviteMessage(state.code),'Invite message');
const connectionHelp=element('p','','connectionHelp');connectionHelp.id='connectionHelp';connectionHelp.hidden=true;connectionHelp.setAttribute('role','status');$('connection').after(connectionHelp);$('connection').setAttribute('role','status');$('connection').setAttribute('aria-live','polite');
const updateConnectionHelp=()=>{const text=$('connection').textContent,waiting=/reconnect|connecting/i.test(text);connectionHelp.hidden=!waiting;connectionHelp.textContent=/reconnect/i.test(text)?'Your place is held for up to 30 seconds after disconnecting. Two-player games pause while we reconnect.':'Connecting to the room. A sleeping server may take longer to respond.';};
new MutationObserver(updateConnectionHelp).observe($('connection'),{childList:true,characterData:true,subtree:true});
window.addEventListener('online',()=>{if(session)connectStream();});
window.addEventListener('offline',()=>{if(session){$('connection').textContent='Offline · reconnecting when your connection returns';}});
const leaveDialog=element('dialog','','demoPanel leavePanel');leaveDialog.id='leavePanel';leaveDialog.setAttribute('aria-labelledby','leaveTitle');
const leaveTitle=element('h2','Leave this game?');leaveTitle.id='leaveTitle';const leaveText=element('p',''),leaveActions=element('div','','demoActions'),stay=element('button','Keep playing','secondary'),leaveConfirm=element('button','Leave game');leaveActions.append(stay,leaveConfirm);leaveDialog.append(leaveTitle,leaveText,leaveActions);document.body.append(leaveDialog);
const leaveRoom=$('leave').onclick;
$('leave').onclick=()=>{const me=state?.players.find(p=>p.id===state.me),unfinishedSeries=state?.series&&!state.series.complete&&state.series.ids.includes(state.me);if(unfinishedSeries||(state?.phase==='playing'&&me?.active)||(state?.host===state?.me&&state.players.length>1)){
 leaveTitle.textContent=unfinishedSeries?'Leave this series?':state.phase==='playing'?'Leave this game?':'Leave your room?';
 leaveText.textContent=unfinishedSeries?'Leaving forfeits this series to the other competitor.':state.phase==='playing'&&['ttt','gebeta'].includes(state.game)?'Leaving forfeits this match to the other competitor.':state.phase==='playing'?'You will leave the current match. If fewer than two players remain, it will end without a winner.':'Your friends can stay in the room. Host controls pass to another connected player.';
 leaveDialog.showModal();stay.focus();}else leaveRoom();};
stay.onclick=()=>leaveDialog.close();leaveConfirm.onclick=()=>{leaveDialog.close();leaveRoom();};leaveDialog.addEventListener('close',()=>{if(!$('room').hidden)$('leave').focus();});
function winningCells(cells){for(const line of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]])if(cells?.[line[0]]&&line.every(i=>cells[i]===cells[line[0]]))return line;return [];}
const matchPlayers=element('details','','matchPlayers');const matchPlayersSummary=element('summary','Choose two players');$('pickPlayers').before(matchPlayers);matchPlayers.append(matchPlayersSummary,$('pickPlayers'));const duelPair=element('p','','small');duelPair.id='duelPair';$('start').before(duelPair);
const competitionRender=render;let celebratedResult=null;
render=function(s){if(s.phase==='ended'){if(demo.open)demo.close();if(leaveDialog.open)leaveDialog.close();}competitionRender(s);$('room').dataset.game=s.game;const twoPlayer=['ttt','gebeta'].includes(s.game),connected=s.players.filter(p=>p.online);matchPlayers.hidden=$('pickPlayers').hidden||connected.length<=2;duelPair.hidden=!twoPlayer||s.phase!=='lobby'||s.host!==s.me||connected.length!==2;if(!duelPair.hidden)duelPair.textContent=connected.map(p=>p.name).join(' vs ');matchPlayersSummary.textContent='Players: '+[$('seatA'),$('seatB')].map(e=>e.selectedOptions[0]?.textContent||'Choose').join(' vs ')+' · Change';$('shareRoom').hidden=s.phase==='playing';$('helpDemo').hidden=s.game!=='gebeta';$('lobbyDemo').hidden=s.game!=='gebeta';
 const me=s.players.find(p=>p.id===s.me),unit=s.game==='memory'?'pairs':s.game==='race'?'steps':s.game==='gebeta'?'captured':'round score';
 $('matchScores').replaceChildren(...s.players.filter(p=>p.active).map(p=>element('span',p.name+' · '+p.score+' '+unit)));
 if(s.phase==='playing'){
  if(!me?.active)$('roleLabel').textContent='Spectator · join the next match';
  else if(s.game==='ttt')$('roleLabel').textContent='You are '+s.duel.symbols[s.duel.ids.indexOf(s.me)];
  else if(s.game==='gebeta')$('roleLabel').textContent='Your pits: '+(s.duel.ids.indexOf(s.me)===0?'lower row →':'upper row ←');
  else $('roleLabel').textContent='You are playing';
 }
 if(s.game==='gebeta'){
  const pits=$('otherGame').querySelector('.pits'),d=s.duel;
  if(pits&&d){const top=s.players.find(p=>p.id===d.ids[1]),bottom=s.players.find(p=>p.id===d.ids[0]);
   const rowLabel=(p,direction)=>{const label=element('div','','pitOwner');const mine=p?.id===s.me;label.append(element('span',(p?.name||'Player')+(mine?' · YOUR ROW':''),mine?'mineLabel':''),element('span',direction));return label;};
   pits.before(rowLabel(top,'← Sowing direction'));pits.after(rowLabel(bottom,'Sowing direction →'));
   for(const [index,button] of [...pits.querySelectorAll('.pit')].entries()){const pit=[11,10,9,8,7,6,0,1,2,3,4,5][index],side=pit<6?0:1,owner=s.players.find(p=>p.id===d.ids[side]);button.setAttribute('aria-label',(owner?.name||'Player')+(owner?.id===s.me?', your row':'')+', pit '+(pit%6+1)+', '+d.cells[pit]+' seeds'+(!button.disabled?', playable':''));}
  }
  $('fullRules').textContent='Saba_Party’s Gebeta variant\n\nTwo players · Six pits each · Four seeds per pit to start.\n\nChoose a nonempty pit on your row. Sow one seed per pit counterclockwise: lower row →, upper row ←. If your last seed lands in an occupied pit, pick up that handful and continue. Landing in an empty pit ends your turn.\n\nA pit reaching four is captured. If your final seed makes four, you capture it; a family made while you still hold seeds belongs to the owner of that row.\n\nWhen a player begins a turn with an empty row, the opponent collects the remaining seeds. Most captured seeds wins. Equal scores or repeated positions are a draw.\n\nThis is the rules variant used here; Gebeta has other traditions and variants.'+(s.series?'\n\nBest of 3: first to two round wins. Draws award no win; the starting player alternates after every round.':'');
 }
 const won=s.game==='ttt'?winningCells(s.duel?.cells):[];for(const [i,b] of [...$('otherGame').querySelectorAll('.ttt button')].entries())b.classList.toggle('won',won.includes(i));
 const miniature=$('winningBoard');miniature.hidden=!(s.phase==='ended'&&s.game==='ttt'&&won.length);if(!miniature.hidden){miniature.replaceChildren(...s.duel.cells.map((value,i)=>element('span',value||'·',won.includes(i)?'won':'')));miniature.setAttribute('role','img');miniature.setAttribute('aria-label','Winning line: squares '+won.map(i=>i+1).join(', ')+'.');}
 if(s.phase==='ended'&&s.outcome&&celebratedResult!==s.code+':'+s.outcome.id){celebratedResult=s.code+':'+s.outcome.id;if(['win','series','shared','round'].includes(s.outcome.kind)){$('resultsPanel').classList.remove('celebrate');requestAnimationFrame(()=>$('resultsPanel').classList.add('celebrate'));}}
};
const demo=element('dialog','','demoPanel');demo.id='gebetaDemo';demo.setAttribute('aria-labelledby','demoTitle');
const demoTop=element('div','','demoTop'),demoTitle=element('h2','One Gebeta move'),demoClose=element('button','Skip','secondary');demoTitle.id='demoTitle';demoTop.append(demoTitle,demoClose);
const demoIntro=element('p','Follow the seeds. This demonstration uses the same rules engine as your match.','demoNote'),demoChoices=element('div','','demoChoices'),demoBoard=element('div','','demoBoard'),demoStatus=element('p','','demoStatus'),demoScores=element('p','','demoScores'),demoActions=element('div','','demoActions'),demoReplay=element('button','Replay move'),demoDone=element('button','Got it','secondary');demoStatus.setAttribute('role','status');demoActions.append(demoReplay,demoDone);demo.append(demoTop,demoIntro,demoChoices,demoBoard,demoScores,demoStatus,demoActions);document.body.append(demo);
let demoCases,selectedDemo=0,demoTimers=[],demoTrigger=null,demoRequest;
const clearDemo=()=>{demoTimers.forEach(clearTimeout);demoTimers=[];};
function paintDemo(cells,captured,frame){demoBoard.replaceChildren(element('div','Opponent’s row · ←','',''));const grid=element('div','','demoPits');for(const i of [11,10,9,8,7,6,0,1,2,3,4,5]){const wrap=element('div'),pit=element('div','','demoPit'+(frame?.pit===i?' '+(frame.kind==='pickup'?'pickup':'landing'):''));pit.setAttribute('aria-label',(i<6?'Your':'Opponent’s')+' pit '+(i%6+1)+': '+cells[i]+' seeds');for(let n=0;n<cells[i];n++){const seed=element('span','','seed'),angle=n*2.399963,radius=cells[i]===1?0:Math.sqrt((n+.5)/Math.max(cells[i],4))*30;seed.style.left=(43+Math.cos(angle)*radius)+'%';seed.style.top=(43+Math.sin(angle)*radius)+'%';seed.setAttribute('aria-hidden','true');pit.append(seed);}wrap.append(pit,element('span',String(cells[i]),'demoCount'));grid.append(wrap);}demoBoard.append(grid,element('div','Your row · →','pitOwner'));demoScores.textContent='Captured: you '+captured[0]+' · opponent '+captured[1];}
function playDemo(){if(!demoCases)return;clearDemo();const sample=demoCases[selectedDemo];demoReplay.disabled=true;demoIntro.textContent=sample.id==='opening'?'Opening position: four seeds in every pit. We pick up your first handful and follow a legal relay move.':'Capture example: an illustrative position with 48 seeds. Your one seed will make a family of four.';paintDemo(sample.initialBoard,sample.initialCaptured);demoStatus.textContent='Choose a nonempty pit on your row. We’ll use your leftmost pit.';
 for(const frame of sample.frames){const timer=setTimeout(()=>{if(!demo.open)return;paintDemo(frame.cells,frame.captured,frame);const pit='pit '+(frame.pit%6+1);if(frame.kind==='pickup')demoStatus.textContent='Pick up '+frame.hand+' seeds from '+pit+'.';else if(frame.kind==='capture')demoStatus.textContent='Four seeds: capture this family.';else if(frame.kind==='rest')demoStatus.textContent='The last seed landed in an empty pit. Your turn ends.';else if(frame.hand===0)demoStatus.textContent='Handful finished. Pause before continuing or capturing.';else demoStatus.textContent='One seed lands in '+pit+' · '+frame.hand+' left in your hand.';},900+frame.at);demoTimers.push(timer);}
 demoTimers.push(setTimeout(()=>{demoReplay.disabled=false;demoStatus.textContent=sample.captured[0]?'You captured four seeds. In this variant, a final seed making four captures that family for you.':'The legal move is complete. The board and seed counts update together for both players.';},900+sample.duration+600));
}
async function openDemo(trigger){demoTrigger=trigger;if($('howToPlay').open)$('howToPlay').close();demo.showModal();demoClose.focus();demoStatus.textContent='Loading the demonstration…';try{if(!demoCases){demoRequest=new AbortController();const response=await fetch('/demo/gebeta',{signal:demoRequest.signal});if(!response.ok)throw Error('Demo unavailable');const data=await response.json();demoCases=data.cases;demoChoices.replaceChildren(...demoCases.map((c,i)=>{const b=element('button',c.title,'secondary');b.onclick=()=>{selectedDemo=i;playDemo();};return b;}));}if(demo.open)playDemo();}catch(e){if(e.name!=='AbortError'){demoStatus.textContent='The server is waking up. Close and try again in a moment.';demoReplay.disabled=true;}}}
for(const id of ['welcomeDemo','lobbyDemo','helpDemo'])$(id).onclick=()=>openDemo($(id));demoClose.onclick=demoDone.onclick=()=>demo.close();demoReplay.onclick=playDemo;demo.addEventListener('close',()=>{clearDemo();demoRequest?.abort();if(demoTrigger?.closest('dialog')&&!demoTrigger.closest('dialog').open)$('helpToggle').focus();else if(demoTrigger&&!demoTrigger.hidden)demoTrigger.focus();});
demo.addEventListener('click',e=>{if(e.target!==demo)return;const r=demo.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)demo.close();});
if(state)render(state);

