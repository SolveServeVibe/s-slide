FROM node:20-alpine AS s-slide-builder

WORKDIR /app

# Force cache invalidation - bump this timestamp to rebuild from scratch
RUN echo "Cache bust: 2024-06-04-v5"

COPY package.json package-lock.json ./
# Install all dependencies (including devDependencies for tailwindcss)
RUN npm install --legacy-peer-deps

COPY . .
# Set production env for build
ENV NODE_ENV=production
RUN npm run build

RUN mkdir -p /app/public/presentations

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "run", "start"]
