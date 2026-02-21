#!/bin/sh

export FONTCONFIG_PATH=/tmp
sudo chmod -R a+w /tmp

# Install playwright and its dependencies
npx -y playwright@latest install --with-deps firefox

# install node modules
npm install
