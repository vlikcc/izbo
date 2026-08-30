using System.Net;
using Xunit;

namespace EduPlatform.SmokeTests;

public class SubscriptionSmokeTests
{
    [Fact]
    public async Task Plans_endpoint_is_public_and_returns_success()
    {
        var baseUrl = Environment.GetEnvironmentVariable("SMOKE_API_URL");
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            // Skip in CI/local when stack is not running
            return;
        }

        using var client = new HttpClient { BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/") };
        var response = await client.GetAsync("api/plans");
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task My_subscription_requires_authentication()
    {
        var baseUrl = Environment.GetEnvironmentVariable("SMOKE_API_URL");
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            return;
        }

        using var client = new HttpClient { BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/") };
        var response = await client.GetAsync("api/subscriptions/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
