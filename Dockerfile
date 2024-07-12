FROM node:lts

WORKDIR /home/node/app
COPY . .
RUN npm install --omit dev --no-package-lock && npm run build

USER node

CMD ["npm", "run", "start:only"]
