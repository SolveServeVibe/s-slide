FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV production

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

RUN mkdir -p /app/public/presentations

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "run", "start"]
