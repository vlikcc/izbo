namespace ClassroomService.Configuration;

/// <summary>
/// Credentials for signing Jitsi/JaaS room tokens. Supplied via configuration only; the service
/// refuses to mint tokens when they are absent rather than falling back to a placeholder secret.
/// </summary>
public sealed class JitsiOptions
{
    public const string SectionName = "Jitsi";

    public string AppId { get; set; } = string.Empty;

    public string AppSecret { get; set; } = string.Empty;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(AppId) && !string.IsNullOrWhiteSpace(AppSecret);
}
