FROM node:20 AS builder

WORKDIR /home/node/app
COPY . .
RUN ls -l
RUN npm ci && npm list && npm run build:bin

USER node

FROM debian:stable

RUN mkdir /app

WORKDIR /app

COPY --from=builder /home/node/app/build/pkg/musebot-linux musebot
COPY --from=builder /home/node/app/LICENSE.md LICENSE.txt

CMD ["./musebot"]
