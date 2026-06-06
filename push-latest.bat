@echo off
docker buildx build --platform linux/amd64 -t rtippenhauer/standup-order-generator:latest --push .
