namespace MRV.Domain;

public static class RoleCodes
{
    public const string User = "USER";
    public const string Admin = "ADMIN";
    public const string SuperAdmin = "SUPER_ADMIN";
    public const string SystemAdmin = "SYSTEM_ADMIN";
}

public static class SubmissionStatuses
{
    public const string Drafted = "drafted";
    public const string Submitted = "submitted";
    public const string Accepted = "accepted";
    public const string Rejected = "rejected";
    public const string RevertedBack = "reverted_back";
}
