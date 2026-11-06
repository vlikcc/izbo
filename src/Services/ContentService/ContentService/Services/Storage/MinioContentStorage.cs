using Minio;
using Minio.DataModel.Args;
using Minio.Exceptions;

namespace ContentService.Services.Storage;

public sealed class MinioContentStorage : IContentStorage
{
    private readonly IMinioClient _minio;
    private readonly ILogger<MinioContentStorage> _logger;
    private readonly string _bucket;
    private int _bucketVerified;

    public MinioContentStorage(IMinioClient minio, IConfiguration configuration, ILogger<MinioContentStorage> logger)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        _minio = minio;
        _logger = logger;
        _bucket = ContentBucket.Name(configuration);
    }

    public async Task<long> PutAsync(string key, Stream data, long size, string contentType, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(data);

        await EnsureBucketAsync(cancellationToken);

        await using var counting = new CountingReadStream(data);
        var stored = await _minio.PutObjectAsync(new PutObjectArgs()
            .WithBucket(_bucket)
            .WithObject(key)
            .WithStreamData(counting)
            .WithObjectSize(size)
            .WithContentType(contentType), cancellationToken);

        // Same receipt check as FileService: the SDK reports success without an ETag when the write never
        // reached the server, which would otherwise leave the database pointing at an empty object.
        if (string.IsNullOrEmpty(stored?.Etag))
        {
            throw new ContentStorageException($"Object store did not acknowledge {key}.");
        }

        return counting.BytesRead;
    }

    public async Task<StoredObjectInfo?> StatAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            var stat = await _minio.StatObjectAsync(
                new StatObjectArgs().WithBucket(_bucket).WithObject(key), cancellationToken);
            return new StoredObjectInfo(stat.Size, stat.ContentType ?? "application/octet-stream");
        }
        catch (ObjectNotFoundException)
        {
            return null;
        }
        catch (BucketNotFoundException)
        {
            return null;
        }
    }

    public Task CopyToAsync(string key, Stream destination, long offset = 0, long? length = null, CancellationToken cancellationToken = default)
    {
        var args = new GetObjectArgs()
            .WithBucket(_bucket)
            .WithObject(key)
            .WithCallbackStream((source, token) => source.CopyToAsync(destination, token));

        if (offset > 0 || length.HasValue)
        {
            args = args.WithOffsetAndLength(offset, length ?? 0);
        }

        return _minio.GetObjectAsync(args, cancellationToken);
    }

    public async Task DeleteAsync(string key, CancellationToken cancellationToken = default)
    {
        await _minio.RemoveObjectAsync(new RemoveObjectArgs().WithBucket(_bucket).WithObject(key), cancellationToken);
    }

    public async Task DeletePrefixAsync(string prefix, CancellationToken cancellationToken = default)
    {
        var keys = new List<string>();
        await foreach (var item in _minio.ListObjectsEnumAsync(
            new ListObjectsArgs().WithBucket(_bucket).WithPrefix(prefix).WithRecursive(true), cancellationToken))
        {
            keys.Add(item.Key);
        }

        if (keys.Count == 0)
        {
            return;
        }

        var errors = await _minio.RemoveObjectsAsync(
            new RemoveObjectsArgs().WithBucket(_bucket).WithObjects(keys), cancellationToken);
        if (errors.Count > 0)
        {
            _logger.LogWarning("{Count} objects under {Prefix} could not be removed", errors.Count, prefix);
        }
    }

    private async Task EnsureBucketAsync(CancellationToken cancellationToken)
    {
        if (Volatile.Read(ref _bucketVerified) == 1)
        {
            return;
        }

        var exists = await _minio.BucketExistsAsync(new BucketExistsArgs().WithBucket(_bucket), cancellationToken);
        if (!exists)
        {
            await _minio.MakeBucketAsync(new MakeBucketArgs().WithBucket(_bucket), cancellationToken);
        }

        Volatile.Write(ref _bucketVerified, 1);
    }
}

public static class ContentBucket
{
    public const string DefaultName = "eduplatform-content";

    public static string Name(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var configured = configuration["MinIO:BucketName"];
        return string.IsNullOrWhiteSpace(configured) ? DefaultName : configured;
    }
}

/// <summary>Forwards reads and counts the bytes that passed through.</summary>
internal sealed class CountingReadStream : Stream
{
    private readonly Stream _inner;

    public CountingReadStream(Stream inner) => _inner = inner;

    public long BytesRead { get; private set; }

    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => throw new NotSupportedException();

    public override long Position
    {
        get => BytesRead;
        set => throw new NotSupportedException();
    }

    public override int Read(byte[] buffer, int offset, int count)
    {
        var read = _inner.Read(buffer, offset, count);
        BytesRead += read;
        return read;
    }

    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        var read = await _inner.ReadAsync(buffer, cancellationToken);
        BytesRead += read;
        return read;
    }

    public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
        ReadAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();

    public override void Flush() { }
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
}
