using ContentService.Services.Media;
using Shared.Models;
using Shouldly;

namespace EduPlatform.UnitTests;

public class HlsFileNameTests
{
    [Theory]
    [InlineData("master.m3u8")]
    [InlineData("360p.m3u8")]
    [InlineData("720p_000.ts")]
    [InlineData("720p_1234.ts")]
    public void Accepts_the_names_the_transcoder_writes(string name)
    {
        HlsFileName.IsValid(name).ShouldBeTrue();
    }

    [Theory]
    [InlineData("../source.mp4")]
    [InlineData("..\\source.mp4")]
    [InlineData("../../other/hls/master.m3u8")]
    [InlineData("..%2Fmaster.m3u8")]
    [InlineData("%2e%2e/master.m3u8")]
    [InlineData("sub/master.m3u8")]
    [InlineData("sub\\720p_000.ts")]
    [InlineData("/etc/passwd")]
    [InlineData(".m3u8")]
    [InlineData("..m3u8")]
    [InlineData("master.m3u8.exe")]
    [InlineData("source.mp4")]
    [InlineData("thumbnail.jpg")]
    [InlineData("master.M3U8 ")]
    [InlineData("mas ter.m3u8")]
    [InlineData("")]
    [InlineData(null)]
    public void Refuses_anything_that_could_leave_the_hls_prefix(string? name)
    {
        HlsFileName.IsValid(name).ShouldBeFalse();
    }

    [Fact]
    public void Refuses_overlong_names()
    {
        HlsFileName.IsValid(new string('a', 80) + ".ts").ShouldBeFalse();
    }

    [Fact]
    public void Maps_content_types()
    {
        HlsFileName.ContentTypeFor("master.m3u8").ShouldBe("application/vnd.apple.mpegurl");
        HlsFileName.ContentTypeFor("360p_001.ts").ShouldBe("video/mp2t");
    }
}

public class ByteRangeTests
{
    [Fact]
    public void Missing_header_serves_everything()
    {
        ByteRange.Parse(null, 100).Kind.ShouldBe(ByteRangeKind.Full);
    }

    [Fact]
    public void Parses_a_closed_range()
    {
        var range = ByteRange.Parse("bytes=10-19", 100);
        range.Kind.ShouldBe(ByteRangeKind.Partial);
        range.Start.ShouldBe(10);
        range.End.ShouldBe(19);
        range.Length.ShouldBe(10);
    }

    [Fact]
    public void Open_range_runs_to_the_end()
    {
        var range = ByteRange.Parse("bytes=90-", 100);
        range.Start.ShouldBe(90);
        range.End.ShouldBe(99);
    }

    [Fact]
    public void Suffix_range_takes_the_last_bytes()
    {
        var range = ByteRange.Parse("bytes=-30", 100);
        range.Start.ShouldBe(70);
        range.End.ShouldBe(99);
    }

    [Fact]
    public void End_past_the_object_is_clamped()
    {
        ByteRange.Parse("bytes=50-5000", 100).End.ShouldBe(99);
    }

    [Fact]
    public void Start_past_the_object_is_unsatisfiable()
    {
        ByteRange.Parse("bytes=100-", 100).Kind.ShouldBe(ByteRangeKind.Unsatisfiable);
    }

    [Theory]
    [InlineData("bytes=0-1,5-6")]
    [InlineData("items=0-10")]
    [InlineData("bytes=abc-")]
    [InlineData("bytes=20-10")]
    public void Unsupported_or_malformed_ranges_fall_back_to_the_full_body(string header)
    {
        ByteRange.Parse(header, 100).Kind.ShouldBe(ByteRangeKind.Full);
    }
}

public class FfmpegArgumentsTests
{
    [Fact]
    public void Low_resolution_sources_get_only_the_360p_rung()
    {
        FfmpegArguments.SelectRenditions(480).Select(r => r.Name).ShouldBe(["360p"]);
        FfmpegArguments.SelectRenditions(240).Select(r => r.Name).ShouldBe(["360p"]);
    }

    [Fact]
    public void Hd_sources_and_unknown_heights_get_the_full_ladder()
    {
        FfmpegArguments.SelectRenditions(1080).Select(r => r.Name).ShouldBe(["360p", "720p"]);
        FfmpegArguments.SelectRenditions(null).Select(r => r.Name).ShouldBe(["360p", "720p"]);
    }

    [Fact]
    public void Hls_command_builds_a_two_rung_vod_ladder_with_six_second_segments()
    {
        var args = FfmpegArguments.Hls("/work/source.mp4", "/work/hls", FfmpegArguments.Ladder, hasAudio: true);

        ValueAfter(args, "-i").ShouldBe("/work/source.mp4");
        ValueAfter(args, "-filter_complex")
            .ShouldBe("[0:v]split=2[v0][v1];[v0]scale=-2:360[v0out];[v1]scale=-2:720[v1out]");
        ValueAfter(args, "-hls_time").ShouldBe("6");
        ValueAfter(args, "-hls_playlist_type").ShouldBe("vod");
        ValueAfter(args, "-force_key_frames").ShouldBe("expr:gte(t,n_forced*6)");
        ValueAfter(args, "-master_pl_name").ShouldBe("master.m3u8");
        ValueAfter(args, "-var_stream_map").ShouldBe("v:0,a:0,name:360p v:1,a:1,name:720p");
        ValueAfter(args, "-hls_segment_filename").ShouldBe(Path.Combine("/work/hls", "%v_%03d.ts"));
        ValueAfter(args, "-b:v:0").ShouldBe("800k");
        ValueAfter(args, "-b:v:1").ShouldBe("2800k");
        ValueAfter(args, "-c:a:1").ShouldBe("aac");
        args[^1].ShouldBe(Path.Combine("/work/hls", "%v.m3u8"));
        args.Count(a => a == "0:a:0").ShouldBe(2);
    }

