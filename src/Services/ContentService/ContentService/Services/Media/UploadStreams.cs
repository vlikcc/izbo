namespace ContentService.Services.Media;

/// <summary>Thrown by <see cref="LimitedReadStream"/> once an upload passes the configured ceiling.</summary>
public sealed class UploadTooLargeException : Exception
{
    public UploadTooLargeException() { }

    public UploadTooLargeException(string message) : base(message) { }

    public UploadTooLargeException(string message, Exception innerException) : base(message, innerException) { }
}

/// <summary>
/// Replays a sniffed prefix, then continues with the rest of a forward-only stream, so the first bytes of
/// a request body can be inspected without buffering the body.
/// </summary>
internal sealed class PrefixedReadStream : Stream
{
    private readonly byte[] _prefix;
    private readonly Stream _rest;
    private int _prefixOffset;

    public PrefixedReadStream(byte[] prefix, Stream rest)
    {
        _prefix = prefix;
        _rest = rest;
    }

    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => throw new NotSupportedException();

    public override long Position
    {
        get => throw new NotSupportedException();
        set => throw new NotSupportedException();
    }

    public override int Read(byte[] buffer, int offset, int count) =>
        ReadAsync(buffer.AsMemory(offset, count)).AsTask().GetAwaiter().GetResult();

    public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
        ReadAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();

    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        if (_prefixOffset < _prefix.Length)
        {
            var count = Math.Min(buffer.Length, _prefix.Length - _prefixOffset);
            _prefix.AsMemory(_prefixOffset, count).CopyTo(buffer);
            _prefixOffset += count;
            return count;
        }

        return await _rest.ReadAsync(buffer, cancellationToken);
    }

    public override void Flush() { }
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
}

/// <summary>Fails the read that would take the stream past <c>maxBytes</c>.</summary>
internal sealed class LimitedReadStream : Stream
{
    private readonly Stream _inner;
    private readonly long _maxBytes;
    private long _read;

    public LimitedReadStream(Stream inner, long maxBytes)
    {
        _inner = inner;
        _maxBytes = maxBytes;
    }

    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => throw new NotSupportedException();

    public override long Position
    {
        get => _read;
        set => throw new NotSupportedException();
    }

    public override int Read(byte[] buffer, int offset, int count) =>
        ReadAsync(buffer.AsMemory(offset, count)).AsTask().GetAwaiter().GetResult();

    public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
        ReadAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();

    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        var read = await _inner.ReadAsync(buffer, cancellationToken);
        _read += read;
        if (_read > _maxBytes)
        {
            throw new UploadTooLargeException($"The upload exceeds the {_maxBytes / (1024 * 1024)} MB limit.");
        }

        return read;
    }

    public override void Flush() { }
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
}
