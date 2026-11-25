import assert from 'node:assert/strict';
import test from 'node:test';
import {privateOddsEnabled,oddsSession,validOddsSession} from '../app/lib/private-odds-auth.ts';
import {parseRundown} from '../app/lib/therundown-odds.ts';
test('private odds is denied in production even if enabled; signed sessions reject tampering and expiry',()=>{
 const old={...process.env};try{process.env.FOURTH_DOWN_PRIVATE_ODDS='true';process.env.VERCEL_ENV='production';assert.equal(privateOddsEnabled(),false);process.env.VERCEL_ENV='preview';assert.equal(privateOddsEnabled(),true);const secret='x'.repeat(32),session=oddsSession(secret);assert.equal(validOddsSession(session,secret),true);assert.equal(validOddsSession(session+'x',secret),false);assert.equal(validOddsSession(oddsSession(secret,Date.now()-1),secret),false);}finally{process.env=old;}
});
test('only future NCAAF main pregame prices from permitted books survive; missing stays missing',()=>{
 const now=Date.parse('2026-11-25T12:00:00Z'),price={price:-110,is_main_line:true,updated_at:'2026-11-25T11:55:00Z'},event={event_id:'verified-provider-event',sport_id:1,event_date:'2026-11-26T17:00:00Z',score:{event_status:'STATUS_SCHEDULED'},schedule:{event_name:'Test fixture, not a real quote'},markets:[{market_id:1,period_id:0,participants:[{id:1,name:'Test team',lines:[{prices:{19:price,22:price,23:price,3:price}}]}]},{market_id:2,period_id:0,participants:[{id:1,name:'Test team',lines:[{value:'-3.5',prices:{19:price}}]}]},{market_id:3,period_id:0,participants:[{id:0,name:'Over',lines:[{value:'45.5',prices:{19:price}}]}]}]};
 const parse=(e:unknown)=>parseRundown({events:[e]},now);assert.equal(parse(event).length,5);assert.equal(parse({...event,sport_id:2}).length,0);assert.equal(parse({...event,event_date:'2026-11-25T11:59:00Z'}).length,0);assert.equal(parse({...event,score:{event_status:'STATUS_IN_PROGRESS'}}).length,0);
 for(const bad of [{...price,price:0.0001},{...price,updated_at:undefined},{...price,updated_at:'2026-11-25T13:00:00Z'},{...price,closed_at:'2026-11-25T11:00:00Z'},{...price,is_main_line:false}]){assert.equal(parse({...event,markets:[{market_id:1,period_id:0,participants:[{id:1,name:'Test team',lines:[{prices:{19:bad}}]}]}]}).length,0);}
 assert.throws(()=>parseRundown({}),/Invalid/);
});
