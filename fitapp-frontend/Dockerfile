FROM node:20-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Use npm install with flags for faster builds
# Install dependencies and ensure optional dependencies are installed (fixes Rollup musl issue)
RUN npm install --silent --no-audit --no-fund && \
    npm install @rollup/rollup-linux-x64-musl --save-optional || true

# Copy source code
COPY . .

EXPOSE 5173

# Start the development server
CMD ["npm", "run", "dev", "--", "--host"]