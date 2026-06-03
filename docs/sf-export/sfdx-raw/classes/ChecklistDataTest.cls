@isTest
private class ChecklistDataTest {
  
    @isTest
    static void getActiveChecklistItemTest() {
        
        Account accountRecord = DataFactoryTest.createAccount();
        insert accountRecord;
        
        Contact contactRecord = DataFactoryTest.createContact();
        insert contactRecord;
        
        Checklist__c checkList = new Checklist__c(Name = 'Active', Account__c = accountRecord.Id, Active__c = True);
        insert checkList;
        
        Test.startTest();
        List<Checklist__c> checkLists = ChecklistData.getActiveChecklistItem(accountRecord.Id);
        Test.stopTest();
        
        Assert.areEqual(1, checkLists.size());
    }
}