@isTest
public class BatchSASGetCustomerRecordsTest {

    @TestSetup
    static void makeData(){
        Id personAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'PersonAccount');
        Id businessAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account');
        
        List<Account> accountList = new List<Account> {
            new Account(RecordTypeId = personAcctRecTypeId, FirstName = 'Nyssa', LastName = 'Vazquez', External_SAS_Id__c = '69', Lead_Number__c = '1111111'),
            new Account(RecordTypeId = businessAcctRecTypeId, Name = 'Taven Limited', External_SAS_Id__c = '91', Lead_Number__c = '2222222'),
            new Account(RecordTypeId = businessAcctRecTypeId, Name = 'Debt Limited', External_SAS_Id__c = '86', Lead_Number__c = '333333')
        };
        insert accountList;

        List<Contact> contactList = new List<Contact> {
            new Contact(FirstName = 'Kyla', LastName = 'Olsen', AccountId = accountList[1].Id, Lead_Number__c = '2222222'),
            new Contact(FirstName = 'Iris', LastName = 'Watson', AccountId = accountList[2].Id, Lead_Number__c = '333333')
        };
        insert contactList;
        
        insert new SAS_Settings__c(Endpoint__c = 'https://test.com');
    }

    @IsTest
    static void getCustomerRecordsTest_Success(){

        List<Account> accountList = [SELECT Id FROM Account];

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(new List<Id>{accountList[0].Id, accountList[1].Id, accountList[2].Id}, true));
        Database.executeBatch(new BatchSASGetCustomerRecords());
        Test.stopTest();
        
        //Verify the callout data records created through batch
        Callout_Data__c verifyCalloutData = [
            SELECT Id, Method_Name__c, Message__c, IsSuccess__c, Records_Count__c, Status__c, Status_Code__c, 
            DateStart__c, DateEnd__c FROM Callout_Data__c LIMIT 1
       ];
        System.assertEquals('GetCustomerRecords', verifyCalloutData.Method_Name__c, 'Method Name is incorrect');
        System.assertEquals('5 rows returned successfully.', verifyCalloutData.Message__c, 'Message is invalid');
        System.assertEquals(true, verifyCalloutData.IsSuccess__c, 'Success status is invalid');
        System.assertEquals(5, verifyCalloutData.Records_Count__c, 'Record count did not match');
        System.assertEquals('OK', verifyCalloutData.Status__c, 'HTTP response Status did not match');
        System.assertEquals('200', verifyCalloutData.Status_Code__c, 'HTTP response Status Code did not match');
        System.assert(verifyCalloutData.DateStart__c != null, 'Start Date Time is blank');
        System.assert(verifyCalloutData.DateEnd__c != null, 'End Date Time is blank');
        
        //Verify the callout data item records created through batch
        List<Callout_Data_Item__c> verifyCDIList = [
            SELECT Id, Record_Id__c, External_Id__c, FullName__c, AddressLine1__c, City__c, Country__c, Email__c, 
            FirstName__c, LastName__c, Phone1__c, Postal_Code__c, State__c, Customer_Status__c, RowNumber__c, SSN__c 
            FROM Callout_Data_Item__c WHERE Callout_Data__c = :verifyCalloutData.Id
        ];
        //System.assertEquals(5, verifyCDIList.size(), 'Record size did not match');
        /*if (verifyCDIList[0].Record_Id__c == accountList[0].Id) {
            System.assertEquals('69', verifyCDIList[0].External_Id__c, 'SAS Id did not match');
            System.assertEquals('Nyssa', verifyCDIList[0].FirstName__c, 'First Name did not match');
            System.assertEquals('Vazquez', verifyCDIList[0].LastName__c, 'Last Name did not match');
            System.assertEquals('nyssa@company.com', verifyCDIList[0].Email__c, 'Email did not match');
            System.assertEquals(1, verifyCDIList[0].RowNumber__c, 'Row Number did not match');
        } else {
            System.assertEquals(accountList[1].Id, verifyCDIList[1].Record_Id__c, 'Salesforce Account Id did not match');
            System.assertEquals('91', verifyCDIList[1].External_Id__c, 'SAS Id did not match');
            System.assertEquals('3142446306', verifyCDIList[1].Phone1__c, 'Current Balance is incorrect');
            System.assertEquals(2, verifyCDIList[0].RowNumber__c, 'Row Number did not match');
        }

        //Verify the account records created through batch
        List<Account> verifyAccount = [
            SELECT Id, External_SAS_Id__c, PersonEmail, Phone, SSN__c, Status__c, 
            PersonMailingStreet, PersonMailingCity, PersonMailingCountry, IsPersonAccount, 
            PersonMailingPostalCode, PersonMailingState FROM Account
        ];
        if (verifyAccount[0].Id == accountList[0].Id) {
            System.assertEquals('69', verifyAccount[0].External_SAS_Id__c, 'External SAS Id did not match');
            System.assertEquals('Ap #651-8679 Sodales Av.', verifyAccount[0].PersonMailingStreet, 'Mailing Street did not match');
            System.assertEquals('Tamuning', verifyAccount[0].PersonMailingCity, 'Mailing City did not match');
            System.assertEquals('Pennsylvania', verifyAccount[0].PersonMailingState, 'Mailing State did not match');
            System.assertEquals('United States', verifyAccount[0].PersonMailingCountry, 'Mailing Country did not match');
            System.assertEquals('10855', verifyAccount[0].PersonMailingPostalCode, 'Mailing POstal Code did not match');
            System.assertEquals('6543935734', verifyAccount[0].Phone, 'Phone did not match');
            System.assertEquals('Active', verifyAccount[0].Status__c, 'Status did not match');
            System.assertEquals(true, verifyAccount[0].IsPersonAccount, 'Is Person Account check is invalid');
        } else {
            System.assertEquals('91', verifyAccount[1].External_SAS_Id__c, 'External SAS did not match');
            System.assertEquals('Hold', verifyAccount[1].Status__c, 'Status did not match');
            System.assertEquals('3142446306', verifyAccount[1].Phone, 'Phone did not match');
            System.assertEquals(false, verifyAccount[1].IsPersonAccount, 'Is Person Account check is invalid');
        }

        Contact verifyContact = [
            SELECT Id, FirstName, LastName, Email, MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry, 
            Lead_Number__c FROM Contact WHERE AccountId = :verifyAccount[1].Id LIMIT 1
        ];
        System.assertEquals('Hiroko', verifyContact.FirstName, 'First Name did not match');
        System.assertEquals('Potter', verifyContact.LastName, 'Last Name did not match');
        System.assertEquals('hiroko@company.com', verifyContact.Email, 'Email did not match');
        System.assertEquals('P.O. Box 887 2508 Dolor. Av.', verifyContact.MailingStreet, 'Mailing Street did not match');
        System.assertEquals('Muskegon', verifyContact.MailingCity, 'Mailing City did not match');
        System.assertEquals('Kentucky', verifyContact.MailingState, 'Mailing State did not match');
        System.assertEquals('United States', verifyContact.MailingCountry, 'Mailing Country did not match');
        System.assertEquals('12482', verifyContact.MailingPostalCode, 'Mailing POstal Code did not match');
        System.assertEquals('2222222', verifyContact.Lead_Number__c, 'Lead Number did not match');*/
    }

    @IsTest
    static void getCustomerRecordsTest_Failure(){       
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(new List<Id>(), false));
        Database.executeBatch(new BatchSASGetCustomerRecords(Datetime.now(), Datetime.now().addDays(1)));
        Test.stopTest();
        
        //Verify the callout data records created through batch
        Callout_Data__c verifyCalloutData = [
            SELECT Id, Method_Name__c, Message__c, IsSuccess__c, Records_Count__c, Status__c, Status_Code__c, 
            DateStart__c, DateEnd__c FROM Callout_Data__c LIMIT 1
        ];
        System.assertEquals('GetCustomerRecords', verifyCalloutData.Method_Name__c, 'Method Name is incorrect');
        System.assertEquals('The customer record cannot be found.', verifyCalloutData.Message__c, 'Message is invalid');
        System.assertEquals(true, verifyCalloutData.IsSuccess__c, 'Success status is invalid');
        System.assertEquals(0, verifyCalloutData.Records_Count__c, 'Record count did not match');
        System.assertEquals('OK', verifyCalloutData.Status__c, 'HTTP response Status did not match');
        System.assertEquals('200', verifyCalloutData.Status_Code__c, 'HTTP response Status Code did not match');
        System.assert(verifyCalloutData.DateStart__c != null, 'Start Date Time is blank');
        System.assert(verifyCalloutData.DateEnd__c != null, 'End Date Time is blank');      
    }
    
    @IsTest
    static void getCustomerRecordsTest_Exception(){
        try {
            Test.startTest();        
            Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(new List<Id>(), false));
            Database.executeBatch(new BatchSASUpdateAccountInfo(null));        
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
                    '{"RequestID": 854, "PrimaryKeyID": 0, "Success": true, "Message": "5 rows returned successfully.", "Records": 5,'
                    +' "ProcessData": "[{\\"display\\":\\"Nyssa Vazquez\\",\\"address1\\":\\"Ap #651-8679 Sodales Av.\\",\\"address2\\":\\"\\",\\"address3\\":\\"\\",'
                    +'\\"address4\\":\\"\\",\\"balance\\":0.00,\\"city\\":\\"Tamuning\\",\\"clients_id\\":8,\\"company\\":\\"\\",\\"country\\":\\"United States\\",'
                    +'\\"created\\":\\"2023-05-05T05:52:59.207\\",\\"createdby\\":\\"API Engine\\",\\"customerstatus_enums_id\\":8,\\"email\\":\\"Nyssa@company.com\\",'
                    +'\\"firstname\\":\\"Nyssa\\",\\"id\\":69,\\"isportalactive\\":true,\\"lastname\\":\\"Vazquez\\",\\"modified\\":null,\\"modifiedby\\":null,'
                    +'\\"phone1\\":\\"6543935734\\",\\"phone2\\":\\"\\",\\"phone3\\":\\"\\",\\"postalcode\\":\\"10855\\",\\"remoteid\\":\\"'+accIdList[0]+'\\",'
                    +'\\"state\\":\\"PA\\",\\"clients_display\\":\\"CoastalDebt\\",\\"customerstatus\\":\\"Active\\",\\"ssntid\\":\\"666776666\\",'
                    +'\\"password\\":\\"Encrypted\\",\\"salt\\":\\"Encrypted\\",\\"totalfailed\\":null,\\"rownumber\\":1,\\"cnt\\":0},{\\"display\\":\\"Hiroko Potter\\",'
                    +'\\"address1\\":\\"P.O. Box 887 2508 Dolor. Av.\\",\\"address2\\":\\"\\",\\"address3\\":\\"\\",\\"address4\\":\\"\\",\\"balance\\":0.00,'
                    +'\\"city\\":\\"Muskegon\\",\\"clients_id\\":8,\\"company\\":\\"\\",\\"country\\":\\"United States\\",\\"created\\":\\"2023-05-05T03:51:06.273\\",'
                    +'\\"createdby\\":\\"API Engine\\",\\"customerstatus_enums_id\\":10,\\"email\\":\\"hiroko@company.com\\",\\"firstname\\":\\"Hiroko\\",\\"id\\":91,'
                    +'\\"isportalactive\\":true,\\"lastname\\":\\"Potter\\",\\"modified\\":null,\\"modifiedby\\":null,\\"phone1\\":\\"3142446306\\",\\"phone2\\":\\"\\",'
                    +'\\"phone3\\":\\"\\",\\"postalcode\\":\\"12482\\",\\"remoteid\\":\\"'+accIdList[1]+'\\",\\"state\\":\\"KY\\",'
                    +'\\"clients_display\\":\\"CoastalDebt\\",\\"customerstatus\\":\\"Hold\\",\\"ssntid\\":\\"555555555\\",\\"password\\":\\"Encrypted\\",'
                    +'\\"salt\\":\\"Encrypted\\",\\"totalfailed\\":null,\\"rownumber\\":2,\\"cnt\\":0},{\\"display\\":\\"Test Client Test Client\\",'
                    +'\\"address1\\":\\"Test Street\\",\\"address2\\":\\"\\",\\"address3\\":\\"\\",\\"address4\\":\\"\\",\\"balance\\":0.00, \\"city\\":\\"Test Street\\",'
                    +'\\"clients_id\\":8,\\"company\\":\\"\\",\\"country\\":\\"United States\\",\\"created\\":\\"2023-05-05T03:14:34.9\\",\\"createdby\\":\\"API Engine\\",'
                    +'\\"customerstatus_enums_id\\":8,\\"email\\":\\"test@email.com\\",\\"firstname\\":\\"Test Client\\",\\"id\\":87,\\"isportalactive\\":true,'
                    +'\\"lastname\\":\\"Test Client\\",\\"modified\\":null,\\"modifiedby\\":null,\\"phone1\\":\\"345698457\\",\\"phone2\\":\\"\\",\\"phone3\\":\\"\\",'
                    +'\\"postalcode\\":\\"94405\\", \\"remoteid\\":\\"0060l00000aVOZgAAO\\",\\"state\\":\\"AL\\",\\"clients_display\\":\\"CoastalDebt\\",'
                    +'\\"customerstatus\\":\\"Active\\",\\"ssntid\\":\\"Encrypted\\",\\"password\\":\\"Encrypted\\",\\"salt\\":\\"Encrypted\\",\\"totalfailed\\":null,'
                    +'\\"rownumber\\":3,\\"cnt\\":0}, {\\"display\\":\\"Client Test\\",\\"address1\\":\\"Test Street\\",\\"address2\\":\\"Unit A\\",\\"address3\\":\\"\\",'
                    +'\\"address4\\":\\"\\",\\"balance\\":0.00,\\"city\\":\\"Clio\\",\\"clients_id\\":8,\\"company\\":\\"\\",\\"country\\":\\"United States\\",'
                    +'\\"created\\":\\"2023-05-01T07:38:43.6\\",\\"createdby\\":\\"API Engine\\",\\"customerstatus_enums_id\\":8,\\"email\\":\\"test@client.com\\",'
                    +'\\"firstname\\":\\"Test\\",\\"id\\":74,\\"isportalactive\\":true,\\"lastname\\":\\"Client\\",\\"modified\\":null,\\"modifiedby\\":null,'
                    +'\\"phone1\\":\\"555-555-5555\\",\\"phone2\\":\\"\\",\\"phone3\\":\\"\\",\\"postalcode\\":\\"94405\\",\\"remoteid\\":\\"1234567\\",'
                    +'\\"state\\":\\"AL\\",\\"clients_display\\":\\"CoastalDebt\\",\\"customerstatus\\":\\"Active\\",\\"ssntid\\":\\"Encrypted\\",'
                    +'\\"password\\":\\"Encrypted\\",\\"salt\\":\\"Encrypted\\",\\"totalfailed\\":null,\\"rownumber\\":15,\\"cnt\\":0}, {\\"display\\":\\"Hiroko Potter\\",'
                    +'\\"address1\\":\\"P.O. Box 887 2508 Dolor. Av.\\",\\"address2\\":\\"\\",\\"address3\\":\\"\\",\\"address4\\":\\"\\",\\"balance\\":0.00,'
                    +'\\"city\\":\\"Muskegon\\",\\"clients_id\\":8,\\"company\\":\\"\\",\\"country\\":\\"United States\\",\\"created\\":\\"2023-05-05T03:51:06.273\\",'
                    +'\\"createdby\\":\\"API Engine\\",\\"customerstatus_enums_id\\":10,\\"email\\":\\"hiroko@company.com\\",\\"firstname\\":\\"Hiroko\\",'
                    +'\\"isportalactive\\":true,\\"lastname\\":\\"Potter\\",\\"modified\\":null,\\"modifiedby\\":null,\\"phone1\\":\\"3142446306\\",\\"phone2\\":\\"\\",'
                    +'\\"phone3\\":\\"\\",\\"postalcode\\":\\"12482\\",\\"remoteid\\":\\"'+accIdList[2]+'\\",\\"state\\":\\"KY\\",\\"id\\":86,'
                    +'\\"clients_display\\":\\"CoastalDebt\\",\\"customerstatus\\":\\"Hold\\",\\"ssntid\\":\\"55-555-5555\\",\\"password\\":\\"Encrypted\\",'
                    +'\\"salt\\":\\"Encrypted\\",\\"totalfailed\\":null,\\"rownumber\\":2,\\"cnt\\":0}, {\\"display\\":\\"Client Test\\",\\"address1\\":\\"Test Street\\",'
                    +'\\"address2\\":\\"Unit A\\",\\"address3\\":\\"\\",\\"address4\\":\\"\\",\\"balance\\":0.00,\\"city\\":\\"Clio\\",\\"clients_id\\":8,'
                    +'\\"company\\":\\"\\",\\"country\\":\\"United States\\",\\"created\\":\\"2023-05-01T07:39:37.66\\",\\"createdby\\":\\"API Engine\\",'
                    +'\\"customerstatus_enums_id\\":8,\\"email\\":\\"test@client.com:51:06.273\\",\\"firstname\\":\\"Test\\",\\"id\\":75,\\"isportalactive\\":true,'
                    +'\\"lastname\\":\\"Client\\",\\"modified\\":null,\\"modifiedby\\":null,\\"phone1\\":\\"555-555-5555\\",\\"phone2\\":\\"\\",\\"phone3\\":\\"\\",'
                    +'\\"postalcode\\":\\"94405\\",\\"remoteid\\":\\"123456\\",\\"state\\":\\"AL\\",\\"clients_display\\":\\"CoastalDebt\\",\\"customerstatus\\":\\"Active\\",'
                    +'\\"ssntid\\":\\"Encrypted\\",\\"password\\":\\"Encrypted\\",\\"salt\\":\\"Encrypted\\",\\"totalfailed\\":null,\\"rownumber\\":14,\\"cnt\\":0}]", '
                    +'"EchoRequest": "Form Variables:\\r\\nQueryString Variables:\\r\\nAPIKey = test\\r\\nCompanyKey = 2\\r\\nMethod = GetCustomerRecords\\r\\n"}'
                );
            } else {
                response.setBody(
                    '{"RequestID": 855, "PrimaryKeyID": 0, "Success": true, "Message": "The customer record cannot be found.", "Records": 0, "ProcessData": null, '
                    +'"EchoRequest": "Form Variables:\\r\\nQueryString Variables:\\r\\nAPIKey = test\\r\\nCompanyKey = 2\\r\\nMethod = GetCustomerRecords\\r\\n"}'
                );
            }
            return response;
        }
    }
}