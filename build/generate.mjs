/* RentalsAround page generator.
   Reads ../../data/fitzrovia-floorplans.json and writes static HTML into ../.
   Static output = nothing to query at page load. Re-run after any price change. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");            // v2/
const DATA = path.resolve(ROOT, "..", "data", "fitzrovia-floorplans.json");
const db   = JSON.parse(fs.readFileSync(DATA, "utf8"));
const PHOTOS = JSON.parse(fs.readFileSync(path.resolve(ROOT, "..", "data", "photos.json"), "utf8"));

const PHONE = "437-869-3363";
const TEL   = "4378693363";

// Photography we already hold, per community. Empty = no imagery yet.
const IMAGES = {
  "elm-ledbury":      { dir: "../compressed",           hero: "24077-269.jpg" },
  "sloane-south":     { dir: "../compressed-sloan",     hero: "25008-18.jpg" },
  "sloane-west-east": { dir: "../compressed-sloan",     hero: "25008-47.jpg" },
  "maddox-tyndall":   { dir: "../compressed-liberty",   hero: "Tyndal_Lobby.jpg" }
};

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = n => "$" + Number(n).toLocaleString("en-CA");
const slug  = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const live = db.communities.filter(c => c.floorplans.length);
const soon = db.communities.filter(c => !c.floorplans.length);
const totalPlans = live.reduce((n, c) => n + c.floorplans.length, 0);
const cheapest = Math.min(...live.flatMap(c => c.floorplans.map(f => f.from)));

/* ---------- shared chrome ---------- */
const head = (title, desc, extra = "") => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/site.css">
${extra}
</head>
<body>`;

const nav = `
<nav class="nav">
  <a href="index.html" class="nav-logo">rentals<span>around</span>.ca</a>
  <ul class="nav-links">
    <li><a href="index.html">Communities</a></li>
    <li><a href="index.html#why">Why Rent</a></li>
    <li class="keep"><a href="tel:${TEL}">${PHONE}</a></li>
    <li class="keep"><a href="#" class="nav-cta" data-book data-kind="general">Book a Showing</a></li>
  </ul>
</nav>`;

const footer = `
<footer>
  <a href="index.html" class="footer-logo">rentals<span>around</span>.ca</a>
  <p class="footer-note">Toronto &amp; GTA purpose-built rentals · ${PHONE}</p>
  <p class="footer-note">Prices and availability subject to change. E.&amp;O.E.<br>Independent leasing brokerage. Not affiliated with Fitzrovia Real Estate or Maddox.</p>
</footer>`;

const modal = `
<div class="modal" id="bkModal" role="dialog" aria-modal="true" aria-labelledby="bkTitle">
  <div class="modal-box">
    <button class="modal-close" id="bkClose" aria-label="Close">&times;</button>
    <h2 id="bkTitle">Book a Showing</h2>
    <p class="modal-sub" id="bkSub"></p>
    <p class="fp-spec" id="bkPlanLine" hidden style="margin:-14px 0 20px;color:var(--gold)"></p>
    <form id="bkForm" novalidate>
      <input type="hidden" name="community_id"><input type="hidden" name="community_name">
      <input type="hidden" name="floorplan_name"><input type="hidden" name="floorplan_type">
      <input type="hidden" name="floorplan_sqft"><input type="hidden" name="kind">
      <div class="row2">
        <div class="field"><label for="bkDate">Preferred date</label><input type="date" id="bkDate" name="request_date"></div>
        <div class="field"><label for="bkTime">Preferred time</label>
          <select id="bkTime" name="request_time">
            <option value="">Any time</option>
            <option>Morning (9am – 12pm)</option>
            <option>Afternoon (12pm – 4pm)</option>
            <option>Evening (4pm – 7pm)</option>
          </select></div>
      </div>
      <div class="field"><label for="bkName">Your name</label><input type="text" id="bkName" name="name" autocomplete="name" required></div>
      <div class="row2">
        <div class="field"><label for="bkPhone">Phone</label><input type="tel" id="bkPhone" name="phone" autocomplete="tel" placeholder="416-555-0100"></div>
        <div class="field"><label for="bkEmail">Email</label><input type="email" id="bkEmail" name="email" autocomplete="email" placeholder="you@example.com"></div>
      </div>
      <div class="field"><label for="bkMoveIn">Ideal move-in</label><input type="date" id="bkMoveIn" name="move_in"></div>
      <div class="field"><label for="bkNote">Anything else?</label><textarea id="bkNote" name="note" placeholder="Budget, number of bedrooms, parking, pets…"></textarea></div>
      <button type="submit" class="submit" id="bkSubmit">Request My Showing</button>
      <div class="msg" id="bkMsg" role="status" aria-live="polite"></div>
      <p class="form-note">Or call / text <a href="tel:${TEL}" style="color:var(--gold)">${PHONE}</a>.<br>Your details are never shared or sold.</p>
    </form>
  </div>
