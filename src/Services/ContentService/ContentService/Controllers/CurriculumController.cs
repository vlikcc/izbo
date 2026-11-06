using ContentService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;

namespace ContentService.Controllers;

/// <summary>The curriculum tree, readable by anyone signed in.</summary>
[ApiController]
[Route("api/content")]
[Authorize]
public class CurriculumController : ControllerBase
{
    private readonly ICurriculumService _curriculum;

    public CurriculumController(ICurriculumService curriculum) => _curriculum = curriculum;

    private Caller Caller => User.GetCaller();

    [HttpGet("levels")]
    public async Task<ActionResult<ApiResponse<List<LevelDto>>>> GetLevels(CancellationToken cancellationToken) =>
        Ok(new ApiResponse<List<LevelDto>>(true, await _curriculum.GetLevelsAsync(cancellationToken)));

    [HttpGet("levels/{slug}/subjects")]
    public async Task<ActionResult<ApiResponse<List<SubjectDto>>>> GetSubjects(string slug, CancellationToken cancellationToken)
    {
        var subjects = await _curriculum.GetSubjectsAsync(slug, cancellationToken);
        return subjects is null
            ? NotFound(new ApiResponse<List<SubjectDto>>(false, null, "Level not found"))
            : Ok(new ApiResponse<List<SubjectDto>>(true, subjects));
    }

    [HttpGet("subjects/{id:guid}/tree")]
    public async Task<ActionResult<ApiResponse<SubjectTreeDto>>> GetSubjectTree(Guid id, CancellationToken cancellationToken)
    {
        var tree = await _curriculum.GetSubjectTreeAsync(id, Caller, cancellationToken);
        return tree is null
            ? NotFound(new ApiResponse<SubjectTreeDto>(false, null, "Subject not found"))
            : Ok(new ApiResponse<SubjectTreeDto>(true, tree));
    }

    [HttpGet("topics/{id:guid}")]
    public async Task<ActionResult<ApiResponse<TopicDetailDto>>> GetTopic(Guid id, CancellationToken cancellationToken)
    {
        var topic = await _curriculum.GetTopicAsync(id, Caller, cancellationToken);
        return topic is null
            ? NotFound(new ApiResponse<TopicDetailDto>(false, null, "Topic not found"))
            : Ok(new ApiResponse<TopicDetailDto>(true, topic));
    }
}
