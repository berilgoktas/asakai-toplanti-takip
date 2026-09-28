FROM node:20-alpine AS frontend-build
WORKDIR /front
COPY AsakaiToplantiFront/package.json AsakaiToplantiFront/package-lock.json ./
RUN npm ci
COPY AsakaiToplantiFront/ ./
RUN printf 'VITE_API_BASE_URL=\n' > /.env
ENV VITE_API_BASE_URL=
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS api-build
WORKDIR /src
COPY AsakaiToplantiApi/AsakaiToplantiApi.csproj ./
RUN dotnet restore
COPY AsakaiToplantiApi/ ./
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

COPY --from=api-build /app/publish /app/api
COPY --from=frontend-build /front/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/sites-available/asakai.conf
COPY docker/start.sh /start.sh
RUN ln -s /etc/nginx/sites-available/asakai.conf /etc/nginx/sites-enabled/asakai.conf \
    && chmod +x /start.sh

ENV ASPNETCORE_URLS=http://127.0.0.1:3004
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 3004
EXPOSE 3005

WORKDIR /app/api
ENTRYPOINT ["/start.sh"]
