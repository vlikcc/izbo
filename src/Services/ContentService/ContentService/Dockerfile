FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["Directory.Build.props", "./"]
COPY ["Directory.Packages.props", "./"]
COPY ["src/Services/ContentService/ContentService/ContentService.csproj", "src/Services/ContentService/ContentService/"]
COPY ["src/Shared/Shared/Shared.csproj", "src/Shared/Shared/"]
RUN dotnet restore "src/Services/ContentService/ContentService/ContentService.csproj"
COPY . .
WORKDIR "/src/src/Services/ContentService/ContentService"
RUN dotnet build "ContentService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ContentService.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
USER root
# ffmpeg/ffprobe turn uploaded videos into the HLS ladder (VideoTranscodeWorker). The worker writes its
# scratch files under /tmp, which the non-root app user can write to.
RUN apt-get update && apt-get install -y --no-install-recommends curl ffmpeg \
    && rm -rf /var/lib/apt/lists/*
USER $APP_UID
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ContentService.dll"]
