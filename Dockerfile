FROM node:18.7-buster

WORKDIR /usr/app

USER root

RUN wget https://bootstrap.pypa.io/get-pip.py && \
    python3 get-pip.py && \
    pip install motor && \ 
    rm get-pip.py

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

#compile headless
RUN yarn run build-scripts

RUN chmod +x dist/export-tree.js

WORKDIR /usr/app/

RUN cp -a /usr/app/node/* /usr/app/ && rm -r /usr/app/node && rm -r react

ENTRYPOINT ["bash", "entrypoint.sh"]
