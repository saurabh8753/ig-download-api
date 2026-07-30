# ig-download-api

Instagram Story + Post/Reel download API — Cloudflare Worker, auto-deployed via GitHub Actions.

## Routes

- `GET /story?username=someuser`
- `GET /post?url=https://www.instagram.com/p/XXXXXXX/`

Session cookie na ho toh `/post` automatically no-login embed-scrape fallback use karta hai.
`/story` ke liye session cookie zaroori hai (Instagram bina login stories expose nahi karta).

## GitHub se connect karke deploy karna

### 1. Repo banao aur push karo

```bash
cd ig-download-api
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/saurabh8753/ig-download-api.git
git push -u origin main
```

### 2. Cloudflare API token banao

1. https://dash.cloudflare.com/profile/api-tokens pe jao
2. "Create Token" -> "Edit Cloudflare Workers" template use karo
3. Token copy kar lo (ek hi baar dikhega)

### 3. Cloudflare Account ID lo

Cloudflare dashboard -> right sidebar me "Account ID" mil jaayega.

### 4. GitHub repo me secrets add karo

Repo -> Settings -> Secrets and variables -> Actions -> "New repository secret":

| Secret name | Value |
|---|---|
| `CF_API_TOKEN` | Step 2 ka token |
| `CF_ACCOUNT_ID` | Step 3 ka account ID |
| `IG_SESSION_COOKIE` | `sessionid=XXXX; csrftoken=XXXX` (optional, story API ke liye chahiye) |

### 5. Deploy trigger

Ab jab bhi `main` branch pe push karoge, GitHub Actions automatically Cloudflare pe deploy kar dega.
Pehli baar manually bhi trigger kar sakte ho: repo -> Actions tab -> "Deploy Worker" -> "Run workflow".

### 6. Local testing (optional)

```bash
npm install -g wrangler
wrangler dev
```

## Notes

- Production ban-prevention strategy (caching, session rotation, rate-limit) alag se implement karo — ye base API hai.
- Multiple mirror accounts chahiye toh alag `IG_SESSION_COOKIE_1`, `IG_SESSION_COOKIE_2` secrets add karke code me pool-selection logic add kar sakte ho.
