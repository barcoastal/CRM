@isTest
private class ContentDocumentDataTest {

    @isTest
    static void getContentDocumentsTest() {

        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        oppInstance.StageName = 'Agreements Received';
        insert oppInstance;

        ContentVersion contentVersion = DataFactoryTest.createContentVersion();
        insert contentVersion;

        ContentVersion contVersion = [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id = :contentVersion.Id];

        ContentDocumentLink contDoclink = DataFactoryTest.createContentDocumentLink(oppInstance.Id, contVersion.ContentDocumentId);
        insert contDoclink;

        Test.startTest();
        List<ContentDocument> documents = ContentDocumentData.getContentDocuments(new Set<Id> {contVersion.ContentDocumentId});
        Test.stopTest();

        Assert.isNotNull(documents, 'Verify the content document is retrieved');
    }
}