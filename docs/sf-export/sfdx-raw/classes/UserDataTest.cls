@isTest
private with sharing class UserDataTest {
    
    @testSetup
    static void makeData(){
        List<Profile> profileRec = [SELECT Id FROM Profile WHERE Name = 'System Administrator'];
        User userData = DataFactoryTest.createUser(profileRec[0].Id);
        insert userData;
    }

    /**Test Method for UserData.queryCurrentUser */
    @isTest
    static void testQueryUserWithFields() {
        List<User> users = [SELECT Id FROM User WHERE Email = 'puser000@amamama.com'];
        Set<String> fields = new Set<String> {'Id', 'LastName', 'Email'};
        List<User> queriedUsers;
        System.runAs(users[0]) {
            Test.startTest();
            queriedUsers = UserData.queryCurrentUser(fields);
            Test.stopTest();
        }
        System.assertEquals('last', queriedUsers[0].LastName, 'Verify the User Instance has Last Name');
        System.assertEquals('puser000@amamama.com', queriedUsers[0].Email, 'Verify the User Instance has Email');
    }
    
    @isTest
    static void testqueryActiveUsers(){
        Test.startTest();
        List<User> users  =  UserData.queryActiveUsers();
        Test.stopTest();
        assert.isNotNull(!users.isEmpty(),'users list should not be empty');
    }
    @isTest
    static void testqueryCloserUsers(){
        Test.startTest();
        List<User> users = UserData.queryActiveClsoers();
        Test.stopTest();
        assert.isNotNull(!users.isEmpty(),'users list should not be empty');
    }
    @isTest
    static void testqueryDefaultSalesAdminUsers(){
        Test.startTest();
        List<User> users = UserData.queryDefaultSalesAdmin();
        UserData.queryBuyoutClosers();
        Test.stopTest();
        assert.isNotNull(!users.isEmpty(),'users list should not be empty');
    }
}