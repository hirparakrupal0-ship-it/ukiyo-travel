const Destination = require("../models/Destination");
const Package = require("../models/Package");
const Hotel = require("../models/Hotel");
const Banner = require("../models/Banner");
const Booking = require("../models/Booking");
const Review = require("../models/Review");
const { priceToNumber } = require("../utils/money");

const SORT = { isFeatured: -1, priority: 1, createdAt: 1 };
const money = (n) => "₹" + Number(n).toLocaleString("en-IN");
const safeUrl = (u) => !u || /^(https?:\/\/|assets\/|\/)/i.test(String(u).trim());
const safeLink = (u) => !u || /^(#|\/|https?:\/\/)/i.test(String(u).trim());
const list = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map((s) => String(s).trim()).filter(Boolean).slice(0, 12);
const bool = (v) => v === true || v === "true";

/* Each type: model, id field, and a sanitiser that returns { data } or { error }. */
const TYPES = {
  destinations: {
    Model: Destination, idField: "slug", label: "Destination",
    clean(b, creating) {
      const d = {};
      if (creating) {
        const slug = String(b.slug || b.name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!slug) return { error: "A name is required." };
        d.slug = slug;
      }
      if (b.name !== undefined || creating) { if (!String(b.name || "").trim()) return { error: "Destination name is required." }; d.name = String(b.name).trim().slice(0, 80); }
      if (b.priceFrom !== undefined || creating) {
        const n = priceToNumber(b.priceFrom); if (!n) return { error: "Enter a valid starting price, e.g. 9999." }; d.priceFrom = money(n);
      }
      if (b.image !== undefined) { if (!safeUrl(b.image)) return { error: "Image must be an http(s) URL." }; d.image = String(b.image).trim(); }
      if (b.short !== undefined) d.short = String(b.short).trim().slice(0, 200);
      if (b.description !== undefined) d.description = String(b.description).trim().slice(0, 1500);
      if (b.highlights !== undefined) d.highlights = list(b.highlights);
      if (b.bestTime !== undefined) d.bestTime = String(b.bestTime).trim().slice(0, 40);
      return { data: d };
    },
  },
  packages: {
    Model: Package, idField: "id", label: "Package",
    async clean(b, creating) {
      const d = {};
      if (creating) {
        const id = String(b.id || b.title || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!id) return { error: "A title is required." };
        d.id = id;
      }
      if (b.title !== undefined || creating) { if (!String(b.title || "").trim()) return { error: "Package title is required." }; d.title = String(b.title).trim().slice(0, 80); }
      if (b.destination !== undefined || creating) {
        const slug = String(b.destination || "").toLowerCase();
        if (!(await Destination.exists({ slug }))) return { error: "Choose an existing destination." };
        d.destination = slug;
      }
      if (b.price !== undefined || creating) { const n = priceToNumber(b.price); if (!n) return { error: "Enter a valid price, e.g. 9999." }; d.price = money(n); }
      if (b.duration !== undefined) d.duration = String(b.duration).trim().slice(0, 40);
      if (b.image !== undefined) { if (!safeUrl(b.image)) return { error: "Image must be an http(s) URL." }; d.image = String(b.image).trim(); }
      if (b.includes !== undefined) d.includes = list(b.includes);
      return { data: d };
    },
  },
  hotels: {
    Model: Hotel, idField: "id", label: "Hotel",
    async clean(b, creating) {
      const d = {};
      if (creating) {
        const id = String(b.id || b.name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!id) return { error: "A name is required." }; d.id = id;
      }
      if (b.name !== undefined || creating) { if (!String(b.name || "").trim()) return { error: "Hotel name is required." }; d.name = String(b.name).trim().slice(0, 80); }
      if (b.city !== undefined || creating) {
        const dest = await Destination.findOne({ name: new RegExp("^" + String(b.city || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") });
        if (!dest) return { error: "Choose a city that matches an existing destination." }; d.city = dest.name;
      }
      if (b.price !== undefined || creating) { const n = priceToNumber(b.price); if (!n) return { error: "Enter a valid price per night, e.g. 4500." }; d.price = money(n); }
      if (b.rating !== undefined && b.rating !== "") { const r = Number(b.rating); if (!(r >= 0 && r <= 5)) return { error: "Rating must be between 0 and 5." }; d.rating = r; }
      if (b.image !== undefined) { if (!safeUrl(b.image)) return { error: "Image must be an http(s) URL." }; d.image = String(b.image).trim(); }
      if (b.tags !== undefined) d.tags = list(b.tags);
      return { data: d };
    },
  },
  banners: {
    Model: Banner, idField: "_id", label: "Banner",
    clean(b, creating) {
      const d = {};
      if (b.kind !== undefined) { if (!["banner", "promo"].includes(b.kind)) return { error: "Type must be banner or promo." }; d.kind = b.kind; }
      if (b.title !== undefined || creating) { if (!String(b.title || "").trim()) return { error: "Title is required." }; d.title = String(b.title).trim().slice(0, 90); }
      if (b.subtitle !== undefined) d.subtitle = String(b.subtitle).trim().slice(0, 220);
      if (b.imageUrl !== undefined) { if (!safeUrl(b.imageUrl)) return { error: "Image must be an http(s) URL." }; d.imageUrl = String(b.imageUrl).trim(); }
      if (b.ctaLabel !== undefined) d.ctaLabel = String(b.ctaLabel).trim().slice(0, 30);
      if (b.ctaLink !== undefined) { if (!safeLink(b.ctaLink)) return { error: "Link must start with #, / or https://" }; d.ctaLink = String(b.ctaLink).trim(); }
      return { data: d };
    },
  },
};

function flagsFrom(b) {
  const f = {};
  if (b.isActive !== undefined) f.isActive = bool(b.isActive);
  if (b.isFeatured !== undefined) f.isFeatured = bool(b.isFeatured);
  if (b.priority !== undefined && b.priority !== "") { const p = Number(b.priority); if (Number.isFinite(p)) f.priority = Math.max(0, Math.min(9999, Math.round(p))); }
  return f;
}

function typeOr404(req, res) {
  const t = TYPES[req.params.type];
  if (!t) res.status(404).json({ success: false, message: "Unknown content type" });
  return t;
}

/* ------------------------------ PUBLIC ------------------------------ */

/**
 * @route GET /api/catalog
 * What the user website renders. Inactive items are hidden; featured first, then by priority.
 * Ratings shown on cards are the real average of approved reviews when any exist.
 */
async function publicCatalog(req, res, next) {
  try {
    const [destinations, packages, hotels, banners, reviews] = await Promise.all([
      Destination.find({ isActive: true }).sort(SORT).lean(),
      Package.find({ isActive: true }).sort(SORT).lean(),
      Hotel.find({ isActive: true }).sort(SORT).lean(),
      Banner.find({ isActive: true }).sort({ priority: 1, createdAt: 1 }).lean(),
      Review.find({ status: "approved" }).select("itemType itemId rating").lean(),
    ]);
    const agg = new Map();
    reviews.forEach((r) => { const k = r.itemType + ":" + r.itemId; const a = agg.get(k) || { sum: 0, n: 0 }; a.sum += r.rating; a.n += 1; agg.set(k, a); });
    const rate = (type, id) => { const a = agg.get(type + ":" + id); return a ? { avg: Math.round((a.sum / a.n) * 10) / 10, n: a.n } : null; };

    const strip = ({ _id, __v, createdAt, updatedAt, ...rest }) => rest;
    res.json({
      success: true,
      destinations: destinations.map((d) => { const r = rate("destination", d.slug); return { ...strip(d), reviewCount: r ? r.n : 0, reviewAverage: r ? r.avg : null }; }),
      packages: packages.map((p) => { const r = rate("package", p.id); return { ...strip(p), reviewCount: r ? r.n : 0, reviewAverage: r ? r.avg : null }; }),
      hotels: hotels.map((h) => { const r = rate("hotel", h.id); return { ...strip(h), rating: r ? r.avg : h.rating, reviewCount: r ? r.n : 0, reviewAverage: r ? r.avg : null }; }),
      banners: banners.map((b) => ({ ...strip(b), id: String(b._id) })),
    });
  } catch (err) { next(err); }
}

/* ------------------------------ ADMIN CRUD ------------------------------ */

/** @route GET /api/admin/catalog/:type — everything, including inactive, with booking counts */
async function adminList(req, res, next) {
  try {
    const t = typeOr404(req, res); if (!t) return;
    const items = await t.Model.find().sort(SORT).lean();
    let counts = new Map();
    if (t.idField !== "_id") {
      const type = { destinations: "destination", packages: "package", hotels: "hotel" }[req.params.type];
      const rows = await Booking.aggregate([{ $match: { itemType: type, status: { $ne: "cancelled" } } }, { $group: { _id: "$itemId", n: { $sum: 1 } } }]);
      counts = new Map(rows.map((r) => [r._id, r.n]));
    }
    res.json({ success: true, count: items.length, items: items.map((i) => ({ ...i, bookingCount: counts.get(i[t.idField]) || 0 })) });
  } catch (err) { next(err); }
}

/** @route POST /api/admin/catalog/:type */
async function adminCreate(req, res, next) {
  try {
    const t = typeOr404(req, res); if (!t) return;
    const r = await t.clean(req.body, true);
    if (r.error) return res.status(400).json({ success: false, message: r.error });
    const doc = { ...r.data, ...flagsFrom(req.body) };
    if (doc.priority === undefined) doc.priority = ((await t.Model.countDocuments()) + 1) * 10;
    if (t.idField !== "_id" && (await t.Model.exists({ [t.idField]: doc[t.idField] }))) {
      return res.status(409).json({ success: false, message: `${t.label} "${doc[t.idField]}" already exists.` });
    }
    const item = await t.Model.create(doc);
    res.status(201).json({ success: true, message: `${t.label} added`, item });
  } catch (err) { next(err); }
}

/** @route PUT /api/admin/catalog/:type/:id — edit content fields and flags (the id/slug is permanent) */
async function adminUpdate(req, res, next) {
  try {
    const t = typeOr404(req, res); if (!t) return;
    const item = await t.Model.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: `${t.label} not found` });
    const r = await t.clean(req.body, false);
    if (r.error) return res.status(400).json({ success: false, message: r.error });
    item.set({ ...r.data, ...flagsFrom(req.body) });
    await item.save();
    res.json({ success: true, message: `${t.label} updated`, item });
  } catch (err) { next(err); }
}

/** @route PATCH /api/admin/catalog/:type/:id/flags  { isActive?, isFeatured?, priority? } */
async function adminFlags(req, res, next) {
  try {
    const t = typeOr404(req, res); if (!t) return;
    const f = flagsFrom(req.body);
    if (!Object.keys(f).length) return res.status(400).json({ success: false, message: "Nothing to update" });
    const item = await t.Model.findByIdAndUpdate(req.params.id, { $set: f }, { new: true });
    if (!item) return res.status(404).json({ success: false, message: `${t.label} not found` });
    res.json({ success: true, message: `${t.label} updated`, item });
  } catch (err) { next(err); }
}

/** @route POST /api/admin/catalog/:type/reorder  { ids: [orderedMongoIds] } — sets display order */
async function adminReorder(req, res, next) {
  try {
    const t = typeOr404(req, res); if (!t) return;
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ success: false, message: "ids are required" });
    await t.Model.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { priority: (i + 1) * 10 } } } })));
    res.json({ success: true, message: "Display order saved" });
  } catch (err) { next(err); }
}

