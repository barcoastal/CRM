@isTest
private class DocusignDocumentDataTest {

    @isTest
    static void myUnitTest() {

        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        insert oppInstance;

        dfsle__Envelope__c envelope = DataFactoryTest.createDS_Envelope();
        envelope.dfsle__SourceId__c = oppInstance.Id;
        insert envelope;

        dfsle__Document__c document = DataFactoryTest.createDS_Document();
        document.dfsle__Envelope__c = envelope.Id;
        insert document;

        Test.startTest();
        List<dfsle__Document__c> documents = DocusignDocumentData.getDocuments(new Set<String> {envelope.dfsle__DocuSignId__c});
        Test.stopTest();

        Assert.isNotNull(documents, 'Verify the DocusSign Document is retrieved');
        Assert.areEqual('Test Document', documents[0].dfsle__FullName__c, 'Verify the Documents Full Name');
        Assert.areEqual(oppInstance.Id, documents[0].dfsle__Envelope__r.dfsle__SourceId__c, 'Verify the Source Id of the Envelope');
    }

    @isTest
    static void getGenTemplateByNameTest(){
        
        dfsle__GenTemplate__c genTemp = new dfsle__GenTemplate__c();
        genTemp.Name = 'Opportunity_QuickSendContract_GenTemplate';
        genTemp.dfsle__Description__c = 'QuickSendContract';
        insert genTemp;

        Test.startTest();
        dfsle__GenTemplate__c template = DocusignDocumentData.getGenTemplateByName('Opportunity_QuickSendContract_GenTemplate');
        Test.stopTest();

        Assert.isNotNull(template);
        Assert.areEqual(genTemp.Id, template.Id);
        Assert.areEqual('QuickSendContract', template.dfsle__Description__c);
    }
}