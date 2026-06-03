@isTest
private class SuppressionListTriggerTest {

    @isTest
    static void testSuppressionListTrigger() {
        Lead testLead = new Lead(
            FirstName = 'Test',
            LastName = 'User',
            Company = 'Test Company',
            Status = 'Open - Not Contacted'
        );
        insert testLead;

        ContentVersion cv = new ContentVersion(
            Title = 'Test File',
            PathOnClient = 'TestFile.csv',
            VersionData = Blob.valueOf( 'Header1,Header2\nRow1Col1,Row1Col2\nRow2Col1,Row2Col2\n')
        );
        insert cv;

        Id contentDocId = [
            SELECT ContentDocumentId 
            FROM ContentVersion 
            WHERE Id = :cv.Id 
            LIMIT 1
        ].ContentDocumentId;

        ContentDocumentLink cdl = new ContentDocumentLink(
            ContentDocumentId = contentDocId,
            LinkedEntityId = testLead.Id,
            ShareType = 'V', 
            Visibility = 'AllUsers'
        );
        insert cdl;


        Test.startTest();

        Suppression_List__e eventRecord = new Suppression_List__e(
            ParentId__c = testLead.Id,
            ContentDocumentId__c = contentDocId
        );
        Database.SaveResult result = EventBus.publish(eventRecord);
        System.assert(result.isSuccess(), 'Event should be published successfully.');

        Test.stopTest();

    }
}