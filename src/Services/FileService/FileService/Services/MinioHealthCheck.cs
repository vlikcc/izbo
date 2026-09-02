using Microsoft.Extensions.Diagnostics.HealthChecks;
using Minio;
using Minio.DataModel.Args;

namespace FileService.Services;

/// <summary>
/// Reports whether the object store is reachable and holds the bucket uploads are written to.
///
/// Reachability is probed over plain HTTP against MinIO's own liveness endpoint rather than through
/// the SDK. The SDK cannot answer the question: with the server stopped, BucketExistsAsync still
/// returns true and PutObjectAsync still returns without throwing — the same leniency that let
/// uploads report success while storing nothing.
///
/// Registered as Degraded rather than Unhealthy on purpose. The container health check gates
/// depends_on in compose and the gateway waits on this service, so failing hard here would turn an
/// object-storage blip into the whole platform refusing to start. Degraded keeps /health answering
/// 200 while still naming the problem in the response body.
/// </summary>
public sealed class MinioHealthCheck : IHealthCheck
{
    public const string HttpClientName = "minio-health";

    private readonly IMinioClient _minio;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _bucketName;
    private readonly Uri _livenessUri;

    public MinioHealthCheck(IMinioClient minio, IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        _minio = minio;
        _httpClientFactory = httpClientFactory;
        _bucketName = configuration["MinIO:BucketName"] ?? "eduplatform";
        _livenessUri = LivenessUri(configuration);
    }

    /// <summary>MinIO serves an unauthenticated liveness probe at /minio/health/live.</summary>
    public static Uri LivenessUri(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var endpoint = configuration["MinIO:Endpoint"] ?? "localhost:9000";
        var scheme = configuration.GetValue<bool>("MinIO:UseSsl") ? "https" : "http";
        return new Uri($"{scheme}://{endpoint.TrimEnd('/')}/minio/health/live");
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);

        try
        {
            using var http = _httpClientFactory.CreateClient(HttpClientName);
            using var response = await http.GetAsync(_livenessUri, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return new HealthCheckResult(
                    context.Registration.FailureStatus,
                    $"Object storage answered {(int)response.StatusCode} on its liveness probe.");
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return new HealthCheckResult(
                context.Registration.FailureStatus, "Object storage is unreachable.", ex);
        }

        // Only meaningful once the server is known to be up, for the reason in the class comment.
        var exists = await _minio.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(_bucketName), cancellationToken);

        return exists
            ? HealthCheckResult.Healthy($"Bucket '{_bucketName}' is available.")
            : new HealthCheckResult(
                context.Registration.FailureStatus, $"Bucket '{_bucketName}' does not exist.");
    }
}
