# SEO + Trust deployment notes

## SEO is **not** maximized yet

Treat as unverified until tested on production host:

- [ ] Root `robots.txt` live on secure.imagineqira.com  
- [ ] Sitemap index + child sitemaps  
- [ ] Google Search Console property + sitemap submit  
- [ ] Bing Webmaster Tools  
- [ ] IndexNow key file + deploy hook  
- [ ] Canonical URLs (no competing hash-route marketing links)  
- [ ] Structured data validation  
- [ ] Coverage for intent pages  

Source files ready to deploy: `public-site/` in this repo.

## Critical correction

Do **not** use hash routes as primary public product URLs:

```text
BAD:  https://theartofsound.github.io/qev-desktop/#/tool
GOOD: https://secure.imagineqira.com/tools/envelope/
GOOD: https://secure.imagineqira.com/vault
```

## Deploy checklist

1. Copy `public-site/*` to the edge/static host for `secure.imagineqira.com`  
2. Generate IndexNow key → place `<key>.txt` at site root  
3. Wire `scripts/indexnow-submit.mjs` into CI on publish  
4. Submit sitemaps in GSC + Bing  
5. Keep `/app/`, `/admin/`, `/api/`, `/v1/` disallowed in robots **and** authenticated  

## Trust badges (issuable now)

| Level | Issuable? |
|---|---|
| QEV Compatible | Yes (interop tests) |
| Pilot Configuration Passed | Yes (internal / pilot gateway) |
| Verified / Protected / Independently Assessed | **No** until platform + process |

Gateway pilot API:

```bash
curl -X POST http://127.0.0.1:7443/v1/trust/issue-pilot \
  -H "authorization: Bearer dev-ingest-token-change-me" \
  -H "content-type: application/json" \
  -d '{"legal_name":"Pilot Co","domain":"localhost","level":"qev_pilot_configuration_passed"}'
```

Package seal certificates are written to `data/packages/certificates/` on each seal.
