using System.Collections.Concurrent;
using ContentService.Services.Storage;

namespace EduPlatform.IntegrationTests;

/// <summary>Object storage held in memory, so the content workflow runs without MinIO.</summary>
internal sealed class InMemoryContentStorage : IContentStorage
{
    public ConcurrentDictionary<string, (byte[] Data, string ContentType)> Objects { get; } = new(StringComparer.Ordinal);

    public async Task<long> PutAsync(string key, Stream data, long size, string contentType, CancellationToken cancellationToken = default)
    {
        using var buffer = new MemoryStream();
        await data.CopyToAsync(buffer, cancellationToken);
        Objects[key] = (buffer.ToArray(), contentType);
        return buffer.Length;
    }

    public Task<StoredObjectInfo?> StatAsync(string key, CancellationToken cancellationToken = default) =>
        Task.FromResult(Objects.TryGetValue(key, out var value)
            ? new StoredObjectInfo(value.Data.Length, value.ContentType)
            : null);

    public async Task CopyToAsync(string key, Stream destination, long offset = 0, long? length = null, CancellationToken cancellationToken = default)
    {
        var data = Objects[key].Data;
        var count = length ?? (data.Length - offset);
        await destination.WriteAsync(data.AsMemory((int)offset, (int)count), cancellationToken);
    }

    public Task DeleteAsync(string key, CancellationToken cancellationToken = default)
    {
        Objects.TryRemove(key, out _);
        return Task.CompletedTask;
    }

    public Task DeletePrefixAsync(string prefix, CancellationToken cancellationToken = default)
    {
        foreach (var key in Objects.Keys.Where(k => k.StartsWith(prefix, StringComparison.Ordinal)).ToList())
        {
            Objects.TryRemove(key, out _);
        }

        return Task.CompletedTask;
    }
}
