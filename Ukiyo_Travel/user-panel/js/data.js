/* =========================================================
   Ukiyo Travel — catalog data (destinations, packages, hotels)
   Shared by the homepage modals and booking flow.
========================================================= */
window.UkiyoData = (function () {
  const destinations = [
    {
      slug: "goa",
      name: "Goa",
      image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=85",
      short: "Beaches, nightlife and luxury resorts.",
      description:
        "Sun-soaked beaches, buzzing nightlife and laid-back cafés — Goa blends Portuguese charm with tropical energy. Perfect for beach lovers and party-seekers alike.",
      highlights: ["Baga & Palolem beaches", "Water sports", "Beach shacks & nightlife", "Old Goa churches"],
      bestTime: "Nov – Feb",
      priceFrom: "₹9,999",
    },
    {
      slug: "kashmir",
      name: "Kashmir",
      image: "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=900&q=85",
      short: "Heaven on earth with snowy mountains.",
      description:
        "Snow-capped peaks, shimmering Dal Lake and blooming valleys make Kashmir a dream for romance and scenery. Shikara rides, houseboats and gardens await.",
      highlights: ["Dal Lake & houseboats", "Gulmarg gondola", "Mughal gardens", "Snow in winter"],
      bestTime: "Mar – Oct",
      priceFrom: "₹14,999",
    },
    {
      slug: "kerala",
      name: "Kerala",
      image: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=900&q=85",
      short: "Backwaters, greenery and peaceful nature.",
      description:
        "God's Own Country — tranquil backwaters, lush tea hills and Ayurvedic calm. Cruise a houseboat, sip fresh chai in Munnar and unwind by the coast.",
      highlights: ["Alleppey backwaters", "Munnar tea gardens", "Ayurveda retreats", "Kathakali culture"],
      bestTime: "Sep – Mar",
      priceFrom: "₹11,999",
    },
    {
      slug: "rajasthan",
      name: "Rajasthan",
      image: "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=900&q=85",
      short: "Royal forts, palaces and desert culture.",
      description:
        "Majestic forts, palace hotels and golden dunes. Rajasthan is heritage and luxury — from Udaipur's lakes to Jaisalmer's desert camps.",
      highlights: ["Udaipur lake palaces", "Jaisalmer desert safari", "Amber Fort", "Royal dining"],
      bestTime: "Oct – Mar",
      priceFrom: "₹16,499",
    },
    {
      slug: "meghalaya",
      name: "Meghalaya",
      image: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=900&q=85",
      short: "Waterfalls, living-root bridges and clouds.",
      description:
        "The abode of clouds — living-root bridges, crystal rivers and endless waterfalls. Cherrapunji and Dawki offer nature at its purest.",
      highlights: ["Living-root bridges", "Dawki clear river", "Nohkalikai Falls", "Cave exploring"],
      bestTime: "Oct – Apr",
      priceFrom: "₹13,499",
    },
    {
      slug: "andaman",
      name: "Andaman",
      image: "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?auto=format&fit=crop&w=900&q=85",
      short: "Turquoise waters and coral reefs.",
      description:
        "Powder-white sands, coral reefs and scuba adventures. Radhanagar Beach is among the world's finest — pure island escape.",
      highlights: ["Radhanagar Beach", "Scuba & snorkelling", "Cellular Jail", "Island hopping"],
      bestTime: "Oct – May",
      priceFrom: "₹22,999",
    },
  ];

  const packages = [
    { id: "goa-escape", title: "Goa Escape", destination: "goa", price: "₹9,999", duration: "4 Days / 3 Nights",
      image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=85",
      includes: ["Return transfers", "3-star beach stay", "Daily breakfast", "Sightseeing tour"] },
    { id: "kashmir-tour", title: "Kashmir Tour", destination: "kashmir", price: "₹14,999", duration: "5 Days / 4 Nights",
      image: "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=900&q=85",
      includes: ["Houseboat night", "Gulmarg day trip", "Breakfast & dinner", "Shikara ride"] },
    { id: "kerala-holiday", title: "Kerala Holiday", destination: "kerala", price: "₹11,999", duration: "4 Days / 3 Nights",
      image: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=900&q=85",
      includes: ["Alleppey houseboat", "Munnar stay", "All breakfasts", "Backwater cruise"] },
  ];

  const hotels = [
    { id: "taj-goa", name: "Taj Beach Resort", city: "Goa", rating: 4.8, price: "₹6,500", perNight: true,
      image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=85",
      tags: ["Beachfront", "Pool", "Breakfast"] },
    { id: "dal-view", name: "Dal View Houseboat", city: "Kashmir", rating: 4.7, price: "₹4,200", perNight: true,
      image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=85",
      tags: ["Lake view", "Traditional", "All meals"] },
    { id: "backwater-villa", name: "Backwater Villa", city: "Kerala", rating: 4.9, price: "₹5,100", perNight: true,
      image: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=800&q=85",
      tags: ["Backwaters", "Ayurveda", "Free WiFi"] },
    { id: "royal-heritage", name: "Royal Heritage Palace", city: "Rajasthan", rating: 4.8, price: "₹8,900", perNight: true,
      image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=85",
      tags: ["Heritage", "Fine dining", "Spa"] },
    { id: "cloud-retreat", name: "Cloud Retreat", city: "Meghalaya", rating: 4.6, price: "₹3,800", perNight: true,
      image: "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=800&q=85",
      tags: ["Hilltop", "Nature", "Breakfast"] },
    { id: "island-sands", name: "Island Sands Resort", city: "Andaman", rating: 4.9, price: "₹9,500", perNight: true,
      image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=85",
      tags: ["Sea view", "Diving", "Pool"] },
  ];

  // ---- Scoring attributes (0–100) used by the Smart Destination engine ----
  // Dimensions: peace, adventure, romance, fun, nature, luxury, budget,
  //             uncrowded, weather (reliability), food, stay (accommodation)
  const attributes = {
    goa:       { peace:45, adventure:60, romance:65, fun:95, nature:55, luxury:70, budget:75, uncrowded:30, weather:70, food:85, stay:85 },
    kashmir:   { peace:80, adventure:75, romance:90, fun:40, nature:90, luxury:65, budget:55, uncrowded:65, weather:60, food:70, stay:75 },
    kerala:    { peace:95, adventure:45, romance:80, fun:45, nature:92, luxury:70, budget:70, uncrowded:75, weather:75, food:85, stay:85 },
    rajasthan: { peace:50, adventure:60, romance:75, fun:65, nature:35, luxury:95, budget:60, uncrowded:55, weather:65, food:90, stay:90 },
    meghalaya: { peace:88, adventure:80, romance:60, fun:40, nature:98, luxury:45, budget:65, uncrowded:85, weather:55, food:60, stay:65 },
    andaman:   { peace:85, adventure:85, romance:85, fun:70, nature:88, luxury:80, budget:40, uncrowded:70, weather:75, food:70, stay:80 },
  };

  // ---- Day-wise itinerary catalog (activity pool per destination) ----
  const itineraries = {
    goa: [
      { title: "Arrival & North Goa beaches", morning: "Arrive, check in and freshen up", afternoon: "Relax at Baga & Calangute beach", evening: "Beach shacks and sunset at Anjuna" },
      { title: "Water sports & Fort", morning: "Parasailing and jet-ski at Candolim", afternoon: "Explore Aguada Fort", evening: "Live music at a beach club" },
      { title: "Old Goa & spice trail", morning: "Basilica of Bom Jesus & Se Cathedral", afternoon: "Spice plantation tour with lunch", evening: "Mandovi river sunset cruise" },
      { title: "South Goa serenity", morning: "Drive to Palolem beach", afternoon: "Kayaking and quiet swimming", evening: "Seafood dinner by the shore" },
      { title: "Markets & leisure", morning: "Anjuna flea market shopping", afternoon: "Café hopping in Assagao", evening: "Casino or night market" },
      { title: "Dudhsagar day trip", morning: "Drive to Dudhsagar waterfalls", afternoon: "Jeep safari & swim", evening: "Return and relax" },
      { title: "Departure", morning: "Last-minute shopping", afternoon: "Check out & transfer", evening: "Departure" },
    ],
    kashmir: [
      { title: "Arrival in Srinagar", morning: "Arrive & houseboat check-in", afternoon: "Shikara ride on Dal Lake", evening: "Floating market & dinner" },
      { title: "Gulmarg", morning: "Drive to Gulmarg", afternoon: "Gondola ride to Apharwat peak", evening: "Return to Srinagar" },
      { title: "Pahalgam valley", morning: "Scenic drive to Pahalgam", afternoon: "Betaab & Aru valley", evening: "Riverside leisure" },
      { title: "Mughal gardens", morning: "Nishat & Shalimar Bagh", afternoon: "Local handicraft shopping", evening: "Sunset by the lake" },
      { title: "Sonamarg", morning: "Drive to Sonamarg", afternoon: "Thajiwas glacier pony ride", evening: "Return & rest" },
      { title: "Doodhpathri", morning: "Day trip to Doodhpathri meadows", afternoon: "Picnic and nature walk", evening: "Farewell Kashmiri dinner" },
      { title: "Departure", morning: "Leisure & packing", afternoon: "Transfer to airport", evening: "Departure" },
    ],
    kerala: [
      { title: "Arrival in Kochi", morning: "Arrive & check in", afternoon: "Fort Kochi & Chinese fishing nets", evening: "Kathakali performance" },
      { title: "Munnar hills", morning: "Drive to Munnar", afternoon: "Tea gardens & museum", evening: "Hill-view stay" },
      { title: "Munnar nature", morning: "Eravikulam National Park", afternoon: "Mattupetty dam & echo point", evening: "Bonfire evening" },
      { title: "Thekkady", morning: "Drive to Thekkady", afternoon: "Periyar wildlife boat safari", evening: "Spice market walk" },
      { title: "Alleppey houseboat", morning: "Drive to Alleppey", afternoon: "Board houseboat, cruise backwaters", evening: "Onboard dinner & stay" },
      { title: "Backwater villages", morning: "Village canoe tour", afternoon: "Ayurvedic massage", evening: "Beachside leisure" },
      { title: "Departure", morning: "Cruise back & check out", afternoon: "Transfer to airport", evening: "Departure" },
    ],
    rajasthan: [
      { title: "Arrival in Jaipur", morning: "Arrive & check in", afternoon: "City Palace & Jantar Mantar", evening: "Chokhi Dhani cultural dinner" },
      { title: "Jaipur forts", morning: "Amber Fort with elephant ride", afternoon: "Jal Mahal & Hawa Mahal", evening: "Bazaar shopping" },
      { title: "To Jodhpur", morning: "Drive to the Blue City", afternoon: "Mehrangarh Fort", evening: "Old city walk" },
      { title: "Udaipur lakes", morning: "Drive to Udaipur", afternoon: "Lake Pichola boat ride", evening: "City Palace sound & light show" },
      { title: "Udaipur heritage", morning: "Saheliyon ki Bari & Jagdish temple", afternoon: "Vintage car museum", evening: "Rooftop fine dining" },
      { title: "Desert experience", morning: "Drive toward the dunes", afternoon: "Camel safari at sunset", evening: "Desert camp with folk music" },
      { title: "Departure", morning: "Handicraft shopping", afternoon: "Transfer to airport", evening: "Departure" },
    ],
    meghalaya: [
      { title: "Arrival in Shillong", morning: "Arrive & check in", afternoon: "Ward's Lake & Police Bazaar", evening: "Café evening" },
      { title: "Cherrapunji", morning: "Drive to Cherrapunji", afternoon: "Nohkalikai Falls & Mawsmai caves", evening: "Viewpoint sunset" },
      { title: "Living-root bridges", morning: "Trek to double-decker root bridge", afternoon: "Natural pools swim", evening: "Rest & recover" },
      { title: "Dawki & Mawlynnong", morning: "Drive to Dawki", afternoon: "Boat on crystal Umngot river", evening: "Asia's cleanest village walk" },
      { title: "Laitlum canyons", morning: "Laitlum grand canyon views", afternoon: "Local village experience", evening: "Return to Shillong" },
      { title: "Elephant Falls & leisure", morning: "Elephant Falls & Shillong peak", afternoon: "Shopping for local crafts", evening: "Farewell dinner" },
      { title: "Departure", morning: "Leisure", afternoon: "Transfer to Guwahati", evening: "Departure" },
    ],
    andaman: [
      { title: "Arrival in Port Blair", morning: "Arrive & check in", afternoon: "Corbyn's Cove beach", evening: "Cellular Jail light & sound show" },
      { title: "Havelock Island", morning: "Ferry to Havelock", afternoon: "Radhanagar beach sunset", evening: "Beachside dinner" },
      { title: "Scuba & snorkelling", morning: "Scuba diving at Elephant beach", afternoon: "Snorkelling & sea walk", evening: "Leisure" },
      { title: "Neil Island", morning: "Ferry to Neil Island", afternoon: "Natural bridge & Bharatpur beach", evening: "Sunset point" },
      { title: "Ross & North Bay", morning: "Ross Island heritage walk", afternoon: "North Bay glass-bottom boat", evening: "Return to Port Blair" },
      { title: "Baratang day trip", morning: "Limestone caves at Baratang", afternoon: "Mangrove creek boat", evening: "Rest" },
      { title: "Departure", morning: "Souvenir shopping", afternoon: "Transfer to airport", evening: "Departure" },
    ],
  };

  // Build an N-day plan; reuses the pool and inserts leisure days if N is large.
  function itineraryFor(slug, days) {
    const pool = itineraries[slug] || itineraries.goa;
    const plan = [];
    const arrival = pool[0];
    const departure = pool[pool.length - 1];
    const middle = pool.slice(1, -1);
    if (days <= 1) return [arrival];
    plan.push(arrival);
    const need = days - 2; // between arrival and departure
    for (let i = 0; i < need; i++) {
      if (i < middle.length) plan.push(middle[i]);
      else plan.push({ title: "Leisure & local exploring", morning: "Free morning at your pace", afternoon: "Optional local activity or shopping", evening: "Relax and unwind" });
    }
    plan.push(departure);
    return plan;
  }

  const bySlug = (slug) => destinations.find((d) => d.slug === slug) || null;
  const packageById = (id) => packages.find((p) => p.id === id) || null;
  const hotelById = (id) => hotels.find((h) => h.id === id) || null;
  const attrBySlug = (slug) => attributes[slug] || null;

  return { destinations, packages, hotels, attributes, itineraries, bySlug, packageById, hotelById, attrBySlug, itineraryFor };
})();
