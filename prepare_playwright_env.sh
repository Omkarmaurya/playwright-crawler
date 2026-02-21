#!/bin/sh

PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers

sudo chmod -R a+w $HOME/pw-browsers

# Install playwright and its dependencies
npx -y playwright@latest install --with-deps firefox

# install node modules
npm install
