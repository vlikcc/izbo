namespace EduPlatform.IntegrationTests;

/// <summary>A clock tests can move: lockouts expire, days and cup weeks turn.</summary>
internal sealed class MutableTime : TimeProvider
{
    public MutableTime(DateTimeOffset now)
    {
        Now = now;
    }

    public DateTimeOffset Now { get; set; }

    public override DateTimeOffset GetUtcNow() => Now;

    public void Advance(TimeSpan by) => Now += by;
}
