FROM node:latest

WORKDIR /usr/app

USER root

RUN wget https://bootstrap.pypa.io/get-pip.py && \
    python3 get-pip.py && \
    pip install motor && \ 
    rm get-pip.py

COPY ./react ./react
COPY ./node ./

WORKDIR /usr/app/react

# build react app, copy assets into static directory, and remove
RUN yarn install && \
    yarn run build && \
    cp -a dist/* /usr/app/static/ && \
    rm -rf react

WORKDIR /usr/app

# build node app
RUN yarn install && yarn run build

RUN chown -R node:node /usr/app/

USER node

ENTRYPOINT ["bash", "entrypoint.sh"]
