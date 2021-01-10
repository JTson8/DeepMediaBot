FROM node:8

WORKDIR /usr/src/app
COPY savedData /usr/src/app/savedData
COPY . /usr/src/app

RUN npm install

CMD ["npm", "start"]
