using System.Net;
using System.Text;
using ContentService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Shared.Authorization;
using Shared.Models;
using Shared.Subscription;
using Shouldly;

namespace EduPlatform.UnitTests;

public class LearnerAccessTests
{
    [Theory]
    [InlineData(8, "Lgs", new[] { "8-sinif", "lgs" })]
    [InlineData(11, "Yks", new[] { "11-sinif", "yks-tyt", "yks-ayt", "yks-ydt" })]
    [InlineData(5, "None", new[] { "5-sinif" })]
    [InlineData(null, null, new string[0])]
    [InlineData(13, null, new string[0])]
    public void A_students_levels_are_their_grade_and_exam_track(int? grade, string? exam, string[] expected) =>
        LearnerLevels.For(grade, exam).ShouldBe(expected);

    [Theory]
    [InlineData(9, 0, 6)]    // 12:00 in Istanbul: the day began at 21:00 UTC the evening before
    [InlineData(20, 59, 6)]  // 23:59 in Istanbul
    [InlineData(21, 0, 7)]   // midnight in Istanbul: a new day
    public void Daily_limits_reset_at_midnight_in_Istanbul(int hour, int minute, int dayStartedOnUtc)
    {
        var now = new DateTime(2026, 11, 7, hour, minute, 0, DateTimeKind.Utc);
        LearnerLevels.StartOfIstanbulDay(now).ShouldBe(new DateTime(2026, 11, dayStartedOnUtc, 21, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void Premium_content_opens_with_the_feature_at_the_students_levels()
    {
        var free = new ContentEntitlement(false, LearnerProfile.Free(3, ["5-sinif"]));
        var temel = new ContentEntitlement(false, new LearnerProfile(1, [LearnerFeatureCodes.PremiumContent], 3, ["5-sinif"]));
        var temelNoGrade = new ContentEntitlement(false, new LearnerProfile(1, [LearnerFeatureCodes.PremiumContent], 3, []));

        free.CanOpen(ContentAccessTier.Free, "6-sinif").ShouldBeTrue();
        free.CanOpen(ContentAccessTier.Premium, "5-sinif").ShouldBeFalse();
        temel.CanOpen(ContentAccessTier.Premium, "5-sinif").ShouldBeTrue();
        temel.CanOpen(ContentAccessTier.Premium, "6-sinif").ShouldBeFalse();
        temelNoGrade.CanOpen(ContentAccessTier.Premium, "6-sinif").ShouldBeTrue("no grade set yet: not held back by level");
        ContentEntitlement.Staff.CanOpen(ContentAccessTier.Premium, "12-sinif").ShouldBeTrue();

        temel.PracticeTestsPerDay.ShouldBe(3);
        new ContentEntitlement(false, new LearnerProfile(2, [LearnerFeatureCodes.UnlimitedPractice], 3, [])).PracticeTestsPerDay.ShouldBe(-1);
        ContentEntitlement.Staff.PracticeTestsPerDay.ShouldBe(-1);
    }

    [Fact]
    public async Task The_client_reads_the_package_and_grade_with_the_callers_token()
    {
        var handler = new StubHandler(request => request.RequestUri!.AbsolutePath switch
        {
            "/api/internal/learner-access" => Json("""{"success":true,"data":{"studentId":"00000000-0000-0000-0000-000000000001","packageCode":"plus","packageName":"Plus","tier":2,"features":["premium_content","unlimited_practice"],"practiceTestsPerDay":-1,"endsAt":null,"trialAvailable":false}}"""),
            "/api/users/me" => Json("""{"success":true,"data":{"id":"00000000-0000-0000-0000-000000000001","firstName":"A","lastName":"B","role":"Student","isActive":true,"createdAt":"2026-01-01T00:00:00Z","gradeLevel":8,"examTarget":"Lgs"}}"""),
            _ => new HttpResponseMessage(HttpStatusCode.NotFound)
        });

        var profile = await CreateClient(handler).GetAsync(Student);

        profile.Tier.ShouldBe(2);
        profile.Has(LearnerFeatureCodes.UnlimitedPractice).ShouldBeTrue();
        profile.Levels.ShouldBe(["8-sinif", "lgs"]);
        handler.Authorizations.ShouldAllBe(a => a == "Bearer token-123");
        handler.Authorizations.Count.ShouldBe(2);
    }

    [Fact]
    public async Task When_SubscriptionService_fails_the_student_is_treated_as_free()
    {
        var handler = new StubHandler(request => request.RequestUri!.AbsolutePath == "/api/users/me"
            ? Json("""{"success":true,"data":{"id":"00000000-0000-0000-0000-000000000001","firstName":"A","lastName":"B","role":"Student","isActive":true,"createdAt":"2026-01-01T00:00:00Z","gradeLevel":5}}""")
            : new HttpResponseMessage(HttpStatusCode.InternalServerError));

        var profile = await CreateClient(handler).GetAsync(Student);

        profile.Tier.ShouldBe(0);
        profile.Features.ShouldBeEmpty();
        profile.PracticeTestsPerDay.ShouldBe(3);
        profile.Levels.ShouldBe(["5-sinif"]);
    }

    private static readonly Caller Student = new(Guid.Parse("00000000-0000-0000-0000-000000000001"), UserRole.Student);

    private static LearnerAccessClient CreateClient(StubHandler handler)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers.Authorization = "Bearer token-123";
        return new LearnerAccessClient(
            new StubFactory(handler),
            new HttpContextAccessor { HttpContext = context },
            new MemoryCache(new MemoryCacheOptions()),
            Options.Create(new LearnerAccessOptions()),
            NullLogger<LearnerAccessClient>.Instance);
    }

    private static HttpResponseMessage Json(string body) =>
        new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public List<string> Authorizations { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Authorizations.Add(request.Headers.Authorization?.ToString() ?? string.Empty);
            return Task.FromResult(respond(request));
        }
    }

    private sealed class StubFactory(StubHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) =>
            new(handler, disposeHandler: false) { BaseAddress = new Uri("http://service/") };
    }
}

public class PackageRequiredResponseTests
{
    [Fact]
    public async Task A_missing_package_becomes_a_402_the_frontend_can_act_on()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var middleware = new QuotaExceptionMiddleware(_ =>
            throw new PackageRequiredException(2, PackageRequiredReasons.DailyLimit, "Günlük test hakkın doldu"));

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.ShouldBe(402);
        context.Response.Body.Position = 0;
        using var json = await System.Text.Json.JsonDocument.ParseAsync(context.Response.Body);
        json.RootElement.GetProperty("errorCode").GetString().ShouldBe("PACKAGE_REQUIRED");
        json.RootElement.GetProperty("requiredTier").GetInt32().ShouldBe(2);
        json.RootElement.GetProperty("reason").GetString().ShouldBe("daily_limit");
        json.RootElement.GetProperty("upgradeUrl").GetString().ShouldBe("/app/paketler");
    }
}
