FROM node:lts AS builder

WORKDIR /home/node/app

COPY . .

RUN chown -R node:node /home/node

USER node

RUN npm install && npm run build:bin \
    && cp -f .env.example bin/.env.example \
    && cp -f logo.jpg bin/logo.jpg \
    && cp -rf docs/ bin/docs/

FROM node:lts AS runner

USER node

WORKDIR /home/node/app

COPY --from=builder /home/node/app/bin .

CMD ["./musebot"]
