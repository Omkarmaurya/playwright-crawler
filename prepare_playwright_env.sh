#!/bin/sh

apt-get update
apt-get install xvfb

# Install playwright and its dependencies
npx -y playwright@latest install --with-deps chromium

# install node modules
npm install
