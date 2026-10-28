# Saba_Party

Play at https://pals-party.onrender.com. Create a room, share its eight-character code and join with separate nicknames. The host chooses and starts each game. Rooms hold 2–8 people. Late joiners watch until the next match. Room chat is available throughout.

## Games

- **Memory Match (2–8):** Take Turns is the default, with the original Race mode still available to the host. In Take Turns everyone sees the current player’s two flips; a pair earns 1 point and another turn. A mismatch remains visible for one second, then hides and passes play. The first player is random; turns follow join order. Disconnecting pauses the current turn for the 30-second reconnect window, then skips that player. Race mode retains the original private flips and first-valid-claim scoring. All 12 claimed ends either mode; equal top scores share the win.
- **Tap Racing (2–8):** a shared three-second countdown starts a race to 100 steps. Tap the button or press Space, up to 10 steps per rolling second. Touch-down controls suppress selection and context menus, with visible press feedback. Persistent car elements animate smoothly between server-confirmed positions. Holding Space does not repeat. Finishers in the same 50 ms server window share first place. A 60-second deadline awards the win to the furthest players, including ties.
- **Tic-Tac-Toe (2):** host selects two connected players; others spectate. Random initial starting player takes X; the starting player alternates on rematches. Three in a row wins, a full board without a line draws. Turns are enforced by the server.
- **Gebeta (2):** seed illustrations sit inside recessed circular pits, with exact counts below each pit and legal moves highlighted. Sowing is synchronized for everyone: one seed every 200 ms, a highlighted destination, and a 500 ms pause when the handful runs out before relay pickup or final capture. Counts update at each landing; the next move is blocked server-side until sowing finishes. Refresh restores the current animation position. Approved family-of-four variant. Two rows of six pits, four seeds per pit. Pick a nonempty home pit and sow counterclockwise through both rows. A last seed in an empty pit ends the turn; in an occupied pit, pick up and relay sow. A last seed making four captures those four for the moving player and ends the turn. Families formed along the way belong to that pit's owner. If the next player starts with an empty row, the opponent collects all remaining seeds. Most captured seeds wins; equal totals, repeated board-and-turn positions or an endless relay cycle draw. This is the agreed variant, not a claim that all Ethiopian communities use identical rules.

## Connections and privacy

Room state uses authenticated POST server-sent event streams. Updates are sent after actual game or room events, not on a recurring state timer. Countdown completion, mismatch hiding, race deadline, finish adjudication and disconnect expiry use one-shot timers. Empty transport comments every 20 seconds keep the connection healthy; they contain no room state. Stream tokens are in the request body, not URL query strings. Each player receives only their own hidden card values. Chat stays within its room; anyone with the invitation code may join. This is not end-to-end encrypted chat.

Refreshing restores the tab's private session token within 30 seconds. Open a fresh window by typing the address; duplicating tabs can copy sessionStorage. On disconnect, two-player games pause for 30 seconds and then forfeit; a reconnected player resumes their turn. Racing and Memory continue during the reconnect window. Departed players cannot win; claimed Memory pairs remain claimed. Fewer than two active competitors ends Racing or Memory without a winner. If the host disconnects, control moves to a connected player. The last player leaving closes the room.

## Run and verify locally

Requires Node 22. Set PORT=4317 if desired, then run `npm start`. Open the displayed localhost port in two browser windows. Run `npm test` for rule and HTTP/push-stream integration checks.

Render runs one Free Node instance. Auto-deploy is off: publish updates manually between matches. Sleeping, restarting or redeploying clears rooms, chat and scores. Free services sleep after 15 idle minutes and can take about a minute to wake. See DEPLOY-RENDER.md for hosting instructions and limits.

## Visual theme

Ancient royal court styling: imperial obsidian #120D1C, antique crimson #2B141D, parchment #FFF8E7 and gold #FFB800. Phone screens put the central game card first with stacked game choices below; all game rules, timing, scoring and connection logic are unchanged.

The lobby places game selection, player selection and Start together before the board. During play the board takes priority and setup collapses. A short hint stays beside each board; full instructions expand under How to play. On phones Create/Join appears before the welcome copy.

Chat opens from the sticky top-bar Chat button in a floating dialog. An unread badge counts new messages from other players while chat is closed; opening it clears the badge. Close with the close button, Escape, or outside the panel. Message IDs distinguish repeated identical messages. This adds no browser notification permissions and changes no game rules.

Entry is nickname-first: valid nicknames enable Create and Join. Create reveals a 1–40-character room name; Join reveals the private eight-character invitation code. Room names are shown only to room members and do not create a public room listing. The lighter royal theme uses parchment forms and panels with a dark header. Lobby order is game selection, settings, Start, players, then instructions; during play the board stays first and setup collapses. Group chat remains available from the top button.
