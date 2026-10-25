FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props ./
COPY src/FeelingLucky/FeelingLucky.csproj src/FeelingLucky/
COPY src/FeelingLucky.Host/FeelingLucky.Host.csproj src/FeelingLucky.Host/
RUN dotnet restore src/FeelingLucky.Host/FeelingLucky.Host.csproj
COPY src/ src/
RUN dotnet publish src/FeelingLucky.Host/FeelingLucky.Host.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENTRYPOINT ["dotnet", "FeelingLucky.Host.dll"]
