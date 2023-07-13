FROM node:18.7-buster

WORKDIR /usr/app

ARG UID=1000
ARG GID=1000

USER root

# create user if ARG doesn't exist
# we do this in two steps to avoid the || && gotcha
RUN id -u $UID || groupadd -f -g $GID tmc-user
RUN id -u $UID || useradd --create-home --shell /bin/bash -g $GID -u $UID tmc-user

# for canvas dep
RUN apt-get update && apt-get install -y libpixman-1-dev libcairo2-dev libpangocairo-1.0-0 libpango1.0-dev 

#recreate local structure so modules can be shared during build
COPY ./react ./react
COPY ./node ./node

# COPY --chown switch does not seem to work with variables in older versions of docker
RUN chown -R $UID:$GID /usr/app

USER $UID

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
    # remove react directory only after node scripts (which have react modules as dependencies) have been built
    rm -r /usr/app/react 

ENTRYPOINT ["bash", "entrypoint.sh", "--prod"]
