FROM node:18-alpine

RUN npm install

EXPOSE 5000

CMD ["node", "server.js"]
