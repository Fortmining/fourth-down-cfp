import type {NewsItem} from './news-pulse.ts';

export const pulseDesks = [
  ['all','All coverage'], ['signing','Signing Day'], ['portal','Transfer Portal'],
  ['recruiting','Recruiting'], ['team','Team Intelligence'],
  ['availability','Player Availability'], ['money','Program Money'],
] as const;

export type PulseDesk = typeof pulseDesks[number][0];

export function matchesPulseDesk(item: NewsItem, desk: PulseDesk) {
  // Headline routing only. These matches establish coverage topics, never
  // confirmed player transactions, availability, or compensation.
  const title = item.title;
  switch (desk) {
    case 'all': return true;
    case 'signing': return /\bsigning (?:day|period|class)\b|\b(?:signs|signed) (?:with|his|their|a letter)\b/i.test(title);
    case 'portal': return /\btransfer portal\b|\bportal (?:entry|entries|withdrawal)\b/i.test(title);
    case 'recruiting': return item.contentCategory === 'recruiting' || /\brecruit(?:ing|s)?\b|\bdecommit(?:s|ted|ment)?\b/i.test(title);
    case 'team': return item.teamIds.length > 0 && ['analysis','preview','recap'].some(kind => item.kind === kind || item.contentCategory === kind);
    case 'availability': return /\binjur(?:y|ies|ed)\b|\bavailability report\b|\bruled out\b|\bgame[- ]time decision\b/i.test(title);
    case 'money': return /\bNIL\b|\brevenue[- ]sharing\b|\bathletic(?:s| department)? (?:budget|spending|revenue)\b/i.test(title);
  }
}

export const footballSigningDates = {
  earlyStart: '2026-12-02',
  earlyEnd: '2026-12-04',
  regularStart: '2027-02-03',
  source: 'https://www.ncaa.org/eligibility-center/recruiting/',
} as const;

export function signingCalendarStatus(localDate: string) {
  const {earlyStart,earlyEnd,regularStart} = footballSigningDates;
  if (localDate < earlyStart) return 'Early signing dates ahead';
  if (localDate <= earlyEnd) return 'Early signing dates';
  if (localDate < regularStart) return 'Early signing dates have passed';
  return 'Regular signing has reached its published start date';
}
