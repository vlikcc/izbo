using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Shared.Email;

public sealed record EmailMessage(string To, string Subject, string Body);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}

public sealed class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IConfiguration configuration, ILogger<SmtpEmailSender> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(message);

        var host = _configuration["Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            _logger.LogInformation("SMTP is not configured; email to {To} was skipped: {Subject}", message.To, message.Subject);
            return;
        }

        var port = _configuration.GetValue("Smtp:Port", 587);
        var from = _configuration["Smtp:From"] ?? "noreply@eduplatform.local";
        var userName = _configuration["Smtp:User"];
        var password = _configuration["Smtp:Password"];

#pragma warning disable SYSLIB0014 // SmtpClient is the in-box sender; MailKit is not a project dependency.
        using var client = new SmtpClient(host, port)
        {
            EnableSsl = _configuration.GetValue("Smtp:EnableSsl", true),
            DeliveryMethod = SmtpDeliveryMethod.Network
        };

        if (!string.IsNullOrWhiteSpace(userName))
        {
            client.Credentials = new NetworkCredential(userName, password);
        }

        using var mail = new MailMessage(from, message.To, message.Subject, message.Body);
        await client.SendMailAsync(mail, cancellationToken);
#pragma warning restore SYSLIB0014
        _logger.LogInformation("Sent email to {To}: {Subject}", message.To, message.Subject);
    }
}
