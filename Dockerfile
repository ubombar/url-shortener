FROM node:14
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install
RUN npm install -g typescript nodemon
COPY . .
EXPOSE 8080
CMD [ "npm", "run", "start" ]