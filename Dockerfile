FROM node:24-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/eventia.sqlite

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY public ./public
COPY database ./database
COPY scripts ./scripts

RUN mkdir -p /app/data && chown -R node:node /app

USER node
VOLUME /app/data
EXPOSE 3000

CMD ["npm", "start"]
