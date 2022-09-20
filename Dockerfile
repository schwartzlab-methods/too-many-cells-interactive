FROM node:18.7-buster

WORKDIR /usr/app

USER root

# for canvas dep
RUN apt-get update && apt-get install -y libpixman-1-dev libcairo2-dev libpangocairo-1.0-0 libpango1.0-dev 

RUN chown -R node:node /usr/app/

#recreate local structure so modules can be shared during build
COPY --chown=node:node ./react ./react
COPY --chown=node:node ./node ./node

USER node

WORKDIR /usr/app/react

# build react app, copy assets into static directory so node can serve
RUN yarn install && \
    yarn run build && \
    cp -a dist/* /usr/app/node/static/ 

WORKDIR /usr/app/node

# build base node app
RUN yarn install && yarn run build

RUN chmod -R +x dist

WORKDIR /usr/app/

RUN cp -a /usr/app/node/* /usr/app/ && \
    rm -r /usr/app/node && \
    # remove react directory only once node scripts with imports from the react app have been built
    rm -r /usr/app/react 

ENTRYPOINT ["bash", "entrypoint.sh", "--prod"]
