/** Private, local metadata review is not a public redistribution license.
 * Production and hosted Preview always reject this switch. */
export function privateRssReviewEnabled(env:Record<string,string|undefined>={NODE_ENV:process.env.NODE_ENV,VERCEL:process.env.VERCEL,VERCEL_ENV:process.env.VERCEL_ENV,NEXT_PUBLIC_FOURTH_DOWN_PULSE_RSS_REVIEW:process.env.NEXT_PUBLIC_FOURTH_DOWN_PULSE_RSS_REVIEW}){
 return env.NODE_ENV==='development'&&!env.VERCEL&&env.VERCEL_ENV!=='production'&&env.VERCEL_ENV!=='preview'&&env.NEXT_PUBLIC_FOURTH_DOWN_PULSE_RSS_REVIEW==='private-local-v1';
}
export const sportsRssIds=['espn-ncf','ncaa-fbs','ncaa-fcs'] as const;
export type SportsRssId=typeof sportsRssIds[number];
export const sportsRss=(id:string)=>sportsRssIds.some(x=>x===id);
