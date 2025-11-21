#!/bin/bash
#
# Build and push Docker image to ECR
#
# Usage: ./scripts/build-and-push.sh
#
# Required environment variables:
#   AWS_ACCOUNT_ID - Your AWS account ID
#   AWS_REGION - AWS region (default: us-east-1)
#

set -e

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
IMAGE_NAME="ingredients-nlp"
ECR_REPOSITORY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${IMAGE_NAME}"

# Validate environment
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "❌ Error: AWS_ACCOUNT_ID environment variable is required"
    exit 1
fi

echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | \
    docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "🏗️  Building Docker image..."
docker build -t "${IMAGE_NAME}:latest" .

echo "🏷️  Tagging image..."
docker tag "${IMAGE_NAME}:latest" "${ECR_REPOSITORY}:latest"
docker tag "${IMAGE_NAME}:latest" "${ECR_REPOSITORY}:$(date +%Y%m%d-%H%M%S)"

echo "⬆️  Pushing to ECR..."
docker push "${ECR_REPOSITORY}:latest"
docker push "${ECR_REPOSITORY}:$(date +%Y%m%d-%H%M%S)"

echo "✅ Successfully pushed to ${ECR_REPOSITORY}"
