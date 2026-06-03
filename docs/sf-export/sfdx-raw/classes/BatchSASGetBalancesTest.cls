@isTest
public class BatchSASGetBalancesTest {

    @TestSetup
    static void makeData(){
        Id personAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'PersonAccount');
        Id businessAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account');
        
        List<Account> accountList = new List<Account> {
            new Account(RecordTypeId = personAcctRecTypeId, FirstName = 'Nyssa', LastName = 'Vazquez', External_SAS_Id__c = '69'),
            new Account(RecordTypeId = businessAcctRecTypeId, Name = 'Taven Limited', External_SAS_Id__c = '91')
        };
        insert accountList;
        
        insert new SAS_Settings__c(Endpoint__c = 'https://test.com');
    }

    @IsTest
    static void getCurrentBalancesTest_Success(){

        List<Account> accountList = [SELECT Id FROM Account];

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(new List<Id>{accountList[0].Id, accountList[1].Id}, true));
        Database.executeBatch(new BatchSASGetBalances());
        Test.stopTest();
        
        //Verify the callout data records created through batch
        Callout_Data__c verifyCalloutData = [SELECT Id, Method_Name__c, Message__c, IsSuccess__c, Records_Count__c, Status__c, Status_Code__c FROM Callout_Data__c LIMIT 1];
        System.assertEquals('GetBalances', verifyCalloutData.Method_Name__c, 'Method Name is incorrect');
        System.assertEquals('4 rows returned successfully.', verifyCalloutData.Message__c, 'Message is invalid');
        System.assertEquals(true, verifyCalloutData.IsSuccess__c, 'Success status is invalid');
        System.assertEquals(4, verifyCalloutData.Records_Count__c, 'Record count did not match');
        System.assertEquals('OK', verifyCalloutData.Status__c, 'HTTP response Status did not match');
        System.assertEquals('200', verifyCalloutData.Status_Code__c, 'HTTP response Status Code did not match');
        
        //Verify the callout data item records created through batch
        List<Callout_Data_Item__c> verifyCDIList = [
            SELECT Id, Balance_In__c, Balance_Out__c, Current_Balance__c, Record_Id__c, External_Id__c 
            FROM Callout_Data_Item__c WHERE Callout_Data__c = :verifyCalloutData.Id
        ];
        /*System.assertEquals(4, verifyCDIList.size(), 'Record size did not match');
        if (verifyCDIList[0].Record_Id__c == accountList[0].Id) {
            System.assertEquals('69', verifyCDIList[0].External_Id__c, 'SAS Id did not match');
            System.assertEquals(10.00, verifyCDIList[0].Current_Balance__c, 'Current Balance is incorrect');
            System.assertEquals(0.00, verifyCDIList[0].Balance_In__c, 'Balance In did not match');
            System.assertEquals(0.00, verifyCDIList[0].Balance_Out__c, 'Balance Out did not match');
        } else {
            System.assertEquals(accountList[1].Id, verifyCDIList[1].Record_Id__c, 'Salesforce Account Id did not match');
            System.assertEquals('91', verifyCDIList[1].External_Id__c, 'SAS Id did not match');
            System.assertEquals(12.35, verifyCDIList[1].Current_Balance__c, 'Current Balance is incorrect');
        }
        
        //Verify the account records updated through batch
        List<Account> verifyAccount = [SELECT Id, Current_Balance__c, External_SAS_Id__c FROM Account];
        if (verifyAccount[0].Id == accountList[0].Id) {
            System.assertEquals('69', verifyAccount[0].External_SAS_Id__c, 'External SAS Id did not match');
            System.assertEquals(10.00, verifyAccount[0].Current_Balance__c, 'Current Balance did not match');
        } else {
            System.assertEquals('91', verifyAccount[1].External_SAS_Id__c, 'External SAS did not match');
            System.assertEquals(12.35, verifyAccount[1].Current_Balance__c, 'Current Balance did not match');
        }*/
    }

    @IsTest
    static void getCurrentBalancesTest_Failure(){

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(new List<Id>(), false));
        Database.executeBatch(new BatchSASGetBalances());
        Test.stopTest();

        //Verify the callout data records created through batch
        Callout_Data__c verifyCalloutData = [SELECT Id, Method_Name__c, Message__c, IsSuccess__c, Records_Count__c, Status__c, Status_Code__c FROM Callout_Data__c LIMIT 1];
        System.assertEquals('GetBalances', verifyCalloutData.Method_Name__c, 'Method Name is incorrect');
        System.assertEquals('The customer record cannot be found.', verifyCalloutData.Message__c, 'Message is invalid');
        System.assertEquals(true, verifyCalloutData.IsSuccess__c, 'Success status is invalid');
        System.assertEquals(0, verifyCalloutData.Records_Count__c, 'Record count did not match');
        System.assertEquals('OK', verifyCalloutData.Status__c, 'HTTP response Status did not match');
        System.assertEquals('200', verifyCalloutData.Status_Code__c, 'HTTP response Status Code did not match');
    }
    
    @IsTest
    static void getCurrentBalancesTest_Exception(){
        try {
            Test.startTest();        
            Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(new List<Id>(), false));
            Database.executeBatch(new BatchSASUpdateAccountBalance(null));        
            Test.stopTest();
        } catch (CustomException exp) {
            System.assertEquals('Callout Data Id is required to execute the batch', exp.getMessage(), 'Exception is not valid');
        }
    }

    public class MockHttpResponseGenerator implements HttpCalloutMock {
        private List<Id> accIdList;
        private Boolean isSuccess;

        public MockHttpResponseGenerator(List<Id> acctIdList, Boolean isSuccess) {
            this.accIdList = acctIdList;
            this.isSuccess = isSuccess;
        }

        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            response.setHeader('Content-Type', 'application/json');
            response.setStatusCode(200);
            response.setStatus('OK');

            if (this.isSuccess) {
                response.setBody(
                    '{"RequestID": 854, "PrimaryKeyID": 0, "Success": true, "Message": "4 rows returned successfully.", "Records": 4,'
                    +' "ProcessData": "[{\\"id\\":69,\\"remoteid\\":\\"'+accIdList[0]+'\\",\\"balance_in\\":0.00,\\"balance_out\\":0.00,\\"current_balance\\":10.00},'
                    +'{\\"id\\":72,\\"remoteid\\":\\"879887665465\\",\\"balance_in\\":0.00,\\"balance_out\\":0.00,\\"current_balance\\":0.00},'
                    +'{\\"id\\":72,\\"remoteid\\":\\"0120l000001krDMAAY\\",\\"balance_in\\":0.00,\\"balance_out\\":0.00,\\"current_balance\\":0.00},'
                    +'{\\"id\\":91,\\"remoteid\\":\\"'+accIdList[1]+'\\",\\"balance_in\\":71.00,\\"balance_out\\":0.00,\\"current_balance\\":12.35}]", '
                    +'"EchoRequest": "Form Variables:\\r\\nQueryString Variables:\\r\\nAPIKey = test\\r\\nCompanyKey = 2\\r\\nMethod = GetBalances\\r\\n"}'
                );
            } else {
                response.setBody(
                    '{"RequestID": 855, "PrimaryKeyID": 0, "Success": true, "Message": "The customer record cannot be found.", "Records": 0, "ProcessData": null, '
                    +'"EchoRequest": "Form Variables:\\r\\nQueryString Variables:\\r\\nAPIKey = test\\r\\nCompanyKey = 2\\r\\nMethod = GetBalances\\r\\n"}'
                );
            }
            return response;
        }
    }
}