# Saba_Party

Live: https://pals-party.onrender.com

A private, phone-first room for 2–8 friends. A valid nickname enables Create or Join. Creating asks for a room name; joining asks for the eight-character invitation code. Rooms are unlisted. Each browser tab keeps its private reconnect token in sessionStorage; refreshing restores the same player within the 30-second reconnect grace period.

## Four screens

- **Welcome:** nickname and Create/Join only.
- **Lobby:** room name/code, four game choices, relevant settings and one Start button. Only the host can configure and start.
- **Match:** game, turn/status, compact scores and board/controls. Setup is hidden. Spectators are identified clearly.
- **Results:** one shared announcement for every player and spectator. Distinguishes a win, shared win, draw, round win, series win, forfeit or cancellation. Open floating panels close when results arrive so the announcement is visible. Only the host controls the next action.

Chat, Players and Help use top buttons and accessible floating dialogs. Chat retains its unread badge. Close dialogs with their close button, Escape or a backdrop click. Instructions live in Help, and the player list lives in Players. No public room directory or private messaging is added.

## Games

- **Memory Match (2–8):** Take Turns is the default. Everyone sees the current player's two flips; a pair earns one point and another turn. A mismatch hides after one second and passes play. The first player is random; turns follow join order. Race mode retains simultaneous private flips and first-valid-claim scoring. All 12 pairs claimed ends either mode; equal top scores share the win. Claimed pairs remain claimed if a player leaves. A disconnected current turn waits for the reconnect grace period before skipping that player.
- **Tap Racing (2–8):** a three-second countdown starts a race to 100 steps. Tap the button or press Space, up to 10 steps per rolling second. Holding Space does not repeat. Touch controls suppress text selection and context menus; persistent car elements animate between server-confirmed positions. Finishers in the same 50 ms server window share first place. At the 60-second deadline, furthest players win, including ties.
- **Tic-Tac-Toe (2):** the host selects two players and everyone else watches. The first starter is random, takes X, and starters alternate on rematches. Three in a row wins; a full board without a line draws.
- **Gebeta (2):** the approved family-of-four variant uses two rows of six pits with four seeds each. Sow counterclockwise through both rows, relay from an occupied final pit, and stop at an empty final pit. A final seed making four captures that family for the mover; intermediate families belong to the pit owner. An empty row at the start of a turn ends the game and the opponent collects the rest. Most captured seeds wins. Equal totals, repeated board/turn positions or an endless relay draw. Sowing remains synchronized at one seed every 200 ms with 500 ms pauses after each handful; counts and landing highlights update along the way, and the next move is blocked until sowing finishes.

## Optional Best of 3

Available for Tic-Tac-Toe and Gebeta. Single round remains the default. Best of 3 means first to two round wins; draws give no wins and additional rounds may be needed. The same two competitors stay locked for the series, and the starting player alternates every round, including draws. Current round scores and series wins are displayed separately.

The server settles each round once, and publishes the same result to everyone. Next round preserves series progress. Play again creates a fresh series with scores reset; Back to lobby clears series state and allows new settings/competitors. These actions are host-only. Between normal rounds, the host gets Next round. After completion, the host gets Play again and Back to lobby.

A competitor explicitly leaving or exceeding the reconnect grace period forfeits an unfinished series, including between rounds. A forfeit ends the series without artificially adding round wins. Repeated disconnect processing never increments wins again. Refresh/reconnect preserves the competitor identity and series progress.

## Connections and privacy

State uses authenticated POST server-sent events. Actual room/game events, one-shot deadlines and animation frames trigger updates; there is no recurring state polling. Transport keep-alive comments contain no room state. Tokens are sent in request bodies, not URL query strings. Hidden Memory faces are sent only to their owner in Race mode. Chat is delivered only to authenticated room members and rendered as plain text. Anyone with the room code may join; chat is not end-to-end encrypted.

Two-player games pause during the reconnect window. Racing and Memory continue while a disconnected player has time to return. Fewer than two active competitors cancels Racing or Memory without a winner. Host control transfers to a connected player if the host disconnects. Empty rooms close.

## Run and test

Requires Node 22. Run `npm start`, or set PORT to choose a local port. Open the URL in independent browser windows. Run `npm test` for game rules, HTTP/push streams, chat notifications, entry validation, authoritative results and Best-of-3 lifecycle tests. The suite includes a real 30-second reconnect-expiry check.

The light royal theme uses obsidian, warm crimson, parchment and gold, with restrained headings and phone-sized controls.

## Hosting limitation

Render runs one Free Node instance, with auto-deploy disabled. Publish updates between matches. Rooms, messages, scores and series progress live in memory and are lost on server restart, sleep or redeployment. Free services sleep after 15 idle minutes and may take about a minute to wake. See DEPLOY-RENDER.md for setup and limits.

## Stop or extend a match

The host can use End game during play or an unfinished series. Confirmation returns everyone to the lobby, clears the cancelled match/series without a winner, announces the cancellation and preserves the room and chat. Animation and race deadlines from that match cannot affect the lobby. Other players retain Leave room.

After a normal Single round win in Tic-Tac-Toe or Gebeta, only the loser can ask for Best of 3 from Results. Only the winner can accept or decline. Acceptance credits the first win (1–0), locks the existing competitors and lets the host start the next round with the alternating starter. Declining preserves the original result. One request is permitted per round; a pending request closes if a competitor leaves.

## Competition refinement

Guest play remains nickname → Create/Join → game, without registration. Gebeta is featured as Saba_Party’s chosen rules variant. A replayable opening move and capture example are generated directly by the same `sowGebeta` rules engine used for matches; they do not change live rooms.

Room invitation links contain only `?room=CODE` and prefill Join. Copy code / share invitation use native sharing when available and a selectable copy fallback. Nickname, invalid-code and room-entry errors appear beside their fields. Scores, pit ownership, sowing direction, spectator status, leave consequences and Tic-Tac-Toe winning lines are clearer. Reduced-motion settings disable interface movement; server sowing timings and move locks remain unchanged.

Serve `competition.js` and `competition.css` alongside the existing page. No build or external runtime dependencies are required. `npm test` includes original game/reconnect/series checks and teaching-engine/invitation/winning-line checks. Keep the Free Render plan. Sites forwards only the fixed game paths and these public assets; no account or Supabase server keys are needed for this version.

