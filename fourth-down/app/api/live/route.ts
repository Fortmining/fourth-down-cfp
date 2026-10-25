import {loadLiveFeed} from "../../lib/live-feed";
export const dynamic = "force-dynamic";
export async function GET(){return loadLiveFeed();}
