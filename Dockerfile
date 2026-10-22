# ---------- Stage 1: deps ----------
# Production dependencies only, installed exactly as pinned in the lockfile.
# The npm cache is wiped in the same layer so it never adds to image size.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Stage 2: test ----------
# Only built on request (`docker build --target test`). CI runs the suite
# here, on the same dependencies the runtime image ships with. The tests use
# Node's built-in runner, so no dev dependencies are needed.
FROM deps AS test
COPY . .
CMD ["npm", "test"]

# ---------- Stage 3: runtime ----------
# Starts again from a clean base and copies in only what the server needs to
# run: no tests, docs, lockfile or npm cache.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json server.js ./
COPY --chown=node:node public ./public

# Never run as root in the container, even for an MVP.
USER node

EXPOSE 3000
# Hits the app, not Redis: /api/health stays green while the cache is down,
# which is intended - the app still serves live data.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
