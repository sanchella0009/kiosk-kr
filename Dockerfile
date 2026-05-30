FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Set a local dummy DB so Next.js prerendering doesn't fail on missing tables during build
ENV DATABASE_URL="file:./dev.db"
RUN npx prisma generate
RUN npx prisma db push

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && npm run start"]
