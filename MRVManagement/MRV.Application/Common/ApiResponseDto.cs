namespace MRV.Application.Common;

public sealed class ApiResponseDto<T> where T : notnull
{
    public required T Data { get; set; }
    public List<ApiErrorDto> Errors { get; set; } = [];
    public bool IsSuccess { get; set; } = true;
    public ApiMetaDto MetaData { get; set; } = new() { TimeStamp = DateTime.UtcNow };
}

public sealed class ApiErrorDto
{
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
}

public sealed class ApiMetaDto
{
    public DateTime TimeStamp { get; set; }
    public int? PageNumber { get; set; }
    public int? PageSize { get; set; }
    public int? TotalCount { get; set; }
    public int? TotalPages { get; set; }
}

