@isTest
private class DocusignEnvelopeStatusHandlerTest {

    @isTest
    static void sentContractsTest() {

        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        oppInstance.StageName = 'Agreements Received';
        insert oppInstance;
        
        Id oppId = oppInstance.Id;

        ContentVersion contentVersion = DataFactoryTest.createContentVersion();
        insert contentVersion;

        ContentVersion contVersion = [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id = :contentVersion.Id];

        ContentDocumentLink contDoclink = DataFactoryTest.createContentDocumentLink(oppInstance.Id, contVersion.ContentDocumentId);
        insert contDoclink;

        dfsle__Envelope__c envelope = DataFactoryTest.createDS_Envelope();
        envelope.dfsle__SourceId__c = oppId;
        insert envelope;

        dfsle__Document__c document = DataFactoryTest.createDS_Document();
        document.dfsle__Envelope__c = envelope.Id;
        insert document;        
        
        dfsle__EnvelopeStatus__c status = DataFactoryTest.createDS_EnvelopeStatus();
        insert status;
    }
    

    @isTest
    static void deleteUnSignedContractsTest() {

        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        oppInstance.StageName = 'Agreements Received';
        insert oppInstance;
        
        Id oppId = oppInstance.Id;

        ContentVersion contentVersion = DataFactoryTest.createContentVersion();
        insert contentVersion;

        ContentVersion contVersion = [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id = :contentVersion.Id];

        ContentDocumentLink contDoclink = DataFactoryTest.createContentDocumentLink(oppInstance.Id, contVersion.ContentDocumentId);
        insert contDoclink;

        dfsle__Envelope__c envelope = DataFactoryTest.createDS_Envelope();
        envelope.dfsle__SourceId__c = oppId;
        insert envelope;

        dfsle__Document__c document = DataFactoryTest.createDS_Document();
        document.dfsle__Envelope__c = envelope.Id;
        insert document;        
        
        dfsle__EnvelopeStatus__c status = DataFactoryTest.createDS_EnvelopeStatus();
        insert status;
        
        Test.startTest();
        status.dfsle__Status__c = 'Completed';
        update status;
        Test.stopTest();

        Assert.areEqual(0, Database.countQuery('SELECT COUNT() FROM ContentDocumentLink WHERE LinkedEntityId = :oppId'));
    }
}