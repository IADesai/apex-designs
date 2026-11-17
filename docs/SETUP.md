# Apex Designs: setup guide

Everything you need to take the new site live, connect the mini-CRM, and keep your Hostinger email working. Do the steps in order. Steps 2 to 5 are only needed for the CRM; the site works without them (tracking switches off and the quote form falls back to opening an email).

## 1. Contact details

Edit `src/config/site.ts`:

- `email`: your Hostinger mailbox, e.g. `info@apexdesigns.org.uk`
- `whatsapp`: your number in international format, digits only, e.g. `447912345678`

The build prints a warning until the WhatsApp placeholder is replaced.

## 2. Supabase project

1. Create a free project at [supabase.com](https://supabase.com). Region: **London (eu-west-2)**.
2. Project Settings → API: copy the **Project URL** and the **anon** (or **publishable**) key.
3. Copy `.env.example` to `.env` and paste both values in. Both are safe to expose publicly; the database rules protect your data.

## 3. Database

Either paste the two files below into **SQL Editor** (in this order) and run them:

1. `supabase/migrations/20261027000000_crm.sql`
2. `supabase/migrations/20261027000100_retention.sql`

…or use the CLI:

```bash
npx supabase@latest login
npx supabase@latest init
npx supabase@latest link --project-ref YOUR-PROJECT-REF
npx supabase@latest db push
```

Then paste `supabase/tests/rls_test.sql` into the SQL Editor and run it. You should see the notice **`RLS OK`**. It rolls back, so it leaves no data behind. If you see a `FAIL:` message instead, stop and fix that before going further.

## 4. Admin login

1. Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".
2. Authentication → URL Configuration:
   - Site URL: `https://apexdesigns.org.uk`
   - Redirect URLs: `https://apexdesigns.org.uk/admin/` and `http://localhost:4321/admin/`
3. Authentication → Users → **Invite user** → your email.
4. SQL Editor (lowercase email):
   ```sql
   insert into public.admins (email) values ('you@yourdomain');
   ```
5. Optional but recommended: Authentication → SMTP Settings → use Hostinger (`smtp.hostinger.com`, port `465`, your mailbox and password). Sign-in emails then come from your domain, and you avoid Supabase's low default email rate limit.

## 5. Lead notification function

```bash
npx supabase@latest secrets set SMTP_USER=you@yourdomain SMTP_PASS='your-mailbox-password' NOTIFY_TO=you@yourdomain ALLOWED_ORIGINS=https://apexdesigns.org.uk,https://www.apexdesigns.org.uk,http://localhost:4321
npx supabase@latest functions deploy submit-lead --no-verify-jwt
```

Test it:

```bash
curl -i -X POST "https://YOUR-PROJECT-REF.supabase.co/functions/v1/submit-lead" \
  -H "Content-Type: application/json" -H "Origin: http://localhost:4321" \
  -d '{"name":"Setup Test","email":"you@yourdomain","message":"Testing the lead function","elapsed":5000}'
```

Expected: `200 {"ok":true}`, a new row in the `leads` table, and an email in your Hostinger inbox. If the row appears but no email arrives, check the function logs (Edge Functions → submit-lead → Logs) for an SMTP error.

Delete the test lead afterwards:

```sql
delete from public.leads where name = 'Setup Test';
```

## 6. GitHub Pages

1. Create a GitHub repository and push this project's `main` branch.
2. Settings → Pages → Source: **GitHub Actions**.
3. Settings → Secrets and variables → Actions → **Variables** tab → add `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.
4. Settings → Pages → Custom domain: `apexdesigns.org.uk`.
5. Recommended: verify the domain under your GitHub account (your profile Settings → Pages → Verified domains). This stops anyone else claiming it.

Every push to `main` now runs the tests, builds the site and deploys it.

## 7. Hostinger DNS (keeps your email working)

In hPanel → Domains → **DNS / Nameservers**:

1. **Delete** the existing `A` record(s) (and any `AAAA`) for `@` that point to Hostinger web hosting.
2. **Add** four `A` records for `@`:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
3. Optional `AAAA` records for `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
4. Set the `CNAME` for `www` → `YOUR-GITHUB-USERNAME.github.io`.
5. **Do not touch** the `MX` records, the `TXT` records for SPF / DKIM / DMARC, or any mail-related `CNAME`s (`autodiscover`, `autoconfig`, `mail`, etc.). These are what keep your Hostinger email working.
6. Once DNS has updated (minutes to a few hours), tick **Enforce HTTPS** in GitHub → Settings → Pages.

**Before cancelling any Hostinger plan:** check whether your email is bundled with the web hosting plan. If it is, keep the plan, or move to a standalone Hostinger email plan first, otherwise your mailboxes will stop working. Keep `public_html.zip` as your WordPress backup.

## 8. After launch

- Add the site to [Google Search Console](https://search.google.com/search-console) as a **Domain** property and submit `https://apexdesigns.org.uk/sitemap-index.xml`.
- After a week or two, check Pages → "Not found (404)". Any old WordPress URLs that show up can be redirected by adding them to `redirects` in `astro.config.mjs`.
- Update your Google Business Profile's website link if it changed.

## 9. Using the CRM

1. Open `https://apexdesigns.org.uk/admin/` and sign in with the emailed link.
2. **Tracked links** → create one per place you post, e.g. label "Romford Traders WhatsApp". The slug fills itself in.
3. Click **Copy WhatsApp message** and paste it into the group.
4. Visits through that link are counted (anonymously if people decline cookies). If someone accepts analytics and later sends a quote request, their lead shows the full journey: which link they came from and which pages they read.
5. In **Leads**, set each lead's status (new → warm → quoted → won/lost) and keep notes.

## 10. Client change requests

Clients describe a change to a chat assistant (typing or talking), you approve it, and the dashboard writes the prompt for Claude.

One-off setup:

1. Run `supabase/migrations/20261117000000_change_requests.sql` in the SQL Editor (or `npx supabase@latest db push`).
2. Deploy the portal function. It uses the same secrets as `submit-lead`:
   ```bash
   npx supabase@latest functions deploy client-portal --no-verify-jwt
   ```

Day to day:

1. **Clients** → add the client. "Project notes for Claude" is where the repo, stack and brand rules go; it is added to every prompt for that client.
2. **Copy message for client** and send it to them privately. The link is their key: anyone holding it can send requests as that client. **Turn link off** stops it working.
3. The client opens the link and tells the assistant what they want. It asks where, what exactly and how soon, then sends it. You get an email.
4. **Change requests** → open the request. Add a reply (the client sees it on their portal) or private notes, then **Approve** or **Decline**.
5. Once approved, **Copy prompt for Claude** and paste it into Claude Code in that client's project. **Open in Claude** opens claude.ai with the prompt filled in instead.
6. Mark it **In progress**, then **Done**. The client sees each step.

The assistant is scripted, so it costs nothing to run. Voice uses the speech features built into the client's browser (Chrome, Edge and Safari); browsers without them just get the typing box.

## 11. Data protection (ICO)

- **Register with the ICO** if you have not already: most businesses that handle personal data must pay the data protection fee. Check and pay at [ico.org.uk/for-organisations/data-protection-fee](https://ico.org.uk/for-organisations/data-protection-fee/).
- Put your registration reference in `icoNumber` in `src/config/site.ts`. It then appears in the footer and privacy policy. Leave it empty until you have one; the site never shows a made-up number.
- Read `/privacy/` once and check it matches what you really do, especially the list of providers and the retention periods.
- If a client or visitor asks for their data or for it to be deleted, you have one month to respond. Leads and change requests can be deleted from the Supabase table editor; deleting a client removes their requests too.

## 12. Google reviews

The Google Business Profile ID lives in `google` in `src/config/site.ts`. The home page, hero and footer link to the profile, and the business schema lists it. The quotes on the site are in `src/data/reviews.ts`: copy new ones from the profile word for word when you want to show them.
