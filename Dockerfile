FROM node:20

COPY . .
RUN npm i --omit=dev --no-package-lock && npm run build

USER node

CMD ["npm", "run", "start:only"]
