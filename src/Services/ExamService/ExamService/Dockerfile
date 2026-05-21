FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["Directory.Build.props", "./"]
COPY ["Directory.Packages.props", "./"]
COPY ["src/Services/ExamService/ExamService/ExamService.csproj", "src/Services/ExamService/ExamService/"]
COPY ["src/Shared/Shared/Shared.csproj", "src/Shared/Shared/"]
RUN dotnet restore "src/Services/ExamService/ExamService/ExamService.csproj"
COPY . .
WORKDIR "/src/src/Services/ExamService/ExamService"
RUN dotnet build "ExamService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ExamService.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
USER $APP_UID
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ExamService.dll"]
