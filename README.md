# Northgate Logistics (fictional demo site)

B2B freight, warehousing and cold chain logistics near Harlow. Part of the Polar Chat Agent demo. Not a real business.

```sh
npm install
npm run dev     # http://localhost:4321
npm run build
```

## Where things live
- **Copy:** `src/content/` (JSON, validated by `src/content.config.ts`).
  - `site/site.json`: name, nav, phone, email, depots.
  - `pages/*.json`: page copy for Home, Services, Sectors, About, Contact.
  - `services/*.json`, `sectors/*.json`: one file per service or sector, sorted by `order`.
  - `campaigns/*.json`: one file per landing page. The file name is the URL: `cold-chain.json` becomes `/campaigns/cold-chain`.
- **Colours, fonts, spacing:** `src/styles/tokens.css` only (protected).
- **Legal footer:** `src/components/LegalFooter.astro` (protected). Rendered by the layout on every page.
- **Images:** `public/images/`. Leave `src` out of an image and a placeholder is shown; `alt` is always required.

Noindexed three ways: robots meta, `public/robots.txt`, and an `X-Robots-Tag` header in `vercel.json`.
