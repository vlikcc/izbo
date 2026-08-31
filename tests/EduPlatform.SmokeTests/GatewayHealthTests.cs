using Xunit;

namespace EduPlatform.SmokeTests;

public class GatewayHealthTests
{
    [SkippableFact]
    public async Task Health_endpoint_returns_success_when_api_is_configured()
    {
        var baseUrl = Environment.GetEnvironmentVariable("SMOKE_API_URL");
        Skip.If(string.IsNullOrWhiteSpace(baseUrl), "SMOKE_API_URL is not set; the stack is not running.");

        using var client = new HttpClient { BaseAddress = new Uri(baseUrl!.TrimEnd('/') + "/") };
        var response = await client.GetAsync("health");
        response.EnsureSuccessStatusCode();
    }
}
