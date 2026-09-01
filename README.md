# GDPS Rate Announcer Bot

Polls your GDPS's MySQL database and posts an embed in a Discord channel
whenever a level gets rated.

## 1. Schema (already matched to your GDPS)

Your `levels` table uses:

| Purpose        | Column           |
|----------------|------------------|
| Level ID       | `levelID`        |
| Level name     | `levelName`      |
| Creator        | `userName`       |
| Difficulty     | `starDifficulty` (10/20/30/40/50 = Easy…Insane, 0 = N/A) |
| Demon flag     | `starDemon`      |
| Star count     | `starStars`      |
| Rated marker   | `rateDate` (unix timestamp, `0` = not yet rated) |
| Featured flag  | `starFeatured`   |
| Epic flag      | `starEpic`       |

The bot watches `rateDate` climbing above `0` — this is more reliable than a
plain flag since it also gives us an exact rating timestamp for the embed.
The defaults in `.env.example` are already set to these column names, so you
shouldn't need to change `COL_*` unless something doesn't match once you test it.

## 2. Create a Discord bot

1. Go to https://discord.com/developers/applications → New Application
2. Bot tab → Reset Token → copy it (this is your `DISCORD_TOKEN`)
3. Invite it to your server with the `bot` scope and `Send Messages` + `Embed Links` permissions
4. In Discord, enable Developer Mode (User Settings → Advanced), right-click your target channel → Copy Channel ID → this is `DISCORD_CHANNEL_ID`

## 3. Configure

```bash
cp .env.example .env
# edit .env with your real DB credentials, table/column names, and Discord token
```

## 4. Install & run

```bash
npm install
npm start
```

The bot will:
- Connect to Discord and your database
- Immediately check for any already-rated levels it hasn't announced yet
- Poll every `POLL_INTERVAL_MS` (default 30s) for newly rated levels
- Track progress in `last_seen.json` so it won't repeat announcements after a restart

## Notes / things to double check

- **DB host**: `pma.fhgdps.com` is your phpMyAdmin web address, not
  necessarily the raw MySQL hostname the bot can connect to directly. If the
  bot fails to connect, ask your host what hostname/port (and whether
  external connections are even allowed) to use — you may need to run this
  bot on the same server as the database instead.
- **Security**: since DB credentials were shared in this chat, it's worth
  rotating the `gdps_neogd` password in phpMyAdmin once you've copied it into
  your `.env` file, just to be safe.
- **Running 24/7**: for a bot that needs to stay online, run it with a process
  manager like `pm2` (`pm2 start index.js --name gdps-bot`) or host it on a
  small VPS/always-on service, since it needs a persistent connection to both
  Discord and your database.
- Never commit your real `.env` file — it contains your bot token and DB credentials.
