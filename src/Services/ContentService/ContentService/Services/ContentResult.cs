namespace ContentService.Services;

public enum ContentResultStatus
{
    Ok,
    NotFound,
    Forbidden,
    Conflict,
    Invalid
}

/// <summary>A service outcome the controllers translate to a status code.</summary>
public sealed record ContentResult<T>(ContentResultStatus Status, T? Value, string? Error)
{
    public bool IsOk => Status == ContentResultStatus.Ok;
}

public static class ContentResult
{
    public static ContentResult<T> Ok<T>(T value) => new(ContentResultStatus.Ok, value, null);

    public static ContentResult<T> NotFound<T>(string error = "Not found") => new(ContentResultStatus.NotFound, default, error);

    public static ContentResult<T> Forbidden<T>(string error) => new(ContentResultStatus.Forbidden, default, error);

    public static ContentResult<T> Conflict<T>(string error) => new(ContentResultStatus.Conflict, default, error);

    public static ContentResult<T> Invalid<T>(string error) => new(ContentResultStatus.Invalid, default, error);
}
