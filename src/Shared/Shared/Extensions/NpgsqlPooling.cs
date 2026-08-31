using Npgsql;

namespace Shared.Extensions;

public static class NpgsqlPooling
{
    public const int DefaultMaxPoolSize = 50;
    public const int DefaultMinPoolSize = 1;
    public const int DefaultTimeoutSeconds = 15;

    /// <summary>
    /// Caps the connection pool so a service cannot exhaust Postgres under load. Existing values in the
    /// connection string are left alone.
    /// </summary>
    public static string Apply(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return connectionString ?? string.Empty;
        }

        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        if (!HasKey(connectionString, "Maximum Pool Size") && !HasKey(connectionString, "MaxPoolSize"))
        {
            builder.MaxPoolSize = DefaultMaxPoolSize;
        }

        if (!HasKey(connectionString, "Minimum Pool Size") && !HasKey(connectionString, "MinPoolSize"))
        {
            builder.MinPoolSize = DefaultMinPoolSize;
        }

        if (!HasKey(connectionString, "Timeout"))
        {
            builder.Timeout = DefaultTimeoutSeconds;
        }

        return builder.ConnectionString;
    }

    private static bool HasKey(string connectionString, string key) =>
        connectionString.Contains(key, StringComparison.OrdinalIgnoreCase);
}
