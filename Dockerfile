FROM node:latest

WORKDIR /usr/app

COPY ./js .

RUN yarn install

ENTRYPOINT ["yarn"]

CMD ["run","start-cold"]