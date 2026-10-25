# Ultra-lightweight Nginx alpine image
FROM nginx:alpine

# Copy static assets to Nginx html directory
COPY . /usr/share/nginx/html

# Expose container port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
