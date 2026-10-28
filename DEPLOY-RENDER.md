# Publish Pals Party on Render

Prepared October 28, 2026. Selected plan: Free, for testing (sleeps when idle).

## Exact setup steps

1. Create an empty private GitHub repository named `pals-party`. If GitHub offers initial files, leave them unselected.
2. Upload the contents of this game-room folder into the repository root, keeping filenames unchanged. In GitHub, choose Add file > Upload files, drag in the files, and commit. Do not upload the parent Codex folder or work/ folder. Ensure server.mjs, index.html, package.json and render.yaml are at the repository root. Hidden .node-version and .gitignore are useful but optional: package.json also selects Node 22.
3. Sign in at https://dashboard.render.com. Choose the Hobby workspace plan ($0 base workspace fee).
4. Choose New > Web Service. Connect GitHub and authorize access to this repository. Select pals-party.
5. Set Name to pals-party (or another available name), Language to Node, Branch to the branch containing your uploaded files, and Region to Virginia if most players are near the US East Coast. Leave Root Directory blank.
6. Set Build Command to `node --check server.mjs` and Start Command to `npm start`.
7. Select the Free compute plan. It is a Web Service, not a Static Site. Keep exactly one instance.
8. Under Advanced, add NODE_ENV with value production. Set Health Check Path to /health. Set Auto-Deploy to Off. Do not set PORT: the server uses Render's supplied PORT automatically.
9. Click Create Web Service. Wait for deployment to show Live. If account verification is requested, complete it yourself.
10. Copy the exact HTTPS URL displayed on the service page. Its address ends in .onrender.com. Do not assume pals-party.onrender.com is available or assigned to you.
11. Open the URL and create a room. This first creation tests the HTTPS API as well as page loading. Visiting /health on the same host should return {"ok":true}.

The included render.yaml declares the same settings for users who prefer Render Blueprints. Use either Web Service setup or Blueprint setup, not both, to avoid creating two services.

## Free-tier limits

- Sleeps after 15 minutes without incoming HTTP traffic or WebSocket messages. Wakeup takes about one minute.
- 750 free instance hours per workspace each calendar month, shared between its free web services. Exhaustion suspends free web services until next month.
- Free instance: 512 MB RAM, 0.1 CPU. One instance; no persistent disk. Render may restart a free service at any time.
- A new Hobby workspace includes 5 GB outbound bandwidth and 500 standard build minutes monthly. Legacy workspace allowances can differ.
- Current listed overages are $0.15/GB bandwidth and $5 per 1,000 standard build minutes. Without a payment method, exhausting bandwidth suspends free services; exhausting build minutes disables new builds. Check the Billing page and spend controls before adding payment details.
- Free compute is intended for testing and previews. It does not provide an always-running guarantee. The paid 0.5c-512mb plan (formerly Starter) is currently $7/month and does not sleep for inactivity, but restarts and maintenance can still occur.

## Phone test

1. Create a room from the live HTTPS URL on your computer; keep that tab open.
2. On your phone, turn Wi-Fi off and use cellular data to confirm it works outside your home network. Open the exact same live URL in Safari or Chrome (not localhost).
3. Join using the room code and a different nickname. Confirm both players appear on both devices.
4. Send a chat message each way. The host starts Memory Match. Flip a card on the phone: the computer should not see its face. Claim a pair: both devices should show it claimed and the same score.
5. Refresh the phone page within 30 seconds. It should return to the same player and score.
6. For a deliberate disconnect test, close the phone tab or disable its network for more than 30 seconds. The remaining two-player match should end without a winner. Rejoin for a new match.
7. Keep the game tab in the foreground during play. Mobile browsers can suspend background tabs; the 30-second reconnect rule still applies.

## Operational notes

This version uses authenticated server-sent events for room state and HTTP requests for player actions. State is pushed on changes; there is no state polling timer. A transport keep-alive comment is sent every 20 seconds, without any game state. Monitor bandwidth usage after your first few sessions.

Rooms and chat live in process memory, and are lost on sleep, redeployment, crash or restart. Keep a single instance. Deploy updates only between matches. Do not use artificial keep-alive traffic to present the free plan as always running.

Chat is available only to authenticated members of its room; anyone with its invite code may join. Render provides HTTPS, but the app does not provide end-to-end encryption.

Sources:
https://render.com/docs/web-services
https://render.com/docs/free
https://render.com/docs/compute-plans
https://render.com/docs/new-workspace-plans
https://render.com/pricing
