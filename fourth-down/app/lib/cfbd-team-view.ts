// Only derived school views cross the public boundary. Reject unexpected fields,
// including an accidentally mirrored snapshot or a future private provider field.
type Check=(v:unknown)=>boolean;
const word:Check=v=>typeof v==='string'&&v.length<=160;
const num:Check=v=>typeof v==='number'&&Number.isFinite(v);
const count:Check=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const nullable=(v:unknown)=>v===null||num(v);
function shape(fields:Record<string,Check>,optional=false):Check {
  return v=>record(v)&&Object.entries(v).every(([key,x])=>Object.hasOwn(fields,key)&&fields[key](x))
    &&(optional||Object.keys(fields).every(key=>Object.hasOwn(v,key)));
}
const shortList=(item:Check,max:number):Check=>v=>Array.isArray(v)&&v.length<=max&&v.every(item);
const transfer=shape({direction:v=>v==='incoming'||v==='outgoing',name:word,position:word,origin:word,destination:word,date:word});
const positions:Check=v=>record(v)&&Object.keys(v).length<=64&&Object.entries(v).every(([p,n])=>/^[A-Za-z0-9 /-]{1,32}$/.test(p)&&count(n));
const group:Check=v=>shape({count,examples:shortList(transfer,12),positions},true)(v)&&record(v)&&count(v.count)&&shortList(transfer,12)(v.examples);
const views:Record<string,Check>={
  transfers:shape({incoming:group,outgoing:group}),
  recruits:shape({reported:count,prospects:shortList(shape({id:word,name:word,position:word,rank:nullable,stars:nullable}),5)}),
  classRank:shape({rank:count,points:nullable},true),
  roster:shape({listed:count,positions:v=>record(v)&&Object.keys(v).length<=64&&Object.entries(v).every(([p,n])=>/^[A-Za-z0-9 /-]{1,32}$/.test(p)&&count(n))}),
  teamStats:shape({totalYards:num,rushingYards:num,netPassingYards:num,turnovers:num,interceptions:num},true),
  playerStats:shape({leaders:shortList(shape({id:word,name:word,category:v=>v==='passing'||v==='rushing'||v==='receiving',yards:num}),9)}),
  analytics:shape({offense_successRate:num,defense_successRate:num,offense_ppa:num,defense_ppa:num},true),
};
export function decodeTeamView(text:string,team:string){
  if(Buffer.byteLength(text)>24576)return null;
  let view:unknown;
  try {view=JSON.parse(text);} catch {return null;}
  if(!record(view)||view.version!==1||view.team!==team||Object.keys(view).length!==3||!record(view.datasets))return null;
  for(const [key,edition] of Object.entries(view.datasets)){
    if(!Object.hasOwn(views,key)||!shape({value:views[key],year:count,observedAt:count,revision:count,
      inLatest:v=>typeof v==='boolean',source:v=>v==='CollegeFootballData API'||v==='CFBD via cfbfastR annual roster export'})(edition))return null;
  }
  return view;
}
