FROM node:20-alpine AS s-slide-builder

# Force cache rebuild - bump this when dependencies change
ARG CACHEBUST=2024-06-04-3

WORKDIR /app

ENV NODE_ENV=production

# Force cache invalidation - bump this timestamp to rebuild from scratch
RUN echo "Cache bust: 2024-06-04-v4"

COPY package.json package-lock.json ./
# Cache bust - change this value to force npm install to rerun
RUN echo "${CACHEBUST}" && npm install --legacy-peer-deps

COPY . .
RUN npm run build

RUN mkdir -p /app/public/presentations

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "run", "start"]