    [Fact]
    public void Silent_videos_map_no_audio()
    {
        var args = FfmpegArguments.Hls("in.mp4", "out", FfmpegArguments.SelectRenditions(360), hasAudio: false);

        ValueAfter(args, "-filter_complex").ShouldBe("[0:v]scale=-2:360[v0out]");
        ValueAfter(args, "-var_stream_map").ShouldBe("v:0,name:360p");
        args.ShouldNotContain("0:a:0");
        args.ShouldNotContain("-ac");
    }

    [Fact]
    public void Hostile_file_names_stay_a_single_argument()
    {
        const string input = "/work/a b; rm -rf / $(x).mp4";
        var args = FfmpegArguments.Hls(input, "/out", FfmpegArguments.Ladder, hasAudio: true);
        args.ShouldContain(input);
    }

    [Fact]
    public void Thumbnail_is_taken_a_few_seconds_in_and_scaled()
    {
        var args = FfmpegArguments.Thumbnail("in.mp4", "thumb.jpg", FfmpegArguments.ThumbnailTime(600));

        ValueAfter(args, "-ss").ShouldBe("5");
        ValueAfter(args, "-frames:v").ShouldBe("1");
        ValueAfter(args, "-vf").ShouldBe("scale=640:-2");
        args[^1].ShouldBe("thumb.jpg");
        FfmpegArguments.ThumbnailTime(6).ShouldBe(2);
        FfmpegArguments.ThumbnailTime(null).ShouldBe(0);
    }

    [Fact]
    public void Probe_asks_for_json_streams_and_format()
    {
        FfmpegArguments.Probe("in.mp4").ShouldBe(["-v", "error", "-print_format", "json", "-show_format", "-show_streams", "in.mp4"]);
    }

    private static string ValueAfter(IReadOnlyList<string> args, string flag)
    {
        var index = args.ToList().IndexOf(flag);
        index.ShouldBeGreaterThanOrEqualTo(0, $"{flag} missing");
        return args[index + 1];
    }
}

public class FfprobeResultTests
{
    [Fact]
    public void Reads_duration_height_and_audio()
    {
        const string json = """
            {"streams":[{"codec_type":"video","height":1080},{"codec_type":"audio"}],
             "format":{"duration":"125.480000"}}
            """;

        var result = FfprobeResult.Parse(json);

        result.HasVideo.ShouldBeTrue();
        result.HasAudio.ShouldBeTrue();
        result.VideoHeight.ShouldBe(1080);
        result.DurationSeconds.ShouldBe(125.48);
    }

    [Fact]
    public void Cover_art_is_not_a_video_stream()
    {
        const string json = """
            {"streams":[{"codec_type":"audio"},{"codec_type":"video","height":500,"disposition":{"attached_pic":1}}],
             "format":{"duration":"10"}}
            """;

        FfprobeResult.Parse(json).HasVideo.ShouldBeFalse();
    }

    [Fact]
    public void Falls_back_to_the_stream_duration()
    {
        const string json = """{"streams":[{"codec_type":"video","height":360,"duration":"42.0"}],"format":{}}""";

        var result = FfprobeResult.Parse(json);
        result.DurationSeconds.ShouldBe(42);
        result.HasAudio.ShouldBeFalse();
    }
}

public class ContentUploadRulesTests
{
    private static readonly byte[] Mp4Head = [0, 0, 0, 0x18, (byte)'f', (byte)'t', (byte)'y', (byte)'p', (byte)'m', (byte)'p', (byte)'4', (byte)'2'];
    private static readonly byte[] PdfHead = "%PDF-1.7\n"u8.ToArray();
    private static readonly byte[] ExeHead = [(byte)'M', (byte)'Z', 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0];

    [Fact]
    public void Accepts_an_mp4_video()
    {
        var check = ContentUploadRules.Check(ContentItemType.Video, "ders.MP4", Mp4Head);
        check.IsValid.ShouldBeTrue();
        check.Extension.ShouldBe(".mp4");
        check.ContentType.ShouldBe("video/mp4");
    }

    [Fact]
    public void Accepts_webm_by_its_ebml_magic()
    {
        ContentUploadRules.Check(ContentItemType.SolvedQuestionVideo, "cozum.webm", [0x1A, 0x45, 0xDF, 0xA3, 0, 0, 0, 0]).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void Refuses_a_renamed_executable()
    {
        ContentUploadRules.Check(ContentItemType.Video, "ders.mp4", ExeHead).IsValid.ShouldBeFalse();
        ContentUploadRules.Check(ContentItemType.Pdf, "notlar.pdf", ExeHead).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void Documents_must_be_pdf()
    {
        ContentUploadRules.Check(ContentItemType.Worksheet, "calisma.pdf", PdfHead).IsValid.ShouldBeTrue();
        ContentUploadRules.Check(ContentItemType.EBook, "kitap.docx", PdfHead).IsValid.ShouldBeFalse();
        ContentUploadRules.Check(ContentItemType.Video, "video.pdf", PdfHead).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void Embeds_take_no_file()
    {
        ContentUploadRules.Check(ContentItemType.Embed, "x.mp4", Mp4Head).IsValid.ShouldBeFalse();
    }
}
