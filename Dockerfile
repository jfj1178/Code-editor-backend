FROM alpine:latest

RUN apk update 

RUN apk add --update nodejs npm

RUN npm install

EXPOSE 5000

CMD ["node", "server.js"]
