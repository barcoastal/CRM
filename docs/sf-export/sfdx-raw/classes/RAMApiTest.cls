@IsTest
private class RAMApiTest {

    @TestSetup
    static void makeData() {
        RAMS_Settings__c settings = new RAMS_Settings__c();
        settings.Name = 'RAM Settings';
        settings.Endpoint__c = 'https://example.com/api';
        settings.APIKey__c = 'testApiKey';
        settings.Affiliate_ID__c = '1234';
        settings.Fee_Split_Group_ID__c = '1234';
        insert settings;
        Contact con = DataFactoryTest.createContact();
        con.BirthDate = System.today().addyears(-18);
        con.Lead_Number__c = '123456';
        insert con;
        Account acct = DataFactoryTest.createBusinessAccount();
        acct.Primary_Contact__c = con.Id;
        acct.BillingStateCode = 'NY';
        acct.Bank_Account_Number__c = '1234567890';
        acct.Bank_Routing_Number__c = '123456789';
        acct.Bank_Account_Type__c = 'Checking';
        acct.Bank_Name__c = 'Test Bank';
        acct.Lead_Number__c = '123456';
        insert acct;
        con.AccountId = acct.Id;
        update con;
        Opportunity opportunity = DataFactoryTest.createOpportunity('Test Opportunity', 'Prospect', acct.Id);
        insert opportunity;
        Payment_Processor__c paymentprocessor = DataFactoryTest.createPaymentProcessor('RAM', 'RAM');
        insert paymentprocessor;
        Program_Plan__c programPlan = DataFactoryTest.createProgramPlan(opportunity.Id, acct.Id, paymentprocessor.Id);
        insert programPlan;
        Draft__c draft = DataFactoryTest.createDraft(programPlan.Id, 'Pending', null);
        insert draft;
        List<Fee__c> fees = new List<Fee__c> {
            DataFactoryTest.createFee(draft.Id, 10, Date.today().addDays(2), 'Setup_Fee'),
            DataFactoryTest.createFee(draft.Id, 20, Date.today().addDays(2), 'Retainer_Fee'),
            DataFactoryTest.createFee(draft.Id, 30, Date.today().addDays(2), 'Processor_Fee'),
            DataFactoryTest.createFee(draft.Id, 40, Date.today().addDays(2), 'Service_Fee'),
            DataFactoryTest.createFee(draft.Id, 50, Date.today().addDays(2), 'Program_Fee')
        };
        insert fees;
    }
    
    @IsTest
    static void createClientTest_Success(){
        Account accountInstance = [SELECT Id FROM Account];
        Account acctWithoutSOQLMemory = ProcessorAPI.getAccountDetails(accountInstance.Id);
        Contact contWithoutSOQLMemory = ProcessorAPI.getContact(acctWithoutSOQLMemory);
        ProcessorWrapper.CreateClientRequest createClientRequest = new ProcessorWrapper.CreateClientRequest();
        createClientRequest.clientWrap = new ClientWrapper(acctWithoutSOQLMemory, contWithoutSOQLMemory, null);
        Account bankAcctWithoutSOQLMemory = ProcessorAPI.getBankAccountDetails(accountInstance.Id);
        ProcessorWrapper.CreateBankAccountRequest createBankAccountRequest = new ProcessorWrapper.CreateBankAccountRequest();        
        createBankAccountRequest.bankAccountWrap = new BankAccountWrapper(bankAcctWithoutSOQLMemory, 'RAM');
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        result = RAMApi.createClient(createClientRequest, createBankAccountRequest);
        RAMApi.endSession();
        Test.stopTest();
        
        Assert.areEqual('200', result.statusCode, 'Expected sucessfull syncing with RAM Processor.');
    }

    @IsTest
    static void createBankAccountTest_Success(){
        Account accountInstance = [SELECT Id FROM Account];
        Account bankAcctWithoutSOQLMemory = ProcessorAPI.getBankAccountDetails(accountInstance.Id);
        ProcessorWrapper.CreateBankAccountRequest createBankAccountRequest = new ProcessorWrapper.CreateBankAccountRequest();        
        createBankAccountRequest.bankAccountWrap = new BankAccountWrapper(bankAcctWithoutSOQLMemory, 'RAM');
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        result = RAMApi.createBankAccount(createBankAccountRequest);
        Test.stopTest();

        Assert.areEqual('200', result.statusCode, 'Expected sucessfull syncing with RAM Processor.');
    }

