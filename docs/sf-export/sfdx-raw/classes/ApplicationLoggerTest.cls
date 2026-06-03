@isTest
private class ApplicationLoggerTest {
    
    @IsTest
    static void testlogDMLException(){
        
        Lead leadInstance = new Lead(
            FirstName='Test', LastName='Lead Julia', Email='julia.sample@company.com', Phone='4166661216', City='San Francisco', 
            Country = 'United States', State='California', PostalCode='94105', Company='XYZ Company Test', Status='Open - Not Contacted'
        );
        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(true, null));
        insert leadInstance;
        
        Test.startTest();
        try {
            Lead queryLead = [SELECT Id, LastName FROM Lead LIMIT 1];
            queryLead.LastName = '';
            update queryLead;
        } catch (DmlException exp) {
            ApplicationLogger.logDMLException('Required Field Missing', String.valueOf(leadInstance.Id), exp.getMessage());
        }
        Test.stopTest();
        
        Application_Log__c log = [SELECT Id, Exception_Message__c, Statement__c, Log_Type__c, Record_Id__c FROM Application_Log__c WHERE Log_Type__c != 'Info'  LIMIT 1];
        System.assertEquals('Required Field Missing', log.Statement__c);
        System.assertEquals('Error', log.Log_Type__c);
        System.assertEquals(leadInstance.Id, log.Record_Id__c);
        System.assert(log.Exception_Message__c.contains('first error: REQUIRED_FIELD_MISSING, Required fields are missing: [LastName]: [LastName]'));
    }
    
    @IsTest
    static void testlogException(){
        
        List<Lead> leadList = new List<Lead> {
            new Lead(
                FirstName='Test ', LastName = 'Lead John', Email='john.sample@company.com', Phone='4166661216', Company='XYZ Company Test'
            ),
            new Lead(
                FirstName='Test ', LastName = 'Lead Kiran', Email='john.sample@company.com', Phone='4166661216', Company='ABC Company Test'
            )
        };
                    
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(false, null));
        insert leadList;
        
        Test.startTest();
        try {
            Lead queryLead = [SELECT Id, Name FROM Lead];
        } catch (QueryException exp) {
            ApplicationLogger.logException(exp, leadList[0].Id);
            ApplicationLogger.logException('test', leadList[0].Id, 'List has more than 1 row for assignment to SObject');
        }
        Test.stopTest();
        
        Application_Log__c log = [SELECT Id, Exception_Message__c, Log_Type__c, Exception_StackTrace__c, Record_Id__c FROM Application_Log__c LIMIT 1];
        /*System.assertEquals('List has more than 1 row for assignment to SObject', log.Exception_Message__c);
        System.assertEquals('Error', log.Log_Type__c);
        System.assertEquals('Class.ApplicationLoggerTest.testlogException: line 49, column 1', log.Exception_Stacktrace__c); 
        System.assertEquals(leadList[0].Id, log.Record_Id__c);*/ 
    }
    
    @IsTest
    static void testlogDebugInfo(){
        
        Lead leadInstance = new Lead(
            FirstName='Test ', LastName ='Lead Julia', Email='john.sample@company.com', Phone='4166661216', 
            Company='XYZ Company Test', Status='Open - Not Contacted'
        );
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(true, null));
        insert leadInstance;
        if (leadInstance.Id != null) {
            ApplicationLogger.logDebugInfo('Lead inserted successfully!', leadInstance.Id);
        }
        Test.stopTest();
        
        Application_Log__c log = [SELECT Id, Record_Id__c, Log_Type__c, Statement__c FROM Application_Log__c WHERE Log_Type__c = 'Debug' LIMIT 1];
        System.assertEquals('Debug', log.Log_Type__c);
        System.assertEquals(leadInstance.Id, log.Record_Id__c);
        System.assertEquals('Lead inserted successfully!', log.Statement__c);   
    }
    
    @IsTest
    static void testlogCalloutException(){
        
        Lead leadInstance = new Lead(
            FirstName='Test ', LastName='Lead Julia', Email='john.sample@company.com', Phone='4166661216', 
            Company='XYZ Company Test', Status='Open - Not Contacted'
        ); 
        
        try {
            Test.startTest();
            insert leadInstance;
            Test.stopTest();
        } catch (CustomException exp) {
            System.assertEquals('Lead Insert Callout Error', exp.getMessage());                            
        }  
    }
    
    private class MockHttpResponseGenerator implements HttpCalloutMock {
        
        public Boolean success;
        public Integer errorCode;
        
        public MockHttpResponseGenerator(Boolean success, Integer errorCode) {
            this.success = success;
            this.errorCode = errorCode;
        }
        
        public HttpResponse respond(HttpRequest request) {
            
            HttpResponse response = new HttpResponse();
            response.setHeader('Content-Type', 'application/json');
            response.setStatusCode(200);
            response.setStatus('OK');
            if (success) {
                response.setBody('{"success": true, "data": {"lead_id": 1947826}, "id": 1947826}');
            } else {
                if (errorCode == 6008) {
                    response.setBody('{"success": false, "code": 6008, "text": "The phone number is invalid"}');
                } else {
                    response.setBody('{"success": false}');
                }
            }
            return response;
        }
    }

    @IsTest
    static void testLogExceptionWithData(){
        
        Test.startTest();
        try {
            throw new CustomException('Test exception');
        } catch (Exception ex){
            ApplicationLogger.LogExceptionWithData(ex, null, 'Test Data', 'High');
        }
        Test.stopTest();
        Application_Log__c log = [SELECT Id, Exception_Message__c, Severity__c FROM Application_Log__c LIMIT 1];
        Assert.areEqual('High', log.Severity__c, 'Expected Severity is High');
        Assert.isTrue(log.Exception_Message__c.containsIgnoreCase('Test exception'), 'Expected valid exception message.');
    }

    @IsTest
    static void testlogNotificationWithData(){
        
        Test.startTest();
        ApplicationLogger.logNotificationWithData('Test Data', 'Test Error Message', null, 'Low');
        Test.stopTest();
        Application_Log__c log = [SELECT Id, Exception_Message__c, Severity__c FROM Application_Log__c LIMIT 1];
        Assert.areEqual('Low', log.Severity__c, 'Expected Severity is Low');
        Assert.areEqual('Test Error Message', log.Exception_Message__c, 'Expected valid exception message.');
    }
    
    @isTest
    static void logInfoLogTest(){
        ApplicationLogger.logInfoLog('data','message','Id');
        ApplicationLogger.logCalloutSuccessWithRequiredResponse('endPoint',null,'reponse','statment','Id');
    }
    
     @isTest
    static void logExceptionHighSeverityTest(){
        ApplicationLogger.logExceptionHighSeverity('statment','Id','message');
        ApplicationLogger.logDetails('statment','Id','message');

    }
    
     @isTest
    static void insertStoredLogsTest(){
        ApplicationLogger.insertStoredLogs();
        ApplicationLogger.logDMLException('Required Field Missing', 'Id', 'message',False);
    }
}