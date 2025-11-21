# Build stage
FROM public.ecr.aws/lambda/nodejs:22 AS build
WORKDIR /build

COPY package.json yarn.lock tsconfig.json esbuild.config.js ./
COPY src ./src

# Use corepack as planned
RUN corepack enable && corepack prepare yarn@stable --activate
RUN yarn config set nodeLinker node-modules
RUN yarn install --immutable
RUN yarn build

# Runtime stage
FROM public.ecr.aws/lambda/nodejs:22

# Lambda expects your code in /var/task (set via LAMBDA_TASK_ROOT)
WORKDIR ${LAMBDA_TASK_ROOT}
ENV NODE_OPTIONS="--enable-source-maps"

# CRITICAL FIX: Create a minimal package.json in the runtime stage
# This explicitly tells Node.js to treat all .js and (by extension) .mjs files
# as ES Modules within the context of the container.
RUN echo '{"type": "module"}' > package.json

# If your lambda.mjs relies on specific installed dependencies (i.e., you didn't mark them
# as external in esbuild), you would need to copy package.json and run 'yarn install --production' here.
# Since you externalized @aws-sdk/*, this minimal package.json should be sufficient.

# Copy single-file ESM bundle and source map
COPY --from=build /build/dist/lambda.mjs .
COPY --from=build /build/dist/lambda.mjs.map .

# Handler = <filename>.<export>
# This remains correct for your lambda.mjs file
CMD [ "lambda.handler" ]
