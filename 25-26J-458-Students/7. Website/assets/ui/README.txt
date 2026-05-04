UI screenshots for the CDAP website
=====================================

The PNG files in this folder are **schematic placeholders** generated for the
public website. Replace them with real application screenshots for assessment.

Suggested capture (locally, 1280x720 or 1920x1080, same aspect for all four):

1. cle-dashboard.png
   - cd praboth/frontend
   - npm install && npm run dev
   - Open http://localhost:3000 (or the port shown) — home view with CLE / SSE.
2. scheduler-dashboard.png
   - Open older/static/dashboard.html or the integrated flow from the project README.
3. yuvidu-heatmap.png
   - cd yuvidu/frontend && npm install && npm run dev
   - Capture weekly / intensity view.
4. intentlock-modal.png
   - cd newer/andrew/intentlock-frontend && npm install && npm run dev
   - Trigger IntentLockModal if applicable.

Use the same filenames so index.html does not need edits.

If you add real PNGs, run an image optimiser to stay under the 20 MB site upload
limit (faculty CDAP web disk quota).
