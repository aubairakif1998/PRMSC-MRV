using System.Security.Cryptography;
using System.Text;

namespace MRV.Application.Security;

/// <summary>
/// Compatibility with Werkzeug's `generate_password_hash` / `check_password_hash`
/// default format: "pbkdf2:sha256:ITERATIONS$SALT$HASH"
/// where HASH is hex of derived key.
/// </summary>
public sealed class WerkzeugPasswordHasher : IWerkzeugPasswordHasher
{
    public bool Verify(string werkzeugHash, string password)
    {
        if (string.IsNullOrWhiteSpace(werkzeugHash) || password is null)
            return false;

        // Example: pbkdf2:sha256:260000$<salt>$<hashhex>
        var parts = werkzeugHash.Split('$');
        if (parts.Length != 3)
            return false;

        var methodPart = parts[0];
        var salt = parts[1];
        var expectedHex = parts[2];

        if (!methodPart.StartsWith("pbkdf2:sha256:", StringComparison.OrdinalIgnoreCase))
            return false;

        if (!int.TryParse(methodPart["pbkdf2:sha256:".Length..], out var iterations) || iterations <= 0)
            return false;

        var actualHex = Pbkdf2Sha256Hex(password, salt, iterations, keyLenBytes: 32);
        return ConstantTimeEqualsHex(expectedHex, actualHex);
    }

    public string Hash(string password, int iterations = 260000)
    {
        if (password is null)
            throw new ArgumentNullException(nameof(password));
        if (iterations <= 0)
            throw new ArgumentOutOfRangeException(nameof(iterations));

        var salt = GenerateSalt(16);
        var hex = Pbkdf2Sha256Hex(password, salt, iterations, keyLenBytes: 32);
        return $"pbkdf2:sha256:{iterations}${salt}${hex}";
    }

    private static string GenerateSalt(int byteLen)
    {
        var bytes = RandomNumberGenerator.GetBytes(byteLen);
        // Werkzeug salts are typically URL-safe-ish; plain base64 is fine because salt is inside DB only.
        // Remove padding to keep it compact.
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static string Pbkdf2Sha256Hex(string password, string salt, int iterations, int keyLenBytes)
    {
        using var pbkdf2 = new Rfc2898DeriveBytes(
            password: password,
            salt: Encoding.UTF8.GetBytes(salt),
            iterations: iterations,
            hashAlgorithm: HashAlgorithmName.SHA256);

        var dk = pbkdf2.GetBytes(keyLenBytes);
        return Convert.ToHexString(dk).ToLowerInvariant();
    }

    private static bool ConstantTimeEqualsHex(string a, string b)
    {
        if (a is null || b is null)
            return false;
        if (a.Length != b.Length)
            return false;

        var diff = 0;
        for (var i = 0; i < a.Length; i++)
            diff |= a[i] ^ b[i];
        return diff == 0;
    }
}