    @IsTest
    static void createDraftTest_Success(){
        Account acc = [SELECT Id FROM Account Limit 1];
        Program_Plan__c programPlanInst = [SELECT Id FROM Program_Plan__c];
        List<Draft__c> draftList = ProcessorAPI.getDraftDetails(programPlanInst.Id, acc.Id);
        ProcessorWrapper.CreateDraftRequest createDraftRequest = new ProcessorWrapper.CreateDraftRequest();
        createDraftRequest.draftWrap = new DraftWrapper(draftList[0]);
        createDraftRequest.draftWrap.clientExternalProcId = '1234567';
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        result = RAMApi.createDraft(createDraftRequest);
        Test.stopTest();
        
        Assert.areEqual('16956609', result.externalId, 'Expected sucessfull syncing of draft payment with RAM Processor.');
    }

    @IsTest
    static void updateClientTest_Success(){
        Account accountInstance = [SELECT Id, Client_Number__c FROM Account];
        Account accountInstanceToUpdate = new Account(Id = accountInstance.Id, External_RAM_Id__c = accountInstance.Client_Number__c, Status__c = 'Active');
        update accountInstanceToUpdate;
        Account acctWithoutSOQLMemory = ProcessorAPI.getAccountDetails(accountInstance.Id);
        Contact contWithoutSOQLMemory = ProcessorAPI.getContact(acctWithoutSOQLMemory);
        ClientWrapper clientWrap = new ClientWrapper(acctWithoutSOQLMemory, contWithoutSOQLMemory, null);
        ProcessorWrapper.UpdateClientRequest updateClientRequest = new ProcessorWrapper.UpdateClientRequest();
        updateClientRequest.clientWrap = clientWrap;
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        result = RAMApi.updateClient(updateClientRequest);
        Test.stopTest();

        Assert.areEqual('200', result.statusCode, 'Expected sucessfull syncing with RAM Processor.');
    }
    
    @IsTest
    static void cancelDraftTest_Success(){
        Account acc = [SELECT Id FROM Account Limit 1];
        Program_Plan__c programPlanInst = [SELECT Id FROM Program_Plan__c];
        List<Draft__c> draftList = ProcessorAPI.getDraftDetails(programPlanInst.Id, acc.Id);        
        ProcessorWrapper.CreateDraftRequest createDraftRequest = new ProcessorWrapper.CreateDraftRequest();
        createDraftRequest.draftWrap = new DraftWrapper(draftList[0]);
        createDraftRequest.draftWrap.clientExternalProcId = '1234567';
        createDraftRequest.draftWrap.draftStatus = DraftUtil.STATUS_CANCELLED;
        createDraftRequest.draftWrap.externalRAMId = '16956609';
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        result = RAMApi.createDraft(createDraftRequest);
        Test.stopTest();
        
        Assert.areEqual('16956609', result.externalId, 'Expected sucessfully cancelled the draft payment in RAM Processor.');
    }

    @IsTest
    static void updateBankAccountTest_Success(){
        Account accountInstance = [SELECT Id FROM Account];
        Account bankAcctWithoutSOQLMemory = ProcessorAPI.getBankAccountDetails(accountInstance.Id);
        BankAccountWrapper bankAccountWrap = new BankAccountWrapper(bankAcctWithoutSOQLMemory, 'RAM');
        ProcessorWrapper.UpdateBankAccountRequest updateBankAccountRequest = new ProcessorWrapper.UpdateBankAccountRequest();
        updateBankAccountRequest.bankAccountWrap = bankAccountWrap;
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        result = RAMApi.updateBankAccount(updateBankAccountRequest);
        Test.stopTest();

        Assert.areEqual('200', result.statusCode, 'Expected sucessfulL syncing with RAM Processor.');
    }

