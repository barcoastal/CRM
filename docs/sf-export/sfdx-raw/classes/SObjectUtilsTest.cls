@isTest
private class SObjectUtilsTest {
    
    @TestSetup
    static void setup() {
        
        // Create test Account
        Account acc = new Account();
        acc.Name = 'Test Account 1';
        insert acc;
        Account acc1 = new Account();
        acc1.Name = 'Test Account 2';
        insert acc1;
        // Create test Opportunity
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId =  acc.Id;
        insert opp;  
        
        // Create test Quote
        Quote quote = new Quote(
            Name = 'Test Quote',
            OpportunityId = opp.Id, // Assuming there's at least one Opportunity
            Pricebook2Id = Test.getStandardPricebookId(),
            Status = 'Draft' 
        );
        insert quote;
        
        //create test user
        Profile profile = [SELECT Id FROM Profile LIMIT 1]; 
        User testUser = DataFactoryTest.createUser(profile.Id);
        insert testUser;
    }
    
    @isTest
    static void testGetObject() {
        
        Account testAccount = [SELECT Id FROM Account LIMIT 1];
        Id accountId = testAccount.Id;
        
        // Test getObject method
        SObject retrievedObject = SObjectUtils.getObject(accountId);
        
        // Assert that the retrieved object is not null
        System.assertNotEquals(null, retrievedObject);
    }
    
    @isTest
    static void testGetObjects() {
        
        List<Account> testAccounts = [SELECT Id FROM Account LIMIT 2];
        List<Id> accountIds = new List<Id>();
        for (Account acc : testAccounts) {
            accountIds.add(acc.Id);
        }
        
        // Test getObjects method
        Map<Id, SObject> retrievedObjects = SObjectUtils.getObjects(accountIds);
        
        // Assert that the retrieved objects map is not null and contains the correct number of records
        System.assertNotEquals(null, retrievedObjects);
        System.assertEquals(2, retrievedObjects.size());
    }
    
    @isTest
    static void testGetObjectsException() {
        List<Id> accountIds = new List<Id>();
        Map<Id, SObject> retrievedObjects = new map<Id,SObject>();
        try{
            // Test getObjects method
            retrievedObjects = SObjectUtils.getObjects(accountIds);
        }
        catch(NullPointerException  e){
            System.assertEquals('The list of Object Ids cannot be null or empty', e.getMessage(), 'Exception message mismatch');
            
        }
        
    }
    
    @isTest
    static void testGetObjectByName() {
        
        // Test getObjectByName method
        Account testAccount = [SELECT Id, Name FROM Account where Name = 'Test Account 1' LIMIT 1];
        SObject retrievedObject = SObjectUtils.getObjectByName('Account', testAccount.Name);
        
        // Assert that the retrieved object is not null
        System.assertNotEquals(null, retrievedObject);
    }
    
    @isTest
    static void testGetObjectsByName() {
        
        List<Account> testAccounts = [SELECT Id, Name FROM Account LIMIT 2];
        List<String> accountNames = new List<String>();
        for (Account acc : testAccounts) {
            accountNames.add(acc.Name);
        }
        // Test getObjectsByName method
        Map<String, SObject> retrievedObjects = SObjectUtils.getObjectsByName('Account', accountNames);
        
        // Assert that the retrieved objects map is not null and contains the correct number of records
        System.assertNotEquals(null, retrievedObjects);
        System.assertEquals(2, retrievedObjects.size());
    }
    
    @isTest
    static void testGetObjectsByNameForlistRecordNamesException() {
        
        List<String> accountNames = new List<String>();
        Map<String, SObject> retrievedObjects = new map<String,SObject>();
        try{
            // Test getObjectByName method
            retrievedObjects = SObjectUtils.getObjectsByName('Account', accountNames);
        }
        catch(NullPointerException  e){
            //assert to check if exception is thrown
            System.assertEquals('The list of Record Names cannot be null or empty', e.getMessage(), 'Exception message mismatch');
            
        }
        
    }
    
    
    @isTest
    static void testGetObjectKeyPrefixForObjectName() {
        // Test getObjectKeyPrefixForObjectName method
        String keyPrefix = SObjectUtils.getObjectKeyPrefixForObjectName('Account');
        
        // Assert that the key prefix is not null
        System.assertNotEquals(null, keyPrefix);
    }
    
    @isTest
    static void testGetFieldNamesForObject() {
        // Test getFieldNamesForObject method
        List<String> fieldNames = SObjectUtils.getFieldNamesForObject('Account');
        
        // Assert that the list of field names is not null and not empty
        System.assertNotEquals(null, fieldNames);
        System.assertNotEquals(0, fieldNames.size());
    }
    
