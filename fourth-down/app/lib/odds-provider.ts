export type OddsQuote={eventId:string;eventName:string;startsAt:string;market:'moneyline'|'spread'|'total';participant:string;participantId:string;line:string|null;book:string;american:string;updatedAt:string};
export type OddsSnapshot={provider:string;observedAt:string;delaySeconds:number;quotes:OddsQuote[];datapoints:number|null;remaining:number|null};
export interface OddsProvider {id:string;fetchPregame(date:string):Promise<OddsSnapshot>;}
