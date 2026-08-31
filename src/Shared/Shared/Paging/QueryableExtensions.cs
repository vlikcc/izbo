using Microsoft.EntityFrameworkCore;
using Shared.DTOs;
using System.Linq.Expressions;

namespace Shared.Paging;

public static class QueryableExtensions
{
    public static IQueryable<T> ApplySort<T>(
        this IQueryable<T> query,
        PagedRequest request,
        IReadOnlyDictionary<string, Expression<Func<T, object>>> allowed,
        string defaultKey)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(allowed);

        var key = request.SortBy is { Length: > 0 } && allowed.ContainsKey(request.SortBy)
            ? request.SortBy
            : defaultKey;

        if (!allowed.TryGetValue(key, out var expression))
        {
            throw new InvalidOperationException($"Sort key '{defaultKey}' is not in the allow-list.");
        }

        return request.SortDescending
            ? query.OrderByDescending(expression)
            : query.OrderBy(expression);
    }

    public static async Task<PagedResponse<T>> ToPagedResponseAsync<T>(
        this IQueryable<T> query,
        PagedRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(request);

        var page = request.NormalizedPage;
        var pageSize = request.NormalizedPageSize;
        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var totalPages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)pageSize);
        return new PagedResponse<T>(items, page, pageSize, total, totalPages);
    }
}
