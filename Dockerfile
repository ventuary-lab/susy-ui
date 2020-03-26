FROM node:12-stretch-slim

COPY package.json package-lock.json index.js /app/

WORKDIR /app

COPY public /app/public
COPY src /app/src

RUN npm i
RUN npm i express
RUN npm run build

ENTRYPOINT [ "npm", "run", "serve" ]