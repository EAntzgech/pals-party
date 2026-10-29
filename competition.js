/* Saba_Party competition interface. No game rules are reimplemented here. */
function showEntryError(error,action){
 for(const id of ['nicknameError','createError','joinError']){$(id).hidden=true;$(id).textContent='';}
 const text=error?.message||'Unable to connect. Please try again.';
 if(action==='join'&&invitationMode&&!/nickname|name.*taken/i.test(text)){$('inviteError').textContent='This invitation may have expired. '+text;$('inviteError').hidden=false;$('manualInviteCode').hidden=false;$('confirmInvite').disabled=true;return;}
 const id=/nickname|name.*taken/i.test(text)?'nicknameError':action==='create'?'createError':'joinError';
 $(id).textContent=text;$(id).hidden=false;
 const field=id==='nicknameError'?$('nickname'):action==='join'?$('roomcode'):$('roomNameInput');field.setAttribute('aria-invalid','true');field.setAttribute('aria-errormessage',id);field.focus();
}
for(const [input,error] of [['nickname','nicknameError'],['roomcode','joinError'],['roomNameInput','createError']])$(input).addEventListener('input',()=>{$(error).hidden=true;$(input).removeAttribute('aria-invalid');});
const inviteParam=new URL(location.href).searchParams.get('room');
let invitationMode=inviteParam!==null,inviteCode=inviteParam&&/^[A-HJ-NP-Z2-9]{8}$/i.test(inviteParam)?inviteParam.toUpperCase():'';
const inviteHeadline=$('welcome').querySelector('.welcomeIntro h1'),inviteCopy=$('welcome').querySelector('.welcomeIntro p'),originalInviteHeadline=inviteHeadline.innerHTML,originalInviteCopy=inviteCopy.textContent;
async function previewInvitation(){
 $('welcome').classList.add('invited');$('invitePanel').hidden=false;$('entryChoices').hidden=true;$('createFields').hidden=true;$('joinFields').hidden=true;$('entryPrivacy').hidden=true;$('signatureIntro').hidden=true;
 inviteHeadline.textContent='You’re invited';inviteCopy.textContent='Enter your nickname to join this private room.';$('nicknameHint').textContent='Enter your nickname to continue.';
 $('confirmInvite').disabled=true;$('confirmInvite').dataset.ready='false';$('manualInviteCode').hidden=true;
 if(!inviteCode){showInvitationProblem('This invitation link is invalid or has expired.');return;}
 $('roomcode').value=inviteCode;$('inviteRoomLabel').textContent='Checking your invitation…';
 try{const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preview',code:inviteCode})});let data;try{data=await response.json();}catch{throw Error('The room server is waking up. Try again shortly.');}if(!response.ok)throw Error(data.error||'This invitation is no longer active.');$('inviteRoomLabel').textContent='Join '+data.roomName;$('confirmInvite').dataset.ready='true';refreshEntry();}
 catch(error){showInvitationProblem(error.message);}
}
function showInvitationProblem(message){$('inviteError').textContent=message;$('inviteError').hidden=false;$('manualInviteCode').hidden=false;$('inviteRoomLabel').textContent='Room invitation';$('confirmInvite').disabled=true;}
function useManualRoomCode(){
 invitationMode=false;inviteCode='';history.replaceState(null,'',location.pathname);$('welcome').classList.remove('invited');$('invitePanel').hidden=true;$('entryChoices').hidden=false;$('entryPrivacy').hidden=false;$('signatureIntro').hidden=false;inviteHeadline.innerHTML=originalInviteHeadline;inviteCopy.textContent=originalInviteCopy;$('createFields').hidden=true;$('joinFields').hidden=false;$('join').setAttribute('aria-pressed','true');$('create').setAttribute('aria-pressed','false');$('roomcode').value='';$('joinError').hidden=true;refreshEntry();$('roomcode').focus();
}
if(invitationMode)previewInvitation();
$('manualInviteCode').onclick=useManualRoomCode;
$('confirmInvite').onclick=()=>{if(!inviteCode||$('confirmInvite').disabled)return;$('roomcode').value=inviteCode;enter('join');};
$('roomcode').addEventListener('input',()=>{if($('roomcode').value.length>=8&&!validCode()){$('joinError').hidden=false;$('joinError').textContent='Use eight letters or numbers. Codes do not use I, O, 0, or 1.';$('roomcode').setAttribute('aria-invalid','true');}});function roomInvitation(code){const url=new URL(location.pathname,location.origin);url.searchParams.set('room',code);return url.href;}
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
render=function(s){if(s.phase==='ended'){if(demo.open)demo.close();if(leaveDialog.open)leaveDialog.close();}competitionRender(s);$('room').dataset.game=s.game;const twoPlayer=['ttt','gebeta'].includes(s.game),connected=s.players.filter(p=>p.online);matchPlayers.hidden=$('pickPlayers').hidden||connected.length<=2;duelPair.hidden=!twoPlayer||s.phase!=='lobby'||s.host!==s.me||connected.length!==2;if(!duelPair.hidden)duelPair.textContent=connected.map(p=>p.name).join(' vs ');matchPlayersSummary.textContent='Players: '+[$('seatA'),$('seatB')].map(e=>e.selectedOptions[0]?.textContent||'Choose').join(' vs ')+' · Change';$('shareRoom').hidden=s.phase==='playing';$('helpTutorial').hidden=$('lobbyTutorial').hidden=s.game!=='gebeta';
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
  $('fullRules').textContent='Saba_Party’s Gebeta variant\n\nTwo players · Six pits each · Four seeds per pit to start.\n\nChoose a nonempty pit on your row. Sow one seed per pit counterclockwise: lower row →, upper row ←. If your last seed lands in an occupied pit, pick up that handful and continue. Landing in an empty pit ends your turn.\n\nA pit reaching four is captured. If your final seed makes four, you capture it; a family made while you still hold seeds belongs to the owner of that row.\n\nWhen a player begins a turn with an empty row, the opponent collects the remaining seeds. Most captured seeds wins. Equal scores or repeated positions are a draw.\n\nThis room uses the Saba_Party rules for Gebeta; other communities may play differently.'+(s.series?'\n\nBest of 3: first to two round wins. Draws award no win; the starting player alternates after every round.':'');
 }
 const won=s.game==='ttt'?winningCells(s.duel?.cells):[];for(const [i,b] of [...$('otherGame').querySelectorAll('.ttt button')].entries())b.classList.toggle('won',won.includes(i));
 const miniature=$('winningBoard');miniature.hidden=!(s.phase==='ended'&&s.game==='ttt'&&won.length);if(!miniature.hidden){miniature.replaceChildren(...s.duel.cells.map((value,i)=>element('span',value||'·',won.includes(i)?'won':'')));miniature.setAttribute('role','img');miniature.setAttribute('aria-label','Winning line: squares '+won.map(i=>i+1).join(', ')+'.');}
 if(s.phase==='ended'&&s.outcome&&celebratedResult!==s.code+':'+s.outcome.id){celebratedResult=s.code+':'+s.outcome.id;if(['win','series','shared','round'].includes(s.outcome.kind)){$('resultsPanel').classList.remove('celebrate');requestAnimationFrame(()=>$('resultsPanel').classList.add('celebrate'));}}
};
const demo=element('dialog','','demoPanel');demo.id='gebetaDemo';demo.setAttribute('aria-labelledby','demoTitle');
const demoTop=element('div','','demoTop'),demoTitle=element('h2','One Gebeta move'),demoClose=element('button','Close','secondary');demoTitle.id='demoTitle';demoTop.append(demoTitle,demoClose);
const tutorialProgress=element('p','','tutorialProgress'),demoStepHeading=element('h3','','tutorialStepHeading'),demoIntro=element('p','','demoNote'),tutorialArt=element('div','','tutorialArt'),demoBoard=element('div','','demoBoard'),demoStatus=element('p','','demoStatus'),demoScores=element('p','','demoScores'),tutorialNav=element('div','','tutorialNav'),tutorialBack=element('button','← Back','secondary'),tutorialNext=element('button','Next →');tutorialProgress.setAttribute('role','status');demoStatus.setAttribute('role','status');tutorialNav.append(tutorialBack,tutorialNext);demo.append(demoTop,tutorialProgress,demoStepHeading,demoIntro,tutorialArt,demoBoard,demoScores,demoStatus,tutorialNav);document.body.append(demo);
let demoCases,demoTrigger=null,demoRequest,tutorialStep=0;

