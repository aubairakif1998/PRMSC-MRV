namespace MRV.Application.Security;

public interface IWerkzeugPasswordHasher
{
    bool Verify(string werkzeugHash, string password);
    string Hash(string password, int iterations = 260000);
}

