namespace Shared.DTOs;

public record ApiResponse<T>(bool Success, T? Data, string? Message = null, List<string>? Errors = null);

/// <summary>
/// Page is 1-based. PageSize is clamped to 100 so a client cannot ask a service to materialise an
/// unbounded result set in a single round trip.
/// </summary>
public record PagedRequest(int Page = 1, int PageSize = 20, string? SortBy = null, bool SortDescending = false)
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public int NormalizedPage => Page < 1 ? 1 : Page;

    public int NormalizedPageSize
    {
        get
        {
            if (PageSize < 1)
            {
                return DefaultPageSize;
            }

            return PageSize > MaxPageSize ? MaxPageSize : PageSize;
        }
    }
}

public record PagedResponse<T>(List<T> Items, int Page, int PageSize, int TotalCount, int TotalPages);

public record ErrorResponse(string Message, List<string>? Errors = null, string? TraceId = null);