</div>
<script src="assets/app.js" defer></script>
</body></html>`;

const planModal = `
<div class="modal" id="planModal" role="dialog" aria-modal="true" aria-labelledby="planName">
  <div class="modal-box modal-box--wide">
    <button class="modal-close" id="planClose" aria-label="Close">&times;</button>
    <div class="plan-view">
      <div class="plan-img-wrap"><img id="planImg" src="" alt=""></div>
      <div class="plan-meta">
        <h2 id="planName"></h2>
        <p class="modal-sub" id="planSpec"></p>
        <p class="plan-price" id="planPrice"></p>
        <button class="submit" id="planBook">Request a Viewing</button>
        <p class="form-note">Or call / text <a href="tel:${TEL}" style="color:var(--gold)">${PHONE}</a></p>
      </div>
    </div>
  </div>
</div>`;

/* ---------- homepage ---------- */
function homepage() {
  const cards = [...live, ...soon].map(c => {
    const from = c.floorplans.length ? Math.min(...c.floorplans.map(f => f.from)) : null;
    const href = c.floorplans.length ? `${c.id}.html` : "#";
    const attrs = c.floorplans.length ? `href="${href}"` : `href="#" data-book data-kind="general" data-community="${esc(c.id)}" data-community-name="${esc(c.name)}"`;
    const shot = (PHOTOS[c.id] || [])[0];
    return `
      <a class="card reveal ${shot ? "card--photo" : ""}" ${attrs}>
        ${shot ? `<img class="card-img" src="${shot}" alt="${esc(c.name)}" loading="lazy" decoding="async">` : ""}
        ${c.status ? `<span class="badge">${esc(c.status)}</span>` : ""}
        <p class="card-name">${esc(c.name)}</p>
        <p class="card-meta">${esc(c.location)}</p>
        ${from ? `<p class="card-count">${c.floorplans.length} floor plans · ${esc(c.types || "")}</p>` : `<p class="card-count">Register your interest</p>`}
        ${from ? `<p class="card-price">From ${money(from)}/mo</p>` : ""}
      </a>`;
  }).join("");

  const perks = [
    ["Up to 2 Months Free", "Select communities are offering one to two months free on a 12-month lease — thousands back before you unpack."],
    ["Free In-Suite Wi-Fi", "Bundled into every suite across the portfolio. No setup fee, no monthly bill, no provider to chase."],
    ["Built to Rent, Not Sold", "Every building here is owned and operated by the builder. No private landlord, no surprise sale, no eviction so an owner can move in."],
    ["Amenities That Embarrass Condos", "Rooftop pools, basketball courts, bowling alleys, spin studios, co-working floors, pet spas, screening rooms."],
    ["On-Site Staff, Every Day", "Concierge, management and maintenance in the building. Issues get fixed, not ignored."],
    ["Zero Showings While You Live There", "Your suite is never listed for sale under you. No strangers walking through your home."]
  ].map(([t, b]) => `<div class="perk reveal"><p class="perk-t">${esc(t)}</p><p class="perk-b">${esc(b)}</p></div>`).join("");

  return head(
    "Toronto Purpose-Built Rentals — Floor Plans & Pricing | RentalsAround.ca",
    `Every floor plan, size and price across ${live.length} builder-owned Toronto rental communities. ${totalPlans} plans from ${money(cheapest)}/mo. Book a showing in seconds.`
  ) + nav + `
