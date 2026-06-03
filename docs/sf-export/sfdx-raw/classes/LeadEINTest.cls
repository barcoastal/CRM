@isTest
public class LeadEINTest {
    
    @TestSetup
    static void makeData(){
        
        // Create a new Lead record without an EIN
        Lead testLead = new Lead(
            FirstName = 'Humppy',
            LastName = 'Dumppy',
            Company = 'XYZ Inc.',
            Phone = '1234567890'
        );
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        insert testLead;
    }
    
    @IsTest
    static void testEINFormat_Blank() {
        // Verify that the EIN field is blank
        Lead testLead = [SELECT EIN_Number_Tax_Id__c FROM Lead LIMIT 1];
        System.assertEquals(null, testLead.EIN_Number_Tax_Id__c	);
    }
    
    @IsTest
    static void testEINFormat_Valid() {
        
        // Update the EIN field with a valid numeric value
        Lead testLead = [SELECT EIN_Number_Tax_Id__c FROM Lead LIMIT 1];
        testLead.EIN_Number_Tax_Id__c = '123456789';
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        update testLead;

        // Verify that the EIN field is updated correctly
        Lead verifyLead = [SELECT EIN_Number_Tax_Id__c FROM Lead LIMIT 1];
        System.assertEquals('123456789', verifyLead.EIN_Number_Tax_Id__c	);
    }

    @IsTest
    static void testEINFormat_InValid() {      
        
        // Update the EIN field with a non-numeric value
        Lead testLead = [SELECT EIN_Number_Tax_Id__c FROM Lead LIMIT 1];
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        testLead.EIN_Number_Tax_Id__c = 'abc123';
        try {
            update testLead;
        } catch (DMLException e) {
            // Verify that an error is thrown due to invalid EIN format
            System.assertEquals('Update failed. First exception on row 0 with id '+testLead.Id+'; first error: FIELD_CUSTOM_VALIDATION_EXCEPTION, Please enter 9 digits values: [EIN_Number_Tax_Id__c]', e.getMessage());
        }
    }

	public class MockHttpResponseGenerator implements HttpCalloutMock {

        public HttpResponse respond(HttpRequest request) {
            return new HttpResponse();
        }
    }    
}