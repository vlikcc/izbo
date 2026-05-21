namespace Shared.Configuration;

public class AdminSeedOptions
{
    public const string SectionName = "Seed";

    public bool Enabled { get; set; } = true;

    /// <summary>Stable ID so Auth and User databases stay in sync.</summary>
    public Guid AdminUserId { get; set; } = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    public string Email { get; set; } = "admin@eduplatform.local";

    public string Password { get; set; } = "";

    public string FirstName { get; set; } = "System";

    public string LastName { get; set; } = "Admin";

    public string Role { get; set; } = "SuperAdmin";
}
