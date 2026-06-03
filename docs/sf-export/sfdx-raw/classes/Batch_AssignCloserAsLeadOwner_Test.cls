@isTest
private class Batch_AssignCloserAsLeadOwner_Test {
    
    @isTest
    static void testBatchAssignCloserAsLeadOwner() {
        Profile p = [SELECT Id FROM Profile WHERE Name = 'System Administrator']; 
        List<User> userList = new List<User> {
            new User(Email='AllisonBiscardi@testcompany.com', ProfileId = p.Id, UserName='AllisonBiscardi@testcompany.com', FirstName = 'Alison', 
            LastName='Biscardi', Alias = 'abisc', EmailEncodingKey='UTF-8', LanguageLocaleKey='en_US', LocaleSidKey='en_US', TimeZoneSidKey='America/Los_Angeles',User_Country__c = 'United States'),
            new User(Email='ChristopherBoulahanis@testcompany.com', ProfileId = p.Id, UserName='ChristopherBoulahanis@testcompany.com', FirstName = 'Christopher', 
            LastName='Boulahanis', Alias = 'cboul', EmailEncodingKey='UTF-8', LanguageLocaleKey='en_US', LocaleSidKey='en_US', TimeZoneSidKey='America/Los_Angeles',User_Country__c = 'United States'),
            new User(Email='GonzaloSalinas@testcompany.com', ProfileId = p.Id, UserName='GonzaloSalinas@testcompany.com', FirstName = 'Gonzalo', 
            LastName='Salinas', Alias = 'gsali', EmailEncodingKey='UTF-8', LanguageLocaleKey='en_US', LocaleSidKey='en_US', TimeZoneSidKey='America/Los_Angeles',User_Country__c = 'United States'),
            new User(Email='NikkiValente@testcompany.com', ProfileId = p.Id, UserName='NikkiValente@testcompany.com', FirstName = 'Nikki', 
            LastName='Valente', Alias = 'nvale', EmailEncodingKey='UTF-8', LanguageLocaleKey='en_US', LocaleSidKey='en_US', TimeZoneSidKey='America/Los_Angeles',User_Country__c = 'United States')
        };
        insert userList;
        
        Test.startTest();
        List<Lead> leadList = new List<Lead>{
            new Lead(FirstName = 'Allison', LastName = 'Biscardi', Closer__c = userList[0].FirstName+' '+userList[0].LastName, Phone = '9087654321'),
            new Lead(FirstName = 'Christopher', LastName = 'Boulahanis', Closer__c = userList[1].FirstName+' '+userList[1].LastName, Phone = '9087654321'),
            new Lead(FirstName = 'Gonzalo', LastName = 'Salinas', Closer__c = userList[2].FirstName+' '+userList[2].LastName, Phone = '9087654321'),
            new Lead(FirstName = 'Nikki', LastName = 'Valente', Closer__c = userList[3].FirstName+' '+userList[3].LastName, Phone = '9087654321')
        };
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        insert leadList;
        Database.executeBatch(new Batch_AssignCloserAsLeadOwner());
        Test.stopTest();
         /*List<Lead> verifyLeadList = [SELECT Id, Closer__c, OwnerId, Owner.Name FROM Lead];
        System.assertEquals(verifyLeadList[0].Closer__c, verifyLeadList[0].Owner.Name);
        System.assertEquals(verifyLeadList[1].Closer__c, verifyLeadList[1].Owner.Name);
        System.assertEquals(verifyLeadList[2].Closer__c, verifyLeadList[2].Owner.Name);
        System.assertEquals(verifyLeadList[3].Closer__c, verifyLeadList[3].Owner.Name);*/
    }
}