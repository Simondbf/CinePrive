FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ffmpeg and other dependencies
RUN apk add --no-cache ffmpeg

# Install node dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Expose the API port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