    @isTest
    static void testGetUpdateableFieldNamesForObject() {
        // Test getUpdateableFieldNamesForObject method
        List<Schema.DescribeFieldResult> updateableFields = SObjectUtils.getUpdateableFieldNamesForObject('Account');
        
        // Assert that the list of updateable fields is not null and not empty
        System.assertNotEquals(null, updateableFields);
        System.assertNotEquals(0, updateableFields.size());
    }
    
    @isTest
    static void testIsOpportunity(){
        Opportunity opp = [select id from opportunity limit 1];
        // Test isOpportunity method
        Boolean isOpp = SObjectUtils.isOpportunity(opp.id);
        //assert if isOpp method returns true
        system.assertEquals(true,isOpp);
    }
    @isTest
    static void testIsQuote(){
        Quote q = [select id from Quote limit 1];
        // Test isQuote method
        Boolean isQuote = SObjectUtils.isQuote(q.id);
        //assert if isQuote method returns true
        system.assertEquals(true,isQuote);
    }
    @isTest
    static void testIsUser(){
        User us = [select id from User limit 1];
        // Test isUser method
        Boolean isUser = SObjectUtils.isUser(us.id);
        //assert if isUser method returns true
        system.assertEquals(true,isUser);
    }
    
    
    
    @isTest
    static void testCopyFields_Clobber_NoExcludeFields() {
        // Create source and target SObject instances
        Account sourceAccount = new Account(Name = 'Source Account', Industry = 'Technology');
        Account targetAccount = new Account(Name = 'Target Account', Industry = 'Finance');
        
        // Copy fields with clobbering and no excluded fields
        SObjectUtils.copyFields(sourceAccount, targetAccount, true);
        
        // Assert that target Account's fields are clobbered from source Account
        System.assertEquals('Source Account', targetAccount.Name);
        System.assertEquals('Technology', targetAccount.Industry);
    }
    
    
    @isTest
    static void testSetToNull() {
        
        Account acc = [Select id,Description from Account limit 1];
        
        // Add some fields to clear
        List<String> fieldsToClear = new List<String>{'Description'};
            
            // Call the method to set fields to null
            SObjectUtils.setToNull(acc, fieldsToClear);
        
        
        // Check if fields are null
        System.assertEquals(null, acc.Description);
    }
    
    @isTest
    static void testGetChangedFields() {
        // Create editable fields
        List<Schema.DescribeFieldResult> editableFields = new List<Schema.DescribeFieldResult>{
            Account.Name.getDescribe(),
                Account.Description.getDescribe()
                };
                    
                    // Create ignore fields
                    Set<String> ignoreFieldNames = new Set<String>{'Description'};
        
        Account oldAcc = [select id,Name from Account where Name='Test Account 1'];
        Account newAcc = [Select id,Name from Account where Name = 'Test Account 2'];
        
        // Call the method to get changed fields
        List<Schema.DescribeFieldResult> changedFields = SObjectUtils.getChangedFields(editableFields, ignoreFieldNames, newAcc, oldAcc);
        
        // Check if the changed fields are correct
        System.assertEquals(1, changedFields.size());
        System.assertEquals('Name', changedFields[0].getName());
    }
    
    @isTest
    static void testAdaptToVm() {  
       Account acc = [select id,Name from Account where Name='Test Account 1'];
        
        // Call the method to adapt SObject to VM
        Map<String, Object> vm = SObjectUtils.adaptToVm(acc);
        
        // Check if the VM is created correctly
        System.assertEquals('Test Account 1', vm.get('Name'));
    }
    
    @isTest
    static void testCreateMapWithUncommonElements() {
        
         Account acc1 = [select id,Name from Account where Name='Test Account 1'];
        Account acc2 = [Select id,Name from Account where Name = 'Test Account 2'];
        // Create two maps with some common and uncommon elements
        Map<String, SObject> firstMap = new Map<String, SObject>{'Account1' => acc1 };
                    
      	Map<String, SObject> secondMap = new Map<String, SObject>{'Account2' => acc2 };
                                
         // Call the method to create a map with uncommon elements
          Map<String, SObject> resultMap = SObjectUtils.createMapWithUncommonElements(firstMap, secondMap);
        
        // Check if the result map contains only uncommon elements
        System.assertEquals(2, resultMap.size());
        System.assertEquals(true, resultMap.containsKey('Account1'));
        System.assertEquals(true, resultMap.containsKey('Account2'));
    }
}