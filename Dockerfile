FROM node:22-alpine

WORKDIR /app

# Dependencies are copied and installed before the source so that edits to
# server.js or public/ reuse the cached npm layer instead of reinstalling.
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Never run as root in the container, even for an MVP.
USER node

EXPOSE 3000
CMD ["node", "server.js"]
