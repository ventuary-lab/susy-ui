#!/usr/bin/bash

docker build -t susy .
docker run -itd --name susy -p 6000:6000 susy