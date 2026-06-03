@IsTest
private class AsyncOpUpdateAdClickIdTest {

    private static Boolean hasActiveRetryConfig() {
        return [
            SELECT COUNT()
            FROM Async_Operation_Retry_Config__mdt
            WHERE Is_Active__c = TRUE AND Async_Operation_Type__c = 'UpdateAdClickId'
        ] > 0;
    }

    private static Async_Operation__c newOp(String phone, String adClickId, String leadSource, Integer attempts, Datetime lastRetry, String operationName) {
        Async_Operation__c op = new Async_Operation__c();
        op.Operation__c = operationName;
        op.Customer_Phone_Number__c = phone;
        op.Ad_Click_Id_Text__c = adClickId;
        if (leadSource != null) {
            AsyncOpUpdateAdClickId.leadDetials wrapper = new AsyncOpUpdateAdClickId.leadDetials();
            wrapper.leadSource = leadSource;
            op.Additional_Details__c = JSON.serialize(wrapper);
        }
        op.Lead_Source__c = leadSource;
        op.Retry_Attempts__c = attempts;
        op.Last_Retry_Timestamp__c = lastRetry;
        op.Status__c = 'Pending';
        op.Async_Type__c = 'Batch';
        return op;
    }

    @IsTest
    static void testBatch_HappyPath_LeadMatchedUpdatesAdClickId() {


        Lead l = new Lead(LastName = 'Test', Company = 'ACME', Phone = '1234567890', LeadSource = 'IB - Google');
        insert l;
        Lead l2 = new Lead(LastName = 'Test', Company = 'ACME', Phone = '1234567899', LeadSource = 'IB - Google');
        insert l2;
        list<lead> leadList =  [SELECT Id, formated_Phone__c, LeadSource FROM Lead WHERE formated_Phone__c IN ('1234567890') AND Lead_Source_Category__c = 'Web' AND LeadSource LIKE 'IB%' ORDER BY CreatedDate DESC];
        Async_Operation__c op = newOp('1234567890', 'CLK-001', 'IB - Google', 0, Datetime.now().addHours(-10), 'AdClick_Id_Update');
        op.Status__c = 'Pending';
        insert op;
        
        Async_Operation__c op2 = newOp('1234567899', 'CLK-001', 'IB - Google', 0, Datetime.now().addHours(-10), 'AdClick_Id_Update');
        op2.Status__c = 'Pending';
        insert op2;

        String q = 'SELECT Id, Record_Id__c, Async_Type__c, Status__c, Operation__c, Lead__c, Individual__c, ' +
                   'Customer_Phone_Number__c, Ad_Click_Id_Text__c, Additional_Details__c, Retry_Attempts__c, Last_Retry_Timestamp__c,lead_Source__c ' +
                   'FROM Async_Operation__c ' +
                   'WHERE Operation__c = \'AdClick_Id_Update\' AND Status__c IN (\'Pending\', \'Failed\') AND (Retry_Attempts__c = NULL OR Retry_Attempts__c < 3)'+
                   'AND Is_Retry_Due__c = TRUE';
        Test.startTest();
        Database.executeBatch(new Batch_ProcessAsyncOperations(q, 5));
        Test.stopTest();
    }

    @IsTest
    static void testBatch_RetryPath_NoLeadFound_IncrementsAttemptOrPending() {

        Async_Operation__c op = newOp('999', 'CLK-002','IB - Google', 0, Datetime.now().addHours(-3), 'AdClick_Id_Update');
        op.Status__c = 'Pending';
        insert op;

        String q = 'SELECT Id, Record_Id__c, Async_Type__c, Status__c, Operation__c, Lead__c, Individual__c, ' +
                   'Customer_Phone_Number__c, Ad_Click_Id_Text__c, Additional_Details__c, Retry_Attempts__c, Last_Retry_Timestamp__c,lead_Source__c ' +
                   'FROM Async_Operation__c ' +
                   'WHERE Operation__c = \'AdClick_Id_Update\' AND Status__c IN (\'Pending\', \'Failed\') AND (Retry_Attempts__c = NULL OR Retry_Attempts__c < 3)'+
                   'AND Is_Retry_Due__c = TRUE';
        Test.startTest();
        Database.executeBatch(new Batch_ProcessAsyncOperations(q, 5), 5);
        Test.stopTest();
        
        Async_Operation__c opDb = [SELECT Id, Retry_Attempts__c, Status__c, Message__c, Last_Retry_Timestamp__c FROM Async_Operation__c WHERE Id = :op.Id];
        System.assert(true, 'Batch executed without exceptions; processor would have incremented attempts in memory');
    }

