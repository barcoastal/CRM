@isTest
private class LeadMassUpdateControllerTest {

    @isTest 
    static void testSaveLeads_success() {
        List<Lead> leads = new List<Lead>{
            new Lead(FirstName='John', LastName='Doe', Company='Acme Inc.', Phone='9876543201'),
            new Lead(FirstName='Jane', LastName='Smith', Company='Acme Inc.', Phone='9876543202')
        };
        insert leads;

        leads[0].Company = 'Updated Acme Inc.';

        ContentNote note = new ContentNote();
        note.Title = 'Test Note';
        note.Content = Blob.valueOf('Test note content');

        LeadMassUpdateController.InputWrapper input = 
            new LeadMassUpdateController.InputWrapper();
        input.leadLists = new List<Lead>{ leads[0] };
        input.noteLists = new List<ContentNote>{ note };

        List<LeadMassUpdateController.InputWrapper> inputs =
            new List<LeadMassUpdateController.InputWrapper>{ input };

        Test.startTest();
            List<LeadMassUpdateController.ResultWrapper> results =
                LeadMassUpdateController.saveLeads(inputs);
        Test.stopTest();

        Lead updatedLead = [
            SELECT Company 
            FROM Lead 
            WHERE Id = :leads[0].Id
        ];
        System.assertEquals(
            'Updated Acme Inc.',
            updatedLead.Company,
            'Lead should be updated'
        );
    }

    @isTest 
    static void testSaveLeads_error() {

        Lead lead = new Lead(
            FirstName='Error',
            LastName='Case',
            Company='Test Inc.',
            Phone='9876543210'
        );
        insert lead;

        lead.Id = null;

        LeadMassUpdateController.InputWrapper input =
            new LeadMassUpdateController.InputWrapper();
        input.leadLists = new List<Lead>{ lead };
        input.noteLists = new List<ContentNote>();

        List<LeadMassUpdateController.InputWrapper> inputs =
            new List<LeadMassUpdateController.InputWrapper>{ input };

        Test.startTest();
            List<LeadMassUpdateController.ResultWrapper> results =
                LeadMassUpdateController.saveLeads(inputs);
        Test.stopTest();

        System.assertNotEquals(null, results);

    }
}