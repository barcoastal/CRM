@IsTest
private class AsyncOpCitadelAPITest {    
    
    @IsTest
    static void initiateSyncTest_Success(){
        SAS_Settings__c settings = new SAS_Settings__c();
        settings.Endpoint__c = 'https://test.com';
        insert settings;
        
        Account acct = DataFactoryTest.createBusinessAccount();
        acct.Lead_Number__c = '12345';
        acct.Bank_Name__c = 'Wells Fargo';
        acct.Bank_Account_Number__c = '13719713158835300';
        acct.Bank_Routing_Number__c = '122105155';
        acct.Work_Phone__c='9987654321';
        acct.Client_Status__c = 'First Payment Pending';
        insert acct;
        
        Contact con = DataFactoryTest.createContact();
        con.BirthDate = System.today().addYears(-25);
        con.AccountId = acct.Id;
        insert con;
        
        acct.Primary_Contact__c = con.Id;
        acct.External_SAS_Id__c = '8995';
        acct.Legal_Network__c = 'Citadel';
        update acct;
        
        Opportunity opp = new Opportunity(
            Name = 'Test Opportunity', StageName = 'Closed Won First Payment Pending',
            CloseDate = Date.today(), AccountId = acct.Id,Legal_Plan_Required__c = true
        );
        insert opp;
        
        insert new Citadel_Callout_Settings__c(Endpoint__c = 'https://test.com'); 
        
        ContentVersion contVersion = new ContentVersion();
        contVersion.Title = 'SAS Agreement_TestDocument_' + opp.Name + '_completed.pdf';
        contVersion.VersionData = Blob.valueOf('Test Contract');
        contVersion.PathOnClient = 'Test';
        insert contVersion;

        ContentVersion contVersion2 = new ContentVersion();
        contVersion2.Title = 'Citadel Legal Plan_TestDocument_' + opp.Name + '_completed.pdf';
        contVersion2.VersionData = Blob.valueOf('Test Contract');
        contVersion2.PathOnClient = 'Test';
        insert contVersion2;
        
        List<ContentDocument> contentDocuments = [SELECT Id FROM ContentDocument];
        
        List<ContentDocumentLink> contentDocLink = new List<ContentDocumentLink>();
        ContentDocumentLink contDoc = new ContentDocumentLink();        
        contDoc.ContentDocumentId = contentDocuments[0].Id;
        contDoc.LinkedEntityId = opp.Id;
        contentDocLink.add(contDoc);        
        ContentDocumentLink contDoc1 = new ContentDocumentLink();
        contDoc1.ContentDocumentId = contentDocuments[1].Id;
        contDoc1.LinkedEntityId = opp.Id;
        contentDocLink.add(contDoc1);
        insert contentDocLink;
        
        Payment_Processor__c paymentprocessor = new Payment_Processor__c(
            Processor_Type__c='SAS', Name='SAS'
        );
        insert paymentprocessor;
        
        Program_Plan__c programPlan = new Program_Plan__c(
            Opportunity__c = opp.Id, Client__c = acct.Id, Payment_Processor__c= paymentprocessor.Id            
        );
        insert programPlan;
        List<Draft__c> drafts = new List<Draft__c>();
        Draft__c draft = new Draft__c(
            Program_Plan__c = programPlan.Id, Draft_Amount__c = 100, Retainer_Fee__c = 10,
            Setup_Fee__c = 20, Processor_Fee__c = 30, Service_Fee__c = 40, Citadel_Fee__c = 995,
            Draft_Status__c = 'Scheduled', Program_Fee__c = 10, Draft_Date__c = Date.newInstance(2026, 06, 24)
        );
        drafts.add(draft);
        
        Draft__c draft1 = new Draft__c(
            Program_Plan__c = programPlan.Id, Draft_Amount__c = 100, Retainer_Fee__c = 10,
            Setup_Fee__c = 20, Processor_Fee__c = 30, Service_Fee__c = 40, 
            Draft_Status__c = 'Scheduled', Program_Fee__c = 10, Draft_Date__c = Date.newInstance(2026, 07, 04)
        );
        drafts.add(draft1);
        
        Draft__c draft2 = new Draft__c(
            Program_Plan__c = programPlan.Id, Draft_Amount__c = 100, Retainer_Fee__c = 10,
            Setup_Fee__c = 20, Processor_Fee__c = 30, Service_Fee__c = 40, 
            Draft_Status__c = 'Scheduled', Program_Fee__c = 10, Draft_Date__c = Date.newInstance(2026, 07, 11)
        );
        
        drafts.add(draft2);
        insert drafts; 
        
        Async_Operation__c op = new Async_Operation__c();
        op.Operation__c = 'Legal_Network_Communication';        
        op.Record_Id__c= acct.Id;
        op.Status__c = 'Pending';
        op.Async_Type__c = 'Batch';
        insert op;
        
        Test.startTest();
            
            draft.Draft_Status__c = 'Completed';
            update draft;
                        
            String queryString = 'SELECT Id, Record_Id__c, Async_Type__c, Status__c, Operation__c, Lead__c, Individual__c FROM Async_Operation__c WHERE Status__c IN (\'Pending\', \'Failed\') ORDER BY Operation__c';            
            Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());            
            Database.executeBatch(new Batch_ProcessAsyncOperations(queryString , 1));       
        Test.stopTest();

        Account verifyAccount = [SELECT Id, External_SAS_Id__c FROM Account WHERE Id =:acct.Id];
    }
}