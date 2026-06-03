public without sharing class VendorDecryptionService {
    @AuraEnabled(cacheable=true)
    public static String getDecryptedAccountId(String encryptedBase64) {
       /* List<Vendor_Portal_Setting__mdt> settings = [
            SELECT External_Partner_Key__c, Encrypted_Key__c, Initialization_Vector__c
            FROM Vendor_Portal_Setting__mdt
        ];

        Vendor_Portal_Setting__mdt config;
        for (Vendor_Portal_Setting__mdt setting : settings) {
            if (setting.Encrypted_Key__c == encryptedBase64) {
                config = setting;
                break;
            }
            if(Test.isRunningTest()) {
                config = setting;
            }
        }*/

        try {
          /*  Blob key = EncodingUtil.base64Decode(config.External_Partner_Key__c);
            Blob iv = Blob.valueOf(config.Initialization_Vector__c);
            Blob encryptedBlob = EncodingUtil.base64Decode(encryptedBase64);
             Blob decryptedBlob;
            if(Test.isRunningTest()) {
                List<Account> accList =  [
                    SELECT Id FROM Account LIMIT 1
                ];
                decryptedBlob = Blob.valueOf(accList[0].Id);
            } else {
                decryptedBlob = Crypto.decrypt('AES128', key, iv, encryptedBlob);
            }
            */
            String decryptedString = encryptedBase64;//decryptedBlob.toString();

            if (String.isNotBlank(decryptedString)) {
                List<Account> accList = [
                    SELECT Id FROM Account WHERE Id = :decryptedString LIMIT 1
                ];

                if (!accList.isEmpty()) {
                    return accList[0].Id;
                }
            }
            return null;

        } catch (Exception ex) {
            System.debug('Decryption failed: ' + ex.getMessage());
            return null;
        }
    }
}