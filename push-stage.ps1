# Build and push :stage to Docker Hub
docker buildx build --platform linux/amd64 -t rtippenhauer/standup-order-generator:stage --push .
