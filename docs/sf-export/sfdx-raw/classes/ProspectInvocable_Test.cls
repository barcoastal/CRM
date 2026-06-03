@isTest
public class ProspectInvocable_Test {

    @isTest
    static void testDebugProspectValuesWithValidData() {
        // Create a sample ProspectWrapper
        ProspectInvocable.ProspectWrapper prospect = new ProspectInvocable.ProspectWrapper();
        prospect.firstName = 'John';
        prospect.lastName = 'Doe';
        prospect.email = 'john.doe@example.com';
        prospect.company = 'Test Company';
        prospect.phone = '123-456-7890';
        prospect.utmSource = 'google';
        prospect.utmMedium = 'cpc';
        prospect.status = 'New';
        prospect.mobilePhone = '098-765-4321';
        prospect.externalId = 'EXT123';
        prospect.created = '2023-01-01T00:00:00Z';

        // Serialize to JSON
        String prospectJson = JSON.serialize(prospect);

        // Call the invocable method
        Test.startTest();
        ProspectInvocable.debugProspectValues(new List<String>{prospectJson});
        Test.stopTest();

        // Since the method only debugs, we can't assert much, but ensure no exceptions
        // In a real implementation, we would assert the HTTP callout was made
    }

    @isTest
    static void testDebugProspectValuesWithMultipleProspects() {
        // Create multiple prospects
        ProspectInvocable.ProspectWrapper prospect1 = new ProspectInvocable.ProspectWrapper();
        prospect1.firstName = 'Jane';
        prospect1.lastName = 'Smith';
        prospect1.email = 'jane.smith@example.com';

        ProspectInvocable.ProspectWrapper prospect2 = new ProspectInvocable.ProspectWrapper();
        prospect2.firstName = 'Bob';
        prospect2.lastName = 'Johnson';
        prospect2.email = 'bob.johnson@example.com';

        List<String> prospectJsonList = new List<String>{
            JSON.serialize(prospect1),
            JSON.serialize(prospect2)
        };

        Test.startTest();
        ProspectInvocable.debugProspectValues(prospectJsonList);
        Test.stopTest();
    }

    @isTest
    static void testDebugProspectValuesWithEmptyList() {
        Test.startTest();
        ProspectInvocable.debugProspectValues(new List<String>());
        Test.stopTest();
    }

    @isTest
    static void testDebugProspectValuesWithBlankStrings() {
        List<String> prospectJsonList = new List<String>{'', null, '   '};

        Test.startTest();
        ProspectInvocable.debugProspectValues(prospectJsonList);
        Test.stopTest();
    }

    @isTest
    static void testDebugProspectValuesWithInvalidJson() {
        List<String> prospectJsonList = new List<String>{'invalid json'};

        Test.startTest();
        try {
            ProspectInvocable.debugProspectValues(prospectJsonList);
            System.assert(false, 'Expected JSONException');
        } catch (JSONException e) {
            // Expected
        }
        Test.stopTest();
    }
}