<section class="hero">
  <div class="hero-bg" style="background-image:url('../compressed/24077-269.jpg')"></div>
  <div class="hero-overlay"></div>
  <div class="hero-inner">
    <p class="eyebrow">Toronto &amp; GTA</p>
    <h1>Rentals <em>around…</em></h1>
    <p class="hero-sub">${totalPlans} floor plans across ${live.length} builder-owned communities — every size, every price, no private landlords. Pick a plan, pick a time, we'll do the rest.</p>
    <div class="hero-actions">
      <a href="#communities" class="btn btn-primary">Browse Communities</a>
      <a href="#" class="btn btn-ghost" data-book data-kind="general">Book a Showing</a>
    </div>
  </div>
</section>

<div class="stats">
  <div class="stat"><div class="stat-n">${live.length}</div><div class="stat-l">Communities</div></div>
  <div class="stat"><div class="stat-n">${totalPlans}</div><div class="stat-l">Floor Plans</div></div>
  <div class="stat"><div class="stat-n">${money(cheapest)}</div><div class="stat-l">Starting From / mo</div></div>
  <div class="stat"><div class="stat-n">0</div><div class="stat-l">Private Landlords</div></div>
</div>

<section id="communities"><div class="wrap">
  <div class="section-head reveal">
    <p class="eyebrow">The Portfolio</p>
    <h2>Every building.<br><em>Every floor plan.</em></h2>
    <p class="sub" style="margin-top:12px">Real sizes, real starting prices, straight from the current price list. No "call for pricing".</p>
  </div>
  <div class="grid">${cards}</div>
</div></section>

<div class="strip">
  <span class="strip-t">Not sure which one fits?</span>
  <a href="tel:${TEL}" class="btn">Call · ${PHONE}</a>
  <a href="sms:${TEL}" class="btn">Text Us</a>
</div>

<section id="why"><div class="wrap">
  <div class="section-head reveal">
    <p class="eyebrow">Why Rent With Us</p>
    <h2>Six reasons this beats<br><em>a private landlord.</em></h2>
  </div>
  <div class="perks">${perks}</div>
</div></section>
` + footer + modal;
}

/* ---------- community page ---------- */
function communityPage(c) {
  const from  = Math.min(...c.floorplans.map(f => f.from));
  const types = [...new Set(c.floorplans.map(f => f.type))];
  const img   = IMAGES[c.id];

  const chips = `<button class="chip" data-type="all" aria-pressed="true">All ${c.floorplans.length}</button>` +
    types.map(t => `<button class="chip" data-type="${esc(t)}" aria-pressed="false">${esc(t)} (${c.floorplans.filter(f => f.type === t).length})</button>`).join("");

  const plans = c.floorplans.map(f => `
    <button class="fp" data-type="${esc(f.type)}" data-plan
      data-name="${esc(f.name)}" data-plantype="${esc(f.type)}" data-sqft="${f.sqft}" data-from="${f.from}"
      data-img="${esc(f.img || "")}"
      data-community="${esc(c.id)}" data-community-name="${esc(c.name)}"
      data-title="Book a Showing — ${esc(f.name)}">
      ${f.img
        ? `<img class="fp-img" src="${esc(f.img)}" alt="${esc(f.name)} floor plan — ${esc(f.type)}, ${f.sqft} sq ft" loading="lazy" decoding="async" width="1000" height="700">`
        : `<span class="fp-img fp-img--none" aria-hidden="true">Plan drawing coming soon</span>`}
      <span class="fp-name">${esc(f.name)}</span>
      <span class="fp-spec">${esc(f.type)} · ${f.sqft.toLocaleString()} sq ft</span>
      <span class="fp-price">${money(f.from)}<small>/mo</small></span>
      <span class="fp-cta">View plan &amp; book</span>
    </button>`).join("");

  const incentives = (c.incentives || []).map(i =>
    `<div class="perk reveal"><p class="perk-t">${esc(i)}</p></div>`).join("");

  const shots = PHOTOS[c.id] || [];
  const heroStyle = shots.length
    ? `background-image:url('${shots[0]}')`
    : (img ? `background-image:url('${img.dir}/${img.hero}')`
           : "background:linear-gradient(140deg,#221e18,#3a3227)");

  return head(
    `${c.name} — ${c.floorplans.length} Floor Plans & Prices | RentalsAround.ca`,
    `All ${c.floorplans.length} ${c.name} floor plans with real sizes and starting prices, from ${money(from)}/mo. ${c.location}, Toronto. Book a showing online.`
  ) + nav + `
