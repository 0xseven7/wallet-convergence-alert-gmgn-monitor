FROM node:20-alpine

WORKDIR /app

COPY package.json server.js ./

ENV NODE_ENV=production
ENV PORT=8788
ENV HOST=0.0.0.0

EXPOSE 8788

CMD ["node", "server.js"]