function paintDemo(cells,captured,frame){demoBoard.replaceChildren(element('div','Opponent’s row · ←','',''));const grid=element('div','','demoPits');for(const i of [11,10,9,8,7,6,0,1,2,3,4,5]){const wrap=element('div'),pit=element('div','','demoPit'+(frame?.pit===i?' '+(frame.kind==='pickup'?'pickup':'landing'):''));pit.setAttribute('aria-label',(i<6?'Your':'Opponent’s')+' pit '+(i%6+1)+': '+cells[i]+' seeds');for(let n=0;n<cells[i];n++){const seed=element('span','','seed'),angle=n*2.399963,radius=cells[i]===1?0:Math.sqrt((n+.5)/Math.max(cells[i],4))*30;seed.style.left=(43+Math.cos(angle)*radius)+'%';seed.style.top=(43+Math.sin(angle)*radius)+'%';seed.setAttribute('aria-hidden','true');pit.append(seed);}wrap.append(pit,element('span',String(cells[i]),'demoCount'));grid.append(wrap);}demoBoard.append(grid,element('div','Your row · →','pitOwner'));demoScores.textContent='Captured: you '+captured[0]+' · opponent '+captured[1];}
function loadDemoCases(){if(demoCases)return Promise.resolve();demoRequest=new AbortController();return fetch('/demo/gebeta',{signal:demoRequest.signal}).then(response=>{if(!response.ok)throw Error('Guide unavailable');return response.json();}).then(data=>{demoCases=data.cases;});}
const tutorialPages=[
 {title:'The board and goal',copy:'Each player owns a row of six pits. The opening board has four seeds in every pit. Capture the most seeds to win.',sample:'opening'},
 {title:'Pick up seeds',copy:'Tap a nonempty pit on your side. Pick up every seed from that pit together as one handful.',sample:'sow'},
 {title:'Sow and capture',copy:'Sow counterclockwise, one seed in each next pit. If your last seed lands in an occupied pit, pick up that handful and sow again. A pit that reaches four is captured by its row owner; if your last seed makes it four, you capture it.',sample:'capture'},
 {title:'Finish the game',copy:'If a player starts a turn with all six pits empty, the other player collects the seeds still on the board. Most captured seeds wins. A tied score or repeated position is a draw.',sample:'finish'}
];
function renderTutorialStep(){if(!demoCases)return;const page=tutorialPages[tutorialStep],opening=demoCases.find(x=>x.id==='opening'),capture=demoCases.find(x=>x.id==='capture'),finish=demoCases.find(x=>x.id==='finish');demoTitle.textContent='Gebeta rules in pictures';demoStepHeading.textContent=page.title;tutorialProgress.textContent='Step '+(tutorialStep+1)+' of '+tutorialPages.length;demoIntro.textContent=page.copy;tutorialBack.disabled=tutorialStep===0;tutorialNext.textContent=tutorialStep===tutorialPages.length-1?'Finish':'Next →';tutorialNav.hidden=false;demoClose.textContent='Skip';
tutorialArt.innerHTML=({opening:'<svg viewBox="0 0 360 100" role="img" aria-label="Two rows of six pits"><g fill="none" stroke="currentColor" stroke-width="4"><rect x="14" y="12" width="332" height="76" rx="30"/><path d="M14 50h332"/></g><g fill="none" stroke="currentColor" stroke-width="3"><circle cx="46" cy="31" r="9"/><circle cx="99" cy="31" r="9"/><circle cx="152" cy="31" r="9"/><circle cx="205" cy="31" r="9"/><circle cx="258" cy="31" r="9"/><circle cx="311" cy="31" r="9"/><circle cx="46" cy="69" r="9"/><circle cx="99" cy="69" r="9"/><circle cx="152" cy="69" r="9"/><circle cx="205" cy="69" r="9"/><circle cx="258" cy="69" r="9"/><circle cx="311" cy="69" r="9"/></g></svg>',sow:'<svg viewBox="0 0 360 150" role="img" aria-label="A hand lifts all four seeds from one pit"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="68" cy="112" rx="42" ry="24"/><path d="M43 109c8-16 17-24 25-24s17 8 25 24"/><path d="M112 88c22-23 43-37 63-41"/><path d="m165 40 12 7-13 6"/><path d="M218 119 205 88c-4-10 8-16 15-7l9 14-11-34c-3-10 11-14 16-4l10 26-3-31c-1-11 14-12 16-1l4 31 5-26c2-10 16-8 15 3l-2 30 10-13c7-9 18 0 12 9l-18 28c-7 11-17 15-31 15h-22c-11 0-18-4-22-9Z"/></g><g fill="currentColor"><circle cx="55" cy="111" r="5"/><circle cx="68" cy="101" r="5"/><circle cx="81" cy="111" r="5"/><circle cx="68" cy="120" r="5"/></g></svg>',capture:'<svg viewBox="0 0 360 110" role="img" aria-label="Four seeds in a pit are captured"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="65" cy="55" r="38"/><path d="M112 55h119m-14-12 14 12-14 12"/><rect x="249" y="23" width="72" height="64" rx="8"/></g><g fill="currentColor"><circle cx="54" cy="44" r="6"/><circle cx="76" cy="44" r="6"/><circle cx="54" cy="66" r="6"/><circle cx="76" cy="66" r="6"/><circle cx="269" cy="44" r="6"/><circle cx="291" cy="44" r="6"/><circle cx="269" cy="66" r="6"/><circle cx="291" cy="66" r="6"/></g></svg>',finish:'<svg viewBox="0 0 360 110" role="img" aria-label="An empty row ends the game; remaining seeds are collected"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="15" width="212" height="30" rx="15"/><path d="M30 30h180"/><circle cx="45" cy="78" r="24"/><path d="M88 78h134m-14-12 14 12-14 12"/><rect x="250" y="49" width="80" height="54" rx="8"/></g><g fill="currentColor"><circle cx="38" cy="72" r="4"/><circle cx="51" cy="84" r="4"/><circle cx="268" cy="66" r="5"/><circle cx="288" cy="81" r="5"/><circle cx="307" cy="66" r="5"/></g></svg>'})[page.sample]||'';
 if(page.sample==='opening'){paintDemo(opening.initialBoard,opening.initialCaptured);demoStatus.textContent='Two rows, six pits per player, four seeds in every pit.';}
 if(page.sample==='sow'){paintDemo(opening.initialBoard,opening.initialCaptured,{pit:0,kind:'pickup'});demoStatus.textContent='The drawing shows the whole handful being lifted from the highlighted pit.';}
 if(page.sample==='capture'){const frame=capture.frames.at(-1);paintDemo(frame.cells,frame.captured,frame);demoStatus.textContent='This still board shows the result of a real engine capture.';}
 if(page.sample==='finish'){const frame=finish.frames.at(-1);paintDemo(frame.cells,frame.captured,frame);demoStatus.textContent='This legal move leaves the opponent’s row empty. The remaining seeds are then collected.';}
}
async function openTutorial(trigger){demoTrigger=trigger;tutorialStep=0;if($('howToPlay').open)$('howToPlay').close();demo.showModal();demoClose.focus();demoStatus.textContent='Loading the tutorial…';try{await loadDemoCases();if(demo.open)renderTutorialStep();}catch(e){if(e.name!=='AbortError')demoStatus.textContent='The server is waking up. Close and try again in a moment.';}}
for(const id of ['welcomeTutorial','lobbyTutorial','helpTutorial'])$(id).onclick=()=>openTutorial($(id));
demoClose.onclick=()=>demo.close();
tutorialBack.onclick=()=>{if(tutorialStep>0){tutorialStep--;renderTutorialStep();}};
tutorialNext.onclick=()=>{if(tutorialStep<tutorialPages.length-1){tutorialStep++;renderTutorialStep();}else demo.close();};
demo.addEventListener('keydown',e=>{if(e.target.closest('button'))return;if(e.key==='ArrowRight'){e.preventDefault();tutorialNext.click();}else if(e.key==='ArrowLeft'){e.preventDefault();tutorialBack.click();}});
demo.addEventListener('close',()=>{demoRequest?.abort();if(demoTrigger?.closest('dialog')&&!demoTrigger.closest('dialog').open)$('helpToggle').focus();else if(demoTrigger&&!demoTrigger.hidden)demoTrigger.focus();});
demo.addEventListener('click',e=>{if(e.target!==demo)return;const r=demo.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();});
if(state)render(state);

