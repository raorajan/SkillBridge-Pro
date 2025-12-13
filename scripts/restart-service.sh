#!/bin/bash
cd ~/SkillBridge-Pro
if [ -z "$1" ]; then
    echo "Usage: $0 <service-name>"
    echo "Available services: backend, frontend, user-service, project-service, settings-service, chat-service"
    exit 1
fi
docker-compose restart "$1"
docker-compose logs -f "$1"
