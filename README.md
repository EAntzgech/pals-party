# Pals Party

Open http://localhost:4317 in two separate browser windows. Create a room in the first, then join using its eight-character code and a different nickname in the second. The host starts Memory Match after both players join.

To restart: open PowerShell in this folder, set `$env:PORT='4317'`, then run `node server.mjs`. Requires Node.js 22 or later; no package installation is needed.

Refresh restores the tab's player within 30 seconds using sessionStorage. Open a fresh window by typing the URL; duplicating an existing game tab can copy its session. An incognito window also provides a separate player.

The server is authoritative; clients receive only their own flipped card values. State updates every 300 milliseconds. Mismatches hide after one second. Simultaneous claims are resolved in server arrival order. Highest scores tie. Disconnected players withdraw after 30 seconds, and their claimed cards stay claimed. Fewer than two remaining active players cancels the match without a winner. The host transfers to a connected player if unavailable. Late joiners wait for the next match.

Codes use eight securely random characters (40 bits). Join attempts are limited to 20 per minute per connection IP. Nicknames are unique within each room ignoring case. Chat requires a room-specific member token, is rendered as plain text, and retains the latest 80 messages in server memory. Anyone with the room code may join. This is invitation privacy, not end-to-end encrypted chat.

This is the local test release. Internet hosting has not been deployed. The same Node server can later run on an HTTPS Node hosting service with a single running instance. Rooms, sessions and chat are temporary and disappear on server restart. Multiple server instances would require shared room storage and coordination before deployment.

Included now: rooms, 2–8 player list, host controls, chat, Memory Match, rematches, reconnects. Racing, Tic-Tac-Toe and Gebeta are not implemented yet. Gebeta rules remain to be confirmed.
