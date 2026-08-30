using Shared.Models;

namespace SubscriptionService.Services;

public record CheckoutResult(string Instructions, string? ProviderReference);

public enum PaymentStatus { Pending, Paid, Failed }

/// <summary>Abstraction over a real payment gateway. This phase ships only <see cref="ManualPaymentProvider"/>;
/// a future phase adds e.g. an IyzicoPaymentProvider behind this same interface and a webhook controller —
/// nothing else in SubscriptionService needs to change.</summary>
public interface IPaymentProvider
{
    string Name { get; }
    Task<CheckoutResult> CreateCheckoutAsync(SubscriptionOrder order, CancellationToken ct = default);
    Task<PaymentStatus> GetStatusAsync(string providerReference, CancellationToken ct = default);
}

/// <summary>No real payment integration yet: an order is created and left Pending. An admin confirms
/// payment out-of-band (bank transfer, invoice, etc.) via POST /api/admin/orders/{id}/mark-paid.</summary>
public class ManualPaymentProvider : IPaymentProvider
{
    public string Name => "Manual";

    public Task<CheckoutResult> CreateCheckoutAsync(SubscriptionOrder order, CancellationToken ct = default)
    {
        var instructions =
            "Talebiniz alındı. Ödeme ekibimiz en kısa sürede sizinle iletişime geçecek. " +
            $"Sipariş numaranız: {order.Id}.";
        return Task.FromResult(new CheckoutResult(instructions, ProviderReference: null));
    }

    public Task<PaymentStatus> GetStatusAsync(string providerReference, CancellationToken ct = default)
        => Task.FromResult(PaymentStatus.Pending);
}
