using Minio;
using Minio.DataModel.Args;

namespace FileService.Services;

/// <summary>
/// Creates the storage bucket at start-up so a deployment that skipped scripts/init-minio-bucket.sh
/// still works, and so a misconfigured object store is visible in the logs immediately instead of on
/// whichever request first tries to upload something.
///
/// Deliberately non-fatal: object storage being briefly unreachable must not crash-loop the service.
/// Uploads create the bucket themselves if this did not manage to, and the health check reports the
/// object store as degraded until it recovers.
/// </summary>
public sealed class MinioBucketProvisioner : IHostedService
{
    private readonly IMinioClient _minio;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<MinioBucketProvisioner> _logger;
    private readonly string _bucketName;
    private readonly Uri _livenessUri;

    public MinioBucketProvisioner(
        IMinioClient minio,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<MinioBucketProvisioner> logger)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        _minio = minio;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _bucketName = configuration["MinIO:BucketName"] ?? "eduplatform";
        _livenessUri = MinioHealthCheck.LivenessUri(configuration);
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            // Reachability is settled over HTTP first, because BucketExistsAsync answers true even when
            // the server is stopped — logging "bucket is present" off that would be a lie.
            using var http = _httpClientFactory.CreateClient(MinioHealthCheck.HttpClientName);
            using var live = await http.GetAsync(_livenessUri, cancellationToken);
            live.EnsureSuccessStatusCode();

            var exists = await _minio.BucketExistsAsync(
                new BucketExistsArgs().WithBucket(_bucketName), cancellationToken);

            if (exists)
            {
                _logger.LogInformation("Storage bucket {Bucket} is present", _bucketName);
                return;
            }

            await _minio.MakeBucketAsync(new MakeBucketArgs().WithBucket(_bucketName), cancellationToken);
            _logger.LogInformation("Storage bucket {Bucket} created", _bucketName);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Could not prepare storage bucket {Bucket}. Uploads will fail until the object store is reachable",
                _bucketName);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
