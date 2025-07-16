using System.Security.Cryptography;

namespace CBSSupport.Shared.Helpers
{
    public static class PasswordHelper
    {
        private const int Iterations = 350_000;
        private const int SaltSize = 16; // 128 bit
        private const int KeySize = 32; // 256 bit


        /// <param name="password">The password to hash.</param>

        public static (string hash, string salt) HashPassword(string password)
        {
            // 1. Creating a cryptographically random salt.
            byte[] saltBytes = RandomNumberGenerator.GetBytes(SaltSize);

            // 2. Hashing the password using PBKDF2 with the new salt.
            var pbkdf2 = new Rfc2898DeriveBytes(password, saltBytes, Iterations, HashAlgorithmName.SHA256);
            byte[] hashBytes = pbkdf2.GetBytes(KeySize);

            // 3. Converting both the hash and the salt to Base64 strings to be stored separately.
            return (Convert.ToBase64String(hashBytes), Convert.ToBase64String(saltBytes));
        }

        /// <param name="password">The password to check.</param>
        /// <param name="base64Hash">The stored hash from the 'password_hash' column.</param>
        /// <param name="base64Salt">The stored salt from the 'password_salt' column.</param>
        public static bool VerifyPassword(string password, string base64Hash, string base64Salt)
        {
            try
            {
                // 1. Converting the Base64 salt from the database back to bytes.
                byte[] saltBytes = Convert.FromBase64String(base64Salt);

                // 2. Hashing the incoming password with the *exact same salt and parameters*.
                var pbkdf2 = new Rfc2898DeriveBytes(password, saltBytes, Iterations, HashAlgorithmName.SHA256);
                byte[] hashToCompare = pbkdf2.GetBytes(KeySize);

                // 3. Converting the Base64 hash from the database back to bytes.
                byte[] storedHashBytes = Convert.FromBase64String(base64Hash);

                // 4. Comparing the newly generated hash with the stored hash.
                return CryptographicOperations.FixedTimeEquals(hashToCompare, storedHashBytes);
            }
            catch
            {
                // If any of the Base64 strings are invalid, verification fails.
                return false;
            }
        }
    }
}