    @IsTest
    static void updateDraftTest_Success(){
        Account acc = [SELECT Id FROM Account Limit 1];
        Program_Plan__c programPlanInst = [SELECT Id FROM Program_Plan__c];
        Date todayDate = Date.today();
        String todayDateString = String.valueOf(todayDate);
        List<Draft__c> draftList = ProcessorAPI.getDraftDetails(programPlanInst.Id, acc.Id);
        Draft__c draftInst = draftList[0];
        draftInst.External_RAM_Id__c = 'testingExternalRAMId';
        ProcessorWrapper.CreateDraftRequest createDraftRequest = new ProcessorWrapper.CreateDraftRequest();        
        createDraftRequest.draftWrap = new DraftWrapper(draftInst);
        createDraftRequest.draftWrap.clientExternalProcId = '1234567';
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        result = RAMApi.createDraft(createDraftRequest);
        RAMApi.getUpdatedSavingDetails(todayDateString);
        RAMApi.getGetClientTransactionsByUpdateDate(todayDateString);
        RAMApi.getBalances();
        RAMApi.getDebitSchedule(null,null,0,0);
        Test.stopTest();
        
        Assert.areEqual('200', result.statusCode, 'Expected sucessfull syncing of draft payment with RAM Processor.');
    }

    @IsTest
    static void createClientValidation_Fail(){
        Contact con = DataFactoryTest.createContact();
        insert con;
        Account acct = DataFactoryTest.createBusinessAccount();
        acct.Primary_Contact__c = con.Id;
        insert acct;
        con.AccountId = acct.Id;
        update con;
        Account acctWithoutSOQLMemory = ProcessorAPI.getAccountDetails(acct.Id);
        Contact contWithoutSOQLMemory = ProcessorAPI.getContact(acctWithoutSOQLMemory);
        ProcessorWrapper.CreateClientRequest createClientRequest = new ProcessorWrapper.CreateClientRequest();
        createClientRequest.clientWrap = new ClientWrapper(acctWithoutSOQLMemory, contWithoutSOQLMemory, null);
        Account bankAcctWithoutSOQLMemory = ProcessorAPI.getBankAccountDetails(acct.Id);
        ProcessorWrapper.CreateBankAccountRequest createBankAccountRequest = new ProcessorWrapper.CreateBankAccountRequest();        
        createBankAccountRequest.bankAccountWrap = new BankAccountWrapper(bankAcctWithoutSOQLMemory, 'RAM');
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        result = RAMApi.createClient(createClientRequest, createBankAccountRequest);
        Test.stopTest();

        Assert.areEqual(true, result.message.contains('Client Sync => The following fields should not be blank: '), 'Expected validation message is not matching.');
    }

    @IsTest
    static void updateClientValidation_Fail(){
        Account accountInstance = [SELECT Id, Client_Number__c FROM Account];
        Account acctWithoutSOQLMemory = ProcessorAPI.getAccountDetails(accountInstance.Id);
        Contact contWithoutSOQLMemory = ProcessorAPI.getContact(acctWithoutSOQLMemory);
        ClientWrapper clientWrap = new ClientWrapper(acctWithoutSOQLMemory, contWithoutSOQLMemory, null);
        ProcessorWrapper.UpdateClientRequest updateClientRequest = new ProcessorWrapper.UpdateClientRequest();
        updateClientRequest.clientWrap = clientWrap;
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        result = RAMApi.updateClient(updateClientRequest);
        Test.stopTest();

        Assert.areEqual(true, result.message.contains('Client Sync => The following fields should not be blank: '), 'Expected validation message is not matching.');
    }

    @IsTest
    static void updateBankValidation_Fail(){
        Account acct = DataFactoryTest.createBusinessAccount();
        insert acct;
        Account bankAcctWithoutSOQLMemory = ProcessorAPI.getBankAccountDetails(acct.Id);
        BankAccountWrapper bankAccountWrap = new BankAccountWrapper(bankAcctWithoutSOQLMemory, 'RAM');
        ProcessorWrapper.UpdateBankAccountRequest updateBankAccountRequest = new ProcessorWrapper.UpdateBankAccountRequest();
        updateBankAccountRequest.bankAccountWrap = bankAccountWrap;
        ProcessorWrapper.API_Response result;

        Test.startTest();
        result = RAMApi.updateBankAccount(updateBankAccountRequest);
        Test.stopTest();

        Assert.areEqual(true, result.message.contains('Bank Account Sync => The following fields should not be blank: '), 'Expected validation message is not matching.');
    }

