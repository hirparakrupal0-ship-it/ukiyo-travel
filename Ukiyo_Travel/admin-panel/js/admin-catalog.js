/* Command Center — Destinations, Hotels, Packages, Featured Content */
(function () {
  "use strict";
  const A = window.Admin, Auth = A.Auth, { $, $$, esc, money, call, toast } = A;
  const plain = (s) => String(s || "").replace(/[^\d]/g, "");

  const CFG = {
    destinations: { label: "Destination", key: "slug", title: "Destinations", sub: "Places customers can explore and book",
      fields: (ctx, edit) => [
        { name: "name", label: "Name", required: true, maxlength: 80 },
        { name: "priceFrom", label: "Starting price per person (₹)", type: "number", required: true, min: 1, step: 1 },
        { name: "image", label: "Image URL", type: "url", full: true, hint: "https://… link to a photo" },
        { name: "short", label: "Short tagline", full: true, maxlength: 200 },
        { name: "description", label: "Description", type: "textarea", maxlength: 1500 },
        { name: "highlights", label: "Highlights", full: true, hint: "Comma-separated, e.g. Beaches, Water sports" },
        { name: "bestTime", label: "Best time to visit", placeholder: "Nov – Feb", maxlength: 40 },
        { name: "priority", label: "Display order", type: "number", min: 0, max: 9999, hint: "Lower numbers show first" },
        { name: "isActive", label: "Active (visible on the website)", type: "checkbox" }, { name: "isFeatured", label: "Featured", type: "checkbox" }],
      toForm: (i) => ({ ...i, priceFrom: plain(i.priceFrom), highlights: (i.highlights || []).join(", ") }),
      row: (i) => [`<div class="cell-flex">${i.image ? `<img class="thumb" src="${esc(i.image)}" alt="" loading="lazy">` : '<span class="thumb"></span>'}<div><span class="cell-strong">${esc(i.name)}</span><div class="cell-sub">${esc(i.short || "")}</div></div></div>`, esc(i.priceFrom), esc(i.bestTime || "—")],
      heads: ["Destination", "From", "Best time"] },
    packages: { label: "Package", key: "id", title: "Packages", sub: "Holiday packages customers can book",
      fields: (ctx) => [
        { name: "title", label: "Title", required: true, maxlength: 80 },
        { name: "destination", label: "Destination", type: "select", required: true, options: ctx.destinations.map((d) => [d.slug, d.name]) },
        { name: "price", label: "Price per person (₹)", type: "number", required: true, min: 1, step: 1 }, { name: "duration", label: "Duration", placeholder: "4 Days / 3 Nights", maxlength: 40 },
        { name: "image", label: "Image URL", type: "url", full: true }, { name: "includes", label: "What's included", full: true, hint: "Comma-separated" },
        { name: "priority", label: "Display order", type: "number", min: 0, max: 9999 },
        { name: "isActive", label: "Active (visible on the website)", type: "checkbox" }, { name: "isFeatured", label: "Popular package", type: "checkbox" }],
      toForm: (i) => ({ ...i, price: plain(i.price), includes: (i.includes || []).join(", ") }),
      row: (i, ctx) => [`<div class="cell-flex">${i.image ? `<img class="thumb" src="${esc(i.image)}" alt="" loading="lazy">` : '<span class="thumb"></span>'}<div><span class="cell-strong">${esc(i.title)}</span><div class="cell-sub">${esc(i.duration || "")}</div></div></div>`, esc((ctx.destinations.find((d) => d.slug === i.destination) || {}).name || i.destination), esc(i.price)],
      heads: ["Package", "Destination", "Price"] },
    hotels: { label: "Hotel", key: "id", title: "Hotels", sub: "Stays customers can book",
      fields: (ctx) => [
        { name: "name", label: "Hotel name", required: true, maxlength: 80 },
        { name: "city", label: "City / destination", type: "select", required: true, options: ctx.destinations.map((d) => [d.name, d.name]) },
        { name: "price", label: "Price per night (₹)", type: "number", required: true, min: 1, step: 1 }, { name: "rating", label: "Listing rating (0–5)", type: "number", min: 0, max: 5, step: 0.1, hint: "Replaced by the average of real reviews once guests review" },
        { name: "image", label: "Image URL", type: "url", full: true }, { name: "tags", label: "Tags", full: true, hint: "Comma-separated, e.g. Pool, Breakfast" },
        { name: "priority", label: "Display order", type: "number", min: 0, max: 9999 },
        { name: "isActive", label: "Active (visible on the website)", type: "checkbox" }, { name: "isFeatured", label: "Recommended hotel", type: "checkbox" }],
      toForm: (i) => ({ ...i, price: plain(i.price), tags: (i.tags || []).join(", ") }),
      row: (i) => [`<div class="cell-flex">${i.image ? `<img class="thumb" src="${esc(i.image)}" alt="" loading="lazy">` : '<span class="thumb"></span>'}<div><span class="cell-strong">${esc(i.name)}</span><div class="cell-sub">${esc((i.tags || []).join(" · "))}</div></div></div>`, esc(i.city), esc(i.price) + "<span class='cell-sub'> / night</span>"],
      heads: ["Hotel", "City", "Price"] },
    banners: { label: "Banner", key: "_id", title: "Banners", sub: "",
      fields: () => [
        { name: "kind", label: "Type", type: "select", options: [["banner", "Homepage banner (card)"], ["promo", "Promotional strip"]] },
        { name: "title", label: "Headline", required: true, maxlength: 90 }, { name: "subtitle", label: "Supporting text", full: true, maxlength: 220 },
        { name: "imageUrl", label: "Background image URL", type: "url", full: true, hint: "Optional (banner type only)" },
        { name: "ctaLabel", label: "Button label", maxlength: 30, placeholder: "Book now" }, { name: "ctaLink", label: "Button link", placeholder: "#packages or https://…" },
        { name: "priority", label: "Display order", type: "number", min: 0, max: 9999 }, { name: "isActive", label: "Active (visible on the website)", type: "checkbox" }],
      toForm: (i) => ({ ...i }),
      row: (i) => [`<span class="cell-strong">${esc(i.title)}</span><div class="cell-sub">${esc(i.subtitle || "")}</div>`, esc(i.kind === "promo" ? "Promo strip" : "Banner"), esc(i.ctaLabel ? i.ctaLabel + " → " + (i.ctaLink || "") : "—")],
      heads: ["Content", "Type", "Button"] },
  };

  async function destCtx() { return { destinations: (await call(Auth.adminCatalog("destinations"))).items }; }

  /** Shared table with add / edit / delete / active / featured / order controls. */
  function renderCatalog(type, el, opts = {}) {
    const c = CFG[type];
    const hasFeature = type !== "banners";
    el.innerHTML = `${opts.embedded ? "" : `<div class="page-head"><div><h2>${c.title}</h2><p>${c.sub}</p></div><button class="btn-primary-a" id="add-${type}"><i class="bi bi-plus-lg"></i> Add ${c.label.toLowerCase()}</button></div>`}
      <div class="toolbar">${A.searchBox("q-" + type, "Search " + c.title.toLowerCase() + "…")}<span class="result-count" id="cnt-${type}"></span>${opts.embedded ? `<button class="btn-primary-a" id="add-${type}"><i class="bi bi-plus-lg"></i> Add ${c.label.toLowerCase()}</button>` : ""}</div><div id="body-${type}">${A.skeleton(4)}</div>`;
    let items = [], ctx = {}, q = "";
    const flag = async (item, body, okMsg) => { try { await call(Auth.adminCatalogFlags(type, item._id, body)); toast(okMsg); load(); } catch (e) { if (!e.handled) toast(A.msg(e), "error"); load(); } };
    const paint = () => {
      const ql = q.toLowerCase();
      const rows = items.filter((i) => !ql || JSON.stringify(i).toLowerCase().includes(ql));
      $("#cnt-" + type, el).textContent = rows.length + " of " + items.length;
      $("#body-" + type, el).innerHTML = !items.length ? A.emptyState("bi-inbox", `No ${c.title.toLowerCase()} yet`, "", `<button class="btn-primary-a" data-empty-add><i class="bi bi-plus-lg"></i> Add ${c.label.toLowerCase()}</button>`)
        : !rows.length ? A.emptyState("bi-search", "Nothing matches your search")
        : A.table([...c.heads, ...(type === "banners" ? [] : [{ label: "Bookings", cls: "r" }]), ...(hasFeature ? ["Featured"] : []), "Active", { label: "Order", cls: "r" }, { label: "", cls: "r" }], rows.map((i) => {
          const idx = items.indexOf(i);
          return [...c.row(i, ctx), ...(type === "banners" ? [] : [`<b>${i.bookingCount || 0}</b>`]),
            ...(hasFeature ? [`<button class="icon-btn ${i.isFeatured ? "on" : ""}" data-feat="${i._id}" title="${i.isFeatured ? "Remove from featured" : "Mark as featured"}"><i class="bi ${i.isFeatured ? "bi-star-fill" : "bi-star"}"></i></button>`] : []),
            `<label class="switch" title="Show on website"><input type="checkbox" data-act="${i._id}" ${i.isActive ? "checked" : ""}><span class="sl"></span></label>`,
            `<div class="actions"><button class="icon-btn" data-up="${i._id}" ${idx === 0 || ql ? "disabled" : ""} title="Move up"><i class="bi bi-arrow-up"></i></button><button class="icon-btn" data-down="${i._id}" ${idx === items.length - 1 || ql ? "disabled" : ""} title="Move down"><i class="bi bi-arrow-down"></i></button></div>`,
            `<div class="actions"><button class="icon-btn info" data-edit="${i._id}" title="Edit"><i class="bi bi-pencil"></i></button><button class="icon-btn js-del" data-del="${i._id}" title="Delete"><i class="bi bi-trash"></i></button></div>`];
        }));
      const by = (id) => items.find((i) => i._id === id);
      $$("[data-feat]", el).forEach((b) => b.addEventListener("click", () => { const i = by(b.dataset.feat); flag(i, { isFeatured: !i.isFeatured }, i.isFeatured ? "Removed from featured" : "Marked as featured — live on the website"); }));
      $$("[data-act]", el).forEach((b) => b.addEventListener("change", () => flag(by(b.dataset.act), { isActive: b.checked }, b.checked ? "Now visible on the website" : "Hidden from the website")));
      const move = (id, d) => async () => { const a = items.slice(); const i = a.findIndex((x) => x._id === id); const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]];
        try { await call(Auth.adminCatalogReorder(type, a.map((x) => x._id))); toast("Display order saved"); load(); } catch (e) { if (!e.handled) toast(A.msg(e), "error"); } };
      $$("[data-up]", el).forEach((b) => b.addEventListener("click", move(b.dataset.up, -1))); $$("[data-down]", el).forEach((b) => b.addEventListener("click", move(b.dataset.down, 1)));
      $$("[data-edit]", el).forEach((b) => b.addEventListener("click", () => form(by(b.dataset.edit))));
      $$("[data-del]", el).forEach((b) => b.addEventListener("click", async () => { const i = by(b.dataset.del);
        if (!(await A.confirm({ title: `Delete ${c.label.toLowerCase()}?`, message: `"${i.name || i.title}" will be removed permanently. If customers have booked it you'll be asked to deactivate it instead.`, confirmText: "Delete", danger: true }))) return;
        try { await call(Auth.adminCatalogDelete(type, i._id)); toast(c.label + " deleted"); load(); } catch (e) { if (!e.handled) toast(A.msg(e), "error"); } }));
      const ea = $("[data-empty-add]", el); if (ea) ea.addEventListener("click", () => form(null));
    };
    function form(item) {
      A.formModal({ title: item ? `Edit ${c.label.toLowerCase()}` : `Add ${c.label.toLowerCase()}`, size: "lg", submitText: item ? "Save changes" : `Add ${c.label.toLowerCase()}`,
        fields: c.fields(ctx, !!item), values: item ? c.toForm(item) : { isActive: true, kind: "banner", priority: (items.length + 1) * 10, destination: (ctx.destinations && ctx.destinations[0] || {}).slug, city: (ctx.destinations && ctx.destinations[0] || {}).name },
        onSubmit: async (v) => { const body = { ...v }; if (v.priority === "") delete body.priority;
          if (item) await call(Auth.adminCatalogUpdate(type, item._id, body)); else await call(Auth.adminCatalogCreate(type, body));
          toast(item ? c.label + " updated — changes are live" : c.label + " added"); load(); } });
    }
    async function load() { try { if (["packages", "hotels"].includes(type)) ctx = await destCtx(); else ctx = {}; items = (await call(Auth.adminCatalog(type))).items; paint(); } catch (e) { A.errorState($("#body-" + type, el), e, load, `Couldn't load ${c.title.toLowerCase()}.`); } }
    $("#add-" + type, el).addEventListener("click", async () => { if (["packages", "hotels"].includes(type) && !(ctx.destinations || []).length) return toast("Add a destination first.", "error"); form(null); });
    $("#q-" + type, el).addEventListener("input", A.debounce((e) => { q = e.target.value.trim(); paint(); }, 200));
    load();
  }

  ["destinations", "packages", "hotels"].forEach((t) => A.register(t, { title: CFG[t].title, sub: CFG[t].sub, render: (el) => renderCatalog(t, el) }));

  /* ---------------- Featured Content ---------------- */
  A.register("featured", { title: "Featured Content", sub: "Control what the homepage highlights", render(el) {
    const tabs = [["destinations", "Featured destinations", "bi-geo-alt"], ["packages", "Popular packages", "bi-box-seam"], ["hotels", "Recommended hotels", "bi-building"], ["banners", "Banners & promotions", "bi-megaphone"]];
    let active = "destinations";
    el.innerHTML = `<div class="inline-note"><i class="bi bi-info-circle"></i> Changes here go live on the website straight away. <b>Featured</b> items are shown first with a badge; <b>inactive</b> items are hidden; use the arrows to set the display order.</div>
      <div class="tabs" id="fcTabs">${tabs.map(([k, l, ic]) => `<button data-k="${k}"><i class="bi ${ic}"></i> ${l}</button>`).join("")}</div><div id="fcBody"></div>`;
    const paint = () => { $$("#fcTabs button", el).forEach((b) => b.classList.toggle("active", b.dataset.k === active)); renderCatalog(active, $("#fcBody", el), { embedded: true }); };
    $$("#fcTabs button", el).forEach((b) => b.addEventListener("click", () => { active = b.dataset.k; paint(); }));
    paint();
  } });
})();
