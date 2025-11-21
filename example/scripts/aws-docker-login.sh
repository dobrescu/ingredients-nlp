#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------
# Configuration
# ---------------------------------------------
AWS_PROFILE="${AWS_PROFILE:-default}"
AWS_REGION="${AWS_REGION:-$(aws configure get region --profile "$AWS_PROFILE" || echo "us-east-1")}"

# ---------------------------------------------
# Verify AWS credentials
# ---------------------------------------------
echo "Checking AWS credentials for profile '$AWS_PROFILE'..."
aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null 2>&1 || {
  echo "❌ AWS credentials invalid or expired. Please run 'aws configure' or refresh your session."
  exit 1
}

# ---------------------------------------------
# Get AWS Account ID and ECR login
# ---------------------------------------------
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text --profile "$AWS_PROFILE")

echo "Logging into Amazon ECR for account $AWS_ACCOUNT_ID in region $AWS_REGION..."
aws ecr get-login-password --region "$AWS_REGION" --profile "$AWS_PROFILE" \
  | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

echo "✅ Successfully logged in to AWS ECR ($AWS_REGION)"
