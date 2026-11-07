using System.Reflection;
using System.Text.RegularExpressions;
using ExamService.Hubs;
using Shouldly;

namespace EduPlatform.IntegrationTests;

/// <summary>
/// The server's live-quiz message names and the web client's must match: a name that differs on one
/// side is not an error anywhere, the message is just never handled (QuestionChanged was sent while the
/// client listened for QuestionStarted).
/// </summary>
public partial class LiveQuizEventsContractTests
{
    [Fact]
    public void Every_event_constant_is_listed()
    {
        var constants = typeof(LiveQuizEvents)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(f => f.IsLiteral)
            .Select(f => (string)f.GetRawConstantValue()!)
            .ToList();

        LiveQuizEvents.All.ShouldBe(constants, ignoreOrder: true);
    }

    [Fact]
    public void Client_listens_for_exactly_the_events_the_server_sends()
    {
        var source = File.ReadAllText(Path.Combine(RepositoryRoot(), "frontend", "src", "services", "liveQuizHub.ts"));

        var block = EventsBlock().Match(source);
        block.Success.ShouldBeTrue("LIVE_QUIZ_EVENTS was not found in liveQuizHub.ts");

        var clientEvents = EventEntry().Matches(block.Groups["body"].Value)
            .Select(m =>
            {
                m.Groups["key"].Value.ShouldBe(m.Groups["value"].Value, "a key and its event name differ");
                return m.Groups["value"].Value;
            })
            .ToList();

        clientEvents.ShouldBe(LiveQuizEvents.All, ignoreOrder: true);
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "EduPlatform.sln")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("EduPlatform.sln not found above the test output.");
    }

    [GeneratedRegex(@"LIVE_QUIZ_EVENTS\s*=\s*\{(?<body>[^}]*)\}")]
    private static partial Regex EventsBlock();

    [GeneratedRegex(@"(?<key>\w+)\s*:\s*'(?<value>[^']+)'")]
    private static partial Regex EventEntry();
}
