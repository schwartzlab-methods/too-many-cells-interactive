FROM node:latest as BUILD

WORKDIR /usr/app

ENV NODE_PORT=4422
ENV STATIC_DIR=/usr/app/node/static 

COPY --chown=node:node . .

WORKDIR /usr/app/react

# build react app and copy assets into static directo
RUN yarn install && \
    yarn run build && \
    cp -a dist/* /usr/app/node/static/ && \
    chown -R node:node /usr/app/node/static/

WORKDIR /usr/app/node

# build node app
RUN yarn install && yarn run build

# todo copy dist and static into new image, leaving modules, etc behind

USER node

ENTRYPOINT ["yarn", "run", "start"]
