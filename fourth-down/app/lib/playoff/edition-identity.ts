import {hash} from './engine.ts';import type {Edition} from './types';
/** ESPN may refresh embedded records without publishing a new poll. Preserve the
 * archived edition; only published positions/arrows define its identity here. */
export const publishedEditionIdentity=(e:Edition)=>hash({id:e.id,date:e.date,season:e.season,ranks:e.ranks.map(r=>({id:r.id,rank:r.rank,previous:r.previous})).sort((a,b)=>a.id.localeCompare(b.id))});
