FROM node:24-slim
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Prisma's client from the schema, then the build; neither connects to a database
RUN ROWSTILE_OWNER_DSN=postgresql://build@localhost/build npx prisma generate && npx next build
