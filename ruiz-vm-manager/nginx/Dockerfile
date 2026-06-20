FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends nginx novnc \
    && rm -rf /var/lib/apt/lists/*
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
