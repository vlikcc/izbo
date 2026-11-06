using Microsoft.Extensions.Options;
using Shared.DTOs;
using Shared.Models;
using SubscriptionService.Configuration;

namespace SubscriptionService.Services.Learner;

/// <summary>Who is paying, for providers that need it (card providers ask for name and e-mail for 3-D Secure).</summary>
public record PaymentBuyer(Guid UserId, string? Name, string? Email, string? IpAddress);

/// <summary>
/// How a student-package order gets paid. Today only bank transfer: the order waits for an administrator.
/// A card provider (to be chosen) implements the same contract: <see cref="StartAsync"/> returns where
/// to send the buyer, and <see cref="HandleCallbackAsync"/> verifies the provider's callback and reports
/// the outcome; the order service then marks the order paid exactly as an approval does.
/// </summary>
public interface ILearnerPaymentProvider
{
    string Name { get; }

    Task<PaymentInstructionsDto> StartAsync(LearnerOrder order, PaymentBuyer buyer, CancellationToken cancellationToken = default);

    Task<PaymentCallbackResult> HandleCallbackAsync(IReadOnlyDictionary<string, string> fields, CancellationToken cancellationToken = default);
}

public record PaymentCallbackResult(bool Succeeded, string? OrderReference, string? ProviderReference, string? Error);

/// <summary>Havale/EFT: shows the bank account and the code to write in the description; an administrator confirms.</summary>
public class BankTransferPaymentProvider : ILearnerPaymentProvider
{
    private readonly BankTransferOptions _bank;

    public BankTransferPaymentProvider(IOptions<BankTransferOptions> bank)
    {
        ArgumentNullException.ThrowIfNull(bank);
        _bank = bank.Value;
    }

    public string Name => "BankTransfer";

    public Task<PaymentInstructionsDto> StartAsync(LearnerOrder order, PaymentBuyer buyer, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(order);
        return Task.FromResult(Instructions(order));
    }

    /// <summary>Bank transfers have no callback; an administrator approves them.</summary>
    public Task<PaymentCallbackResult> HandleCallbackAsync(IReadOnlyDictionary<string, string> fields, CancellationToken cancellationToken = default) =>
        Task.FromResult(new PaymentCallbackResult(false, null, null, "Bank transfers are approved by an administrator"));

    public PaymentInstructionsDto Instructions(LearnerOrder order)
    {
        ArgumentNullException.ThrowIfNull(order);

        var hasAccount = !string.IsNullOrWhiteSpace(_bank.Iban);
        var amount = order.Amount.ToString("N2", System.Globalization.CultureInfo.GetCultureInfo("tr-TR"));
        var text = hasAccount
            ? $"{amount} {order.Currency} tutarını aşağıdaki hesaba havale/EFT ile gönderin ve açıklamaya yalnızca {order.Reference} yazın. Ödeme hesaba geçince paket tanımlanır."
            : $"Ödeme bilgileri için bizimle iletişime geçin; sipariş kodunuz {order.Reference}.";

        return new PaymentInstructionsDto(
            Name,
            hasAccount ? _bank.BankName : null,
            hasAccount ? _bank.AccountHolder : null,
            hasAccount ? _bank.Iban : null,
            order.Reference,
            text);
    }
}
