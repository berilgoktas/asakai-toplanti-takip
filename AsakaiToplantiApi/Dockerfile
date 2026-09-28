FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["AsakaiToplantiApi.csproj", "./"]
RUN dotnet restore "AsakaiToplantiApi.csproj"

COPY . .
RUN dotnet publish "AsakaiToplantiApi.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:3004
EXPOSE 3004

ENTRYPOINT ["dotnet", "AsakaiToplantiApi.dll"]
