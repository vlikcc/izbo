using ContentService.Services.Import;
using ContentService.Services.Questions;
using Shared.DTOs;
using Shared.Models;
using Shouldly;

namespace EduPlatform.UnitTests;

public class BankQuestionRulesTests
{
    private static List<QuestionOptionInput> Options(params string[] texts) =>
        texts.Select(t => new QuestionOptionInput(t)).ToList();

    [Fact]
    public void Multiple_choice_options_are_keyed_by_position_and_the_key_is_upper_cased()
    {
        var (question, error) = BankQuestionRules.Normalize(
            BankQuestionType.MultipleChoice, "  $2^3$ kaçtır? ", false, Options("6", " 8 ", "9"), "b", null);

        error.ShouldBeNull();
        question!.Stem.ShouldBe("$2^3$ kaçtır?");
        question.Options.Select(o => (o.Key, o.Text)).ShouldBe([("A", "6"), ("B", "8"), ("C", "9")]);
        question.CorrectKey.ShouldBe("B");
    }

    [Theory]
    [InlineData("D", "one of A, B, C")]
    [InlineData("", "one of A, B, C")]
    public void The_correct_key_must_name_an_existing_option(string key, string message)
    {
        var (question, error) = BankQuestionRules.Normalize(
            BankQuestionType.MultipleChoice, "Soru", false, Options("1", "2", "3"), key, null);

        question.ShouldBeNull();
        error!.ShouldContain(message);
    }

    [Fact]
    public void Multiple_choice_needs_two_to_five_filled_options()
    {
        BankQuestionRules.Normalize(BankQuestionType.MultipleChoice, "Soru", false, Options("tek"), "A", null)
            .Error.ShouldNotBeNull();
        BankQuestionRules.Normalize(BankQuestionType.MultipleChoice, "Soru", false, Options("1", "2", "3", "4", "5", "6"), "A", null)
            .Error.ShouldNotBeNull();
        BankQuestionRules.Normalize(BankQuestionType.MultipleChoice, "Soru", false, Options("1", " "), "A", null)
            .Error!.ShouldContain("Option B");

        // An image is enough for an option.
        BankQuestionRules.Normalize(BankQuestionType.MultipleChoice, "Soru", false,
                [new QuestionOptionInput("1"), new QuestionOptionInput(null, Guid.NewGuid())], "B", null)
            .Error.ShouldBeNull();
    }

    [Fact]
    public void A_question_needs_text_or_an_image()
    {
        BankQuestionRules.Normalize(BankQuestionType.TrueFalse, " ", false, null, "A", null).Error.ShouldNotBeNull();
        BankQuestionRules.Normalize(BankQuestionType.TrueFalse, " ", true, null, "A", null).Error.ShouldBeNull();
    }

    [Fact]
    public void True_false_uses_fixed_options_whatever_was_sent()
    {
        var (question, error) = BankQuestionRules.Normalize(
            BankQuestionType.TrueFalse, "Dünya yuvarlaktır.", false, Options("x", "y", "z"), "a", "Açıklama");

        error.ShouldBeNull();
        question!.Options.Select(o => o.Text).ShouldBe(["Doğru", "Yanlış"]);
        question.CorrectKey.ShouldBe("A");
        BankQuestionRules.Normalize(BankQuestionType.TrueFalse, "S", false, null, "C", null).Error.ShouldNotBeNull();
    }

    [Fact]
    public void Stem_key_ignores_whitespace_differences()
    {
        BankQuestionRules.StemKey(" Bir  soru\n metni ").ShouldBe(BankQuestionRules.StemKey("Bir soru metni"));
    }

    [Theory]
    [InlineData("a.png", new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0 }, true, "image/png")]
    [InlineData("a.JPG", new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0 }, true, "image/jpeg")]
    [InlineData("a.webp", new byte[] { (byte)'R', (byte)'I', (byte)'F', (byte)'F', 0, 0, 0, 0, (byte)'W', (byte)'E', (byte)'B', (byte)'P' }, true, "image/webp")]
    [InlineData("a.png", new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0 }, false, "")]
    [InlineData("a.svg", new byte[] { (byte)'<', (byte)'s', (byte)'v', (byte)'g', 0, 0, 0, 0, 0, 0, 0, 0 }, false, "")]
    public void Images_must_be_png_jpeg_or_webp_with_matching_bytes(string fileName, byte[] head, bool valid, string contentType)
    {
        var check = QuestionImageRules.Check(fileName, head);
        check.IsValid.ShouldBe(valid);
        check.ContentType.ShouldBe(contentType);
    }
}

