namespace MRV.Application.Services;

public sealed class TehsilAccessDeniedException : Exception
{
    public TehsilAccessDeniedException(string message) : base(message) { }
}

