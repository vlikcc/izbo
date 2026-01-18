FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["src/Services/HomeworkService/HomeworkService/HomeworkService.csproj", "src/Services/HomeworkService/HomeworkService/"]
COPY ["src/Shared/Shared/Shared.csproj", "src/Shared/Shared/"]
RUN dotnet restore "src/Services/HomeworkService/HomeworkService/HomeworkService.csproj"
COPY . .
WORKDIR "/src/src/Services/HomeworkService/HomeworkService"
RUN dotnet build "HomeworkService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "HomeworkService.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "HomeworkService.dll"]
