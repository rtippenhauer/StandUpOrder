# Build and push :latest to Docker Hub
docker buildx build --platform linux/amd64 -t rtippenhauer/standup-order-generator:latest --push .