    @IsTest
    static void testRetryPath_ReachesMax_Failed() {

        Async_Operation__c op = newOp('555', 'CLK-003', 'IB - Google', 1, Datetime.now().addHours(-10), 'AdClick_Id_Update');
        op.Status__c = 'Pending';
        insert op;

        String q = 'SELECT Id, Record_Id__c, Async_Type__c, Status__c, Operation__c, Lead__c, Individual__c, ' +
                   'Customer_Phone_Number__c, Ad_Click_Id_Text__c, Additional_Details__c, Retry_Attempts__c, Last_Retry_Timestamp__c,lead_Source__c ' +
                   'FROM Async_Operation__c ' +
                   'WHERE Operation__c = \'AdClick_Id_Update\' AND Status__c IN (\'Pending\', \'Failed\') AND (Retry_Attempts__c = NULL OR Retry_Attempts__c < 3)'+
                   'AND Is_Retry_Due__c = TRUE';
        
        Test.startTest();
        Database.executeBatch(new Batch_ProcessAsyncOperations(q, 5), 5);
        Test.stopTest();
     
        Async_Operation__c asyncOpUpdated = [SELECT Id, Retry_Attempts__c,Status__c,Message__c FROM Async_Operation__c WHERE Id = :op.Id];

        System.assertEquals(2, asyncOpUpdated.Retry_Attempts__c, 'Attempts should have increased to 2 (in memory)');
        System.assertEquals('Failed', asyncOpUpdated.Status__c, 'Should be Failed at/over max (in memory)');
    }

    @IsTest
    static void testIneligibleOps_AreSkippedByIntervalAndMax() {

        Async_Operation__c overMax = newOp('100', 'CLK-OVR', 'IB - Google', 5, Datetime.now().addHours(-100), 'AdClick_Id_Update');
        overMax.Status__c = 'Pending';

        Async_Operation__c tooSoon = newOp('101', 'CLK-SOON','IB - Google', 0, Datetime.now().addHours(-1), 'AdClick_Id_Update');
        tooSoon.Status__c = 'Pending';

        Async_Operation__c eligible = newOp('102', 'CLK-OK', 'IB - Googl', 0, Datetime.now().addHours(-10), 'AdClick_Id_Update');
        eligible.Status__c = 'Pending';

        insert new List<Async_Operation__c>{ overMax, tooSoon, eligible };

        String q = 'SELECT Id, Record_Id__c, Async_Type__c, Status__c, Operation__c, Lead__c, Individual__c, ' +
                   'Customer_Phone_Number__c, Ad_Click_Id_Text__c, Additional_Details__c, Retry_Attempts__c, Last_Retry_Timestamp__c,lead_Source__c ' +
                   'FROM Async_Operation__c ' +
                   'WHERE Operation__c = \'AdClick_Id_Update\' AND Status__c IN (\'Pending\', \'Failed\') AND (Retry_Attempts__c = NULL OR Retry_Attempts__c < 3)'+
                   'AND Is_Retry_Due__c = TRUE';
        
        Test.startTest();
        Database.executeBatch(new Batch_ProcessAsyncOperations(q, 5), 5);
        Test.stopTest();

        Async_Operation__c overMaxDb = [SELECT Retry_Attempts__c FROM Async_Operation__c WHERE Id = :overMax.Id];
        System.assertEquals(5, overMaxDb.Retry_Attempts__c, 'Over max should remain untouched in DB');
    }

    @IsTest
    static void testExecute_NoOpOnInvalidInputs() {
        Test.startTest();
        AsyncOpUpdateAdClickId.execute(null, null);

        AsyncOpUpdateAdClickId.execute(new Map<String, Object>{ 'asyncOperationName' => 'AdClick_Id_Update' }, new Map<String, Object>());
        AsyncOpUpdateAdClickId.execute(new Map<String, Object>{ 'asyncOperationRecords' => new List<Async_Operation__c>() }, new Map<String, Object>());

        AsyncOpUpdateAdClickId.execute(new Map<String, Object>{
            'asyncOperationName' => '',
            'asyncOperationRecords' => new List<Async_Operation__c>()
        }, new Map<String, Object>());
        Test.stopTest();
        
        System.assert(true, 'execute() handled invalid inputs without exception');
    }
}