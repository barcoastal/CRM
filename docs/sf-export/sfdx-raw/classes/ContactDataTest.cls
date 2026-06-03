@IsTest
public class ContactDataTest {

    @TestSetup
    static void makeData(){
        // Create test accounts
        Account testAccount1 = new Account(Name = 'Test Account 1', Lead_Number__c = '123');
        Account testAccount2 = new Account(Name = 'Test Account 2', Lead_Number__c = '456');
        insert new List<Account>{testAccount1, testAccount2};
        // Create test contacts
        Contact testContact1 = new Contact(
            AccountId = testAccount1.Id, FirstName = 'John', LastName = 'Doe', Email = 'johndoe@test.com', 
            MailingStreet = '123 Main St', MailingCity = 'Test City', MailingState = 'California',
            MailingPostalCode = '12345', MailingCountry = 'United States', Lead_Number__c = '123',
            Phone = '9087654321', MobilePhone = '4230987654'
        );
        Contact testContact2 = new Contact(
            AccountId = testAccount2.Id, FirstName = 'Jane', LastName = 'Smith', Email = 'janesmith@test.com',
            MailingStreet = '456 Main St', MailingCity = 'Test City', MailingState = 'New York',
            MailingPostalCode = '67890', MailingCountry = 'United States', Lead_Number__c = '456',
            Phone = '9087654321', MobilePhone = '4230987654'
        );
        insert new List<Contact>{testContact1, testContact2};
    }

    @IsTest
    static void testQueryContact(){

        Account acct = [SELECT Id, Lead_Number__c,Primary_Contact__c FROM Account WHERE Lead_Number__c = '123' LIMIT 1];
        
        Contact con = [SELECT Id,AccountId FROM Contact WHERE AccountId =: acct.Id]; 
        
        acct.Primary_Contact__c = con.Id;
        Update acct;
                
        Test.startTest();
        List<Contact> contacts = ContactData.queryContact(acct);
        ContactData.getPrimaryContact(acct);
        ContactData.fetchContactToAccountMap(new Set<Id>{contacts[0].Id});
        Test.stopTest();

        System.assertEquals('John', contacts[0].FirstName);
        System.assertEquals('Doe', contacts[0].LastName);
        System.assertEquals('johndoe@test.com', contacts[0].Email);
        System.assertEquals('123 Main St', contacts[0].MailingStreet);
        System.assertEquals('Test City', contacts[0].MailingCity);
        System.assertEquals('California', contacts[0].MailingState);
        System.assertEquals('CA', contacts[0].MailingStateCode);
        System.assertEquals('12345', contacts[0].MailingPostalCode);
        System.assertEquals('United States', contacts[0].MailingCountry);
    }

    @IsTest
    public static void testQueryContacts() {

        List<Account> accounts = [SELECT Id, Lead_Number__c FROM Account];            
        // Create account ID to lead number map
        Map<String, String> accIdWithLeadNumber = new Map<String, String>{
            accounts[0].Id => accounts[0].Lead_Number__c, accounts[1].Id => accounts[1].Lead_Number__c, 
            '0010w000015wpkaAAA' => '45632'
        };
            
        Test.startTest();
        // Call the queryContacts method
        List<Contact> contacts = ContactData.queryContacts(accIdWithLeadNumber);
        Test.stopTest();
        
        // Assert the expected results
        System.assertEquals(2, contacts.size());
        System.assertEquals('John', contacts[0].FirstName);
        System.assertEquals('Doe', contacts[0].LastName);
        System.assertEquals('johndoe@test.com', contacts[0].Email);
        System.assertEquals('123 Main St', contacts[0].MailingStreet);
        System.assertEquals('Test City', contacts[0].MailingCity);
        System.assertEquals('California', contacts[0].MailingState);
        System.assertEquals('CA', contacts[0].MailingStateCode);
        System.assertEquals('12345', contacts[0].MailingPostalCode);
        System.assertEquals('United States', contacts[0].MailingCountry);
        System.assertEquals('123', contacts[0].Lead_Number__c);
        System.assertEquals('Jane', contacts[1].FirstName);
        System.assertEquals('Smith', contacts[1].LastName);
        System.assertEquals('janesmith@test.com', contacts[1].Email);
        System.assertEquals('456 Main St', contacts[1].MailingStreet);
        System.assertEquals('Test City', contacts[1].MailingCity);
        System.assertEquals('New York', contacts[1].MailingState);
        System.assertEquals('NY', contacts[1].MailingStateCode);
        System.assertEquals('67890', contacts[1].MailingPostalCode);
        System.assertEquals('United States', contacts[1].MailingCountry);
        System.assertEquals('456', contacts[1].Lead_Number__c);
    }    
    
    @IsTest
    static void testQueryContactsPhoneNumbers() {
        
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        
        Test.startTest();
        List<Contact> contacts = ContactData.queryContactsPhoneNumbers(con.Id);
        Test.stopTest();
        
        System.assertEquals('9087654321', contacts[0].Phone);
        System.assertEquals('4230987654', contacts[0].MobilePhone);
    }

    /**Test Method for ContactData.queryContact */
    @isTest
    static void testQueryContactWithFields() {
        List<Contact> contacts = [SELECT Id FROM Contact ORDER BY CreatedDate LIMIT 1];
        Set<String> fields = new Set<String> {'Id', 'FirstName', 'LastName'};
        Test.startTest();
        List<Contact> queriedContacts = ContactData.queryContact(contacts[0].Id, fields);
        Test.stopTest();
        System.assertEquals('John', queriedContacts[0].FirstName, 'Verify the Contact Instance has FirstName');
        System.assertEquals('Doe', queriedContacts[0].LastName, 'Verify the Contact Instance has LastName');
    }
}