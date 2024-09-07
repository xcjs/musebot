FROM node:lts

WORKDIR /home/node/app
COPY . .
RUN npm install --omit dev && npm run parcel

USER node

CMD ["npm", "run", "start:only"]
