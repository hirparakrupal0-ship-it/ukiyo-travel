/* Catalog service: destinations / packages / hotels live in MongoDB so the admin can manage them.
   On first start EMPTY collections are seeded from seed/catalog.seed.json. */
const fs = require("fs");
const path = require("path");
const Destination = require("../models/Destination");
const Package = require("../models/Package");
const Hotel = require("../models/Hotel");

/** Starting catalog (self-contained in the backend; regenerate with `npm run seed:export` from user-panel/js/data.js). */
function readStaticCatalog() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "seed", "catalog.seed.json"), "utf8"));
}

/** Seeds only empty collections; never overwrites admin edits. Returns counts inserted. */
async function ensureSeeded() {
  const inserted = { destinations: 0, packages: 0, hotels: 0 };
  let data;
  try { data = readStaticCatalog(); } catch (e) { console.warn("Catalog seed skipped:", e.message); return inserted; }

  if ((await Destination.estimatedDocumentCount()) === 0) {
    const docs = data.destinations.map((d, i) => ({ ...d, priority: (i + 1) * 10 }));
    inserted.destinations = (await Destination.insertMany(docs)).length;
  }
  if ((await Package.estimatedDocumentCount()) === 0) {
    const docs = data.packages.map((p, i) => ({ ...p, priority: (i + 1) * 10 }));
    inserted.packages = (await Package.insertMany(docs)).length;
  }
  if ((await Hotel.estimatedDocumentCount()) === 0) {
    const docs = data.hotels.map((h, i) => ({ ...h, priority: (i + 1) * 10 }));
    inserted.hotels = (await Hotel.insertMany(docs)).length;
  }
  return inserted;
}

async function loadMaps() {
  const [destinations, packages, hotels] = await Promise.all([
    Destination.find().lean(), Package.find().lean(), Hotel.find().lean(),
  ]);
  const destBySlug = new Map(destinations.map((d) => [d.slug, d]));
  const destByName = new Map(destinations.map((d) => [d.name.toLowerCase(), d]));
  const pkgById = new Map(packages.map((p) => [p.id, p]));
  const hotelById = new Map(hotels.map((h) => [h.id, h]));
  return { destinations, packages, hotels, destBySlug, destByName, pkgById, hotelById };
}

/** Find the catalog record behind a booking/review (itemType + itemId). */
function findItem(maps, itemType, itemId) {
  if (itemType === "destination") return maps.destBySlug.get(String(itemId).toLowerCase()) || null;
  if (itemType === "package") return maps.pkgById.get(String(itemId).toLowerCase()) || null;
  if (itemType === "hotel") return maps.hotelById.get(String(itemId).toLowerCase()) || null;
  return null;
}

/** Which destination does this booking belong to? -> { slug, name } */
function destinationOf(maps, itemType, itemId, fallbackTitle = "") {
  const item = findItem(maps, itemType, itemId);
  let dest = null;
  if (itemType === "destination") dest = item;
  else if (itemType === "package" && item) dest = maps.destBySlug.get(item.destination);
  else if (itemType === "hotel" && item) dest = maps.destByName.get(String(item.city).toLowerCase());
  if (dest) return { slug: dest.slug, name: dest.name };
  return { slug: "", name: fallbackTitle ? String(fallbackTitle).split("·").pop().trim() : "" };
}

/** Booking document -> destination, preferring the value stored at booking time. */
function bookingDestination(maps, b) {
  if (b.destinationName) return { slug: b.destinationSlug || "", name: b.destinationName };
  return destinationOf(maps, b.itemType, b.itemId, b.title);
}

module.exports = { ensureSeeded, loadMaps, findItem, destinationOf, bookingDestination, readStaticCatalog };
