#!/bin/sh

sudo apt-get update
sudo apt-get install xvfb

# Install playwright and its dependencies
npx -y playwright@latest install --with-deps chromium

# install node modules
npm install
