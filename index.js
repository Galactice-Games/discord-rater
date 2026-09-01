require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
const fs = require('fs');

// ---------------------------------------------------------------------------
// CONFIG - adjust these to match YOUR database schema (see README.md)
// ---------------------------------------------------------------------------
const TABLE_NAME = process.env.DB_LEVELS_TABLE || 'levels';

const COLUMNS = {
  id: process.env.COL_ID || 'levelID',
  name: process.env.COL_NAME || 'levelName',
  creator: process.env.COL_CREATOR || 'userName',
  difficulty: process.env.COL_DIFFICULTY || 'starDifficulty',
  stars: process.env.COL_STARS || 'starStars',
  rated: process.env.COL_RATED || 'rateDate',      // timestamp, 0 = not rated yet
  featured: process.env.COL_FEATURED || 'starFeatured',
  epic: process.env.COL_EPIC || 'starEpic',
  demon: process.env.COL_DEMON || 'starDemon',
};

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '30000', 10);
const STATE_FILE = './last_seen.json';

// ---------------------------------------------------------------------------
// State tracking - remembers the highest level ID we've already announced
// ---------------------------------------------------------------------------
function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { lastSeenRateDate: 0 };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ---------------------------------------------------------------------------
// Discord setup
// ---------------------------------------------------------------------------
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let dbPool;

async function initDb() {
  dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });
  // sanity check
  await dbPool.query('SELECT 1');
  console.log('[db] connected');
}

function difficultyName(diffValue, isDemon) {
  if (isDemon) return 'Demon';
  // Your schema stores difficulty *10 (10=Easy ... 50=Insane, 0=N/A/Auto)
  const map = {
    0: 'N/A', 10: 'Easy', 20: 'Normal', 30: 'Hard',
    40: 'Harder', 50: 'Insane',
  };
  return map[diffValue] ?? `Unknown (${diffValue})`;
}

async function checkForNewlyRatedLevels() {
  const state = loadState();

  const query = `
    SELECT ${COLUMNS.id} AS id,
           ${COLUMNS.name} AS name,
           ${COLUMNS.creator} AS creator,
           ${COLUMNS.difficulty} AS difficulty,
           ${COLUMNS.stars} AS stars,
           ${COLUMNS.featured} AS featured,
           ${COLUMNS.epic} AS epic,
           ${COLUMNS.demon} AS demon,
           ${COLUMNS.rated} AS rateDate
    FROM ${TABLE_NAME}
    WHERE ${COLUMNS.rated} > ?
    ORDER BY ${COLUMNS.rated} ASC
    LIMIT 25
  `;

  const [rows] = await dbPool.query(query, [state.lastSeenRateDate]);

  if (rows.length === 0) return;

  const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);

  for (const level of rows) {
    const embed = new EmbedBuilder()
      .setTitle(`⭐ Level Rated: ${level.name}`)
      .addFields(
        { name: 'Creator', value: String(level.creator), inline: true },
        { name: 'Difficulty', value: difficultyName(level.difficulty, level.demon), inline: true },
        { name: 'Stars', value: String(level.stars), inline: true },
      )
      .setColor(level.epic ? 0xffcc00 : level.featured ? 0x00b0ff : 0x2ecc71)
      .setTimestamp(new Date(level.rateDate * 1000));

    if (level.epic) embed.addFields({ name: 'Epic', value: 'Yes', inline: true });
    else if (level.featured) embed.addFields({ name: 'Featured', value: 'Yes', inline: true });

    await channel.send({ embeds: [embed] });
    state.lastSeenRateDate = Math.max(state.lastSeenRateDate, level.rateDate);
  }

  saveState(state);
}

client.once('ready', async () => {
  console.log(`[discord] logged in as ${client.user.tag}`);
  await initDb();

  // run once immediately, then on interval
  checkForNewlyRatedLevels().catch(err => console.error('[poll] error:', err));
  setInterval(() => {
    checkForNewlyRatedLevels().catch(err => console.error('[poll] error:', err));
  }, POLL_INTERVAL_MS);
});

client.login(process.env.DISCORD_TOKEN);
