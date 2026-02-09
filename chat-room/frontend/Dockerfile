# Frontend Dockerfile
FROM node:18-alpine as builder

WORKDIR /app

# Copy files
COPY *.html *.css *.js ./

# Create directory for static files
RUN mkdir -p /app/dist && \
    cp *.html *.css *.js /app/dist/

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