    @IsTest
    static void updateDraftValidation_Fail(){
        Account acc = [SELECT Id FROM Account Limit 1];
        Program_Plan__c programPlanInst = [SELECT Id FROM Program_Plan__c];
        List<Draft__c> draftList = ProcessorAPI.getDraftDetails(programPlanInst.Id, acc.Id);
        Draft__c draftInst = draftList[0];
        draftInst.External_RAM_Id__c = 'testingExternalRAMId';
        ProcessorWrapper.CreateDraftRequest createDraftRequest = new ProcessorWrapper.CreateDraftRequest();        
        createDraftRequest.draftWrap = new DraftWrapper(draftInst);
        //createDraftRequest.draftWrap.clientExternalProcId = '1234567';
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        result = RAMApi.createDraft(createDraftRequest);
        Test.stopTest();
        
        Assert.areEqual(true, result.message.contains('Draft Sync => The following fields should not be blank: '), 'Expected validation message is not matching.');
    }

    @IsTest
    static void createClientTest_Fail(){
        Account accountInstance = [SELECT Id FROM Account];
        Account acctWithoutSOQLMemory = ProcessorAPI.getAccountDetails(accountInstance.Id);
        Contact contWithoutSOQLMemory = ProcessorAPI.getContact(acctWithoutSOQLMemory);
        ProcessorWrapper.CreateClientRequest createClientRequest = new ProcessorWrapper.CreateClientRequest();
        createClientRequest.clientWrap = new ClientWrapper(acctWithoutSOQLMemory, contWithoutSOQLMemory, null);
        Account bankAcctWithoutSOQLMemory = ProcessorAPI.getBankAccountDetails(accountInstance.Id);
        ProcessorWrapper.CreateBankAccountRequest createBankAccountRequest = new ProcessorWrapper.CreateBankAccountRequest();        
        createBankAccountRequest.bankAccountWrap = new BankAccountWrapper(bankAcctWithoutSOQLMemory, 'RAM');
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler(false));
        RAMApi.sessionId = 'testSessionID';
        result = RAMApi.createClient(createClientRequest, createBankAccountRequest);
        RAMApi.endSession();
        Test.stopTest();
        
