// Deployment-scoped opt-in; production is excluded even if the flag is copied.
export function newsReviewEnabled(env:Record<string,string|undefined>=process.env){
  return env.VERCEL_ENV==='preview'&&env.FOURTH_DOWN_NEWS_PILOT==='protected-preview-v1';
}
export function newsFixturesEnabled(env:Record<string,string|undefined>=process.env){
  return newsReviewEnabled(env)||(env.NODE_ENV==='development'&&!env.VERCEL&&env.FOURTH_DOWN_NEWS_PILOT==='fixtures');
}
export function newsReviewRewrites(env:Record<string,string|undefined>=process.env){
  if(!newsReviewEnabled(env))return [];
  return [
    {source:'/api/live',destination:'/api/news-pulse/review/live'},
    {source:'/api/resumes',destination:'/api/news-pulse/review/resumes'},
    {source:'/api/teams/:id',destination:'/api/news-pulse/review/team/:id'},
    {source:'/api/games/:id',destination:'/api/news-pulse/review/game/:id'},
    {source:'/api/alerts/:path*',destination:'/api/news-pulse/review/alerts'},
    {source:'/api/pulse/:path*',destination:'/api/news-pulse/review/blocked'},
  ];
}
