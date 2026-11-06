using FluentValidation;
using Shared.DTOs;

namespace Shared.Validation;

internal static class ContentRules
{
    public const int NameMax = 200;
    public const int SlugMax = 100;
    public const int TitleMax = 255;
    public const int DescriptionMax = 4000;
    public const int OutcomeCodeMax = 64;
    public const int OutcomeDescriptionMax = 2000;
    public const int ReviewNoteMax = 2000;

    public const string SlugPattern = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
    public const string ColorPattern = "^#[0-9a-fA-F]{6}$";

    public static bool IsHttpsUrl(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps;
}

public sealed class CreateSubjectRequestValidator : AbstractValidator<CreateSubjectRequest>
{
    public CreateSubjectRequestValidator()
    {
        RuleFor(x => x.LevelId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(ContentRules.NameMax);
        RuleFor(x => x.Slug).MaximumLength(ContentRules.SlugMax).Matches(ContentRules.SlugPattern).When(x => x.Slug is not null);
        RuleFor(x => x.Color).Matches(ContentRules.ColorPattern).When(x => x.Color is not null);
        RuleFor(x => x.Order).GreaterThanOrEqualTo(0).When(x => x.Order is not null);
    }
}

public sealed class UpdateSubjectRequestValidator : AbstractValidator<UpdateSubjectRequest>
{
    public UpdateSubjectRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(ContentRules.NameMax).When(x => x.Name is not null);
        RuleFor(x => x.Slug).MaximumLength(ContentRules.SlugMax).Matches(ContentRules.SlugPattern).When(x => x.Slug is not null);
        RuleFor(x => x.Color).Matches(ContentRules.ColorPattern).When(x => x.Color is not null);
        RuleFor(x => x.Order).GreaterThanOrEqualTo(0).When(x => x.Order is not null);
    }
}

public sealed class CreateUnitRequestValidator : AbstractValidator<CreateUnitRequest>
{
    public CreateUnitRequestValidator()
    {
        RuleFor(x => x.SubjectId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(ContentRules.NameMax);
        RuleFor(x => x.Order).GreaterThanOrEqualTo(0).When(x => x.Order is not null);
    }
}

public sealed class UpdateUnitRequestValidator : AbstractValidator<UpdateUnitRequest>
{
    public UpdateUnitRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(ContentRules.NameMax).When(x => x.Name is not null);
        RuleFor(x => x.Order).GreaterThanOrEqualTo(0).When(x => x.Order is not null);
    }
}

public sealed class CreateTopicRequestValidator : AbstractValidator<CreateTopicRequest>
{
    public CreateTopicRequestValidator()
    {
        RuleFor(x => x.UnitId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(ContentRules.NameMax);
        RuleFor(x => x.Slug).MaximumLength(ContentRules.SlugMax).Matches(ContentRules.SlugPattern).When(x => x.Slug is not null);
        RuleFor(x => x.Order).GreaterThanOrEqualTo(0).When(x => x.Order is not null);
    }
}

public sealed class UpdateTopicRequestValidator : AbstractValidator<UpdateTopicRequest>
{
    public UpdateTopicRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(ContentRules.NameMax).When(x => x.Name is not null);
        RuleFor(x => x.Slug).MaximumLength(ContentRules.SlugMax).Matches(ContentRules.SlugPattern).When(x => x.Slug is not null);
        RuleFor(x => x.Order).GreaterThanOrEqualTo(0).When(x => x.Order is not null);
    }
}

public sealed class CreateOutcomeRequestValidator : AbstractValidator<CreateOutcomeRequest>
{
    public CreateOutcomeRequestValidator()
    {
        RuleFor(x => x.TopicId).NotEmpty();
        RuleFor(x => x.Code).NotEmpty().MaximumLength(ContentRules.OutcomeCodeMax);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(ContentRules.OutcomeDescriptionMax);
    }
}

public sealed class UpdateOutcomeRequestValidator : AbstractValidator<UpdateOutcomeRequest>
{
    public UpdateOutcomeRequestValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(ContentRules.OutcomeCodeMax).When(x => x.Code is not null);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(ContentRules.OutcomeDescriptionMax).When(x => x.Description is not null);
    }
}

public sealed class CreateContentItemRequestValidator : AbstractValidator<CreateContentItemRequest>
{
    public CreateContentItemRequestValidator()
    {
        RuleFor(x => x.TopicId).NotEmpty();
        RuleFor(x => x.Type).IsInEnum();
        RuleFor(x => x.AccessTier).IsInEnum();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(ContentRules.TitleMax);
        RuleFor(x => x.Description).MaximumLength(ContentRules.DescriptionMax).When(x => x.Description is not null);
        RuleFor(x => x.Order).GreaterThanOrEqualTo(0).When(x => x.Order is not null);
        RuleFor(x => x.EmbedUrl)
            .Must(ContentRules.IsHttpsUrl).WithMessage("Embed URL must be an absolute https URL.")
            .When(x => x.Type == Models.ContentItemType.Embed);
        RuleFor(x => x.OutcomeIds).Must(ids => ids!.Count <= 50).When(x => x.OutcomeIds is not null);
    }
}

public sealed class UpdateContentItemRequestValidator : AbstractValidator<UpdateContentItemRequest>
{
    public UpdateContentItemRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(ContentRules.TitleMax).When(x => x.Title is not null);
        RuleFor(x => x.Description).MaximumLength(ContentRules.DescriptionMax).When(x => x.Description is not null);
        RuleFor(x => x.AccessTier).IsInEnum().When(x => x.AccessTier is not null);
        RuleFor(x => x.Order).GreaterThanOrEqualTo(0).When(x => x.Order is not null);
        RuleFor(x => x.EmbedUrl)
            .Must(ContentRules.IsHttpsUrl).WithMessage("Embed URL must be an absolute https URL.")
            .When(x => x.EmbedUrl is not null);
        RuleFor(x => x.OutcomeIds).Must(ids => ids!.Count <= 50).When(x => x.OutcomeIds is not null);
    }
}

public sealed class ReviewContentRequestValidator : AbstractValidator<ReviewContentRequest>
{
    public ReviewContentRequestValidator()
    {
        RuleFor(x => x.Note).MaximumLength(ContentRules.ReviewNoteMax).When(x => x.Note is not null);
        RuleFor(x => x.Note).NotEmpty().When(x => !x.Approve)
            .WithMessage("A rejection must explain what to change.");
    }
}

public sealed class UpdateProgressRequestValidator : AbstractValidator<UpdateProgressRequest>
{
    public UpdateProgressRequestValidator()
    {
        // Twelve hours is longer than any lesson; anything beyond it is a client bug, not a position.
        RuleFor(x => x.PositionSeconds).InclusiveBetween(0, 12 * 60 * 60);
    }
}
