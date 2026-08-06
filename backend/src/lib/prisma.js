/**
 * Single shared PrismaClient.
 *
 * Each route module used to construct its own client, which opened one
 * connection pool per module (13 pools). Postgres closes the app down under
 * that load far sooner than SQLite ever complained.
 */
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__boardPortalPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__boardPortalPrisma = prisma;
}

module.exports = prisma;
