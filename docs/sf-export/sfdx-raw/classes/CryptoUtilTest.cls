@IsTest
private class CryptoUtilTest {

    @testSetup
    static void makeData() {    

        Account acctRecord = DataFactoryTest.createBusinessAccount();
        insert acctRecord;

        Contact contRecord = DataFactoryTest.createContact();
        contRecord.AccountId = acctRecord.Id;
        contRecord.Lead_Number__c = '123456';
        insert contRecord;
    }

    @IsTest
    static void encrypt_validRecordId_returnsBase64String() {
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        Test.startTest();
        String result = CryptoUtil.encrypt(con.Id);
        Test.stopTest();
        System.assertNotEquals(con.Id, result,'Encrypted value should differ from input');
    }

    @IsTest
    static void encrypt_nullInput_throwsCryptoException() {
        try {
            Test.startTest();
            CryptoUtil.encrypt(null);
            Test.stopTest();
            System.assert(false, 'Expected CryptoException was not thrown');
        } catch (CryptoUtil.CryptoException e) {
            System.assertEquals('Record ID must not be blank.', e.getMessage());
        }
    }

    @IsTest
    static void decrypt_validCiphertext_returnsOriginalValue() {
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        String ciphertext = CryptoUtil.encrypt(con.Id);

        Test.startTest();
        String result = CryptoUtil.decrypt(ciphertext);
        Test.stopTest();

        System.assertEquals(con.Id, result, 'Decrypted value should match original');
    }


    @IsTest
    static void decrypt_nullInput_throwsCryptoException() {
        try {
            Test.startTest();
            CryptoUtil.decrypt(null);
            Test.stopTest();
            System.assert(false, 'Expected CryptoException was not thrown');
        } catch (CryptoUtil.CryptoException e) {
            System.assertEquals('Encrypted text must not be blank.', e.getMessage());
        }
    }
    
    @IsTest
    static void decrypt_invalidBase64_throwsCryptoException() {
        try {
            Test.startTest();
            CryptoUtil.decrypt('not-valid-base64!!!');
            Test.stopTest();
            System.assert(false, 'Expected CryptoException was not thrown');
        } catch (CryptoUtil.CryptoException e) {
            System.assertEquals('Decryption failed. Contact administrator.', e.getMessage());
        }
    }

}