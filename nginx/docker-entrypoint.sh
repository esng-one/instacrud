#!/bin/sh
set -e

# Generate nginx config based on SSL_ENABLED
if [ "$SSL_ENABLED" = "true" ]; then
    echo "SSL mode enabled - generating config with domain: $DOMAIN"
    envsubst '${DOMAIN}' < /etc/nginx/templates/ssl.conf.template > /etc/nginx/conf.d/default.conf
else
    echo "SSL disabled - using HTTP-only config"
    cp /etc/nginx/templates/nossl.conf /etc/nginx/conf.d/default.conf
fi

# Execute the original command
exec "$@"
