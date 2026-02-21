#!/bin/sh

# Install playwright and its dependencies
npx -y playwright@latest install --with-deps firefox

# install node modules
npm install
