namespace Shared.Models;

public enum SubscriberType
{
    User = 0,
    Organization = 1
}

public enum SubscriptionStatus
{
    Trialing = 0,
    Active = 1,
    PastDue = 2,
    Canceled = 3,
    Expired = 4
}

public enum BillingCycle
{
    Monthly = 0,
    Yearly = 1
}

public enum QuotaPeriod
{
    Absolute = 0,
    Monthly = 1
}

public enum QuotaMetric
{
    Classrooms = 0,
    ExamsCreated = 1,
    HomeworksCreated = 2,
    LiveMinutes = 3,
    StorageMegabytes = 4,
    MaxStudentsPerClassroom = 5,
    MaxQuestionsPerExam = 6,
    Seats = 7
}

public enum OrderStatus
{
    Pending = 0,
    Paid = 1,
    Failed = 2,
    Canceled = 3
}

public enum OrgRole
{
    Owner = 0,
    Admin = 1,
    Member = 2
}

/// <summary>A purchasable plan (Free / Pro / Institution, ...).</summary>
public class Plan
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal PriceMonthly { get; set; }
    public decimal PriceYearly { get; set; }
    public string Currency { get; set; } = "TRY";
    public int Tier { get; set; }
    public SubscriberType? TargetSubscriberType { get; set; }
    public bool IsPublic { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<PlanLimit> Limits { get; set; } = new();
    public List<PlanFeature> Features { get; set; } = new();
}

/// <summary>A single quota limit belonging to a plan. Value = -1 means unlimited.</summary>
public class PlanLimit
{
    public Guid Id { get; set; }
    public Guid PlanId { get; set; }
    public QuotaMetric Metric { get; set; }
    public long Value { get; set; }
    public QuotaPeriod Period { get; set; }

    public Plan? Plan { get; set; }
}

/// <summary>A boolean feature flag belonging to a plan (e.g. "live_quiz").</summary>
public class PlanFeature
{
    public Guid Id { get; set; }
    public Guid PlanId { get; set; }
    public string FeatureCode { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;

    public Plan? Plan { get; set; }
}

/// <summary>An institution/school. Kept in the Subscription DB — cross-service references (OwnerUserId,
/// OrganizationMember.UserId) are plain Guids with no FK, same pattern as other services.</summary>
public class Organization
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public Guid OwnerUserId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<OrganizationMember> Members { get; set; } = new();
}

public class OrganizationMember
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid UserId { get; set; }
    public OrgRole OrgRole { get; set; } = OrgRole.Member;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    public Organization? Organization { get; set; }
}

/// <summary>The single active subscription for a subscriber (a User or an Organization).</summary>
public class Subscription
{
    public Guid Id { get; set; }
    public SubscriberType SubscriberType { get; set; }
    public Guid SubscriberId { get; set; }
    public Guid PlanId { get; set; }
    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Active;
    public DateTime CurrentPeriodStart { get; set; } = DateTime.UtcNow;
    public DateTime CurrentPeriodEnd { get; set; } = DateTime.UtcNow.AddMonths(1);
    public DateTime? TrialEndsAt { get; set; }
    public DateTime? TrialUsedAt { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
    public int SeatCount { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Plan? Plan { get; set; }
}

/// <summary>A usage counter for one subscriber/metric. PeriodStart is null for Absolute metrics
/// (e.g. Classrooms, StorageMegabytes) and set to the subscription's CurrentPeriodStart for Monthly metrics.</summary>
public class UsageCounter
{
    public Guid Id { get; set; }
    public SubscriberType SubscriberType { get; set; }
    public Guid SubscriberId { get; set; }
    public QuotaMetric Metric { get; set; }
    public DateTime? PeriodStart { get; set; }
    public long Value { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>A placeholder order record for a plan purchase. In this phase there is no real payment
/// provider — orders stay Pending until an admin marks them Paid.</summary>
public class SubscriptionOrder
{
    public Guid Id { get; set; }
    public Guid SubscriptionId { get; set; }
    public Guid PlanId { get; set; }
    public BillingCycle Cycle { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "TRY";
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public string Provider { get; set; } = "Manual";
    public string? ProviderReference { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
}

/// <summary>Audit trail for subscription lifecycle changes.</summary>
public class SubscriptionEvent
{
    public Guid Id { get; set; }
    public SubscriberType SubscriberType { get; set; }
    public Guid SubscriberId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string? PayloadJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
