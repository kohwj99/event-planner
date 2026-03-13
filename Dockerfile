# ---- Build stage ----
FROM gdssingapore/airbase:node-22-builder AS builder

ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build


# ---- Runtime stage ----
FROM gdssingapore/airbase:node-22

WORKDIR /app

# Required directories & permissions
RUN mkdir .next && chown app:app .next
RUN mkdir .npm && chown app:app .npm

# Copy Next.js standalone output
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

USER app

CMD ["node", "server.js", "--port", "$PORT"]
