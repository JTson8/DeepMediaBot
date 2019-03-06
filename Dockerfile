FROM node:8

WORKDIR /usr/src/app
COPY . /usr/src/app

RUN npm install

CMD ["npm", "start"]
