using ContentService.Data;
using Shared.DTOs;
using Shared.Models;

namespace ContentService.Services.Assessments;

internal static class AssessmentQueries
{
    /// <summary>Answers arriving this long after the deadline still count, to absorb network latency.</summary>
    public static readonly TimeSpan Grace = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Questions held back for a test that is not over: every placement question, and the questions of a
    /// mock exam until its window closes. Teachers do not see them and practice tests do not draw them,
    /// so nobody meets a deneme question before the deneme.
    /// </summary>
    public static IQueryable<Guid> ReservedQuestionIds(ContentDbContext db, DateTime now) =>
        db.AssessmentQuestions
            .Where(aq => aq.Assessment!.Kind == AssessmentKind.Placement
                || aq.Assessment.WindowEnd == null
                || aq.Assessment.WindowEnd > now)
            .Select(aq => aq.QuestionId);

    public static AssessmentWindowState WindowState(Assessment assessment, DateTime now)
    {
        if (assessment.Kind == AssessmentKind.Placement)
        {
            return AssessmentWindowState.Open;
        }

        if (assessment.WindowStart is { } start && now < start)
        {
            return AssessmentWindowState.Upcoming;
        }

        return assessment.WindowEnd is { } end && now >= end ? AssessmentWindowState.Closed : AssessmentWindowState.Open;
    }

    /// <summary>
    /// A ranked mock-exam sitting shows nothing until the window closes, so answers cannot leak to students
    /// still taking it. Everything else shows as soon as it is finished.
    /// </summary>
    public static (bool Visible, DateTime? At) ResultsVisibility(Attempt attempt, DateTime now)
    {
        if (attempt.Status == AttemptStatus.InProgress)
        {
            return (false, null);
        }

        if (!attempt.IsRanked || attempt.Assessment is null)
        {
            return (true, null);
        }

        var end = attempt.Assessment.WindowEnd;
        return (end is null || now >= end, end);
    }

    public static AttemptSummaryDto ToSummary(Attempt attempt, DateTime now)
    {
        var (visible, at) = ResultsVisibility(attempt, now);
        var rankKnown = visible && attempt.Rank is not null;

        return new AttemptSummaryDto(
            attempt.Id,
            attempt.Scope,
            attempt.Assessment?.Kind,
            attempt.AssessmentId,
            attempt.TopicId,
            attempt.UnitId,
            attempt.Title,
            attempt.Status,
            attempt.ScoringRule,
            attempt.StartedAt,
            attempt.Deadline,
            attempt.SubmittedAt,
            attempt.Items.Count,
            attempt.Items.Count(i => i.SelectedKey != null),
            visible,
            at,
            visible ? attempt.Correct : null,
            visible ? attempt.Wrong : null,
            visible ? attempt.Blank : null,
            visible ? attempt.Net : null,
            visible ? attempt.Percent : null,
            attempt.IsRanked,
            rankKnown ? attempt.Rank : null,
            rankKnown ? attempt.ParticipantCount : null,
            rankKnown ? attempt.TopPercent : null);
    }
}
