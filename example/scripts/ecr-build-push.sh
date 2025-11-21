#!/usr/bin/env bash
set -euo pipefail

# ----------------------------------------------------------------------
# ecr-build-push.sh
# Builds and pushes a Docker image to AWS ECR.
#
# Usage:
#   ./ecr-build-push.sh [<ECR_URI>] [<Dockerfile>]
#
# If no ECR_URI is provided, the script reads from the environment variable ECR_URI.
# Example:
#   ./ecr-build-push.sh 467241965301.dkr.ecr.eu-central-1.amazonaws.com/chef:latest
#   ./ecr-build-push.sh 467241965301.dkr.ecr.eu-central-1.amazonaws.com/chef:dev ./Dockerfile.dev
#
# Or set environment variables:
#   export ECR_URI=467241965301.dkr.ecr.eu-central-1.amazonaws.com/chef:latest
#   export AWS_PROFILE=dev
#   export AWS_REGION=eu-central-1
#   ./ecr-build-push.sh
# ----------------------------------------------------------------------

# ---------------------------------------------
# Load .env (optional)
# ---------------------------------------------
if [ -f ".env" ]; then
  echo "Loading environment variables from .env..."
  # shellcheck disable=SC2046
  export $(grep -v '^\s*#' .env | xargs)
fi

# ---------------------------------------------
# Input handling
# ---------------------------------------------
ECR_URI="${1:-${ECR_URI:-}}"
DOCKERFILE="${2:-Dockerfile}"

if [[ -z "${ECR_URI:-}" ]]; then
  echo "❌ ECR_URI not provided and not found in environment."
  echo "Usage: $0 <ECR_URI> [<Dockerfile>]"
  echo "Or export ECR_URI in your environment."
  exit 1
fi

# Validate ECR URI
if ! [[ "$ECR_URI" =~ ^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com\/[a-zA-Z0-9._/-]+:[a-zA-Z0-9._-]+$ ]]; then
  echo "❌ Invalid ECR URI format: $ECR_URI"
  echo "   Expected format: 123456789012.dkr.ecr.eu-central-1.amazonaws.com/repo:tag"
  exit 1
fi

# ---------------------------------------------
# Parse components
# ---------------------------------------------
AWS_ACCOUNT_ID=$(echo "$ECR_URI" | cut -d'.' -f1)
AWS_REGION_FROM_URI=$(echo "$ECR_URI" | cut -d'.' -f4)
REPO_TAG=$(echo "$ECR_URI" | cut -d'/' -f2-)
REPO_NAME="${REPO_TAG%%:*}"
IMAGE_TAG="${REPO_TAG##*:}"

AWS_PROFILE="${AWS_PROFILE:-default}"
AWS_REGION="${AWS_REGION:-$AWS_REGION_FROM_URI}"

# ---------------------------------------------
# Display configuration summary
# ---------------------------------------------
echo "------------------------------------------------------------"
echo "🧩 Build Configuration"
echo "------------------------------------------------------------"
echo "ECR URI        : $ECR_URI"
echo "Repository     : $REPO_NAME"
echo "Tag            : $IMAGE_TAG"
echo "AWS Account ID : $AWS_ACCOUNT_ID"
echo "AWS Region     : $AWS_REGION"
echo "AWS Profile    : $AWS_PROFILE"
echo "Dockerfile     : $DOCKERFILE"
echo "------------------------------------------------------------"

# ---------------------------------------------
# Validate dependencies
# ---------------------------------------------
for cmd in aws docker; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "❌ Missing dependency: $cmd"
    exit 1
  fi
done

# ---------------------------------------------
# Verify AWS credentials
# ---------------------------------------------
echo "🔍 Validating AWS credentials for profile '$AWS_PROFILE'..."
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null 2>&1; then
  echo "❌ AWS credentials invalid or expired. Run 'aws configure' or refresh your session."
  exit 1
fi

# ---------------------------------------------
# ECR login (reuse or fallback)
# ---------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -x "$SCRIPT_DIR/aws-docker-login.sh" ]]; then
  echo "🔐 Using aws-docker-login.sh..."
  "$SCRIPT_DIR/aws-docker-login.sh"
else
  echo "⚠️ ecr-login.sh not found. Performing direct login..."
  aws ecr get-login-password --region "$AWS_REGION" --profile "$AWS_PROFILE" \
    | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
fi

# ---------------------------------------------
# Build Docker image
# ---------------------------------------------
echo "🏗️  Building Docker image..."
docker build \
  -f "$DOCKERFILE" \
  -t "$ECR_URI" \
  --build-arg AWS_REGION="$AWS_REGION" \
  --build-arg AWS_ACCOUNT_ID="$AWS_ACCOUNT_ID" \
  .

echo "✅ Docker image built successfully."

# ---------------------------------------------
# Push to ECR
# ---------------------------------------------
echo "📤 Pushing image to ECR..."
docker push "$ECR_URI"

echo "✅ Image pushed successfully!"
echo "------------------------------------------------------------"
echo "📦 Image available at: $ECR_URI"
echo "------------------------------------------------------------"
