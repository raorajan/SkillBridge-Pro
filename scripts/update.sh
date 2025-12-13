#!/bin/bash
cd ~/SkillBridge-Pro
git pull
docker-compose down
docker-compose up --build -d

