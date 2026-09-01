namespace Shared.Internal;

/// <summary>
/// Shared secret for service-to-service calls that carry no end-user token — chiefly account
/// provisioning, which happens during registration when nobody is signed in yet.
/// </summary>
public sealed class InternalApiOptions
{
    public const string SectionName = "Internal";

    /// <summary>Header the key travels in.</summary>
    public const string HeaderName = "X-Internal-Key";

    public string? ApiKey { get; set; }

    /// <summary>Base address of AuthService, for services that push account state to it.</summary>
    public string? AuthServiceUrl { get; set; }

    /// <summary>Base address of UserService, for services that push profiles to it.</summary>
    public string? UserServiceUrl { get; set; }
}