<section class="hero">
  <div class="hero-bg" style="${heroStyle}"></div>
  <div class="hero-overlay"></div>
  <div class="hero-inner">
    <p class="eyebrow">${esc(c.brand)} &nbsp;·&nbsp; ${esc(c.location)}</p>
    <h1>${esc(c.name.split("—")[0].trim())},<br><em>every floor plan.</em></h1>
    <p class="hero-sub">${esc(c.lifestyle || (c.area + ". " + (c.types || "") + " from " + money(from) + "/mo."))}</p>
    <div class="hero-actions">
      <a href="#plans" class="btn btn-primary">See All ${c.floorplans.length} Plans</a>
      <a href="#" class="btn btn-ghost" data-book data-kind="general" data-community="${esc(c.id)}" data-community-name="${esc(c.name)}">Book a Showing</a>
    </div>
  </div>
</section>

<div class="stats">
  <div class="stat"><div class="stat-n">${c.units ? c.units.toLocaleString() : "—"}</div><div class="stat-l">Suites</div></div>
  <div class="stat"><div class="stat-n">${c.floorplans.length}</div><div class="stat-l">Floor Plans</div></div>
  <div class="stat"><div class="stat-n">${types.length}</div><div class="stat-l">Suite Types</div></div>
  <div class="stat"><div class="stat-n">${money(from)}</div><div class="stat-l">Starting From / mo</div></div>
</div>

${incentives ? `<section><div class="wrap">
  <div class="section-head reveal"><p class="eyebrow">Current Incentives</p><h2>What you get<br><em>for signing now.</em></h2></div>
  <div class="perks">${incentives}</div>
</div></section>` : ""}

<section id="plans"><div class="wrap">
  <div class="section-head reveal">
    <p class="eyebrow">Floor Plans &amp; Pricing</p>
    <h2>All ${c.floorplans.length} plans.<br><em>Real prices.</em></h2>
    <p class="sub" style="margin-top:12px">Tap any plan to request a viewing of that exact suite type. Premiums apply on higher floors.</p>
  </div>
  <div class="filters" id="fpFilters">${chips}<span class="filter-count" id="fpCount"></span></div>
  <div class="fp-grid">${plans}</div>
  <p class="note">Prices, specifications and availability subject to change without notice. E.&amp;O.E.</p>
</div></section>

<div class="strip">
  <span class="strip-t">Want to see it in person?</span>
  <a href="tel:${TEL}" class="btn">Call · ${PHONE}</a>
  <a href="#" class="btn" data-book data-kind="general" data-community="${esc(c.id)}" data-community-name="${esc(c.name)}">Book Online</a>
</div>

