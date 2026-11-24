/* =========================================================
   Ukiyo Travel — Smart Destination scoring engine
   Combines Find Your Ukiyo (mood) + Travel DNA + Regret-Free
   into a live % match per destination and a top recommendation.
   Depends on: js/data.js
========================================================= */
window.UkiyoScore = (function () {
  const D = window.UkiyoData;
  const DIMS = ["peace", "adventure", "romance", "fun", "nature", "luxury", "budget", "uncrowded", "weather", "food", "stay"];

  // Read the currently-checked radio id within a named group.
  function radio(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.id : null;
  }

  // Build a weight vector for the 11 dimensions from all three feature inputs.
  function buildWeights() {
    const w = {};
    DIMS.forEach((d) => (w[d] = 0.4)); // small base so scores stay stable

    // --- Find Your Ukiyo (mood) ---
    const moodMap = {
      "mood-peace": "peace", "mood-adventure": "adventure", "mood-romance": "romance",
      "mood-fun": "fun", "mood-nature": "nature", "mood-luxury": "luxury",
    };
    const mood = radio("mood");
    if (moodMap[mood]) w[moodMap[mood]] += 3;

    // --- Travel DNA ---
    const vibe = radio("vibe"); // v1 calm, v2 adventure, v3 romantic, v4 party
    ({ v1: () => (w.peace += 2), v2: () => (w.adventure += 2), v3: () => (w.romance += 2), v4: () => (w.fun += 2) }[vibe] || (() => {}))();

    const style = radio("style"); // s1 budget, s2 comfort, s3 luxury, s4 backpacker
    if (style === "s1") w.budget += 2;
    else if (style === "s2") w.stay += 1.5;
    else if (style === "s3") w.luxury += 2;
    else if (style === "s4") { w.budget += 1.5; w.adventure += 1; }

    const morning = radio("morning"); // m1 slow, m2 mountain, m3 beach, m4 city
    if (morning === "m1") w.peace += 0.5;
    else if (morning === "m2") { w.nature += 1; w.adventure += 0.5; }
    else if (morning === "m3") { w.peace += 0.5; w.nature += 0.5; }
    else if (morning === "m4") w.fun += 0.5;

    const withWho = radio("with"); // w1 solo, w2 couple, w3 friends, w4 family
    if (withWho === "w1") w.adventure += 0.5;
    else if (withWho === "w2") w.romance += 1;
    else if (withWho === "w3") w.fun += 1;
    else if (withWho === "w4") { w.stay += 0.5; w.uncrowded += 0.5; }

    // --- Regret-Free (checked = wants to avoid this) ---
    document.querySelectorAll("#regret-free .regret-option input[type=checkbox]:checked").forEach((c) => {
      const t = ((c.parentElement.querySelector("strong") || {}).textContent || "").toLowerCase();
      if (t.includes("spending")) w.budget += 2;
      else if (t.includes("travelling")) w.peace += 1;
      else if (t.includes("crowd")) w.uncrowded += 2;
      else if (t.includes("weather")) w.weather += 2;
      else if (t.includes("food")) w.food += 2;
      else if (t.includes("accommodation")) w.stay += 2;
    });

    return w;
  }

  // Weighted average of a destination's attributes → 0–100 match.
  function scoreFor(slug, w) {
    const a = D.attrBySlug(slug);
    if (!a) return 0;
    let num = 0, den = 0;
    DIMS.forEach((d) => { num += w[d] * (a[d] || 0); den += w[d]; });
    return den ? Math.round(num / den) : 0;
  }

  // Rank all destinations by match, highest first.
  function rank() {
    const w = buildWeights();
    return D.destinations
      .map((d) => ({ slug: d.slug, name: d.name, short: d.short, image: d.image, priceFrom: d.priceFrom, score: scoreFor(d.slug, w) }))
      .sort((a, b) => b.score - a.score);
  }

  return { rank, buildWeights, DIMS };
})();
