@isTest
private class ContentVersionDataTest {
    
    @testSetup
    static void makeData() {
         ContentVersion contentVersion = DataFactoryTest.createContentVersion();
        contentVersion.Title = 'Testing';
        insert contentVersion;
    }
    
    
    @isTest
    static void getContentVersionsTest() {

        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        insert oppInstance;

        ContentVersion contentVersion = DataFactoryTest.createContentVersion();
        insert contentVersion;

        ContentVersion contVersion = [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id = :contentVersion.Id];

        ContentDocumentLink contDoclink = DataFactoryTest.createContentDocumentLink(oppInstance.Id, contVersion.ContentDocumentId);
        insert contDoclink;

        Test.startTest();
        List<ContentVersion> contVersionList = ContentVersionData.getContentVersions(new Set<Id> {contDoclink.ContentDocumentId});
        Test.stopTest();

        Assert.isNotNull(contVersionList, 'Verify the content version record is retrieved');
    }
    
    @isTest
    static void getContentVersionTest(){
        ContentVersion contVersion = [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Title=:'Testing' limit 1];
        Test.startTest();
        ContentVersion contVersionResult = ContentVersionData.getContentVersion(contVersion.ContentDocumentId);
        Test.stopTest();
        Assert.isNotNull(contVersionResult, 'Verify the content version record is retrieved');  
    }
}