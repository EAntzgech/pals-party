import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sowGebeta} from './games.mjs';
process.env.NODE_ENV='test';const {server}=await import('./server.mjs');
test('public teaching examples use the actual engine and conserve all 48 seeds',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{const response=await fetch(base+'/demo/gebeta');assert.equal(response.status,200);const data=await response.json();assert.equal(data.cases.length,2);for(const sample of data.cases){assert.equal(sample.initialBoard.reduce((a,b)=>a+b,0),48);const actual=sowGebeta(sample.initialBoard,sample.initialCaptured,sample.side,sample.pit);assert.deepEqual(sample.frames,actual.frames);assert.equal(sample.duration,actual.duration);for(const frame of sample.frames)assert.equal(frame.cells.reduce((a,b)=>a+b,0)+frame.captured.reduce((a,b)=>a+b,0)+frame.hand,48);}for(const path of ['/competition.css','/competition.js','/?room=ABCDEFGH'])assert.equal((await fetch(base+path)).status,200);}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('invitations contain only a room code on the current origin',()=>{
 const js=fs.readFileSync(new URL('./competition.js',import.meta.url),'utf8');const source=js.slice(js.indexOf('function roomInvitation('),js.indexOf('async function copyRoomText'));
 const ctx={URL,location:{pathname:'/',origin:'https://game.example'}};vm.createContext(ctx);vm.runInContext(source,ctx);
 const link=new URL(ctx.roomInvitation('AB7CD8EF'));assert.equal(link.origin,'https://game.example');assert.deepEqual([...link.searchParams],[['room','AB7CD8EF']]);assert.equal(link.hash,'');
});
test('winning-line feedback identifies only a completed Tic-Tac-Toe line',()=>{
 const js=fs.readFileSync(new URL('./competition.js',import.meta.url),'utf8');const source=js.slice(js.indexOf('function winningCells('),js.indexOf('const matchPlayers='));const ctx={};vm.createContext(ctx);vm.runInContext(source,ctx);assert.deepEqual(Array.from(ctx.winningCells(['X','X','X',null,'O',null,'O',null,null])),[0,1,2]);assert.deepEqual(Array.from(ctx.winningCells(['X','O','X','X','O','O','O','X','X'])),[]);
});


