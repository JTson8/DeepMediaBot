#!/bin/bash
chmod +x stop.sh
sudo docker build -t deepmediabot .
sudo docker run -d --restart always deepmediabot
echo to view container type sudo docker container ls
echo to stop script type ./stop.sh