/** @route DELETE /api/admin/catalog/:type/:id — blocked while bookings/packages depend on it */
async function adminDelete(req, res, next) {
  try {
    const t = typeOr404(req, res); if (!t) return;
    const item = await t.Model.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: `${t.label} not found` });
    if (t.idField !== "_id") {
      const type = { destinations: "destination", packages: "package", hotels: "hotel" }[req.params.type];
      if (await Booking.exists({ itemType: type, itemId: item[t.idField] })) {
        return res.status(409).json({ success: false, message: `${t.label} has bookings, so it can't be deleted. Deactivate it instead to hide it from the website.` });
      }
      if (req.params.type === "destinations" && (await Package.exists({ destination: item.slug }))) {
        return res.status(409).json({ success: false, message: "Packages still use this destination. Delete or move them first, or deactivate the destination." });
      }
      if (req.params.type === "destinations" && (await Hotel.exists({ city: item.name }))) {
        return res.status(409).json({ success: false, message: "Hotels still use this destination. Delete or move them first, or deactivate the destination." });
      }
    }
    await item.deleteOne();
    res.json({ success: true, message: `${t.label} deleted` });
  } catch (err) { next(err); }
}

module.exports = { publicCatalog, adminList, adminCreate, adminUpdate, adminFlags, adminReorder, adminDelete };
