#!/bin/sh

sudo chmod -R a+w /var/cache/fontconfig

# Install playwright and its dependencies
npx -y playwright@latest install --with-deps firefox

# install node modules
npm install
