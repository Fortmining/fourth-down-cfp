import type {Edition} from './types';

/** Private model input validation only; never imported by ranking alerts. */
export function validPublishedEdition(edition:Edition) {
  const rows=[...edition.ranks].sort((a,b)=>a.rank-b.rank);
  return rows.length>=25&&rows.length<=200&&new Set(rows.map(r=>r.id)).size===rows.length&&
    rows.every((row,i)=>/^\d{1,12}$/.test(row.id)&&Number.isInteger(row.rank)&&row.rank>=1&&row.rank<=25&&
      (i===0?row.rank===1:row.rank===rows[i-1].rank||row.rank===i+1));
}
