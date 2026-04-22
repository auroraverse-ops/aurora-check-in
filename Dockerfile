# ===========================================
# Stage 1: Build the application
# ===========================================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Build-time environment variables fuer Vite.
# Coolify setzt diese als Build-Args; Default ist Test-Supabase.
ARG VITE_SUPABASE_URL=https://supabase-test.askitech.de
ARG VITE_STANDORT
ARG VITE_N8N_WEBHOOK_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_STANDORT=$VITE_STANDORT
ENV VITE_N8N_WEBHOOK_URL=$VITE_N8N_WEBHOOK_URL

# Copy package files
COPY package*.json ./
COPY bun.lockb ./

# Install dependencies (using npm for compatibility)
RUN npm install

# Copy source code
COPY . .

# Build the application for production
RUN npm run build

# ===========================================
# Stage 2: Serve with Nginx
# ===========================================
FROM nginx:alpine AS production

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
