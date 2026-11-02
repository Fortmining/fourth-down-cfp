import type { NextConfig } from "next";
import {newsReviewEnabled,newsReviewRewrites} from './app/lib/news-review-mode.ts';
const config: NextConfig = { outputFileTracingRoot: process.cwd(),
  async rewrites() { return {beforeFiles: newsReviewEnabled()?newsReviewRewrites():process.env.VERCEL_ENV === "preview" && process.env.FOURTH_DOWN_DESIGN_PREVIEW === "true" ? ["/api/live","/api/resumes","/api/teams/:id","/api/games/:id"].map(source => ({source,destination:`https://fourth-down-cfp.vercel.app${source}`})) : [],afterFiles:[],fallback:[]}; } };
export default config;
