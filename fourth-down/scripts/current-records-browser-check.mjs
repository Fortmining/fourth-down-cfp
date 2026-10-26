import { chromium, firefox, webkit, devices } from "playwright";
import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
const url = process.env.TEST_URL || "http://127.0.0.1:3009",
  at = new Date().toISOString();
const t = {
  rank: 11,
  previous: 9,
  teamId: "2633",
  name: "Tennessee Volunteers",
  record: "6-1",
  conference: "SEC",
};
const poll = {
  id: "ap",
  name: "AP Top 25",
  url: "https://apnews.com",
  status: "awaiting_update",
  date: "2026-10-18T07:00Z",
  week: 7,
  season: 2026,
  teams: [t],
  message: "",
};
const feed = {
  polls: [poll],
  rankings: [t],
  defaultRankingSource: "ap",
  updatedAt: at,
  season: 2026,
  week: 8,
  rankingSource: poll.name,
  rankingDate: poll.date,
  isCommitteeRanking: false,
  currentRecords: {
    2633: {
      overall: "6-2",
      conference: "3-2",
      observedAt: at,
      source: "ESPN standings",
      status: "available",
    },
  },
  recordObservedAt: at,
  recordStatus: "Current ESPN totals; poll records remain separate.",
  warnings: [],
  games: [
    {
      id: "401856731",
      name: "Tennessee at South Carolina",
      date: new Date(Date.now() - 2 * 3600000).toISOString(),
      status: "post",
      completed: true,
      providerStatus: "STATUS_FINAL",
      detail: "Final",
      teams: [
        { id: "2633", name: t.name, record: "6-1", score: "24" },
        { id: "2579", name: "South Carolina", record: "4-3", score: "27" },
      ],
    },
  ],
};
for (const [engine, mobile] of [
  [chromium, false],
  [firefox, false],
  [webkit, false],
  [webkit, true],
]) {
  const browser = await engine.launch(),
    context = await browser.newContext(
      mobile
        ? devices["iPhone 13"]
        : { viewport: { width: 1280, height: 900 } },
    ),
    page = await context.newPage();
  await context.addInitScript(() => localStorage.setItem('fourth-down-alert-preferences-v1',JSON.stringify({version:1,favorites:[],myTeams:{enabled:false,kickoff:false,final:false},breaking:{enabled:false},following:{enabled:false,items:[{kind:'game',id:'401856731',gameId:'401856731',name:'Tennessee at South Carolina',duration:'game',createdAt:Date.now()-3600000,expiresAt:Date.now()+86400000}]}})));
  await page.route("**/api/live", (r) => r.fulfill({ json: feed }));
  await page.route("**/api/teams/2633",r=>r.fulfill({json:{id:'2633',name:t.name,nickname:'Volunteers',mascot:null,conference:'SEC',logo:null,standing:null,season:2026,record:feed.currentRecords['2633'],games:[],polls:feed.polls,stats:[],warnings:[],sources:[],observedAt:at,scheduleAvailable:true}}));
  await page.route("**/api/pulse/model", (r) =>
    r.fulfill({
      json: {
        notificationsSupported: false,
        limitation: "Poll-position placeholder",
        snapshot: null,
      },
    }),
  );
  await page.goto(url);
  await page
    .getByRole("heading", { name: "The published rankings.", exact: true })
    .waitFor();
  await page
    .locator(".publishedList")
    .getByText(/6–?2|6-2/)
    .waitFor();
  assert.equal(
    await page.locator(".publishedList .rank").first().innerText(),
    "11",
  );
  await page
    .getByRole("button", { name: "Playoff outlook", exact: true })
    .click();
  assert.ok((await page.locator(".outlook").innerText()).includes("6-2"));
  assert.ok(
    (await page.locator(".context").allTextContents()).some((x) =>
      x.includes("Official ranks"),
    ),
  );
  await page.locator('#watchlist').getByText(/Tennessee Volunteers.*6-2/).waitFor();
  assert.ok(!(await page.locator('#watchlist').innerText()).includes('6-1'));
  await page.goto(url + "/team/2633");
  await page.getByText(/Current overall record: 6-2/).waitFor();
  await page.getByRole("region",{name:"Published rankings for this team"}).getByText("No. 11",{exact:true}).waitFor();
  assert.ok(
    (await page.getByText(/Current overall record:/).innerText()).includes(
      "3-2",
    ),
  );
  await page.goto(url + "/game/401856731");
  await page
    .getByRole("heading", { name: feed.games[0].name, exact: true, level: 1 })
    .waitFor();
  assert.ok((await page.locator(".detailCard").innerText()).includes("6-2"));
  assert.ok(!(await page.locator(".detailCard").innerText()).includes("6-1"));
  assert.equal(feed.polls[0].teams[0].record, "6-1");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const axe = await new AxeBuilder({ page })
    .include("#detail")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  assert.deepEqual(
    axe.violations.map((x) => x.id),
    [],
  );
  console.log(
    engine.name() +
      (mobile ? " iPhone" : " desktop") +
      ": canonical current records across rankings, outlook and details; unchanged poll rank and source snapshot; responsive/accessibility passed (fixture data)",
  );
  await browser.close();
}
