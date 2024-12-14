FROM node:lts AS builder

WORKDIR /home/node/app
COPY . .
RUN npm install && npm run build:bin

USER node

FROM debian:stable

COPY --from=builder /home/node/app/build/pkg/musebot-linux /app/musebot
COPY --from=builder /home/node/app/LICENSE.md /app/LICENSE.txt

CMD ["/app/musebot"]