        Assert.areEqual('500', result.statusCode, 'Expected proper exception.');
    }

    @IsTest
    static void createBankAccountTest_Fail(){
        Account accountInstance = [SELECT Id FROM Account];
        Account bankAcctWithoutSOQLMemory = ProcessorAPI.getBankAccountDetails(accountInstance.Id);
        ProcessorWrapper.CreateBankAccountRequest createBankAccountRequest = new ProcessorWrapper.CreateBankAccountRequest();        
        createBankAccountRequest.bankAccountWrap = new BankAccountWrapper(bankAcctWithoutSOQLMemory, 'RAM');
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler(false));
        RAMApi.sessionId = 'testSessionID';
        result = RAMApi.createBankAccount(createBankAccountRequest);
        Test.stopTest();

        Assert.areEqual('500', result.statusCode, 'Expected proper exception.');
    }

    @IsTest
    static void createDraftTest_Fail(){
        Account acc = [SELECT Id FROM Account Limit 1];
        Program_Plan__c programPlanInst = [SELECT Id FROM Program_Plan__c];
        List<Draft__c> draftList = ProcessorAPI.getDraftDetails(programPlanInst.Id, acc.Id);        
        ProcessorWrapper.CreateDraftRequest createDraftRequest = new ProcessorWrapper.CreateDraftRequest();        
        createDraftRequest.draftWrap = new DraftWrapper(draftList[0]);
        createDraftRequest.draftWrap.clientExternalProcId = '1234567';
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler(false));
        RAMApi.sessionId = 'testSessionID';
        result = RAMApi.createDraft(createDraftRequest);
        Test.stopTest();
        
        Assert.areEqual('500', result.statusCode, 'Expected proper exception.');
    }

    @IsTest
    static void updateDraftTest_Fail(){
        Account acc = [SELECT Id FROM Account Limit 1];
        Program_Plan__c programPlanInst = [SELECT Id FROM Program_Plan__c];
        List<Draft__c> draftList = ProcessorAPI.getDraftDetails(programPlanInst.Id, acc.Id);
        Draft__c draftInst = draftList[0];
        draftInst.External_RAM_Id__c = 'testingExternalRAMId';
        ProcessorWrapper.CreateDraftRequest createDraftRequest = new ProcessorWrapper.CreateDraftRequest();        
        createDraftRequest.draftWrap = new DraftWrapper(draftList[0]);
        createDraftRequest.draftWrap.clientExternalProcId = '1234567';
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler(false));
        result = RAMApi.createDraft(createDraftRequest);
        Test.stopTest();
        
        Assert.areEqual('500', result.statusCode, 'Expected proper exception.');
    }

    @IsTest
    static void createDraftValidation_Fail(){
        Account acc = [SELECT Id FROM Account Limit 1];
        Program_Plan__c programPlanInst = [SELECT Id FROM Program_Plan__c];
        List<Draft__c> draftList = ProcessorAPI.getDraftDetails(programPlanInst.Id, acc.Id);
        ProcessorWrapper.CreateDraftRequest createDraftRequest = new ProcessorWrapper.CreateDraftRequest();        
        createDraftRequest.draftWrap = new DraftWrapper(draftList[0]);
        createDraftRequest.draftWrap.clientExternalProcId = null;
      // createDraftRequest.draftWrap.totalAmount = null; 
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        result = RAMApi.createDraft(createDraftRequest);
        Test.stopTest();

        Assert.areEqual(true, result.message.contains('Draft Sync => The following fields should not be blank: '), 'Expected validation message is not matching.');
    }
    
    @IsTest
    static void cancelClientTest(){
        Account acc = [SELECT Id FROM Account Limit 1];
        Program_Plan__c programPlanInst = [SELECT Id FROM Program_Plan__c];
        List<Draft__c> draftList = ProcessorAPI.getDraftDetails(programPlanInst.Id, acc.Id);
        Account accountInstance = [SELECT Id FROM Account];
        Account acctWithoutSOQLMemory = ProcessorAPI.getAccountDetails(accountInstance.Id);
        Contact contWithoutSOQLMemory = ProcessorAPI.getContact(acctWithoutSOQLMemory);        
        ProcessorWrapper.CancelClientRequest cancelClientRequest = new ProcessorWrapper.CancelClientRequest(); 
        ProcessorWrapper.SetCustomerStatuRequest setCustomerRequest = new ProcessorWrapper.SetCustomerStatuRequest();
        setCustomerRequest.clientWrap = new ClientWrapper(acctWithoutSOQLMemory, contWithoutSOQLMemory, null);
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        RAMApi.cancelClient(cancelClientRequest);        
        RAMApi.setCustomerStatus(setCustomerRequest, 'ACTIVE');
        Test.stopTest();

    }
    
    @IsTest
    static void setCustomerStatusTest(){
        Account accountInstance = [SELECT Id, Client_Number__c FROM Account];
        Account accountInstanceToUpdate = new Account(Id = accountInstance.Id, External_RAM_Id__c = accountInstance.Client_Number__c, Status__c = 'Active');
        update accountInstanceToUpdate;
        Account acctWithoutSOQLMemory = ProcessorAPI.getAccountDetails(accountInstance.Id);
        Contact contWithoutSOQLMemory = ProcessorAPI.getContact(acctWithoutSOQLMemory);
        ClientWrapper clientWrap = new ClientWrapper(acctWithoutSOQLMemory, contWithoutSOQLMemory, null);      
        ProcessorWrapper.SetCustomerStatuRequest setCustomerRequest = new ProcessorWrapper.SetCustomerStatuRequest();
        setCustomerRequest.clientWrap = clientWrap;
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        result = RAMApi.setCustomerStatus(setCustomerRequest, 'test');        
        Test.stopTest();
    }
    
    @IsTest
    static void getCustomerDetails(){
        Account accountInstance = [SELECT Id, Client_Number__c FROM Account];
        Account accountInstanceToUpdate = new Account(Id = accountInstance.Id, External_RAM_Id__c = accountInstance.Client_Number__c, Status__c = 'Active');
        update accountInstanceToUpdate;
        ProcessorWrapper.API_Response result;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        result = RAMApi.getCustomerDetails(accountInstance.Client_Number__c);                
        Test.stopTest();
    }
}