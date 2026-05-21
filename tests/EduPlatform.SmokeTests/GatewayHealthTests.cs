using Xunit;

namespace EduPlatform.SmokeTests;

public class GatewayHealthTests
{
    [Fact]
    public async Task Health_endpoint_returns_success_when_api_is_configured()
    {
        var baseUrl = Environment.GetEnvironmentVariable("SMOKE_API_URL");
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            // Skip in CI/local when stack is not running
            return;
        }

        using var client = new HttpClient { BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/") };
        var response = await client.GetAsync("health");
        response.EnsureSuccessStatusCode();
    }
}
