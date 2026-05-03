# CDAP project website (25-26J-458)

Static HTML, CSS, and JavaScript for the **Adaptive Cognitive-Load Study Timer** public site, aligned with the SLIIT CDAP “Planning Your Website” handout (`Website.pdf` in the repo root). Visual design follows the reference in `website design/` (navy / blue / cyan / violet), implemented without a build step in this folder.

## View locally

1. Open `index.html` in your browser, or use a local server, e.g.  
   `cd "25-26J-458-Students/7. Website"`  
   `python -m http.server 8080`  
   then visit `http://localhost:8080/`.

Point document and presentation download links at the files you ship (e.g. under `assets/downloads/`) so downloads work from the deployed zip.

## Design and interactions

- Sticky header, responsive nav, three-column footer  
- Scroll reveal, stat count-up where used, `prefers-reduced-motion` respected  
- Documents: search and type filters  
- Milestones: timeline plus quick-lookup panel from JSON  
- Contact: in-page message acknowledgement; `mailto:` composer for real email  
- Section images: Unsplash URLs (online only)

## Files

- `index.html` … `contact.html` — main pages  
- `css/main.css` — layout and theme  
- `js/main.js` — navigation, filters, FAQ, forms, milestone panel  
- `assets/members/` — team photos  
- `assets/ui/` — UI screenshots (optional)

## Technology

Per faculty notice: **HTML, CSS** (and minimal JS). Static upload; no WordPress or server required.
