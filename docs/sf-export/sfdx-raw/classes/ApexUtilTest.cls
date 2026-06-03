@IsTest
private class ApexUtilTest {

    @IsTest
    static void validateRequireValueWithNull() {
        String textVariable = null;
        String exceptionMessage;
        Test.startTest();
        try {
            ApexUtil.requireValue('Text Variable', textVariable);
        } catch(Exception ex) {
            exceptionMessage = ex.getMessage();
        }
        Test.stopTest();
        System.assertEquals('Text Variable should not be blank.', exceptionMessage, 'Validating the exception message');
    }

    @IsTest
    static void validateRequireValueWithEmptyString() {
        String textVariable = '';
        String exceptionMessage;
        Test.startTest();
        try {
            ApexUtil.requireValue('Text Variable', textVariable);
        } catch(Exception ex) {
            exceptionMessage = ex.getMessage();
        }
        Test.stopTest();
        System.assertEquals('Text Variable should not be blank.', exceptionMessage, 'Validating the exception message');
    }

    @IsTest
    static void validateRequireValueWithValidValue() {
        String textVariable = 'Test';
        String exceptionMessage;
        Test.startTest();
        try {
            ApexUtil.requireValue('Text Variable', textVariable);
        } catch(Exception ex) {
            exceptionMessage = ex.getMessage();
        }
        Test.stopTest();
        System.assertEquals(null, exceptionMessage, 'Validating the exception message is blank');
    }

    @IsTest
    static void testRemoveSOQLMemory() {
        // Test the removeSOQLMemory method
        Account acc = new Account(Name = 'Test Account');
        insert acc;      
        Test.startTest();
        SObject clonedObj = ApexUtil.removeSOQLMemory(acc);
        Test.stopTest();
        System.assertEquals(acc, (Account)clonedObj);
        System.assertEquals(acc.Id, clonedObj.Id);
        System.assertEquals(acc.Name, clonedObj.get('Name'));
    }
    
    @IsTest
    static void testRoundOffAmount() {
        Test.startTest();
        // Test the roundOffAmount method
        Decimal amount = 10.3555444444;
        Decimal roundedAmount = ApexUtil.roundOffAmount(amount);
        Test.stopTest();
        System.assertEquals(10.36, roundedAmount);
    }
    
    @IsTest
    static void testGetDynamicSObjectUtilInstance() {
        Test.startTest();
        // Test when sObjectName is valid
        SObjectUtil sObjectUtilInstance = ApexUtil.getDynamicSObjectUtilInstance('Event');
        // Test when sObjectName is invalid
        SObjectUtil invalidSObjectUtilInstance = ApexUtil.getDynamicSObjectUtilInstance('InvalidObject');
        Test.stopTest();
        System.assert(sObjectUtilInstance != null);
        System.assertEquals(null, invalidSObjectUtilInstance);
    }
    
    @IsTest
    static void testGetKeyPrefix() {
        Test.startTest();
        // Test when objectName is valid
        String keyPrefix = ApexUtil.getKeyPrefix('Account');
        // Test when objectName is invalid
        String invalidKeyPrefix = ApexUtil.getKeyPrefix('InvalidObject');
        Test.stopTest();
        System.assertEquals('001', keyPrefix);
        System.assertEquals(null, invalidKeyPrefix);
    }

