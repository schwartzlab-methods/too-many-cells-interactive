FROM node:latest

WORKDIR /usr/app

COPY ./react .

RUN yarn install

# todo: in 'production' environment, this will build react app and copy assets into static folder
# there's also no reason to mount the data directory anymore -- back end can just serve it up

ENTRYPOINT ["yarn"]

CMD ["run","start-cold"]