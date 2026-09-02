/* RentalsAround — booking + enquiry.
   Talks to one table only: rent_bookings. Insert-only by database policy,
   so this key can never read anybody's details back out. */
(function () {
  "use strict";

  var SB_URL = "https://nxuuxmvlttncgqypalnr.supabase.co";
  var SB_KEY = "sb_publishable_QxS2Lvq10fpmTrjY6ANfXw_m_9TWCtn";
  var TABLE  = "rent_bookings";

  // ---------- helpers ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function todayISO(offsetDays) {
    var d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // Keep only digits, then require a plausible North American number.
  function cleanPhone(v) {
    var d = String(v || "").replace(/[^\d]/g, "");
    if (d.length === 11 && d[0] === "1") d = d.slice(1);
    return d.length === 10 ? d : "";
  }

  // ---------- modal ----------
  var modal, form, msgBox, lastFocus;

  function openModal(opts) {
    opts = opts || {};
    lastFocus = document.activeElement;
    $("#bkTitle").textContent   = opts.title || "Book a Showing";
    $("#bkSub").textContent     = opts.sub   || (window.RA_COMMUNITY ? window.RA_COMMUNITY.name : "RentalsAround");
    form.community_id.value     = opts.community_id   || (window.RA_COMMUNITY ? window.RA_COMMUNITY.id : "");
    form.community_name.value   = opts.community_name || (window.RA_COMMUNITY ? window.RA_COMMUNITY.name : "");
    form.floorplan_name.value   = opts.floorplan_name || "";
    form.floorplan_type.value   = opts.floorplan_type || "";
    form.floorplan_sqft.value   = opts.floorplan_sqft || "";
    form.kind.value             = opts.floorplan_name ? "showing" : (opts.kind || "showing");

    var line = $("#bkPlanLine");
    if (opts.floorplan_name) {
      line.textContent = opts.floorplan_type + " · " + opts.floorplan_name +
        (opts.floorplan_sqft ? " · " + opts.floorplan_sqft + " sq ft" : "") +
        (opts.floorplan_from ? " · from $" + Number(opts.floorplan_from).toLocaleString() + "/mo" : "");
      line.hidden = false;
    } else {
      line.hidden = true;
    }

    hideMsg();
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    setTimeout(function () { form.name.focus(); }, 40);
  }

  function closeModal() {
    modal.classList.remove("open");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function showMsg(kind, text) {
    msgBox.className = "msg show " + kind;
    msgBox.textContent = text;
  }
  function hideMsg() { msgBox.className = "msg"; msgBox.textContent = ""; }

  // ---------- submit ----------
  async function submit(e) {
    e.preventDefault();
    var btn = $("#bkSubmit");

    var name  = form.name.value.trim();
    var email = form.email.value.trim();
    var phone = cleanPhone(form.phone.value);

    if (!name)  { showMsg("err", "Please enter your name."); form.name.focus(); return; }
    if (!phone && !email) { showMsg("err", "Please leave a phone number or an email so we can reach you."); return; }
    if (form.phone.value.trim() && !phone) { showMsg("err", "That phone number doesn't look right — 10 digits please."); form.phone.focus(); return; }

    var payload = {
      community_id:   form.community_id.value,
      community_name: form.community_name.value,
      floorplan_name: form.floorplan_name.value || null,
      floorplan_type: form.floorplan_type.value || null,
      floorplan_sqft: form.floorplan_sqft.value ? Number(form.floorplan_sqft.value) : null,
      request_date:   form.request_date.value || null,
      request_time:   form.request_time.value || null,
      name:           name.slice(0, 80),
      email:          email || null,
      phone:          phone ? "+1" + phone : null,
      move_in:        form.move_in.value || null,
      note:           form.note.value.trim().slice(0, 1000),
      kind:           form.kind.value,
      source:         "rentalsaround.ca",
      source_path:    location.pathname + location.search,
      user_agent:     navigator.userAgent.slice(0, 300)
    };

    btn.disabled = true;
    btn.textContent = "Sending…";
    hideMsg();

    try {
      var r = await fetch(SB_URL + "/rest/v1/" + TABLE, {
        method: "POST",
        headers: {
          apikey: SB_KEY,
          Authorization: "Bearer " + SB_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(payload)
      });

      if (!r.ok) throw new Error("http_" + r.status);

      form.reset();
      showMsg("ok", "Got it — thanks " + name.split(" ")[0] + ". We'll be in touch shortly to confirm your showing.");
      btn.textContent = "Sent";
      setTimeout(closeModal, 2600);
    } catch (err) {
      showMsg("err", "That didn't send. Please call or text 437-869-3363 and we'll sort it out.");
      btn.disabled = false;
      btn.textContent = "Request My Showing";
    }
  }

  // ---------- floor plan filtering ----------
  function initFilters() {
    var bar = $("#fpFilters");
    if (!bar) return;
    var plans = $$(".fp");
    var count = $("#fpCount");

    function apply(type) {
      var shown = 0;
      plans.forEach(function (p) {
        var match = (type === "all" || p.dataset.type === type);
        p.hidden = !match;
        if (match) shown++;
      });
      if (count) count.textContent = shown + (shown === 1 ? " floor plan" : " floor plans");
    }

    $$(".chip", bar).forEach(function (chip) {
      chip.addEventListener("click", function () {
        $$(".chip", bar).forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        apply(chip.dataset.type);
      });
    });
    apply("all");
  }

  // ---------- reveal on scroll ----------
  function initReveal() {
    var els = $$(".reveal");
    if (!els.length || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.06, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  // ---------- wire up ----------
  document.addEventListener("DOMContentLoaded", function () {
    modal  = $("#bkModal");
    if (modal) {
      form   = $("#bkForm");
      msgBox = $("#bkMsg");

      form.request_date.min = todayISO(0);
      form.request_date.max = todayISO(60);
      form.move_in.min      = todayISO(0);

      form.addEventListener("submit", submit);
      $("#bkClose").addEventListener("click", closeModal);
      modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
      });

      // any element with data-book opens the form
      document.addEventListener("click", function (e) {
        var t = e.target.closest("[data-book]");
        if (!t) return;
        e.preventDefault();
        openModal({
          title:          t.dataset.title || "Book a Showing",
          floorplan_name: t.dataset.name || "",
          floorplan_type: t.dataset.plantype || "",
          floorplan_sqft: t.dataset.sqft || "",
          floorplan_from: t.dataset.from || "",
          community_id:   t.dataset.community || "",
          community_name: t.dataset.communityName || "",
          kind:           t.dataset.kind || "showing"
        });
      });
    }

    // ---------- floor plan lightbox ----------
    var pm = $("#planModal");
    if (pm) {
      var current = null;
      function openPlan(d) {
        current = d;
        var img = $("#planImg");
        if (d.img) { img.src = d.img; img.alt = d.name + " floor plan"; img.parentElement.hidden = false; }
        else { img.removeAttribute("src"); img.parentElement.hidden = true; }
        $("#planName").textContent = d.name;
        $("#planSpec").textContent = d.plantype + " · " + Number(d.sqft).toLocaleString() + " sq ft";
        $("#planPrice").innerHTML = "$" + Number(d.from).toLocaleString() + "<small>/mo starting</small>";
        pm.classList.add("open");
        document.body.style.overflow = "hidden";
      }
      function closePlan() { pm.classList.remove("open"); document.body.style.overflow = ""; }

      document.addEventListener("click", function (e) {
        var t = e.target.closest("[data-plan]");
        if (!t) return;
        e.preventDefault();
        openPlan(t.dataset);
      });
      $("#planClose").addEventListener("click", closePlan);
      pm.addEventListener("click", function (e) { if (e.target === pm) closePlan(); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && pm.classList.contains("open")) closePlan();
      });
      $("#planBook").addEventListener("click", function () {
        var d = current || {};
        closePlan();
        openModal({
          title: "Book a Showing — " + (d.name || ""),
          floorplan_name: d.name || "",
          floorplan_type: d.plantype || "",
          floorplan_sqft: d.sqft || "",
          floorplan_from: d.from || "",
          community_id: d.community || "",
          community_name: d.communityName || ""
        });
      });
    }

    // ---------- photo viewer ----------
    var vw = $("#viewer");
    if (vw && window.RA_SHOTS && RA_SHOTS.length) {
      var vi = 0;
      function show(i) {
        vi = (i + RA_SHOTS.length) % RA_SHOTS.length;
        $("#viewerImg").src = RA_SHOTS[vi];
        $("#viewerN").textContent = (vi + 1) + " / " + RA_SHOTS.length;
      }
      function openV(i) { show(i); vw.classList.add("open"); document.body.style.overflow = "hidden"; }
      function closeV() { vw.classList.remove("open"); document.body.style.overflow = ""; }
      document.addEventListener("click", function (e) {
        var t = e.target.closest("[data-shot]");
        if (t) { e.preventDefault(); openV(Number(t.dataset.i)); }
      });
      $("#viewerX").addEventListener("click", closeV);
      $("#viewerPrev").addEventListener("click", function (e) { e.stopPropagation(); show(vi - 1); });
      $("#viewerNext").addEventListener("click", function (e) { e.stopPropagation(); show(vi + 1); });
      vw.addEventListener("click", function (e) { if (e.target === vw) closeV(); });
      document.addEventListener("keydown", function (e) {
        if (!vw.classList.contains("open")) return;
        if (e.key === "Escape") closeV();
        if (e.key === "ArrowLeft") show(vi - 1);
        if (e.key === "ArrowRight") show(vi + 1);
      });
    }

    initFilters();
    initReveal();
  });
})();
