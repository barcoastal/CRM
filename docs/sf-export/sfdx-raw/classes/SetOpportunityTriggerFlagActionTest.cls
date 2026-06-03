@isTest
public class SetOpportunityTriggerFlagActionTest {

    @isTest
    static void testSetPreventTaskFlag() {
        SetOpportunityTriggerFlagAction.setPreventTaskFlag();

        System.assertEquals(true, OpportunityTriggerHandler.preventTaskCreationOnStageChange,
            'Flag should be set to true after calling setPreventTaskFlag');
    }
}