    @IsTest
    static void testGetRecordTypeIdbyDeveloperName() {
        Test.startTest();
        // Test when objectName and recordTypeName are valid
        Id personAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'PersonAccount');
        // Test when objectName is invalid
        Id invalidRecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('InvalidObject', 'Standard');
        // Test when recordTypeName is invalid
        Id invalidRecordTypeId1 = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'InvalidRecordType');
        Test.stopTest();
        System.assert(personAcctRecTypeId != null);        
        System.assertEquals(null, invalidRecordTypeId);
        System.assertEquals(null, invalidRecordTypeId1);
    }
    

    @IsTest
    static void testGetNoOfWeeksBetweenTwoDates() {
        Test.startTest();
        // Test the getNoOfWeeksBetweenTwoDates method
        Date startDate = Date.newInstance(2023, 1, 1);
        Date endDate = Date.newInstance(2023, 1, 31);        
        Integer noOfWeeks = ApexUtil.getNoOfWeeksBetweenTwoDates(startDate, endDate);
        Test.stopTest();
        System.assertEquals(4, noOfWeeks);
    }
    
    @IsTest
    static void testgetSObjectName() {
        Test.startTest();
        Contact con = new Contact(LastName = 'Test Contact');
        insert con;
        String sObjectName = ApexUtil.getSObjectName(con.Id);
        Boolean isWhoId = ApexUtil.isWhoId(con.Id);
        ApexUtil.isAsyncContext();
        Test.stopTest();
        System.assertEquals('Contact', sObjectName);
        System.assertEquals(true, isWhoId);
    }
   
    @IsTest
    static void testTypeConversionWithDatetimeField() {
        Lead newLead = new Lead(LastName = 'Test Lead', Phone = '9087654321');
        insert newLead;
        String sObjectName = 'Lead';
        Map<String, String> fieldNameValueMap = new Map<String, String> {
            'Email'=>'john.sample@company.com','FirstName'=>'','LastName'=>'Julia John',
            'Phone'=>'4166661216', 'Street'=>'Suite 500, The landmark @ One Market',
            'City'=>'San Francisco', 'PostalCode'=>'94106','Country'=>'United States',
            'Gender__c'=>'Female','Date_Of_Birth__c'=>'1997-04-01', 'HasOptedOutOfEmail'=>'false',
            'Total_Debt_Amount__c'=>'133.45','Id'=>newLead.Id,'State'=>'CO',
            'EmailBouncedDate'=>'2023-06-18 16:12:48', 'NumberOfEmployees' => '1000',
            'AnnualRevenue'=>'18446744073709551615'
        };
        fieldNameValueMap.put('Description', JSON.serialize(fieldNameValueMap));
        Test.startTest();
        Lead record = (Lead)ApexUtil.typeConversion(sObjectName, fieldNameValueMap);
        Test.stopTest();
        System.assertEquals('john.sample@company.com', record.Email);
        System.assertEquals('4166661216', record.Phone);
        System.assertEquals('Suite 500, The landmark @ One Market', record.Street);
        System.assertEquals('San Francisco', record.City);
        System.assertEquals('94106', record.PostalCode);
        System.assertEquals('United States', record.Country);
        System.assertEquals('Female', record.Gender__c);
        System.assertEquals('CO', record.State);
        System.assertEquals(Date.newInstance(1997, 04, 01), record.Date_Of_Birth__c);
        System.assertEquals(133.45, record.Total_Debt_Amount__c);
        System.assertEquals(newLead.Id, record.Id);
    }
    
    @isTest
    static void validateEmailIdTest(){
       Boolean isValid = ApexUtil.validateEmailId('Test@gmail.com');       
        Assert.areEqual(true,isValid);
    }
    
     @isTest
    static void getWeekDayTest(){
       String weekDay = ApexUtil.getWeekDay(date.Today());
    }
    
       @isTest
    static void getUSStateAbbreviationTest(){
       String usAbbrevation = ApexUtil.getUSStateAbbreviation('New York');
        
        Assert.areEqual('NY' ,usAbbrevation);
    }
    
    @isTest
    static void removeHtmlTagsTest(){
       
       List<Profile> profileRec = [SELECT Id FROM Profile WHERE Name = 'System Administrator'];
       User userData = DataFactoryTest.createUser(profileRec[0].Id);
       insert userData;        
       ApexUtil.getUserIdByAlias('alias');
       ApexUtil.stringValue('test');
       List<String> strippedHtml = ApexUtil.stripHtml(new List<String>{'<p>test<p>'});
       System.assertEquals(strippedHtml[0], 'test');
    }    
    
}