${shots.length > 1 ? `
<section><div class="wrap">
  <div class="section-head reveal">
    <p class="eyebrow">The Building</p>
    <h2>See it before<br><em>you see it.</em></h2>
    <p class="sub" style="margin-top:12px">${shots.length} photos of the suites and amenity spaces. Tap any image to enlarge.</p>
  </div>
  <div class="gallery reveal">
    ${shots.slice(1, 25).map((src, i) => `
      <button class="shot" data-shot data-i="${i + 1}" aria-label="Photo ${i + 2} of ${shots.length}">
        <img src="${src}" alt="${esc(c.name)} — photo ${i + 2}" loading="lazy" decoding="async">
      </button>`).join("")}
  </div>
  ${shots.length > 25 ? `<p class="note">Showing 24 of ${shots.length} photos — ask us for the full set.</p>` : ""}
</div></section>
<script>window.RA_SHOTS=${JSON.stringify(shots)};</script>` : ""}

${(c.amenities && c.amenities.length) ? `
<section class="amen"><div class="wrap">
  <div class="section-head reveal">
    <p class="eyebrow">Building Amenities</p>
    <h2>${c.amenities.length}+ amenities.<br><em>All included.</em></h2>
    <p class="sub" style="margin-top:12px">No maintenance fees, no add-on memberships. This is what comes with the lease.</p>
  </div>
  <ul class="list list--cols reveal">
    ${c.amenities.map(a => `<li>${esc(a)}</li>`).join("")}
  </ul>
  <p class="note">*Extra fees apply</p>
</div></section>` : ""}

${(c.features && c.features.length) ? `
<section><div class="wrap">
  <div class="section-head reveal">
    <p class="eyebrow">Suite Finishes</p>
    <h2>Inside every<br><em>suite.</em></h2>
  </div>
  <ul class="list list--cols reveal">
    ${c.features.map(f => `<li>${esc(f)}</li>`).join("")}
  </ul>
  <p class="note">*In select suites</p>
</div></section>` : ""}

<section><div class="wrap">
  <div class="cols">
    <div class="reveal">
      <p class="eyebrow">The Community</p>
      <h2 style="font-size:1.6rem;margin-bottom:14px">${esc(c.name)}</h2>
      <p class="sub">${esc(c.area || "")}${c.units ? ` · ${c.units.toLocaleString()} suites` : ""}${c.types ? ` · ${esc(c.types)}` : ""}</p>
      ${c.rentsFrom ? `<p class="sub" style="margin-top:10px">Rents starting at ${money(c.rentsFrom)}.</p>` : ""}
    </div>
    <div class="reveal">
      <p class="eyebrow">Viewings</p>
      <ul class="list">
        ${c.hours ? `<li>Leasing hours — ${esc(c.hours)}</li>` : ""}
        <li>24 hours' notice for before- or after-hours tours</li>
        <li>Call or text ${PHONE}</li>
      </ul>
      <p class="note">We book the showing for you and meet you there.</p>
    </div>
  </div>
</div></section>
` + planModal + `
<div class="viewer" id="viewer" role="dialog" aria-modal="true" aria-label="Photo viewer">
  <button class="viewer-x" id="viewerX" aria-label="Close">&times;</button>
  <button class="viewer-btn viewer-prev" id="viewerPrev" aria-label="Previous">&#8592;</button>
  <img id="viewerImg" src="" alt="">
  <button class="viewer-btn viewer-next" id="viewerNext" aria-label="Next">&#8594;</button>
  <span class="viewer-n" id="viewerN"></span>
</div>` + footer +
  `<script>window.RA_COMMUNITY={id:${JSON.stringify(c.id)},name:${JSON.stringify(c.name)}};</script>` +
  modal;
}

/* ---------- write ---------- */
fs.writeFileSync(path.join(ROOT, "index.html"), homepage());
console.log("index.html".padEnd(30), totalPlans + " plans across " + live.length + " communities");
for (const c of live) {
  const file = c.id + ".html";
  fs.writeFileSync(path.join(ROOT, file), communityPage(c));
  console.log(file.padEnd(30), c.floorplans.length + " plans" + (IMAGES[c.id] ? "" : "   [no photos yet]"));
}
