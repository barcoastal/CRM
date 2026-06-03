@isTest
private class DocusignEnvelopeStatusServiceTest {

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
        document.dfsle__Type__c = 'ContentVersion';
        insert document;
        
        dfsle__Document__c document1 = DataFactoryTest.createDS_Document();
        document1.dfsle__Envelope__c = envelope.Id;
        document1.dfsle__Type__c = 'Template';
        document1.dfsle__FullName__c = 'Opportunity_SendContract_EnvelopeTemplate';
        insert document1;
        
        dfsle__EnvelopeStatus__c status = DataFactoryTest.createDS_EnvelopeStatus();
        insert status;

        Test.startTest();
        status.dfsle__Status__c = 'Completed';
        update status;
        DocusignEnvelopeStatusService.processUnSentDocuments(new Set<String>{status.dfsle__DocuSignId__c});
        DocusignEnvelopeStatusService.updateOpportunity(new Set<String>{oppId}, 'Completed');
        DocusignEnvelopeStatusService.updateContractSignedDateOnOppty(new Set<String>{oppId});
        Test.stopTest();

        Assert.areEqual(0, Database.countQuery('SELECT COUNT() FROM ContentDocumentLink WHERE LinkedEntityId = :oppId'));
    }
}