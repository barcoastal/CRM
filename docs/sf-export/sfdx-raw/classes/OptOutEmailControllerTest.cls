@IsTest
private class OptOutEmailControllerTest {

    private static final String STATUS_SUCCESS = 'success';
    private static final String STATUS_ERROR   = 'error';
    private static final String SUCCESS_MSG    = 'Email opt-out has been completed successfully.';
    private static final String ERROR_GENERIC  = 'An unexpected error occurred while opting out of emails. Please contact your system administrator.';

    @testSetup
    static void makeData() {    

        Account acctRecord = DataFactoryTest.createBusinessAccount();
        insert acctRecord;

        Contact contRecord = DataFactoryTest.createContact();
        contRecord.AccountId = acctRecord.Id;
        contRecord.Lead_Number__c = '123456';
        insert contRecord;
    }

    private static Contact getActiveContact() {
        return [
            SELECT Id, HasOptedOutOfEmail
            FROM Contact
            LIMIT 1
        ];
    }

    @IsTest
    static void processOptOut_nullInput_returnsErrorResponse() {
        Test.startTest();
        Map<String, String> response = OptOutEmailController.processOptOut(null);
        Test.stopTest();

        System.assertEquals(STATUS_ERROR,  response.get('status'),  'Status should be error');
        System.assertEquals(ERROR_GENERIC, response.get('message'), 'Message should match generic error constant');
    }


    @IsTest
    static void processOptOut_plainContactId_updatesOptOutAndReturnsSuccess() {
        Contact con = getActiveContact();

        Test.startTest();
        Map<String, String> response = OptOutEmailController.processOptOut(con.Id);
        Test.stopTest();


        Contact updated = [SELECT HasOptedOutOfEmail FROM Contact WHERE Id = :con.Id];
        System.assertEquals(true, updated.HasOptedOutOfEmail,
            'HasOptedOutOfEmail should be true after opt-out');
    }

    @IsTest
    static void processOptOut_plainContactId_alreadyOptedOut_returnsSuccessWithoutDml() {
        Contact con = getActiveContact();

        Test.startTest();
        Map<String, String> response = OptOutEmailController.processOptOut(con.Id);
        Test.stopTest();

        System.assertEquals(STATUS_SUCCESS, response.get('status'),  'Status should be success');
        System.assertEquals(SUCCESS_MSG,    response.get('message'), 'Message should match success constant');

        Contact unchanged = [SELECT HasOptedOutOfEmail FROM Contact WHERE Id = :con.Id];
        System.assertEquals(true, unchanged.HasOptedOutOfEmail,
            'HasOptedOutOfEmail should remain true');
    }
    
    @IsTest
    static void processOptOut_cryptoExceptionPath_coversHandleCryptoError() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        
        Test.startTest();
        Map<String, String> response = OptOutEmailController.processOptOut(acc.Id);
        Test.stopTest();
        
        System.assertEquals('error',   response.get('status'));
        System.assertEquals(ERROR_GENERIC, response.get('message'));
    }
    
    @IsTest
    static void processOptOut_genericExceptionPath_coversHandleUnexpectedError() {
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        delete con;
        
        Test.startTest();
        Map<String, String> response = OptOutEmailController.processOptOut(con.Id);
        Test.stopTest();
        
        System.assertEquals('error',       response.get('status'));
        System.assertEquals(ERROR_GENERIC, response.get('message'));
    }
}