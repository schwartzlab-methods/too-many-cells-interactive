FROM node:latest

WORKDIR /usr/app

USER root

RUN wget https://bootstrap.pypa.io/get-pip.py && \
    python3 get-pip.py && \
    pip install motor && \ 
    rm get-pip.py

RUN chown -R node:node /usr/app/

COPY --chown=node:node ./react ./react
COPY --chown=node:node ./node ./

USER node

WORKDIR /usr/app/react

# build react app, copy assets into static directory, and remove
RUN yarn install && \
    yarn run build && \
    cp -a dist/* /usr/app/static/ && \
    rm -rf react

WORKDIR /usr/app

# build node app
RUN yarn install && yarn run build

ENTRYPOINT ["bash", "entrypoint.sh"]
