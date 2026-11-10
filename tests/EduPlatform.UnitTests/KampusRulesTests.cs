using System.Text.Json;
using ContentService.Kampus;
using ContentService.Kampus.Catalog;
using ContentService.Kampus.Services;
using Shared.Security;
using Shouldly;

namespace EduPlatform.UnitTests;

public class TurkishNationalIdTests
{
    [Theory]
    [InlineData("10000001068")]
    [InlineData("10000001754")]
    [InlineData("10000001822")]
    [InlineData("10000001990")]
    public void Numbers_with_correct_check_digits_are_valid(string number) =>
        TurkishNationalId.HasValidChecksum(number).ShouldBeTrue();

    [Theory]
    [InlineData("12345678910")] // the prototype's demo number: right shape, wrong check digits
    [InlineData("10000001069")] // last digit off by one
    [InlineData("10000001168")] // tenth digit off
    [InlineData("01234567890")] // leading zero
    [InlineData("1000000106")]  // 10 digits
    [InlineData("100000010680")]
    [InlineData("1000000106a")]
    [InlineData("")]
    [InlineData(null)]
    public void Malformed_or_wrong_check_digits_are_rejected(string? number) =>
        TurkishNationalId.HasValidChecksum(number).ShouldBeFalse();

    [Fact]
    public void The_demo_number_only_passes_the_shape_check() =>
        (TurkishNationalId.HasValidShape("12345678910"), TurkishNationalId.HasValidChecksum("12345678910")).ShouldBe((true, false));

    [Fact]
    public void Spaces_typed_from_a_card_are_removed() =>
        TurkishNationalId.Normalize(" 100 0000 1068 ").ShouldBe("10000001068");
}

public class KampusPasswordRulesTests
{
    [Theory]
    [InlineData("Kampus20262", null)]
    [InlineData("Çiçekli2026", null)]
    [InlineData("Admin123", "Parola en az 10 karakter olmalıdır.")]
    [InlineData("kampus20262", "Şifre en az bir büyük harf içermelidir.")]
    [InlineData("KAMPUS20262", "Şifre en az bir küçük harf içermelidir.")]
    [InlineData("KampusKampus", "Şifre en az bir rakam içermelidir.")]
    public void Kampus_rules_add_case_and_digit_to_the_platform_policy(string password, string? error) =>
        KampusPasswordRules.Validate(password).ShouldBe(error);
}

public class KampusGraderTests
{
    private static JsonElement J(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static CatalogQuestion Q(string type, string[]? answer = null, int? pairs = null) =>
        new("q", type, answer, pairs, null, null);

    [Fact]
    public void Choice_compares_the_option_value()
    {
        KampusGrader.IsRight(Q("choice", ["591"]), J("\"591\"")).ShouldBeTrue();
        KampusGrader.IsRight(Q("choice", ["591"]), J("\"519\"")).ShouldBeFalse();
        KampusGrader.IsRight(Q("choice", ["591"]), null).ShouldBeFalse();
    }

    [Fact]
    public void True_false_accepts_the_string_or_the_boolean()
    {
        KampusGrader.IsRight(Q("tf", ["true"]), J("\"true\"")).ShouldBeTrue();
        KampusGrader.IsRight(Q("tf", ["true"]), J("true")).ShouldBeTrue();
        KampusGrader.IsRight(Q("tf", ["false"]), J("true")).ShouldBeFalse();
    }

    [Fact]
    public void Written_answers_ignore_spaces_case_and_lookalike_signs()
    {
        KampusGrader.IsRight(Q("write", ["407"]), J("\" 4 07 \"")).ShouldBeTrue();
        KampusGrader.IsRight(Q("write", ["<"]), J("\"＜\"")).ShouldBeTrue();
        KampusGrader.IsRight(Q("write", ["İstanbul"]), J("\"istanbul\"")).ShouldBeTrue();
        KampusGrader.IsRight(Q("write", ["729"]), J("\"7209\"")).ShouldBeFalse();
    }

    [Fact]
    public void Matching_needs_every_item_on_its_own_partner()
    {
        KampusGrader.IsRight(Q("match", pairs: 3), J("{\"0\":0,\"1\":1,\"2\":2}")).ShouldBeTrue();
        KampusGrader.IsRight(Q("match", pairs: 3), J("{\"0\":1,\"1\":0,\"2\":2}")).ShouldBeFalse();
        KampusGrader.IsRight(Q("match", pairs: 3), J("{\"0\":0,\"1\":1}")).ShouldBeFalse();
    }
}

public class KampusCupRulesTests
{
    [Theory]
    [InlineData(20, 5)]
    [InlineData(12, 5)]
    [InlineData(11, 3)]
    [InlineData(6, 3)]
    [InlineData(5, 1)]
    [InlineData(1, 1)]
    public void Winners_depend_on_group_size(int size, int winners) =>
        KampusCupService.WinnersFor(size, 5).ShouldBe(winners);
}

public class KampusClockTests
{
    [Fact]
    public void The_day_turns_at_midnight_in_Istanbul_not_UTC()
    {
        // 21:30 UTC on Monday 9 Nov 2026 is 00:30 on Tuesday in Türkiye.
        KampusClock.DayOf(new DateTime(2026, 11, 9, 21, 30, 0, DateTimeKind.Utc)).ShouldBe(new DateOnly(2026, 11, 10));
        KampusClock.DayOf(new DateTime(2026, 11, 9, 20, 59, 0, DateTimeKind.Utc)).ShouldBe(new DateOnly(2026, 11, 9));
    }

    [Fact]
    public void The_cup_week_starts_on_Monday_local_time()
    {
        // Sunday 15 Nov 23:30 local (20:30 UTC) is still the week of 9 Nov; 21:00 UTC is Monday 16 Nov.
        KampusClock.WeekOf(new DateTime(2026, 11, 15, 20, 30, 0, DateTimeKind.Utc)).ShouldBe(new DateOnly(2026, 11, 9));
        KampusClock.WeekOf(new DateTime(2026, 11, 15, 21, 0, 0, DateTimeKind.Utc)).ShouldBe(new DateOnly(2026, 11, 16));
        KampusClock.WeekIndex(new DateOnly(2026, 11, 16)).ShouldBe(1);
        KampusClock.StartOf(new DateOnly(2026, 11, 10)).ShouldBe(new DateTime(2026, 11, 9, 21, 0, 0, DateTimeKind.Utc));
    }
}

public class KampusCatalogTests
{
    [Fact]
    public void The_embedded_catalog_has_answer_keys_for_every_question()
    {
        var catalog = KampusCatalog.LoadEmbedded();

        catalog.Data.Topics.ShouldContainKey("k-dogal-karsilastirma");
        catalog.TopicStops("k-dogal-karsilastirma").ShouldBe(["anlatim", "alistirma", "minitest", "ozet"]);
        catalog.Data.StarDailyMax.ShouldBe(10);
        catalog.Data.Cup.GroupSize.ShouldBe(20);
        catalog.Data.KpRules.Minitest.ShouldBe(10);
        catalog.Data.Avatar.Items.ShouldContain(i => i.Id == "roket-gozluk" && i.Price == 30);

        var questions = catalog.Data.Topics.Values.SelectMany(t => t.Exercises.Concat(t.TestPool)).Concat(catalog.Data.AssessBank).ToList();
        questions.ShouldNotBeEmpty();
        questions.ShouldAllBe(q => q.Type == "match" ? q.Pairs > 0 : q.Answer != null && q.Answer.Count > 0);
        catalog.Data.Books.SelectMany(b => b.Questions).ShouldAllBe(q => q.Answer.Length > 0);
    }
}
