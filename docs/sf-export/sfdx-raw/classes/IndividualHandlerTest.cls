@IsTest
public class IndividualHandlerTest {

    @testSetup
    static void setupTestData() {
        // Create test leads
        List<Lead> testLeads = new List<Lead>();
        for (Integer i = 0; i < 5; i++) {
            Lead lead = new Lead(
                LastName = 'Test Lead ' + i,
                Phone = '123456789'+i,
                Email = 'test@example.com'
            );
            testLeads.add(lead);
        }
        insert testLeads;

        // Create test accounts
        List<Account> testAccounts = new List<Account>();
        for (Integer i = 0; i < 5; i++) {
            Account account = new Account(
                Name = 'Test Account ' + i,
                Phone = '1234567890'
            );
            testAccounts.add(account);
        }
        insert testAccounts;

        // Create test opportunities
        List<Opportunity> testOpportunities = new List<Opportunity>();
        for (Integer i = 0; i < 5; i++) {
            Opportunity opportunity = new Opportunity(
                Name = 'Test Opportunity ' + i,
                Phone__c = '1234567890',
                Email__c = 'test@example.com',
                StageName = 'Prospecting',
                CloseDate = Date.today()
            );
            testOpportunities.add(opportunity);
        }
        insert testOpportunities;
    }

    @IsTest
    static void testConstructLeadsWithIndividual() {
        // Query the test leads
        List<Lead> testLeads = [SELECT Id,Phone,OwnerId,LeadSource,Business_Start_Date__c,City,Status,
        Country,Email,FirstName,Industry,LastName,Lead_Vendor_ID__c,Lenders__c,Monthly_Revenue__c,PostalCode,Secured_Party__c,
        State,Street,Total_Debt_Amount__c,UCC_filing_Date__c,Formated_Phone__c FROM Lead];
        
        Set<String> phoneToLeads = new Set<String>();
        For(Lead leadInstance : testLeads){
            phoneToLeads.add(leadInstance.phone);
        }

        // Call the method to be tested
        Test.startTest();
        Map<Lead,Individual> result = IndividualHandler.constructLeadsWithIndividual(phoneToLeads,testLeads);
        Test.stopTest();

        // Verify the results
        System.assertEquals(5, result.keySet().size());
        for (Lead lead : result.keySet()) {
            System.assertNotEquals(null, lead.IndividualId);
        }
    }

    @IsTest
    static void testConstructAccountsWithIndividual() {
        // Query the test accounts
        List<Account> testAccounts = [SELECT Id, LastName, Phone,Formatted_Phone__c FROM Account];
        Set<String> phoneToLeads = new Set<String>();

        For(Account leadInstance : testAccounts){
            phoneToLeads.add(leadInstance.phone);
        }

        // Call the method to be tested
        Test.startTest();
        List<Account> result = IndividualHandler.constructAccountsWithIndividual(phoneToLeads,testAccounts);
        Test.stopTest();

        // Verify the results
        System.assertEquals(5, result.size());
        for (Account account : result) {
            System.assertNotEquals(null, account.Individual__c);
        }
    }

    @IsTest
    static void testConstructOpportunitiesWithIndividual() {
        // Query the test opportunities
        List<Opportunity> testOpportunities = [SELECT Id, Name, Phone__c,Formatted_Phone__c, Email__c FROM Opportunity];
        Set<String> phoneToLeads = new Set<String>();
        For(Opportunity leadInstance : testOpportunities){
            phoneToLeads.add(leadInstance.phone__c);
        }

        // Call the method to be tested
        Test.startTest();
        Map<Opportunity,Individual> result = IndividualHandler.constructOpportunitiesWithIndividual(phoneToLeads,testOpportunities);
        Test.stopTest();

        // Verify the results
        System.assertEquals(5, result.keySet().size());
        for (Opportunity opportunity : result.keySet()) {
            System.assertNotEquals(null, opportunity.Individual__c);
        }
    }
}