# Base on official NGINX Alpine image
FROM nginx:1.27-alpine

# Remove any existing config files
RUN rm /etc/nginx/conf.d/*

# Create templates directory
RUN mkdir -p /etc/nginx/templates

# Copy config templates
COPY ./ssl.conf.template /etc/nginx/templates/
COPY ./nossl.conf /etc/nginx/templates/

# Copy entrypoint script
COPY ./docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Environment variables with defaults
ENV SSL_ENABLED=false
ENV DOMAIN=localhost

# Expose ports
EXPOSE 80 443

# Use custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]

# Launch NGINX
CMD ["nginx", "-g", "daemon off;"]
