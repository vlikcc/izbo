namespace Shared.DTOs;

// Common response wrapper
public record ApiResponse<T>(bool Success, T? Data, string? Message = null, List<string>? Errors = null);

// Pagination
public record PagedRequest(int Page = 1, int PageSize = 20, string? SortBy = null, bool SortDescending = false);
public record PagedResponse<T>(List<T> Items, int Page, int PageSize, int TotalCount, int TotalPages);

// Common error response
public record ErrorResponse(string Message, List<string>? Errors = null, string? TraceId = null);
