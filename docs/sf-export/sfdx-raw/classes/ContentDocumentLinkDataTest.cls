@isTest
private class ContentDocumentLinkDataTest {

    @isTest
    static void getContentDocumentLinksTest() {

        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        oppInstance.StageName = 'Agreements Received';
        insert oppInstance;

        ContentVersion contentVersion = DataFactoryTest.createContentVersion();
        insert contentVersion;

        ContentVersion contVersion = [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id = :contentVersion.Id];

        ContentDocumentLink contDoclink = DataFactoryTest.createContentDocumentLink(oppInstance.Id, contVersion.ContentDocumentId);
        insert contDoclink;     
        
        List<ContentDocumentLink> contDocLinkRec = [SELECT Id, LinkedEntityId, ContentDocumentId, ContentDocument.Title FROM ContentDocumentLink WHERE ContentDocumentId =:contVersion.ContentDocumentId];  

        Test.startTest();
        ContentDocumentLinkData.queryContentDocumentLinks(new Set<Id>{contVersion.ContentDocumentId });
        ContentDocumentLinkData.getContentDocumentLinksByLinkedEntity(new Set<Id>{contDocLinkRec[0].LinkedEntityId});
        List<ContentDocumentLink> cdlList = ContentDocumentLinkData.getContentDocumentLinks(new Set<Id>{oppInstance.Id}, new Set<String> {contentVersion.Title});
        List<ContentDocumentLink> oppCdList = ContentDocumentLinkData.queryContentDocumentLinksByParentIds(new Set<Id>{oppInstance.Id});
        Test.stopTest();

        Assert.isNotNull(cdlList, 'Verify the content document link is retrieved');
        Assert.areEqual('Test Document', cdlList[0].ContentDocument.Title, 'Verify the content document title');
        Assert.areEqual(1, oppCdList.size(), 'Verify the content document record count');
    }
}