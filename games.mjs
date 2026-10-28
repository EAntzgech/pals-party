// Rules for games added alongside the unchanged Memory Match handlers.
import {randomInt} from 'node:crypto';
export const TWO_PLAYER=new Set(['ttt','gebeta']);
export function raceWinners(players){const best=Math.max(...players.map(p=>p.score));return players.filter(p=>p.score===best);}
export function ticResult(cells){for(const [a,b,c] of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]])if(cells[a]&&cells[a]===cells[b]&&cells[a]===cells[c])return cells[a];return cells.every(Boolean)?'draw':null;}
export function sowGebeta(board,captured,side,pit){
 const cells=[...board],scores=[...captured],visited=new Set();let cursor=pit,seeds=cells[cursor];cells[cursor]=0;
 while(true){
  const signature=JSON.stringify([cells,scores,cursor,seeds]);if(visited.has(signature))return {board:cells,captured:scores,loop:true};visited.add(signature);
  while(seeds>0){cursor=(cursor+1)%12;cells[cursor]++;seeds--;
   if(cells[cursor]===4){const owner=seeds===0?side:(cursor<6?0:1);scores[owner]+=4;cells[cursor]=0;if(seeds===0)return {board:cells,captured:scores};}
  }
  if(cells[cursor]===1)return {board:cells,captured:scores};seeds=cells[cursor];cells[cursor]=0;
 }
}
export function newDuel(r,game,ids){
 const key=game+':'+ids.join(':');const previous=r.lastDuel;
 const first=previous?.key===key?1-previous.first:randomInt(2);r.lastDuel={key,first};
 return {ids,turn:first,symbols:first===0?['X','O']:['O','X'],cells:game==='ttt'?Array(9).fill(null):Array(12).fill(4),captured:[0,0],history:new Set(),paused:false};
}
export function positionKey(duel){return JSON.stringify([duel.cells,duel.turn]);}
