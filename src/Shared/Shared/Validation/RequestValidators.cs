using FluentValidation;
using Shared.DTOs;
using Shared.Security;

namespace Shared.Validation;

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(255);
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.PhoneNumber).MaximumLength(32).When(x => x.PhoneNumber is not null);
        RuleFor(x => x.Password)
            .Custom((password, context) =>
            {
                var error = PasswordPolicy.Validate(password);
                if (error is not null)
                {
                    context.AddFailure(error);
                }
            });
    }
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public sealed class RefreshTokenRequestValidator : AbstractValidator<RefreshTokenRequest>
{
    public RefreshTokenRequestValidator()
    {
        RuleFor(x => x.RefreshToken).NotEmpty();
    }
}

public sealed class UpdateUserRequestValidator : AbstractValidator<UpdateUserRequest>
{
    public UpdateUserRequestValidator()
    {
        RuleFor(x => x.FirstName).MaximumLength(100).When(x => x.FirstName is not null);
        RuleFor(x => x.LastName).MaximumLength(100).When(x => x.LastName is not null);
        RuleFor(x => x.PhoneNumber).MaximumLength(32).When(x => x.PhoneNumber is not null);
    }
}

public sealed class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty();
        RuleFor(x => x.NewPassword)
            .Custom((password, context) =>
            {
                var error = PasswordPolicy.Validate(password);
                if (error is not null)
                {
                    context.AddFailure(error);
                }
            });
    }
}

public sealed class UpdateRoleRequestValidator : AbstractValidator<UpdateRoleRequest>
{
    public UpdateRoleRequestValidator()
    {
        RuleFor(x => x.Role).NotEmpty();
    }
}

public sealed class CreateClassroomRequestValidator : AbstractValidator<CreateClassroomRequest>
{
    public CreateClassroomRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(4000);
    }
}

public sealed class UpdateClassroomRequestValidator : AbstractValidator<UpdateClassroomRequest>
{
    public UpdateClassroomRequestValidator()
    {
        RuleFor(x => x.Name).MaximumLength(200).When(x => x.Name is not null);
        RuleFor(x => x.Description).MaximumLength(4000).When(x => x.Description is not null);
    }
}

public sealed class EnrollStudentRequestValidator : AbstractValidator<EnrollStudentRequest>
{
    public EnrollStudentRequestValidator()
    {
        RuleFor(x => x.StudentId).NotEmpty();
    }
}

public sealed class BulkEnrollRequestValidator : AbstractValidator<BulkEnrollRequest>
{
    public BulkEnrollRequestValidator()
    {
        RuleFor(x => x.StudentIds).NotEmpty().Must(ids => ids.Count <= 200);
    }
}

public sealed class CreateSessionRequestValidator : AbstractValidator<CreateSessionRequest>
{
    public CreateSessionRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ScheduledEndTime).GreaterThan(x => x.ScheduledStartTime);
    }
}

public sealed class UpdateSessionRequestValidator : AbstractValidator<UpdateSessionRequest>
{
    public UpdateSessionRequestValidator()
    {
        RuleFor(x => x.Title).MaximumLength(200).When(x => x.Title is not null);
        RuleFor(x => x)
            .Must(x => !x.ScheduledStartTime.HasValue || !x.ScheduledEndTime.HasValue || x.ScheduledEndTime > x.ScheduledStartTime)
            .WithMessage("Bitiş zamanı başlangıçtan sonra olmalıdır.");
    }
}

