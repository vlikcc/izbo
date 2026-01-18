FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["src/ApiGateway/ApiGateway/ApiGateway.csproj", "src/ApiGateway/ApiGateway/"]
COPY ["src/Shared/Shared/Shared.csproj", "src/Shared/Shared/"]
RUN dotnet restore "src/ApiGateway/ApiGateway/ApiGateway.csproj"
COPY . .
WORKDIR "/src/src/ApiGateway/ApiGateway"
RUN dotnet build "ApiGateway.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ApiGateway.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
COPY ["src/ApiGateway/ApiGateway/ocelot.json", "./"]
ENTRYPOINT ["dotnet", "ApiGateway.dll"]
