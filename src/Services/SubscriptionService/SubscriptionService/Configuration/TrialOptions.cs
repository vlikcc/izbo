namespace SubscriptionService.Configuration;

public class TrialOptions
{
    public const string SectionName = "Trial";

    public int DurationDays { get; set; } = 14;

    /// <summary>Plan code an individual User is placed on while trialing.</summary>
    public string PlanCode { get; set; } = "pro";
}
