UKIYO TRAVEL ULTIMATE
======================

Files:
- index.html
- style.css

Theme:
- Midnight Navy
- Electric Teal
- Sunset Coral
- Warm Cream
- Golden Amber

Unique features:
1. Find Your Ukiyo / MoodTrip
2. Travel DNA
3. Regret-Free Trip
4. Smart Trip Planner
5. Wishlist
6. Destination Match Scores
7. Ukiyo Assistant chatbox
8. Destinations, packages, hotels, gallery, testimonials and contact

Technology:
- HTML5
- CSS3
- Bootstrap 5
- Bootstrap Icons
- Small vanilla JavaScript for the Trip Planner and Wishlist interactions

Images are loaded from Unsplash URLs, so no images folder is required.
Open index.html in a browser.


Brand tagline added:
“A journey through the beautiful moments of life.”

The tagline is placed in the hero section with a premium italic treatment and a teal/golden accent.


Latest update: compact vertical spacing across all sections and feature blocks for a tighter, cleaner single-page layout.

Authentication pages added:
- login.html
- register.html
- auth.css

The pages include responsive UI, password visibility toggle, basic frontend validation,
password strength feedback, terms checkbox, and navigation between login/register/home.
These are frontend demo pages; real authentication/database storage requires a backend such as Django.

Logo update:
- Added generated Ukiyo Travel logo at assets/ukiyo-travel-logo.png
- Integrated the logo into the main navbar, Login page and Registration page.

Latest update: navbar changed to a soft ivory/white premium theme with deep navy text and teal hover accents.

Latest fix: restored original logo colors and removed screen blending/filtering from the light navbar.

Latest navbar update:
- Increased desktop navbar height to 100px.
- Increased logo size while preserving original logo colors.
- Increased navigation font sizes.
- Added a transparent/soft white glass effect that becomes visibly blurred after scrolling.
- Added smooth scroll-state transition.

Latest update:
- Hero statistics area restyled to match the uploaded reference: large white rounded floating card, teal metrics, grey labels, compact overlap below the hero.

Latest spacing update:
- Added breathing room below the Explore Tours and Learn More buttons.
- Added separation before the white floating stats box.
- Increased bottom padding of the teal/blue hero area so the transition feels intentional.

Navbar matched to the supplied reference: logo left, navigation right, same logo and all other content preserved.

Final navbar alignment fix:
Desktop navbar is forced into one row. Logo remains on the left and Home,
Explore, Smart Travel, Contact and Login remain on the right. No logo artwork
or other page sections were changed.

IMPORTANT FINAL FIX:
The navbar wrapper had malformed HTML (`class="hero-buttons class="container"`),
which prevented the desktop flex layout from working. It has been corrected to
the original `<div class="container">`. No logo, hero, stats, buttons, or other
website content was changed.

Stats card updated from plain white to a soft teal/blue premium gradient.


Date rule update:
Every date/calendar field (js/auth-api.js, loaded on all pages) only allows today or a future date. Today is read from the device clock automatically (never hardcoded). Past dates are greyed out/disabled in the calendar; a typed/pasted past date is cleared and shows "Please select today or a future date."; forms cannot be submitted with a past date. The server (bookingController.js) re-checks this too. Any new <input type="date"> added to the site is covered automatically.


Payment flow update:
Book this trip / Book now / Book stay -> booking modal (date, travellers, notes) -> Confirm booking -> Payment modal
(trip, travel date, travellers, price per person, total; UPI / Card / Net Banking) -> Pay Now -> Processing -> Success or Failed.
- Confirm booking only saves the booking as "pending". It becomes "confirmed" (with a reference like UKY-2026-A82F9) only after a successful payment.
- Failed payment: "Payment Failed. Please try again." (booking stays pending; retry or pay later from My Trips).
- Same flow for packages, destinations and hotels.
- Without Razorpay keys the built-in TEST gateway is used (no real money). Test failures: UPI ID containing "fail", or card 4000 0000 0000 0002. Success: any other valid UPI ID, a valid card such as 4242 4242 4242 4242, any bank.
- With RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET set in server/.env the same screen hands off to Razorpay.
