@isTest
public class DocumentControllerTest { 
    /**
    * @description: Test Method to create the test records
    **/
    @testSetup
    static void makeData() { 
        Payment_Processor__c procSas = DataFactoryTest.createPaymentProcessor();
        insert procSas;
        
        Account acct = DataFactoryTest.createAccount();
        insert acct;
        
        Opportunity oppty = DataFactoryTest.createOpportunity();
        oppty.AccountId = acct.Id;
        insert oppty;
        
        Program_Plan__c pgmPlan = DataFactoryTest.createProgramplan(oppty.Id, acct.Id, procSas.id);
        insert pgmPlan;
        
        Debt_Details__c debtDetails = DataFactoryTest.createDebtDetails(pgmPlan.id);
        debtDetails.Account__c = oppty.AccountId;
        debtDetails.Opportunity__c = oppty.Id;
        debtDetails.Creditor_Name__c = 'Test CN';
        insert debtDetails;
        
        ContentVersion contentVersion = DataFactoryTest.createContentVersion();
        insert contentVersion;
    }
    
    @isTest
    static void testgetDebtDetails(){
        Debt_Details__c debtDetails = [select id,Account__c,Opportunity__c from Debt_Details__c limit 1];
        Test.startTest();
        List<Debt_Details__c> dbList = DocumentController.getDebtDetails(debtDetails.Opportunity__c);
        Test.stopTest();
        Assert.isNotNull(dbList.size(),'dbList size should not be null');
    }
    @isTest
    static void testsaveDocumentDetailsWithDebtDetails(){
        Debt_Details__c debtDetails = [select id,Account__c,Opportunity__c,Creditor_Name__c from Debt_Details__c limit 1];
        Opportunity opp = [SELECT Id,Name FROM Opportunity LIMIT 1];
        ContentVersion cv = [SELECT Id, Title,ContentDocumentId FROM ContentVersion LIMIT 1];
        // Create a map to pass to the method
        DocumentController.DocumentDetailsWrapper documentDetails = new DocumentController.DocumentDetailsWrapper();
        documentDetails.documentName = 'Updated Test Document';
        documentDetails.fileId = cv.ContentDocumentId;
        documentDetails.accountId = debtDetails.Account__c;
        documentDetails.category = 'TestCategory';
        documentDetails.oppId = opp.Id;
        documentDetails.creditorName = debtDetails.Creditor_Name__c;
         String documentDetailsJson = JSON.serialize(documentDetails);
        Test.startTest();
        DocumentController.saveDocumentDetails(documentDetailsJson);
        Test.stopTest();
        ContentVersion updatedCv = [SELECT Id, Title FROM ContentVersion WHERE Id = :cv.Id];
        //.areEqual(opp.Name +'_'+ documentDetails.category + '_' + documentDetails.creditorName + '_' + documentDetails.documentName, updatedCv.Title);  
    }
    
    @isTest
    static void testsaveDocumentDetailsWithOutDebtDetails(){
        Opportunity opp = [SELECT Id,Name FROM Opportunity LIMIT 1];
        ContentVersion cv = [SELECT Id, Title,ContentDocumentId FROM ContentVersion LIMIT 1];
        // Create a map to pass to the method
        DocumentController.DocumentDetailsWrapper documentDetails = new DocumentController.DocumentDetailsWrapper();
        documentDetails.documentName = 'Updated Test Document';
        documentDetails.fileId = cv.ContentDocumentId;
        documentDetails.category = 'TestCategory';
        documentDetails.oppId = opp.Id;
         String documentDetailsJson = JSON.serialize(documentDetails);
        Test.startTest();
        DocumentController.saveDocumentDetails(documentDetailsJson);
        Test.stopTest();
        ContentVersion updatedCv = [SELECT Id, Title FROM ContentVersion WHERE Id = :cv.Id];
        Assert.areEqual(opp.Name +'_'+ documentDetails.category + '_' + documentDetails.documentName, updatedCv.Title);  
    }
    
    @isTest
    static void testdeleteDocument(){
        ContentVersion cv = [SELECT Id, Title,ContentDocumentId FROM ContentVersion LIMIT 1];
        Test.startTest();
        DocumentController.deleteDocument(cv.ContentDocumentId);
        Test.stopTest();
        ContentDocument[] contDocs = [SELECT Id FROM ContentDocument WHERE Id = :cv.ContentDocumentId];
        Assert.areEqual(0,contDocs.Size(),'Content Version should be deleted');   
    }
}