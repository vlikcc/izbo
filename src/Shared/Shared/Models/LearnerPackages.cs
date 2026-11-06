namespace Shared.Models;

// Student packages (Temel / Plus / Premium), owned by SubscriptionService. They are separate from the
// teacher plans (free / pro / institution): a package belongs to one student, is prepaid for a fixed
// term and never renews by itself. A parent buys it for a linked child, or a student for themself.

/// <summary>How long a purchase lasts. Summer runs until a fixed date (mid-September).</summary>
public enum LearnerTerm
{
    Month1 = 0,
    Month3 = 1,
    Month12 = 2,
    Summer = 3
}

public enum LearnerPassSource
{
    Purchase = 0,
    Trial = 1,
    AdminGrant = 2
}

public enum LearnerOrderStatus
{
    /// <summary>Created; the payer has the bank details but has not said they paid.</summary>
    Pending = 0,

    /// <summary>The payer says the transfer is made; waiting for an administrator to see it arrive.</summary>
    AwaitingApproval = 1,

    Paid = 2,
    Rejected = 3,
    Canceled = 4
}

/// <summary>Feature codes a package grants. Stored per package so administrators can change what a tier includes.</summary>
public static class LearnerFeatures
{
    /// <summary>Content marked Premium (videos, PDFs) at the student's levels.</summary>
    public const string PremiumContent = "premium_content";

    /// <summary>Topic and unit tests without the daily limit.</summary>
    public const string UnlimitedPractice = "unlimited_practice";

    /// <summary>Mock exams and placement tests marked Premium.</summary>
    public const string PremiumAssessments = "premium_assessments";

    /// <summary>Live group lessons (Faz 4).</summary>
    public const string LiveGroupLessons = "live_group_lessons";
}

public class LearnerPackage
{
    public Guid Id { get; set; }

    /// <summary><c>temel</c>, <c>plus</c> or <c>premium</c>.</summary>
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    /// <summary>1 = Temel, 2 = Plus, 3 = Premium. When passes overlap, the highest tier wins.</summary>
    public int Tier { get; set; }

    public List<string> Features { get; set; } = new();

    /// <summary>Topic/unit tests a day; -1 is unlimited.</summary>
    public int PracticeTestsPerDay { get; set; } = 3;

    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public virtual ICollection<LearnerPackagePrice> Prices { get; set; } = new List<LearnerPackagePrice>();
}

public class LearnerPackagePrice
{
    public Guid Id { get; set; }
    public Guid PackageId { get; set; }
    public LearnerTerm Term { get; set; }

    /// <summary>Length of the term; ignored for Summer, which ends on a fixed date.</summary>
    public int DurationDays { get; set; }

    public decimal Price { get; set; }
    public string Currency { get; set; } = "TRY";
    public bool IsActive { get; set; } = true;

    public virtual LearnerPackage? Package { get; set; }
}

/// <summary>A period during which a student has a package. A student can hold several; the highest live tier applies.</summary>
public class LearnerPass
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public Guid PackageId { get; set; }
    public int Tier { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public LearnerPassSource Source { get; set; }
    public Guid? OrderId { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual LearnerPackage? Package { get; set; }
}

public class LearnerOrder
{
    public Guid Id { get; set; }

    /// <summary>Short code the payer writes in the transfer description, e.g. <c>YZK-8F3K2</c>.</summary>
    public string Reference { get; set; } = string.Empty;

    public Guid PayerId { get; set; }
    public Guid StudentId { get; set; }
    public Guid PackageId { get; set; }
    public LearnerTerm Term { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "TRY";
    public LearnerOrderStatus Status { get; set; } = LearnerOrderStatus.Pending;

    /// <summary><c>BankTransfer</c> today; a card provider's name once one is chosen.</summary>
    public string Provider { get; set; } = "BankTransfer";

    public string? ProviderReference { get; set; }
    public string? PayerNote { get; set; }
    public Guid? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? RejectReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }

    public virtual LearnerPackage? Package { get; set; }
}
