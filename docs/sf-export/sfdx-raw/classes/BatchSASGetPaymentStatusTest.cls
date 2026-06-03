@isTest
public class BatchSASGetPaymentStatusTest {

    @TestSetup
    static void makeData(){

        Id personAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'PersonAccount');
        Account acct = new Account(RecordTypeId = personAcctRecTypeId, FirstName = 'Nyssa', LastName = 'Vazquez', External_SAS_Id__c = '69');
        insert acct;

        Opportunity oppty = new Opportunity(
            Name = 'Opportunity Test', AccountId = acct.Id, CloseDate = System.today().addDays(3), ForecastCategoryName = 'Pipeline',
            Probability = 40, StageName = 'Working Opportunity'
        );
        insert oppty;

        Payment_Processor__c processor = new Payment_Processor__c(Name = 'SAS', Processor_Type__c = 'SAS');
        insert processor;

        Program_Plan__c programPlan = new Program_Plan__c(
            Client__c = acct.Id, Opportunity__c = oppty.Id, Payment_Processor__c = processor.Id
        );
        insert programPlan;

        Draft__c draft = new Draft__c(Program_Plan__c = programPlan.Id, External_SAS_Id__c = '155');
        insert draft;
        
        insert new SAS_Settings__c(Endpoint__c = 'https://test.com');
    }

    @IsTest
    static void getPaymentStatusTest_Success(){

        Account acct = [SELECT Id FROM Account LIMIT 1];
        Draft__c draft = [SELECT Id, External_SAS_Id__c FROM Draft__c LIMIT 1];

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(acct.Id, draft.External_SAS_Id__c, true));
        Database.executeBatch(new BatchSASGetPaymentStatus());
        Test.stopTest();
        
        //Verify the callout data records created through batch
        Callout_Data__c verifyCalloutData = [SELECT Id, Method_Name__c, Message__c, IsSuccess__c, Records_Count__c, Status__c, Status_Code__c FROM Callout_Data__c LIMIT 1];
        System.assertEquals('GetPaymentStatusBulk', verifyCalloutData.Method_Name__c, 'Method Name is incorrect');
        System.assertEquals('4 rows returned successfully.', verifyCalloutData.Message__c, 'Message is invalid');
        System.assertEquals(true, verifyCalloutData.IsSuccess__c, 'Success status is invalid');
        System.assertEquals(4, verifyCalloutData.Records_Count__c, 'Record count did not match');
        System.assertEquals('OK', verifyCalloutData.Status__c, 'HTTP response Status did not match');
        System.assertEquals('200', verifyCalloutData.Status_Code__c, 'HTTP response Status Code did not match');
        
        //Verify the callout data item records created through batch
        List<Callout_Data_Item__c> verifyCDIList = [
            SELECT Id, Invoice_Number__c, Payment_Method__c, External_Id__c, Payment_Status__c
            FROM Callout_Data_Item__c WHERE Callout_Data__c = :verifyCalloutData.Id
        ];
        /*System.assertEquals(2, verifyCDIList.size(), 'Record size did not match');
        System.assertEquals('155', verifyCDIList[0].External_Id__c, 'SAS Id did not match');
        System.assertEquals('11111', verifyCDIList[0].Invoice_Number__c, 'Invoice Number is incorrect');
        System.assertEquals('Successful', verifyCDIList[0].Payment_Status__c, 'Payment Status did not match');
        System.assertEquals('ACH', verifyCDIList[0].Payment_Method__c, 'Payment Method did not match');*/

        //Verify the draft records updated through batch
        Draft__C verifyDraft = [SELECT Id, Draft_Status__c, External_SAS_Id__c FROM Draft__C LIMIT 1];
        //System.assertEquals('155', verifyDraft.External_SAS_Id__c, 'External SAS did not match');
        //System.assertEquals('Scheduled', verifyDraft.Draft_Status__c, 'Draft Status did not match');
    }

    @IsTest
    static void getPaymentStatusTest_Failure(){

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(null, null, false));
        Database.executeBatch(new BatchSASGetPaymentStatus());
        Test.stopTest();

        //Verify the callout data records created through batch
        Callout_Data__c verifyCalloutData = [SELECT Id, Method_Name__c, Message__c, IsSuccess__c, Records_Count__c, Status__c, Status_Code__c FROM Callout_Data__c LIMIT 1];
        System.assertEquals('GetPaymentStatusBulk', verifyCalloutData.Method_Name__c, 'Method Name is incorrect');
        System.assertEquals('No Payment record found.', verifyCalloutData.Message__c, 'Message is invalid');
        System.assertEquals(true, verifyCalloutData.IsSuccess__c, 'Success status is invalid');
        System.assertEquals(0, verifyCalloutData.Records_Count__c, 'Record count did not match');
        System.assertEquals('OK', verifyCalloutData.Status__c, 'HTTP response Status did not match');
        System.assertEquals('200', verifyCalloutData.Status_Code__c, 'HTTP response Status Code did not match');
    }
    
    @IsTest
    static void getPaymentStatusTest_Exception(){
        try {
            Test.startTest();        
            Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(null, null, false));
            Database.executeBatch(new BatchSASUpdatePaymentStatus(null));        
            Test.stopTest();
        } catch (CustomException exp) {
            System.assertEquals('Callout Data Id is required to execute the batch', exp.getMessage(), 'Exception is not valid');
        }
    }

    public class MockHttpResponseGenerator implements HttpCalloutMock {
        private Id accountId;
        private String draftSASId;
        private Boolean isSuccess;

        public MockHttpResponseGenerator(Id acctId, String externalId, Boolean isSuccess) {
            this.accountId = acctId;
            this.draftSASId = externalId;
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
                    +' "ProcessData": "[{\\"id\\":155,\\"created\\":\\"2023-05-29T09:01:09.4\\",\\"createdby\\":\\"PaymentsAPI\\",\\"modified\\":null,'
                    +'\\"modifiedby\\":null,\\"field1\\":\\"Test transaction\\",\\"field2\\":\\"Test transaction\\",\\"field3\\":\\"Test transaction\\",'
                    +'\\"field4\\":null,\\"field5\\":null,\\"invoicenumber\\":\\"11111\\",\\"ach_id\\":null,\\"total\\":10.00,\\"paymentstatus_enums_id\\":17,'
                    +'\\"paymentmethods_display\\":\\"ACH\\",\\"paymentstatus\\":\\"Successful\\",\\"customers_id\\":91,\\"customers_display\\":\\"May-08-2023'
                    +'Test Client\\",\\"customers_email\\":\\"test@email.com1\\",\\"customers_remoteid\\":\\"0017800000LgBiOAAV\\",'
                    +'\\"customers_phone1\\":\\"4567094567\\",\\"customerstatus_enums_id\\":8,\\"clients_id\\":8,\\"clients_email\\":\\"sample@company.com\\",'
                    +'\\"balance\\":0.00,\\"totalnsf\\":null},{\\"id\\":156,\\"created\\":\\"2023-05-29T09:01:54.943\\",\\"createdby\\":\\"PaymentsAPI\\",'
                    +'\\"modified\\":null,\\"modifiedby\\":null,\\"field1\\":\\"Test transaction\\",\\"field2\\":\\"Test transaction\\",\\"field3\\":\\"Test'
                    +'transaction\\",\\"field4\\":null,\\"field5\\":null,\\"invoicenumber\\":\\"11111\\",\\"ach_id\\":null,\\"total\\":10.00,'
                    +'\\"paymentstatus_enums_id\\":17,\\"paymentmethods_display\\":\\"ACH\\",\\"paymentstatus\\":\\"Successful\\",\\"customers_id\\":91,'
                    +'\\"customers_display\\":\\"May-08-2023 Test Client\\",\\"customers_email\\":\\"test@email.com1\\",\\"customers_remoteid\\":\\"0017800000LgBiOAAV\\",'
                    +'\\"customers_phone1\\":\\"4567094567\\",\\"customerstatus_enums_id\\":8,\\"clients_id\\":8,\\"clients_email\\":\\"sample@company.com\\",'
                    +'\\"balance\\":0.00,\\"totalnsf\\":null},{\\"id\\":157,\\"created\\":\\"2023-05-29T09:01:54.943\\",\\"createdby\\":\\"PaymentsAPI\\",'
                    +'\\"modified\\":null,\\"modifiedby\\":null,\\"field1\\":\\"Test transaction\\",\\"field2\\":\\"Test transaction\\",\\"field3\\":\\"Test'
                    +'transaction\\",\\"field4\\":null,\\"field5\\":null,\\"invoicenumber\\":\\"11111\\",\\"ach_id\\":null,\\"total\\":10.00,'
                    +'\\"paymentstatus_enums_id\\":17,\\"paymentmethods_display\\":\\"ACH\\",\\"paymentstatus\\":\\"Successful\\",\\"customers_id\\":91,'
                    +'\\"customers_display\\":\\"May-08-2023 Test Client\\",\\"customers_email\\":\\"test@client.com:51:06.273\\",\\"customers_remoteid\\":\\"0017800000LgBiOAAV\\",'
                    +'\\"customers_phone1\\":\\"4567094567\\",\\"customerstatus_enums_id\\":8,\\"clients_id\\":8,\\"clients_email\\":\\"sample@company.com\\",'
                    +'\\"balance\\":0.00,\\"totalnsf\\":null}]","EchoRequest": "Form Variables:\\r\\nQueryString Variables:\\r\\nAPIKey = 123243\\r\\nCompanyKey'
                    +'= 8\\r\\nMethod = GetPaymentStatusBulk\\r\\n"}'
                );
            } else {
                response.setBody(
                    '{"RequestID": 855, "PrimaryKeyID": 0, "Success": true, "Message": "No Payment record found.", "Records": 0, "ProcessData": "[]", '
                    +'"EchoRequest": "Form Variables:\\r\\nQueryString Variables:\\r\\nAPIKey = test\\r\\nCompanyKey = 2\\r\\nMethod = GetBalances\\r\\n"}'
                );
            }
            return response;
        }
    }
}