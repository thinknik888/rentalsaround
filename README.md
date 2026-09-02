# RentalsAround.ca

Builder-owned purpose-built rentals across Toronto & the GTA.

- 8 static pages: homepage + 7 communities
- 164 floor plans with sizes and starting prices (Fitzrovia price list, July 2026)
- 162 floor plan drawings, 358 building photos
- Showing requests write to Supabase `rent_bookings`, which copies them into the CRM `leads` table

## Updating prices

1. Edit `data/fitzrovia-floorplans.json`
2. `node build/generate.mjs`
3. Commit and push — the site redeploys itself
