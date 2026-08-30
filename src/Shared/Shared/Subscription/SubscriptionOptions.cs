namespace Shared.Subscription;

public class SubscriptionOptions
{
    public const string SectionName = "Subscription";

    /// <summary>Base URL of SubscriptionService, e.g. http://subscriptionservice:80. Empty in a service
    /// that doesn't call AddSubscriptionGuard.</summary>
    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>If SubscriptionService is unreachable, allow the request through instead of blocking it.
    /// A billing outage should never stop a class from running.</summary>
    public bool FailOpen { get; set; } = true;

    public int EntitlementsCacheSeconds { get; set; } = 60;

    public int TimeoutSeconds { get; set; } = 5;
}
