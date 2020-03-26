FROM node:12-stretch-slim

COPY package.json package-lock.json /app/

WORKDIR /app

COPY public /app/public
COPY src /app/src

RUN npm install
RUN npm run build

ENTRYPOINT [ "npm", "run", "serve" ]