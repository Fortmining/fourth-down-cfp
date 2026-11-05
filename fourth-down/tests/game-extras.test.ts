import test from 'node:test';
import assert from 'node:assert/strict';
import {american,gameMoneyline,watchDestination} from '../app/lib/game-extras.ts';
test('moneylines require paired American prices and live evidence',()=>{
 const at='2026-11-05T16:00:00Z';
 const market={provider:{name:'Source'},homeTeamOdds:{moneyLine:145},awayTeamOdds:{moneyLine:-170}};
 const event={competitions:[{status:{type:{state:'pre'}},competitors:[{homeAway:'home',team:{id:'1'}},{homeAway:'away',team:{id:'2'}}],odds:[market]}]};
 assert.equal(gameMoneyline(event,at)?.teams[0].moneyline,'-170');
 event.competitions[0].status.type.state='in';assert.equal(gameMoneyline(event,at),null);
 const live={...market,isLive:true,updatedAt:at,moneyline:{home:{current:{odds:'+145'}},away:{current:{odds:'-170'}}}};
 event.competitions[0].odds=[live];assert.equal(gameMoneyline(event,at)?.kind,'live');
 assert.equal(gameMoneyline(event,'2026-11-05T16:05:00Z'),null);
 assert.equal(american(0),null);assert.equal(american('NaN'),null);
});
test('watch links reject untrusted destinations and identify provider fallbacks',()=>{
 assert.equal(watchDestination([{href:'https://evil.example/watch/123',rel:['watch']}],''),null);
 assert.equal(watchDestination([{href:'https://www.espn.com/watch/player/_/id/example',rel:['watch']}],'')?.exact,true);
 assert.equal(watchDestination([],'ESPN')?.exact,false);
 assert.equal(watchDestination([],'Unknown'),null);
});
