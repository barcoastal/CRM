@IsTest
private class SASValidationTest {

    @testSetup
    static void makeData() {
        SAS_Settings__c sas = DataFactoryTest.createSASSettings();
        insert sas;
    }
    
    @IsTest
    static void clientValidationTest() {
        Account acct = DataFactoryTest.createPersonAccount();
        insert acct;
        
        Test.startTest();
        // Instantiate ClientWrapper class
        ClientWrapper clientWrap = new ClientWrapper(acct, null, null);
        ProcessorWrapper.CreateClientRequest createClientRequest = new ProcessorWrapper.CreateClientRequest();
        createClientRequest.clientWrap = clientWrap;
        String errorMessage = SASValidation.clientValidation(createClientRequest.clientWrap);
        Test.stopTest();
        //System.assert(errorMessage.containsIgnoreCase('The following fields should not be blank: State, Total Debt'));
    }

    @IsTest
    static void createBankAccountValidationTest(){
        Account acct = DataFactoryTest.createBusinessAccount();
        insert acct;

        Test.startTest();
        // Instantiate ClientWrapper class
        BankAccountWrapper bankAccountWrap = new BankAccountWrapper(acct, 'SAS');
        ProcessorWrapper.CreateBankAccountRequest createBankAcctReq = new ProcessorWrapper.CreateBankAccountRequest();
        createBankAcctReq.bankAccountWrap = bankAccountWrap;
        String errorMessage = SASValidation.bankAccountValidation(createBankAcctReq.bankAccountWrap);
        Test.stopTest();
        System.assert(errorMessage.containsIgnoreCase('The following fields should not be blank: Bank Account Number, Routing Number'));
    }

    @IsTest
    static void createPayeeValidationTest(){
        
        Account acct = DataFactoryTest.createPersonAccount();
        insert acct;

        Test.startTest();
        // Instantiate ClientWrapper class
        ClientWrapper clientWrap = new ClientWrapper(acct, null, null);
        ProcessorWrapper.CreatePayeeRequest createPayeeRequest = new ProcessorWrapper.CreatePayeeRequest();
        createPayeeRequest.clientWrap = clientWrap;
        String errorMessage = SASValidation.payeeValidation(clientWrap);
        Test.stopTest();
        //System.assert(errorMessage.containsIgnoreCase('The following fields should not be blank: State, Total Debt'));
    }

    @isTest
    static void draftsValidationTest() {
        DraftWrapper draftWrap1 = new DraftWrapper();
        Test.startTest();
        SASValidation.draftsValidation(draftWrap1);
        SASValidation.draftsValidation(null);
        Test.stopTest();
    }

    @isTest
    static void settlementsValidationTest() {
        SettlementWrapper settlementWrap1 = new SettlementWrapper();
        Test.startTest();
        SASValidation.settlementsValidation(settlementWrap1);
        SASValidation.settlementsValidation(null);
        Test.stopTest();
    }

    @isTest
    static void cancelDraftValidationTest() {
        DraftWrapper draftWrap1 = new DraftWrapper();
        Test.startTest();
        SASValidation.cancelDraftValidation(draftWrap1);
        Test.stopTest();
    }

    @isTest
    static void contractValidationTest() {
        Account acctRecord = new Account();
        ContentVersion contVersion = new ContentVersion();
        FileWrapper fileWrap1 = new FileWrapper(acctRecord, contVersion);
        Test.startTest();
        SASValidation.contractValidation(fileWrap1);
        Test.stopTest();
    }
}