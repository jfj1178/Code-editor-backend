FROM alpine:latest

RUN apk update 

RUN apk add --update nodejs npm

EXPOSE 5000

CMD ["npm", "start"]
