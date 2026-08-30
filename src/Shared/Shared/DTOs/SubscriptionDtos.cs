using Shared.Models;

namespace Shared.DTOs;

// ---- Plans ----

public record PlanLimitDto(QuotaMetric Metric, long Value, QuotaPeriod Period);
public record PlanFeatureDto(string FeatureCode, bool IsEnabled);

public record PlanDto(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    decimal PriceMonthly,
    decimal PriceYearly,
    string Currency,
    int Tier,
    SubscriberType? TargetSubscriberType,
    bool IsPublic,
    List<PlanLimitDto> Limits,
    List<PlanFeatureDto> Features);

// ---- Subscription / entitlements ----

public record UsageSnapshotDto(QuotaMetric Metric, long Used, long Limit, QuotaPeriod Period);

public record SubscriptionDto(
    Guid Id,
    SubscriberType SubscriberType,
    Guid SubscriberId,
    PlanDto Plan,
    SubscriptionStatus Status,
    DateTime CurrentPeriodStart,
    DateTime CurrentPeriodEnd,
    DateTime? TrialEndsAt,
    bool TrialAvailable,
    bool CancelAtPeriodEnd,
    int SeatCount,
    List<UsageSnapshotDto> Usage);

/// <summary>Lean payload used by other services (via /api/internal/entitlements) to make gating decisions.</summary>
public record EntitlementsDto(
    SubscriberType SubscriberType,
    Guid SubscriberId,
    string PlanCode,
    SubscriptionStatus Status,
    List<PlanLimitDto> Limits,
    List<PlanFeatureDto> Features,
    List<UsageSnapshotDto> Usage);

public record CheckoutRequest(string PlanCode, BillingCycle Cycle);
public record CheckoutResultDto(Guid OrderId, decimal Amount, string Currency, string Provider, string Instructions);

public record ConsumeUsageRequest(QuotaMetric Metric, long Amount);
public record ConsumeUsageResultDto(bool Allowed, long Used, long Limit, string? Message);

// ---- Organizations ----

public record CreateOrganizationRequest(string Name);
public record OrganizationMemberDto(Guid Id, Guid UserId, OrgRole OrgRole, DateTime JoinedAt);
public record OrganizationDto(
    Guid Id,
    string Name,
    string Slug,
    Guid OwnerUserId,
    List<OrganizationMemberDto> Members);
public record AddOrganizationMemberRequest(Guid UserId, OrgRole OrgRole = OrgRole.Member);

// ---- Admin ----

public record AdminSubscriptionDto(
    Guid Id,
    SubscriberType SubscriberType,
    Guid SubscriberId,
    string PlanCode,
    SubscriptionStatus Status,
    DateTime CurrentPeriodEnd,
    DateTime? TrialEndsAt);

public record AdminAssignPlanRequest(string PlanCode, int? ExtendDays = null);

public record AdminOrderDto(
    Guid Id,
    Guid SubscriptionId,
    string PlanCode,
    BillingCycle Cycle,
    decimal Amount,
    string Currency,
    OrderStatus Status,
    DateTime CreatedAt);
