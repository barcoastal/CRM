public with sharing class CryptoUtil {

    private static final String ENCRYPTION_KEY = 'CoastalDebtEncryptionKeyPhrase2026';

    public class CryptoException extends Exception {}


    private static Blob getAesKey(Integer keySizeBits) {
        Integer bits = (keySizeBits == null) ? 128 : keySizeBits;
        Integer keyBytes = bits / 8;

        if (String.isBlank(ENCRYPTION_KEY) || ENCRYPTION_KEY.length() < keyBytes) {
            throw new CryptoException('Encryption key is not configured correctly.');
        }

        String keyPart = ENCRYPTION_KEY.substring(0, keyBytes);
        return Blob.valueOf(keyPart);
    }

 
    public static String encrypt(String recordId) {
        if (String.isBlank(recordId)) {
            throw new CryptoException('Record ID must not be blank.');
        }

        try {
            Blob key = getAesKey(128);
            Blob data = Blob.valueOf(recordId);
            Blob encrypted = Crypto.encryptWithManagedIV('AES128', key, data);
            return EncodingUtil.base64Encode(encrypted);
        } catch (CryptoException ce) {
            throw ce;
        } catch (Exception ex) {
            throw new CryptoException('Encryption failed. Contact administrator.');
        }
    }

    public static String decrypt(String encryptedText) {
        if (String.isBlank(encryptedText)) {
            throw new CryptoException('Encrypted text must not be blank.');
        }

        try {
            Blob key = getAesKey(128);
            Blob encryptedData = EncodingUtil.base64Decode(encryptedText);
            Blob decrypted = Crypto.decryptWithManagedIV('AES128', key, encryptedData);
            return decrypted.toString();
        } catch (CryptoException ce) {
            throw ce;
        } catch (Exception ex) {
            throw new CryptoException('Decryption failed. Contact administrator.');
        }
    }
}