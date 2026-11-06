namespace SubscriptionService.Configuration;

/// <summary>Student package rules (section <c>Learner</c>).</summary>
public class LearnerOptions
{
    public const string SectionName = "Learner";

    /// <summary>Topic/unit tests a day for a student without a package.</summary>
    public int FreePracticeTestsPerDay { get; set; } = 3;

    /// <summary>Package a one-off trial grants.</summary>
    public string TrialPackageCode { get; set; } = "plus";

    public int TrialDays { get; set; } = 7;

    /// <summary>The summer package lasts until this day (month/day, Europe/Istanbul).</summary>
    public int SummerEndsMonth { get; set; } = 9;

    public int SummerEndsDay { get; set; } = 15;

    /// <summary>The summer package can be bought from the start of this month…</summary>
    public int SummerSaleFromMonth { get; set; } = 5;

    /// <summary>…to the end of this one.</summary>
    public int SummerSaleToMonth { get; set; } = 8;

    /// <summary>Unpaid orders one payer may have open at once.</summary>
    public int MaxOpenOrdersPerPayer { get; set; } = 5;
}

/// <summary>Where bank transfers go (section <c>Payment:Bank</c>). Empty IBAN means "contact us".</summary>
public class BankTransferOptions
{
    public const string SectionName = "Payment:Bank";

    public string? BankName { get; set; }
    public string? AccountHolder { get; set; }
    public string? Iban { get; set; }
}