public class QuestionImportParserTests
{
    private static readonly string[] Header =
        ["Seviye", "Ders", "Ünite", "Konu", "Kazanım Kodu", "Soru", "A", "B", "C", "D", "Doğru Cevap", "Zorluk", "Çözüm"];

    private static string[][] Table(params string[][] rows) => [Header, .. rows];

    [Fact]
    public void Reads_multiple_choice_and_true_false_rows()
    {
        var result = QuestionImportParser.Parse(Table(
            ["5", "Matematik", "Doğal Sayılar", "Bölme", "M.5.1.1.1", "12 ÷ 3 = ?", "2", "3", "4", "6", "c", "Kolay", "12'yi 3'e böl."],
            ["5", "Matematik", "Doğal Sayılar", "Bölme", "", "0 bir doğal sayıdır.", "", "", "", "", "Doğru", "", ""]));

        result.Errors.ShouldBeEmpty();
        result.Rows.Count.ShouldBe(2);

        var choice = result.Rows[0];
        choice.RowNumber.ShouldBe(2);
        choice.Type.ShouldBe(BankQuestionType.MultipleChoice);
        choice.OutcomeCode.ShouldBe("M.5.1.1.1");
        choice.Question.Options.Count.ShouldBe(4);
        choice.Question.CorrectKey.ShouldBe("C");
        choice.Difficulty.ShouldBe(QuestionDifficulty.Easy);
        choice.Question.Explanation.ShouldBe("12'yi 3'e böl.");

        var trueFalse = result.Rows[1];
        trueFalse.Type.ShouldBe(BankQuestionType.TrueFalse);
        trueFalse.OutcomeCode.ShouldBeNull();
        trueFalse.Question.CorrectKey.ShouldBe(BankQuestionRules.TrueKey);
        trueFalse.Difficulty.ShouldBe(QuestionDifficulty.Medium);
    }

    [Fact]
    public void Reports_every_bad_row_with_its_excel_row_number()
    {
        var result = QuestionImportParser.Parse(Table(
            ["5", "Matematik", "Ünite", "Konu", "", "Soru 1", "1", "", "3", "", "A", "", ""],
            ["5", "Matematik", "Ünite", "Konu", "", "Soru 2", "1", "2", "", "", "E", "", ""],
            ["5", "Matematik", "Ünite", "Konu", "", "Soru 3", "1", "2", "", "", "A", "Çok zor", ""],
            ["5", "Matematik", "Ünite", "", "", "Soru 4", "1", "2", "", "", "A", "", ""]));

        result.Rows.ShouldBeEmpty();
        result.Errors.Select(e => e.Row).ShouldBe([2, 3, 4, 5]);
        result.Errors[0].Message.ShouldContain("without gaps");
        result.Errors[1].Message.ShouldContain("one of A, B");
        result.Errors[2].Message.ShouldContain("difficulty");
        result.Errors[3].Message.ShouldContain("Konu is required");
    }

    [Fact]
    public void The_same_question_twice_in_one_file_is_an_error()
    {
        var result = QuestionImportParser.Parse(Table(
            ["5", "Matematik", "Ünite", "Konu", "", "Aynı  soru", "1", "2", "", "", "A", "", ""],
            ["5", "Matematik", "Ünite", "Konu", "", "Aynı soru", "1", "2", "", "", "B", "", ""]));

        result.Rows.ShouldHaveSingleItem();
        result.Errors.ShouldHaveSingleItem().Message.ShouldContain("row 2");
    }

    [Fact]
    public void Missing_required_columns_are_named()
    {
        var result = QuestionImportParser.Parse([["Ders", "Konu", "A", "B"], ["Matematik", "Bölme", "1", "2"]]);

        result.Rows.ShouldBeEmpty();
        var error = result.Errors.ShouldHaveSingleItem();
        error.Row.ShouldBe(1);
        error.Message.ShouldContain("Seviye");
        error.Message.ShouldContain("Soru");
        error.Message.ShouldContain("Doğru");
    }

    [Fact]
    public void An_explicit_type_column_wins()
    {
        var result = QuestionImportParser.Parse([
            ["Seviye", "Ders", "Ünite", "Konu", "Soru", "Tip", "Cevap"],
            ["5", "Fen", "Ünite", "Konu", "Işık doğrusal yayılır.", "Doğru-Yanlış", "Y"],
        ]);

        result.Errors.ShouldBeEmpty();
        var row = result.Rows.ShouldHaveSingleItem();
        row.Type.ShouldBe(BankQuestionType.TrueFalse);
        row.Question.CorrectKey.ShouldBe(BankQuestionRules.FalseKey);
    }
}
