/**
 * Boot-time seed gate for Railway.
 *
 * The deploy start command always runs this; it only does work when
 * SEED_DEMO_DATA=1. Seeding is idempotent, so leaving the flag on is safe —
 * but turn it off once real data exists, since the seed rebuilds the demo
 * board's meetings each run.
 */
if (process.env.SEED_DEMO_DATA === '1') {
  console.log('SEED_DEMO_DATA=1 — seeding demo data');
  require('./seed');
} else {
  console.log('SEED_DEMO_DATA not set — skipping seed');
}
