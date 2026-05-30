FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (ignoring dev dependencies for smaller image, but we need vite to build)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Expose the API port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
