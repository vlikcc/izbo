using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Shared.Email;
using Shouldly;

namespace EduPlatform.UnitTests;

public class SmtpEmailSenderTests
{
    [Fact]
    public async Task Skips_send_when_host_is_not_configured()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var sender = new SmtpEmailSender(configuration, NullLogger<SmtpEmailSender>.Instance);

        await Should.NotThrowAsync(() =>
            sender.SendAsync(new EmailMessage("student@example.com", "Konu", "Gövde")));
    }
}
