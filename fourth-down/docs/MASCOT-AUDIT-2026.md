# Verified mascot names — 2026 audit

## Scope and root cause

ESPN team profiles supply team nicknames (for example Volunteers) but no usable actual-mascot field. CFBD was evaluated: its documented mascot strings are also athletic nicknames, and its authenticated endpoint is unavailable without a key. No key, service or dependency was added; CFBD identifiers were not used. Sources: https://cfbfastr.sportsdataverse.org/articles/cfbd_teams.html and https://raw.githubusercontent.com/CFBD/cfbd-python/main/cfbd/models/team.py.

The ESPN 2026 FBS/FCS standings inventories define 138 FBS and 128 FCS supported identities, not the general teams endpoint (which ignores the subdivision filter). Conference/division labels are inventory observations, not a statement about postseason eligibility. Independent and transitioning programs are included under their observed 2026 ESPN division. The registry contains 266 unique IDs, with zero cross-division collisions. Every entry retains a full school identity, division, season, status, source URLs, review date and notes.

Counts: {"fbs": {"verified": 127, "none": 5, "unresolved": 6}, "fcs": {"verified": 121, "none": 1, "unresolved": 6}}. Total 248 named mappings, 6 verified absences, 12 unresolved. These are reviewed mappings, not a claim that all sources were newly published in 2026. Older official naming pages are cited explicitly; uncertain retirements are withheld.

University/athletics brand, traditions, spirit-program and current-news sources support actual names. Official character names such as The Phoenix are retained when a school explicitly gives no separate proper name. Student performers, nickname-only records and historical retired live animals are not substituted. No illustrations or logo changes.

## Runtime behavior

The server API joins a local registry using both ESPN ID and normalized full team identity. Unknown IDs, mismatched names, wrong seasons and unresolved entries show Not available. Verified absence shows No official mascot. The registry is not imported by client components; there are zero additional network requests, no browser storage writes and no notification or ranking changes. Existing team-profile failure handling is preserved.

## Unresolved — Not available

These are explicit data gaps, not schools declared to have no mascot. No school contact has been made.
- Army Black Knights (ESPN 349)
- Indiana Hoosiers (ESPN 84)
- Illinois Fighting Illini (ESPN 356)
- Central Michigan Chippewas (ESPN 2117)
- Hawai'i Rainbow Warriors (ESPN 62)
- Louisiana Ragin' Cajuns (ESPN 309)
- Gardner-Webb Runnin' Bulldogs (ESPN 2241)
- Tennessee State Tigers (ESPN 2634)
- Holy Cross Crusaders (ESPN 107)
- Stephen F. Austin Lumberjacks (ESPN 2617)
- Grambling Tigers (ESPN 2755)
- Alcorn State Braves (ESPN 2016)

## Verified absence
- Stanford Cardinal: https://gostanford.com/news/2013/04/17/on-campus-1; https://approaching.stanford.edu/campus-life-oc-blog-posts. University has no official mascot. The Tree is the official Band mascot and unofficial school mascot, not an official university mascot.
- Florida State Seminoles: https://pcs.coe.fsu.edu/seminole-tribe/know.html. FSU explicitly identifies Osceola and Renegade as symbols honoring its Seminole partners, not mascots.
- Michigan Wolverines: https://bentley.umich.edu/discover/athletics/. Official institutional mascot identification; no conversion of nickname to mascot name.
- UNLV Rebels: https://www.unlv.edu/campuslife/mascot-nickname. Official university source explicitly confirms no current mascot; retired characters are not current mascots.
- San Diego State Aztecs: https://brand.sdsu.edu/identity/messaging/editorial-style-guide. Official university source explicitly confirms no current mascot; retired characters are not current mascots.
- Dartmouth Big Green: https://sites.dartmouth.edu/jacko/keggy/. No official mascot; Keggy belongs to the student humor publication and is unofficial.

## Multiple recognized mascots
- Florida Atlantic Owls: Owlsley / Hoot
- Temple Owls: Hooter / Stella
- Clemson Tigers: The Tiger / The Tiger Cub
- NC State Wolfpack: Mr. Wuf / Ms. Wuf
- Georgia Tech Yellow Jackets: Buzz / Ramblin’ Wreck
- Arizona Wildcats: Wilbur Wildcat / Wilma Wildcat
- Texas Tech Red Raiders: The Masked Rider / Raider Red
- Houston Cougars: Shasta / Sasha
- Oklahoma State Cowboys: Pistol Pete / Bullet
- Baylor Bears: Bruiser / Marigold / Indy / Belle
- Kansas Jayhawks: Big Jay / Baby Jay
- Colorado Buffaloes: Ralphie / Chip
- UCLA Bruins: Joe Bruin / Josie Bruin
- USC Trojans: Tommy Trojan / Traveler
- Nebraska Cornhuskers: Herbie Husker / Lil’ Red
- Washington Huskies: Dubs / Harry the Husky
- Delaware Blue Hens: YoUDee / Baby Blue
- Missouri State Bears: Boomer / Growl
- Toledo Rockets: Rocky / Rocksy
- Bowling Green Falcons: Freddy Falcon / Frieda Falcon
- New Mexico Lobos: Lobo Louie / Lobo Lucy
- Wyoming Cowboys: Cowboy Joe / Pistol Pete
- Nevada Wolf Pack: Alphie / Wolfie Jr. / Luna
- Northern Illinois Huskies: Mission / Victor E. Huskie
- Texas State Bobcats: Boko / Koko
- Fresno State Bulldogs: TimeOut / Victor E. Bulldog
- Kentucky Wildcats: Wildcat / Scratch
- Georgia Bulldogs: Uga / Hairy Dawg
- Florida Gators: Albert / Alberta
- Texas Longhorns: Bevo / Hook ’Em
- Oklahoma Sooners: Boomer / Sooner
- Mississippi State Bulldogs: Bully / Dak
- Arkansas Razorbacks: Big Red / Sue E. / Pork Chop / Boss Hog / Ribby / Tusk
- Georgia Southern Eagles: GUS / Freedom
- Louisiana Tech Bulldogs: Tech / Champ
- South Alabama Jaguars: SouthPaw / Miss Pawla
- North Carolina A&T Aggies: Aggie / Aggietha
- New Hampshire Wildcats: Wild E. Cat / Gnarlz
- South Carolina State Bulldogs: Spike / Spirit
- North Carolina Central Eagles: Eddie the Eagle / Annie the Eagle
- Youngstown State Penguins: Pete Penguin / Penny Penguin
- Southern Illinois Salukis: Brown Dawg / Grey Dawg
- Northern Iowa Panthers: TC Panther / TK Panther
- Murray State Racers: Dunker / Racer One
- Butler Bulldogs: Butler Blue / Hink
- Valparaiso Beacons: Beacon / Blaze
- Drake Bulldogs: Griff / Spike
- Mercer Bears: Toby / Tot
- Lamar Cardinals: Big Red / Lu
- Prairie View A&M Panthers: Pete / Sasha
- North Alabama Lions: Leo / Una
- Central Arkansas Bears: Bruce / Sugar Bear

## Maintenance

Review an entry when the school changes its mascot, the ESPN identity changes, or the next season begins. Require primary evidence; do not auto-populate names from nickname fields. Add verified aliases only with identity evidence. Keep unresolved status until evidence is conclusive. The complete mapping and per-school provenance are in app/data/mascots-2026.json.

## Release isolation

Separate feature branch from released main. No changes to PR #19, alerts, rankings, polling, credentials, saved preferences or logos. Branch-specific Vercel Git deployment is disabled to honor the no-deploy instruction. Merge/deployment require approval.