public sealed class CreateHomeworkRequestValidator : AbstractValidator<CreateHomeworkRequest>
{
    public CreateHomeworkRequestValidator()
    {
        RuleFor(x => x.ClassroomId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(8000);
        RuleFor(x => x.MaxScore).InclusiveBetween(1, 1000);
        RuleFor(x => x.LatePenaltyPercent).InclusiveBetween(0, 100);
    }
}

public sealed class UpdateHomeworkRequestValidator : AbstractValidator<UpdateHomeworkRequest>
{
    public UpdateHomeworkRequestValidator()
    {
        RuleFor(x => x.Title).MaximumLength(200).When(x => x.Title is not null);
        RuleFor(x => x.MaxScore).InclusiveBetween(1, 1000).When(x => x.MaxScore.HasValue);
        RuleFor(x => x.LatePenaltyPercent).InclusiveBetween(0, 100).When(x => x.LatePenaltyPercent.HasValue);
    }
}

public sealed class SubmitHomeworkRequestValidator : AbstractValidator<SubmitHomeworkRequest>
{
    public SubmitHomeworkRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.Content) || !string.IsNullOrWhiteSpace(x.FileUrl))
            .WithMessage("Teslim metin veya dosya içermelidir.");
        RuleFor(x => x.Content).MaximumLength(20000).When(x => x.Content is not null);
    }
}

public sealed class GradeSubmissionRequestValidator : AbstractValidator<GradeSubmissionRequest>
{
    public GradeSubmissionRequestValidator()
    {
        RuleFor(x => x.Score).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Feedback).MaximumLength(4000).When(x => x.Feedback is not null);
    }
}

public sealed class CreateExamRequestValidator : AbstractValidator<CreateExamRequest>
{
    public CreateExamRequestValidator()
    {
        RuleFor(x => x.ClassroomId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.DurationMinutes).InclusiveBetween(1, 600);
        RuleFor(x => x.EndTime).GreaterThan(x => x.StartTime);
        RuleFor(x => x.PassingScore).InclusiveBetween(0, 100).When(x => x.PassingScore.HasValue);
    }
}

public sealed class UpdateExamRequestValidator : AbstractValidator<UpdateExamRequest>
{
    public UpdateExamRequestValidator()
    {
        RuleFor(x => x.Title).MaximumLength(200).When(x => x.Title is not null);
        RuleFor(x => x.DurationMinutes).InclusiveBetween(1, 600).When(x => x.DurationMinutes.HasValue);
        RuleFor(x => x)
            .Must(x => !x.StartTime.HasValue || !x.EndTime.HasValue || x.EndTime > x.StartTime)
            .WithMessage("Bitiş zamanı başlangıçtan sonra olmalıdır.");
    }
}

public sealed class CreateQuestionRequestValidator : AbstractValidator<CreateQuestionRequest>
{
    public CreateQuestionRequestValidator()
    {
        RuleFor(x => x.Content).NotEmpty().MaximumLength(8000);
        RuleFor(x => x.Points).InclusiveBetween(1, 100);
        RuleFor(x => x.OrderIndex).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpdateQuestionRequestValidator : AbstractValidator<UpdateQuestionRequest>
{
    public UpdateQuestionRequestValidator()
    {
        RuleFor(x => x.Content).MaximumLength(8000).When(x => x.Content is not null);
        RuleFor(x => x.Points).InclusiveBetween(1, 100).When(x => x.Points.HasValue);
    }
}

public sealed class SubmitAnswerRequestValidator : AbstractValidator<SubmitAnswerRequest>
{
    public SubmitAnswerRequestValidator()
    {
        RuleFor(x => x.QuestionId).NotEmpty();
        RuleFor(x => x.Answer).NotNull().MaximumLength(8000);
    }
}

public sealed class CreateLiveSessionRequestValidator : AbstractValidator<CreateLiveSessionRequest>
{
    public CreateLiveSessionRequestValidator()
    {
        RuleFor(x => x.ClassSessionId).NotEmpty();
    }
}

public sealed class JoinLiveSessionRequestValidator : AbstractValidator<JoinLiveSessionRequest>
{
    public JoinLiveSessionRequestValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty();
    }
}

public sealed class UpdateNotificationPreferenceRequestValidator : AbstractValidator<UpdateNotificationPreferenceRequest>
{
    public UpdateNotificationPreferenceRequestValidator()
    {
        // All fields optional; nothing to reject beyond type binding.
    }
}
