# IntelliCoin

Professional crypto futures signal intelligence platform.

## Environment variables — add to Vercel

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_GROUP_CHAT_ID=
NEXT_PUBLIC_APP_URL=
GITHUB_PAT=          ← Personal access token for manual scan trigger
GITHUB_OWNER=        ← Your GitHub username
GITHUB_REPO=intellicoin
```

## GitHub Secrets — add to repo

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

## Manual scan trigger setup

To enable the "Run scan now" button in the admin panel:

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Create token with "Actions: Read and write" permission on your intellicoin repo
3. Add it as GITHUB_PAT in Vercel environment variables
4. Add your GitHub username as GITHUB_OWNER in Vercel environment variables
