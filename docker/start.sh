#!/bin/sh
set -e
dotnet /app/api/AsakaiToplantiApi.dll &
exec nginx -g "daemon off;"
