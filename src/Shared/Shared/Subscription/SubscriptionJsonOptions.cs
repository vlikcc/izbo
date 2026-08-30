using System.Text.Json;
using System.Text.Json.Serialization;

namespace Shared.Subscription;

/// <summary>Shared JSON options for the subscription surface: enums (QuotaMetric, QuotaPeriod,
/// SubscriberType, ...) serialize as their string names, matching the frontend's string-literal
/// union types and this repo's existing convention (see ExamService's JsonStringEnumConverter).
/// Used both by SubscriptionService's own controllers and by EntitlementClient, which talks to it
/// over a plain HttpClient that doesn't inherit ASP.NET Core's MVC JSON configuration.</summary>
public static class SubscriptionJsonOptions
{
    public static readonly JsonSerializerOptions Default = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };
}
