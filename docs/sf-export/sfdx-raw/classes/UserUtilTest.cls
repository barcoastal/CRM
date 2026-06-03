@isTest
private with sharing class UserUtilTest {
    
    /**Test Class for UserUtil().getSObjName */
    @isTest
    static void testUserObjectName() {
    
        Id profileId = [SELECT Id FROM Profile WHERE Name = 'System Administrator'].Id;
        User userInstance = DataFactoryTest.createUser(profileId);
        userInstance.Twilio_Phone__c = '6498345678';
        insert userInstance;
        
        User userRec = [SELECT Id, UserName FROM User Limit 1];
        
        Test.startTest();
        String userObjName = new UserUtil().getSObjName();
        UserUtil.getUserIdByUserName(userRec.UserName);
        Test.stopTest();
        System.assertEquals('User', userObjName, 'Verify the User Object Name');
    }
}