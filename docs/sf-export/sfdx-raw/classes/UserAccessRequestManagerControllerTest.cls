/*----------------------------------------------------------------
    Author: Yamini B
    Description: Controller Test class to onborad and offborad users
    Test Class: 

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Oct-31-2024     Yamini                  Initial Development                		
--------------------------------------------------------------------*/
@IsTest
public class UserAccessRequestManagerControllerTest {
    // data setup method
    @TestSetup
    static void setupTestData() {
        Id ProfileId = [SELECT Id FROM Profile WHERE Name='Standard User' LIMIT 1].Id;
        // Create a test user
        User us = DataFactoryTest.createUser(ProfileId);
        insert us;
    }
    
    /**
     * Description: Method to test creation of blank recors
    */
    @IsTest
    static void testCreateBlankRecords() {
        Integer recordCount = 3;
        Test.startTest();
        ApexActionResult result = UserAccessRequestManagerController.createBlankRecords(recordCount);
        Test.stopTest();
        UserAccessRequestManagerController.blankRecordResult resultWrap =
            (UserAccessRequestManagerController.blankRecordResult) JSON.deserialize(String.valueOf(result.data), UserAccessRequestManagerController.blankRecordResult.class);
        
        // Verify the number of records created matches the input number
        assert.areEqual(recordCount, resultWrap.blankRecordList.size(), 'The number of blank records created should match the input number');
        
    } 
    
    /**
     * Description: Method to test for fetching active users
    */
    @IsTest
    static void testGetUserList() {
        Test.startTest();
        ApexActionResult result = UserAccessRequestManagerController.getUserList();
        Test.stopTest();
        
        UserAccessRequestManagerController.userListResult resultWrap =
            (UserAccessRequestManagerController.userListResult) JSON.deserialize(String.valueOf(result.data), UserAccessRequestManagerController.userListResult.class);
        
        // Verify that active users are returned
        assert.isNotNull(!resultWrap.userList.isEmpty(), 'The user list should not be empty');
    }
    
    /**
     * Description: Method to test for fetching queues
    */
    @IsTest
    static void testGetQueueIds() {
        Test.startTest();
        ApexActionResult result = UserAccessRequestManagerController.getQueueIds();
        Test.stopTest();
        
        UserAccessRequestManagerController.queueResult resultWrap =
            (UserAccessRequestManagerController.queueResult) JSON.deserialize(String.valueOf(result.data), UserAccessRequestManagerController.queueResult.class);
        
        // Verify the queue map contains expected entries
        assert.areEqual(3, resultWrap.queueMap.size(), 'The map should contain 3 queues');
        
    }
}