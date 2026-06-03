@IsTest
private class OptOutLinkGeneratorTest {

    @testSetup
    static void makeData() {    

        Account acctRecord = DataFactoryTest.createBusinessAccount();
        insert acctRecord;

        Contact contRecord = DataFactoryTest.createContact();
        contRecord.AccountId = acctRecord.Id;
        contRecord.Lead_Number__c = '123456';
        insert contRecord;
    }

    private static Contact getTestContact() {
        return [SELECT Id FROM Contact LIMIT 1];
    }

    private static OptOutLinkGenerator.OptOutLinkRequest buildRequest(String contactId) {
        OptOutLinkGenerator.OptOutLinkRequest req = new OptOutLinkGenerator.OptOutLinkRequest();
        req.contactId = contactId;
        return req;
    }


    @IsTest
    static void generateOptOutLink_nullRequestList_returnsEmptyList() {
        Test.startTest();
        List<OptOutLinkGenerator.OptOutLinkResult> results =
            OptOutLinkGenerator.generateOptOutLink(null);
        Test.stopTest();

        System.assertNotEquals(null,  results, 'Result list should not be null');
        System.assertEquals(0, results.size(), 'Result list should be empty for null input');
    }


    @IsTest
    static void generateOptOutLink_validContactId_returnsEncryptedId() {
        Contact con = getTestContact();

        Test.startTest();
        List<OptOutLinkGenerator.OptOutLinkResult> results =
            OptOutLinkGenerator.generateOptOutLink(
                new List<OptOutLinkGenerator.OptOutLinkRequest>{
                    buildRequest(con.Id)
                }
            );
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Should return exactly one result');

        OptOutLinkGenerator.OptOutLinkResult result = results[0];
        System.assertNotEquals(null, result.encryptedId,
            'encryptedId should not be null');
        System.assert(result.encryptedId.length() > 0,
            'encryptedId should not be empty');
        System.assertNotEquals(con.Id, result.encryptedId,
            'encryptedId should differ from the plain Contact ID');
    }
    
    @IsTest
    static void generateOptOutLink_validContactId_returnsEncryptedIdException() {

        Test.startTest();
        List<OptOutLinkGenerator.OptOutLinkResult> results =
            OptOutLinkGenerator.generateOptOutLink(
                new List<OptOutLinkGenerator.OptOutLinkRequest>{
                    buildRequest('not-valid-base64!!!')
                }
            );
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Should return exactly one result');

    }
    
    @IsTest
    static void optOutLinkRequest_canBeInstantiated() {
        Contact con = getTestContact();
        OptOutLinkGenerator.OptOutLinkRequest req = new OptOutLinkGenerator.OptOutLinkRequest();
        req.contactId = con.Id;
        System.assertEquals(con.Id, req.contactId);
    }

}