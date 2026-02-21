#!/bin/sh

# Install playwright and its dependencies
npx -y playwright@latest install --with-deps webkit

# install node modules
npm install
