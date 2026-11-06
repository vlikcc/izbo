using Shared.Models;

namespace Shared.DTOs;

// ---- Catalogue ----

public record LearnerPriceDto(LearnerTerm Term, int DurationDays, decimal Price, string Currency, bool IsActive);

public record LearnerPackageDto(
    string Code,
    string Name,
    string Description,
    int Tier,
    List<string> Features,
    int PracticeTestsPerDay,
    bool IsActive,
    int SortOrder,
    List<LearnerPriceDto> Prices);

// ---- Access ----

/// <summary>
/// What a student may use right now. With no live package <paramref name="Tier"/> is 0 and the free
/// limits apply. <paramref name="EndsAt"/> is when the current package (with any queued extension) runs out.
/// </summary>
public record LearnerAccessDto(
    Guid StudentId,
    string? PackageCode,
    string? PackageName,
    int Tier,
    List<string> Features,
    int PracticeTestsPerDay,
    DateTime? EndsAt,
    bool TrialAvailable);

public record LearnerPassDto(
    Guid Id,
    string PackageCode,
    string PackageName,
    int Tier,
    DateTime StartsAt,
    DateTime EndsAt,
    LearnerPassSource Source);

// ---- Orders ----

public record CreateLearnerOrderRequest(Guid StudentId, string PackageCode, LearnerTerm Term);

public record LearnerPaidNoticeRequest(string? Note);

public record StartLearnerTrialRequest(Guid StudentId);

/// <summary>Where and how to pay for an order. For a bank transfer: the account and the code to write in the description.</summary>
public record PaymentInstructionsDto(
    string Method,
    string? BankName,
    string? AccountHolder,
    string? Iban,
    string Reference,
    string Text);

public record LearnerOrderDto(
    Guid Id,
    string Reference,
    Guid PayerId,
    Guid StudentId,
    string PackageCode,
    string PackageName,
    LearnerTerm Term,
    decimal Amount,
    string Currency,
    LearnerOrderStatus Status,
    string Provider,
    string? PayerNote,
    string? RejectReason,
    DateTime CreatedAt,
    DateTime? PaidAt,
    PaymentInstructionsDto? Instructions);

// ---- Administration ----

public record RejectLearnerOrderRequest(string Reason);

public record GrantLearnerPassRequest(Guid StudentId, string PackageCode, int Days);

public record UpdateLearnerPackageRequest(
    string Name,
    string? Description,
    List<string> Features,
    int PracticeTestsPerDay,
    bool IsActive,
    int SortOrder);

public record SetLearnerPricesRequest(List<LearnerPriceDto> Prices);
